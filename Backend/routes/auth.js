const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const { loginRateLimiter, registrationRateLimiter } = require('../middleware/authRateLimit');
const {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  AUTH_COOKIE_CLEAR_OPTIONS,
} = require('../utils/authCookie');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function safeUser(user) {
  const safe = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    onboardingCompleted: user.onboardingCompleted !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  return safe;
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

function requestHasTrustedOrigin(req) {
  return config.isAllowedFrontendOrigin(req.get('origin'));
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

function isEmailDuplicateKey(error) {
  return (
    error.code === 11000 &&
    error.keyPattern &&
    Object.keys(error.keyPattern).length === 1 &&
    error.keyPattern.email === 1
  );
}

function emailAlreadyRegistered(res) {
  return res.status(409).json({
    success: false,
    error: {
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'Account already exists. Please sign in.',
    },
  });
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

  try {
    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) {
      return emailAlreadyRegistered(res);
    }

    const user = await User.create({
      name,
      email,
      password,
      onboardingCompleted: true,
    });
    return res.status(201).json({
      success: true,
      data: {
        user: safeUser(user),
      },
    });
  } catch (error) {
    if (isEmailDuplicateKey(error)) {
      try {
        const existingUser = await User.findOne({ email }).select('_id');
        if (existingUser) {
          return emailAlreadyRegistered(res);
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    return next(error);
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

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches =
      user && (await bcrypt.compare(req.body.password, user.password));

    if (!passwordMatches) {
      return invalidCredentials(res);
    }

    res.cookie(AUTH_COOKIE_NAME, issueJwt(user), AUTH_COOKIE_OPTIONS);
    return res.json({
      success: true,
      data: {
        user: safeUser(user),
      },
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

router.post('/onboarding/complete', authenticate, async (req, res, next) => {
  if (!isRecord(req.body) || Object.keys(req.body).length !== 0) {
    return invalidInput(res, 'An empty JSON object is required');
  }

  if (!mongoose.isValidObjectId(req.user.id)) {
    return invalidInput(res, 'A valid authenticated user is required');
  }

  try {
    const result = await User.updateOne(
      { _id: req.user.id },
      { $set: { onboardingCompleted: true } },
    );
    if (result.matchedCount !== 1) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        user: { ...req.user, onboardingCompleted: true },
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
