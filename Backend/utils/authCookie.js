const config = require('../config/env');

const AUTH_COOKIE_NAME = 'fleetcareAccessToken';
const AUTH_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: config.authCookieSecure,
  sameSite: config.authCookieSameSite,
  path: '/api',
  maxAge: 60 * 60 * 1000,
});
const AUTH_COOKIE_CLEAR_OPTIONS = Object.freeze({
  httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
  secure: AUTH_COOKIE_OPTIONS.secure,
  sameSite: AUTH_COOKIE_OPTIONS.sameSite,
  path: AUTH_COOKIE_OPTIONS.path,
});

module.exports = {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  AUTH_COOKIE_CLEAR_OPTIONS,
};
