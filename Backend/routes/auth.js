const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const emailService = require('../services/emailService');
const {
  generateChallenge,
  generateOtp,
  hashChallenge,
  hashOtp,
  isOtpExpired,
  verifyOtp,
} = require('../utils/emailOtp');
const {
  loginRateLimiter,
  otpResendRateLimiter,
  otpVerificationRateLimiter,
  registrationRateLimiter,
} = require('../middleware/authRateLimit');
const {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  AUTH_COOKIE_CLEAR_OPTIONS,
} = require('../utils/authCookie');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HASHING_SECRET = config.jwtSecret;
const PRIVATE_CHALLENGE_FIELDS = [
  '+emailVerificationOtpHash',
  '+emailVerificationOtpExpiresAt',
  '+emailVerificationChallengeHash',
  '+emailVerificationChallengeExpiresAt',
  '+emailVerificationFailedAttempts',
  '+emailVerificationResendAvailableAt',
  '+emailVerificationResendCount',
].join(' ');
const CHALLENGE_STATE_FIELDS = [
  'emailVerificationOtpHash',
  'emailVerificationOtpExpiresAt',
  'emailVerificationChallengeHash',
  'emailVerificationChallengeExpiresAt',
  'emailVerificationFailedAttempts',
  'emailVerificationResendAvailableAt',
  'emailVerificationResendCount',
];

function invalidInput(res, message) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'INVALID_INPUT',
      message,
    },
  });
}

function invalidCredentials(res) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    },
  });
}

function emailServiceUnavailable(res) {
  return res.status(503).json({
    success: false,
    error: {
      code: 'EMAIL_SERVICE_UNAVAILABLE',
      message: 'Email verification is temporarily unavailable. Please try again later.',
    },
  });
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(email) {
  return email.length <= 254 && emailPattern.test(email);
}

function validPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    Buffer.byteLength(password, 'utf8') <= 72
  );
}

function challengeError(res, message = 'Invalid or expired verification challenge') {
  return res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_CHALLENGE',
      message,
    },
  });
}

function otpError(res) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_OTP',
      message: 'Invalid or expired verification code',
    },
  });
}

function requestHasTrustedOrigin(req) {
  return req.get('origin') === config.frontendOrigin;
}

function issueJwt(user) {
  return jwt.sign(
    { role: user.role },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: user._id.toString(),
      issuer: 'fleetcare-api',
      audience: 'fleetcare-client',
      expiresIn: '1h',
    },
  );
}

async function beginEmailVerification(user) {
  const now = Date.now();
  const challenge = generateChallenge(now);
  const otp = generateOtp(now);
  const challengeHash = hashChallenge(challenge.challengeId, OTP_HASHING_SECRET);
  const otpHash = hashOtp(otp.code, OTP_HASHING_SECRET);
  const update = await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerificationChallengeHash: challengeHash,
        emailVerificationChallengeExpiresAt: challenge.expiresAt,
        emailVerificationOtpHash: otpHash,
        emailVerificationOtpExpiresAt: otp.expiresAt,
        emailVerificationFailedAttempts: 0,
        emailVerificationResendAvailableAt: new Date(
          now + OTP_RESEND_COOLDOWN_MS,
        ),
        emailVerificationResendCount: 0,
      },
    },
  );

  if (update.matchedCount !== 1) {
    throw new Error('Unable to start email verification');
  }

  await emailService.sendOtpVerificationEmail(user.email, otp.code);
  return challenge.challengeId;
}

function clearChallengeState() {
  return Object.fromEntries(CHALLENGE_STATE_FIELDS.map((field) => [field, 1]));
}

router.post('/register', registrationRateLimiter, async (req, res, next) => {
  if (!isRecord(req.body)) {
    return invalidInput(res, 'A JSON object with name, email, and password is required');
  }

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;

  if (
    !name ||
    name.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    !validEmail(email) ||
    !validPassword(password)
  ) {
    return invalidInput(
      res,
      'Provide a valid name, email, and password (8-72 UTF-8 bytes)',
    );
  }

  if (!emailService.isConfigured) {
    return emailServiceUnavailable(res);
  }

  try {
    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists',
        },
      });
    }

    const user = await User.create({
      name,
      email,
      password,
    });
    const challengeId = await beginEmailVerification(user);

    return res.status(201).json({
      success: true,
      data: {
        verificationRequired: true,
        challengeId,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', loginRateLimiter, async (req, res, next) => {
  if (
    !isRecord(req.body) ||
    typeof req.body.email !== 'string' ||
    typeof req.body.password !== 'string' ||
    !req.body.password
  ) {
    return invalidInput(res, 'Email and password are required');
  }

  const email = normalizeEmail(req.body.email);
  if (!validEmail(email)) {
    return invalidCredentials(res);
  }
  if (Buffer.byteLength(req.body.password, 'utf8') > 72) {
    return invalidCredentials(res);
  }

  if (!emailService.isConfigured) {
    return emailServiceUnavailable(res);
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches = user && (await bcrypt.compare(req.body.password, user.password));

    if (!passwordMatches) {
      return invalidCredentials(res);
    }

    const challengeId = await beginEmailVerification(user);
    return res.json({
      success: true,
      data: {
        verificationRequired: true,
        challengeId,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/verify-otp',
  otpVerificationRateLimiter,
  async (req, res, next) => {
    if (!requestHasTrustedOrigin(req)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_CHECK_FAILED',
          message: 'Request origin is not allowed',
        },
      });
    }

    if (
      !isRecord(req.body) ||
      typeof req.body.challengeId !== 'string' ||
      typeof req.body.otp !== 'string'
    ) {
      return invalidInput(res, 'Challenge identifier and verification code are required');
    }

    let challengeHash;
    try {
      challengeHash = hashChallenge(req.body.challengeId, OTP_HASHING_SECRET);
    } catch {
      return challengeError(res);
    }

    try {
      const user = await User.findOne({
        emailVerificationChallengeHash: challengeHash,
        emailVerificationChallengeExpiresAt: { $gt: new Date() },
      }).select(PRIVATE_CHALLENGE_FIELDS);

      if (!user || !user.emailVerificationOtpHash) {
        return challengeError(res);
      }

      const now = new Date();
      if (
        isOtpExpired(user.emailVerificationOtpExpiresAt, now.getTime()) ||
        user.emailVerificationFailedAttempts >= MAX_OTP_ATTEMPTS
      ) {
        return otpError(res);
      }

      if (
        !verifyOtp(
          req.body.otp,
          user.emailVerificationOtpHash,
          OTP_HASHING_SECRET,
        )
      ) {
        await User.updateOne(
          {
            _id: user._id,
            emailVerificationChallengeHash: challengeHash,
            emailVerificationChallengeExpiresAt: { $gt: now },
            emailVerificationOtpHash: user.emailVerificationOtpHash,
            emailVerificationOtpExpiresAt: { $gt: now },
            emailVerificationFailedAttempts: { $lt: MAX_OTP_ATTEMPTS },
          },
          { $inc: { emailVerificationFailedAttempts: 1 } },
        );
        await User.updateOne(
          {
            _id: user._id,
            emailVerificationChallengeHash: challengeHash,
            emailVerificationFailedAttempts: { $gte: MAX_OTP_ATTEMPTS },
          },
          {
            $unset: {
              emailVerificationOtpHash: 1,
              emailVerificationOtpExpiresAt: 1,
            },
          },
        );
        return otpError(res);
      }

      const verifiedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          emailVerificationChallengeHash: challengeHash,
          emailVerificationChallengeExpiresAt: { $gt: now },
          emailVerificationOtpHash: user.emailVerificationOtpHash,
          emailVerificationOtpExpiresAt: { $gt: now },
          emailVerificationFailedAttempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        {
          $set: { emailVerified: true },
          $unset: clearChallengeState(),
        },
        { new: true },
      );

      if (!verifiedUser) {
        return otpError(res);
      }

      res.cookie(AUTH_COOKIE_NAME, issueJwt(verifiedUser), AUTH_COOKIE_OPTIONS);
      return res.json({
        success: true,
        data: {
          user: safeUser(verifiedUser),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post('/resend-otp', otpResendRateLimiter, async (req, res, next) => {
  if (!requestHasTrustedOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_CHECK_FAILED',
        message: 'Request origin is not allowed',
      },
    });
  }

  if (
    !isRecord(req.body) ||
    typeof req.body.challengeId !== 'string'
  ) {
    return invalidInput(res, 'Challenge identifier is required');
  }

  if (!emailService.isConfigured) {
    return emailServiceUnavailable(res);
  }

  let challengeHash;
  try {
    challengeHash = hashChallenge(req.body.challengeId, OTP_HASHING_SECRET);
  } catch {
    return challengeError(res);
  }

  try {
    const user = await User.findOne({
      emailVerificationChallengeHash: challengeHash,
      emailVerificationChallengeExpiresAt: { $gt: new Date() },
    }).select(PRIVATE_CHALLENGE_FIELDS);

    if (!user) {
      return challengeError(res);
    }

    const now = new Date();
    if (user.emailVerificationResendCount >= MAX_OTP_RESENDS) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'OTP_RESEND_LIMIT_EXCEEDED',
          message: 'Too many verification code requests. Please try again later.',
        },
      });
    }
    if (
      user.emailVerificationResendAvailableAt &&
      user.emailVerificationResendAvailableAt > now
    ) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (user.emailVerificationResendAvailableAt.getTime() - now.getTime()) /
            1000,
        ),
      );
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        error: {
          code: 'OTP_RESEND_COOLDOWN',
          message: 'Please wait before requesting another verification code.',
        },
      });
    }

    const otp = generateOtp(now.getTime());
    const update = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerificationChallengeHash: challengeHash,
        emailVerificationChallengeExpiresAt: { $gt: now },
        emailVerificationResendAvailableAt: { $lte: now },
        emailVerificationResendCount: { $lt: MAX_OTP_RESENDS },
      },
      {
        $set: {
          emailVerificationOtpHash: hashOtp(otp.code, OTP_HASHING_SECRET),
          emailVerificationOtpExpiresAt: otp.expiresAt,
          emailVerificationFailedAttempts: 0,
          emailVerificationResendAvailableAt: new Date(
            now.getTime() + OTP_RESEND_COOLDOWN_MS,
          ),
        },
        $inc: { emailVerificationResendCount: 1 },
      },
      { new: true },
    );

    if (!update) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'OTP_RESEND_COOLDOWN',
          message: 'Please wait before requesting another verification code.',
        },
      });
    }

    await emailService.sendOtpVerificationEmail(user.email, otp.code);
    return res.json({
      success: true,
      data: { verificationRequired: true },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  if (!requestHasTrustedOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_CHECK_FAILED',
        message: 'Request origin is not allowed',
      },
    });
  }

  return res
    .clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_CLEAR_OPTIONS)
    .json({ success: true, data: { loggedOut: true } });
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

module.exports = router;
