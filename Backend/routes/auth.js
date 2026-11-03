const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const {
  loginRateLimiter,
  registrationRateLimiter,
} = require('../middleware/authRateLimit');

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

    return res.status(201).json({
      success: true,
      data: {
        user: safeUser(user),
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

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches = user && (await bcrypt.compare(req.body.password, user.password));

    if (!passwordMatches) {
      return invalidCredentials(res);
    }

    const token = jwt.sign(
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

    return res.json({
      success: true,
      data: {
        token,
        user: safeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
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
