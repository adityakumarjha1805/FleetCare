const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function unauthorized(res, message) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
    },
  });
}

function forbidden(res) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'CSRF_CHECK_FAILED',
      message: 'Request origin is not allowed',
    },
  });
}

function getCookieValue(req, name) {
  const cookieHeader = req.get('cookie');
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;

    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization && authorization.match(/^Bearer\s+(\S+)$/i);
  let token;
  let authenticatedByCookie = false;

  if (authorization) {
    if (!match) return unauthorized(res, 'Authentication is required');
    token = match[1];
  } else {
    token = getCookieValue(req, 'fleetcareAccessToken');
    authenticatedByCookie = Boolean(token);
    if (!token) return unauthorized(res, 'Authentication is required');
  }

  if (
    authenticatedByCookie &&
    unsafeMethods.has(req.method) &&
    req.get('origin') !== config.frontendOrigin
  ) {
    return forbidden(res);
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, {
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
