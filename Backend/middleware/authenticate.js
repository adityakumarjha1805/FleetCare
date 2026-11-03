const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');

function unauthorized(res, message) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
    },
  });
}

async function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization && authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return unauthorized(res, 'Authentication is required');
  }

  let payload;
  try {
    payload = jwt.verify(match[1], config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'fleetcare-api',
      audience: 'fleetcare-client',
    });
  } catch {
    return unauthorized(res, 'Invalid or expired authentication token');
  }

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    !mongoose.isValidObjectId(payload.sub)
  ) {
    return unauthorized(res, 'Invalid or expired authentication token');
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user) {
      return unauthorized(res, 'Invalid or expired authentication token');
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
