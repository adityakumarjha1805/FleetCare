const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-auth-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const emailService = require('../services/emailService');
const { OTP_TTL_MS } = require('../utils/emailOtp');
const User = require('../models/User');

const users = new Map();
const sentOtps = [];
const originals = {
  findOne: User.findOne,
  findById: User.findById,
  findOneAndUpdate: User.findOneAndUpdate,
  updateOne: User.updateOne,
  create: User.create,
  emailServiceConfigured: emailService.isConfigured,
  sendOtpVerificationEmail: emailService.sendOtpVerificationEmail,
};
let server;
let baseUrl;
let requestSequence = 0;

function isMatch(user, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = user[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$gt' in expected) return actual > expected.$gt;
      if ('$gte' in expected) return actual >= expected.$gte;
      if ('$lt' in expected) return actual < expected.$lt;
      if ('$lte' in expected) return actual <= expected.$lte;
    }
    if (key === '_id') return actual?.toString() === expected.toString();
    return actual === expected;
  });
}

function queryFor(user) {
  return {
    select: async () => user,
    then(resolve, reject) {
      return Promise.resolve(user).then(resolve, reject);
    },
  };
}

function findUser(filter) {
  return [...users.values()].find((user) => isMatch(user, filter)) || null;
}

function applyUpdate(user, update) {
  for (const [key, value] of Object.entries(update.$set || {})) {
    user[key] = value;
  }
  for (const [key, value] of Object.entries(update.$inc || {})) {
    user[key] = (user[key] || 0) + value;
  }
  for (const key of Object.keys(update.$unset || {})) {
    delete user[key];
  }
}

function makeRequestHeaders(headers = {}) {
  return {
    'Content-Type': 'application/json',
    Origin: config.frontendOrigin,
    'X-Forwarded-For': `198.51.100.${(requestSequence++ % 254) + 1}`,
    ...headers,
  };
}

before(async () => {
  app.set('trust proxy', true);
  User.findOne = (filter) => queryFor(findUser(filter));
  emailService.isConfigured = true;
  User.findById = async (id) =>
    [...users.values()].find((user) => user._id.toString() === id) || null;
  User.create = async (fields) => {
    const user = {
      ...fields,
      password: await bcrypt.hash(fields.password, 12),
      _id: new mongoose.Types.ObjectId(),
      role: 'user',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(user.email, user);
    return user;
  };
  User.updateOne = async (filter, update) => {
    const user = findUser(filter);
    if (!user) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(user, update);
    return { matchedCount: 1, modifiedCount: 1 };
  };
  User.findOneAndUpdate = (filter, update) => {
    const user = findUser(filter);
    if (!user) return queryFor(null);
    applyUpdate(user, update);
    return queryFor(user);
  };
  emailService.sendOtpVerificationEmail = async (recipient, code) => {
    sentOtps.push({ recipient, code });
  };

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  User.findOne = originals.findOne;
  User.findById = originals.findById;
  User.findOneAndUpdate = originals.findOneAndUpdate;
  User.updateOne = originals.updateOne;
  User.create = originals.create;
  emailService.isConfigured = originals.emailServiceConfigured;
  emailService.sendOtpVerificationEmail = originals.sendOtpVerificationEmail;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function post(path, body, headers = {}) {
  return fetch(`${baseUrl}/api/auth/${path}`, {
    method: 'POST',
    headers: makeRequestHeaders(headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function register(email, name = 'Fleet Manager', password = 'FleetCare123') {
  const response = await post('register', { name, email, password });
  return { response, body: await response.json() };
}

async function login(email = 'manager@example.com', password = 'FleetCare123') {
  const response = await post('login', { email, password });
  return { response, body: await response.json() };
}

async function verify(challengeId, otp, headers = {}) {
  return post('verify-otp', { challengeId, otp }, headers);
}

function latestOtp(email) {
  return [...sentOtps].reverse().find((sent) => sent.recipient === email)?.code;
}

function assertNoAuthCookie(response) {
  assert.equal(response.headers.get('set-cookie'), null);
}

test('registration validates input, hashes passwords, and sends an OTP without verifying the account', async () => {
  const { response, body } = await register(
    '  Manager@Example.com ',
    '  Fleet Manager  ',
  );
  const storedUser = users.get('manager@example.com');

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.verificationRequired, true);
  assert.match(body.data.challengeId, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Object.hasOwn(body.data, 'user'), false);
  assert.equal(storedUser.name, 'Fleet Manager');
  assert.equal(storedUser.emailVerified, false);
  assert.notEqual(storedUser.emailVerificationChallengeHash, body.data.challengeId);
  assert.equal(Object.hasOwn(body.data, 'otp'), false);
  assert.equal(Object.hasOwn(body.data, 'emailVerificationOtpHash'), false);
  assert.notEqual(storedUser.password, 'FleetCare123');
  assert.equal(await bcrypt.compare('FleetCare123', storedUser.password), true);
  assert.match(storedUser.emailVerificationOtpHash, /^[a-f\d]{64}$/);
  assert.equal(storedUser.emailVerificationOtpHash.includes(latestOtp(storedUser.email)), false);
  assert.equal(
    storedUser.emailVerificationOtpExpiresAt.getTime() -
      storedUser.emailVerificationResendAvailableAt.getTime(),
    OTP_TTL_MS - 60_000,
  );
  assertNoAuthCookie(response);
});

test('registration rejects duplicate normalized emails and invalid fields', async () => {
  const duplicate = await register('MANAGER@example.com', 'Another Manager');
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_REGISTERED');

  const invalidCases = [
    { name: '', email: 'valid@example.com', password: 'FleetCare123' },
    { name: 'Name', email: 'not-an-email', password: 'FleetCare123' },
    { name: 'Name', email: 'valid@example.com', password: 'short' },
    { name: 'Name', email: 'valid@example.com', password: 'x'.repeat(73) },
  ];

  for (const body of invalidCases) {
    const response = await post('register', body);
    assert.equal(response.status, 400);
  }
});

test('login with correct credentials initiates OTP and does not issue a JWT', async () => {
  const { response, body } = await login(' MANAGER@EXAMPLE.COM ');

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.verificationRequired, true);
  assert.match(body.data.challengeId, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Object.hasOwn(body.data, 'user'), false);
  assert.equal(Object.hasOwn(body.data, 'token'), false);
  assertNoAuthCookie(response);
});

test('login rejects an incorrect password and unknown account with the same generic error', async () => {
  const wrongPassword = await login('manager@example.com', 'WrongPassword123');
  const unknownAccount = await login('unknown@example.com');

  assert.equal(wrongPassword.response.status, 401);
  assert.deepEqual(wrongPassword.body.error, {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
  assert.deepEqual(unknownAccount.body.error, wrongPassword.body.error);
  assertNoAuthCookie(wrongPassword.response);
  assertNoAuthCookie(unknownAccount.response);
});

test('registration and login return service unavailable before work when SMTP is not configured', async () => {
  emailService.isConfigured = false;
  try {
    const loginResponse = await login('manager@example.com');
    const registration = await register(
      'smtp-unavailable@example.com',
      'New Driver',
    );

    assert.equal(loginResponse.response.status, 503);
    assert.deepEqual(loginResponse.body.error, {
      code: 'EMAIL_SERVICE_UNAVAILABLE',
      message: 'Email verification is temporarily unavailable. Please try again later.',
    });
    assert.equal(registration.response.status, 503);
    assert.deepEqual(registration.body.error, {
      code: 'EMAIL_SERVICE_UNAVAILABLE',
      message: 'Email verification is temporarily unavailable. Please try again later.',
    });
    assert.equal(users.has('smtp-unavailable@example.com'), false);
  } finally {
    emailService.isConfigured = true;
  }
});

test('successful verification issues an HttpOnly JWT cookie and a safe profile', async () => {
  const { body: loginBody } = await login();
  const response = await verify(loginBody.data.challengeId, latestOtp('manager@example.com'));
  const body = await response.json();
  const setCookie = response.headers.get('set-cookie');
  const token = setCookie.match(/fleetcareAccessToken=([^;]+)/)?.[1];
  const claims = jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });
  const storedUser = users.get('manager@example.com');

  assert.equal(response.status, 200);
  assert.equal(storedUser.emailVerified, true);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api/i);
  assert.equal(claims.sub, storedUser._id.toString());
  assert.equal(Object.hasOwn(body.data, 'token'), false);
  assert.equal(Object.hasOwn(body.data.user, 'password'), false);
  assert.equal(Object.hasOwn(body.data.user, 'emailVerificationOtpHash'), false);
  assert.deepEqual(Object.keys(body.data.user).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
    'role',
    'updatedAt',
  ]);
  assert.equal(storedUser.emailVerificationOtpHash, undefined);
  assert.equal(storedUser.emailVerificationChallengeHash, undefined);
});

test('incorrect OTP attempts are limited and the OTP is invalidated at the limit', async () => {
  const { body } = await login();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await verify(body.data.challengeId, '000000');
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'INVALID_OTP');
  }

  const storedUser = users.get('manager@example.com');
  assert.equal(storedUser.emailVerificationFailedAttempts, 5);
  assert.equal(storedUser.emailVerificationOtpHash, undefined);

  const correctOtpAfterLimit = await verify(
    body.data.challengeId,
    latestOtp('manager@example.com'),
  );
  assert.equal(correctOtpAfterLimit.status, 401);
  assertNoAuthCookie(correctOtpAfterLimit);
});

test('expired OTP is rejected', async () => {
  const { body } = await login();
  users.get('manager@example.com').emailVerificationOtpExpiresAt = new Date(
    Date.now() - 1,
  );

  const response = await verify(
    body.data.challengeId,
    latestOtp('manager@example.com'),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'INVALID_OTP');
  assertNoAuthCookie(response);
});

test('a successfully verified OTP cannot be reused', async () => {
  const { body } = await login();
  const otp = latestOtp('manager@example.com');
  const first = await verify(body.data.challengeId, otp);
  const reuse = await verify(body.data.challengeId, otp);

  assert.equal(first.status, 200);
  assert.equal(reuse.status, 401);
  assert.equal((await reuse.json()).error.code, 'INVALID_CHALLENGE');
  assertNoAuthCookie(reuse);
});

test('resend enforces cooldown, replaces the prior OTP, and limits requests', async () => {
  const { body } = await login();
  const user = users.get('manager@example.com');
  const firstOtp = latestOtp(user.email);

  const immediateResend = await post('resend-otp', {
    challengeId: body.data.challengeId,
  });
  assert.equal(immediateResend.status, 429);
  assert.equal(
    (await immediateResend.json()).error.code,
    'OTP_RESEND_COOLDOWN',
  );

  for (let resend = 0; resend < 5; resend += 1) {
    user.emailVerificationResendAvailableAt = new Date(Date.now() - 1);
    const response = await post('resend-otp', {
      challengeId: body.data.challengeId,
    });
    assert.equal(response.status, 200);
  }
  assert.equal(user.emailVerificationResendCount, 5);

  user.emailVerificationResendAvailableAt = new Date(Date.now() - 1);
  const overLimit = await post('resend-otp', {
    challengeId: body.data.challengeId,
  });
  assert.equal(overLimit.status, 429);
  assert.equal(
    (await overLimit.json()).error.code,
    'OTP_RESEND_LIMIT_EXCEEDED',
  );
  assert.notEqual(latestOtp(user.email), firstOtp);

  const oldOtp = await verify(body.data.challengeId, firstOtp);
  assert.equal(oldOtp.status, 401);
  assertNoAuthCookie(oldOtp);
});

test('challenge verification enforces the configured frontend origin', async () => {
  const { body } = await login();
  const response = await verify(
    body.data.challengeId,
    latestOtp('manager@example.com'),
    { Origin: 'https://untrusted.example' },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'CSRF_CHECK_FAILED');
  assertNoAuthCookie(response);
});

test('verified users access protected APIs; unverified and deleted users are rejected', async () => {
  const { body } = await login();
  const otp = latestOtp('manager@example.com');
  const verification = await verify(body.data.challengeId, otp);
  const cookie = verification.headers.get('set-cookie').split(';')[0];

  const authorized = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authorized.status, 200);

  const unverified = await register('unverified@example.com');
  const unverifiedUser = users.get('unverified@example.com');
  const unverifiedToken = jwt.sign(
    {},
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: unverifiedUser._id.toString(),
      issuer: 'fleetcare-api',
      audience: 'fleetcare-client',
      expiresIn: '1h',
    },
  );
  const deniedUnverified = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${unverifiedToken}` },
  });
  assert.equal(unverified.response.status, 201);
  assert.equal(deniedUnverified.status, 401);

  const deletedUser = users.get('manager@example.com');
  users.delete('manager@example.com');
  const deniedDeleted = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(deniedDeleted.status, 401);
  users.set('manager@example.com', deletedUser);
});

test('invalid and expired JWTs are rejected', async () => {
  const expiredToken = jwt.sign(
    {},
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: users.get('manager@example.com')._id.toString(),
      issuer: 'fleetcare-api',
      audience: 'fleetcare-client',
      expiresIn: -1,
    },
  );
  const cases = [
    { headers: {} },
    { headers: { Authorization: 'Bearer invalid' } },
    { headers: { Authorization: `Bearer ${expiredToken}` } },
  ];

  for (const options of cases) {
    const response = await fetch(`${baseUrl}/api/auth/me`, options);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
  }
});

test('cookie-authenticated writes and logout enforce CSRF origin checks', async () => {
  const { body } = await login();
  const verification = await verify(
    body.data.challengeId,
    latestOtp('manager@example.com'),
  );
  const cookie = verification.headers.get('set-cookie').split(';')[0];

  const rejectedWrite = await fetch(`${baseUrl}/api/vehicles`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      Origin: 'https://untrusted.example',
    },
    body: JSON.stringify({}),
  });
  assert.equal(rejectedWrite.status, 403);

  const trustedWrite = await fetch(`${baseUrl}/api/vehicles`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      Origin: config.frontendOrigin,
    },
    body: JSON.stringify({}),
  });
  assert.notEqual(trustedWrite.status, 403);

  const deniedLogout = await post('logout', undefined, {
    Origin: 'https://untrusted.example',
  });
  assert.equal(deniedLogout.status, 403);

  const logout = await post('logout');
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /fleetcareAccessToken=/);
  assert.match(logout.headers.get('set-cookie'), /Path=\/api/i);
  assert.match(logout.headers.get('set-cookie'), /Expires=/i);
});
