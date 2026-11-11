const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-auth-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const User = require('../models/User');

const users = new Map();
const originals = {
  findOne: User.findOne,
  findById: User.findById,
  create: User.create,
  updateOne: User.updateOne,
};
let server;
let baseUrl;
let requestSequence = 0;

function isMatch(user, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '_id') return user._id.toString() === expected.toString();
    return user[key] === expected;
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

function makeRequestHeaders(headers = {}) {
  return {
    'Content-Type': 'application/json',
    Origin: config.frontendOrigin,
    'X-Forwarded-For': `198.51.100.${(requestSequence++ % 254) + 1}`,
    ...headers,
  };
}

function duplicateKeyError(field, value) {
  return Object.assign(new Error('Duplicate key'), {
    code: 11000,
    keyPattern: { [field]: 1 },
    keyValue: { [field]: value },
  });
}

before(async () => {
  app.set('trust proxy', true);
  User.findOne = (filter) => queryFor(findUser(filter));
  User.findById = async (id) =>
    [...users.values()].find((user) => user._id.toString() === id) || null;
  User.updateOne = async (filter, update) => {
    const user = findUser(filter);
    if (!user) return { matchedCount: 0 };
    Object.assign(user, update.$set);
    return { matchedCount: 1 };
  };
  User.create = async (fields) => {
    if (users.has(fields.email)) {
      throw Object.assign(new Error('Duplicate email index'), {
        code: 11000,
        keyPattern: { email: 1 },
        keyValue: { email: fields.email },
      });
    }

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

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  User.findOne = originals.findOne;
  User.findById = originals.findById;
  User.create = originals.create;
  User.updateOne = originals.updateOne;

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

async function login(email, password = 'FleetCare123') {
  const response = await post('login', { email, password });
  return { response, body: await response.json() };
}

test('registration normalizes email, hashes password, creates one account, and issues no session', async () => {
  const email = `new-account-${Date.now()}@example.test`;
  const countBefore = users.size;
  const { response, body } = await register(` ${email.toUpperCase()} `);
  const user = users.get(email);

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.deepEqual(body.data.user, {
    id: user._id.toString(),
    name: 'Fleet Manager',
    email,
    role: 'user',
    onboardingCompleted: true,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
  assert.equal(users.size, countBefore + 1);
  assert.equal(user.email, email);
  assert.equal(user.onboardingCompleted, true);
  assert.notEqual(user.password, 'FleetCare123');
  assert.equal(await bcrypt.compare('FleetCare123', user.password), true);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('registration rejects repeated normalized email without creating a duplicate', async () => {
  const email = `duplicate-${Date.now()}@example.test`;
  await register(email);
  const countAfterFirst = users.size;

  const duplicate = await register(` ${email.toUpperCase()} `);

  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_REGISTERED');
  assert.equal(
    duplicate.body.error.message,
    'Account already exists. Please sign in.',
  );
  assert.equal(users.size, countAfterFirst);
});

test('registration handles an email unique-index race without creating a second account', async () => {
  const email = `registration-race-${Date.now()}@example.test`;
  const existingUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Existing Manager',
    email,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.set(email, existingUser);
  const previousFindOne = User.findOne;
  const previousCreate = User.create;
  let lookupCount = 0;

  User.findOne = (filter) => {
    if (filter.email === email) {
      lookupCount += 1;
      return queryFor(lookupCount === 1 ? null : existingUser);
    }
    return previousFindOne(filter);
  };
  User.create = async () => {
    throw Object.assign(new Error('Duplicate email index'), {
      code: 11000,
      keyPattern: { email: 1 },
      keyValue: { email },
    });
  };

  try {
    const countBefore = users.size;
    const { response, body } = await register(email.toUpperCase());

    assert.equal(response.status, 409);
    assert.equal(body.error.code, 'EMAIL_ALREADY_REGISTERED');
    assert.equal(users.size, countBefore);
    assert.equal(users.get(email), existingUser);
  } finally {
    User.findOne = previousFindOne;
    User.create = previousCreate;
  }
});

test('registration does not report unrelated unique-index conflicts as email duplicates', async () => {
  const email = `unrelated-index-${Date.now()}@example.test`;
  const previousCreate = User.create;
  const previousConsoleError = console.error;
  const countBefore = users.size;

  User.create = async () => {
    throw duplicateKeyError('externalId', 'collision');
  };
  console.error = () => {};

  try {
    const { response, body } = await register(email);

    assert.equal(response.status, 500);
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(body.error.message, 'An unexpected error occurred');
    assert.equal(users.size, countBefore);
  } finally {
    User.create = previousCreate;
    console.error = previousConsoleError;
  }
});

test('registration validates input before creating a user', async () => {
  const invalidCases = [
    { name: '', email: 'valid@example.test', password: 'FleetCare123' },
    { name: 'Name', email: 'not-an-email', password: 'FleetCare123' },
    { name: 'Name', email: 'valid@example.test', password: 'short' },
    { name: 'Name', email: 'valid@example.test', password: 'x'.repeat(73) },
  ];

  for (const body of invalidCases) {
    const countBefore = users.size;
    const response = await post('register', body);
    assert.equal(response.status, 400);
    assert.equal(users.size, countBefore);
  }
});

test('login accepts a legacy unverified account and issues a secure session cookie', async () => {
  const email = `legacy-${Date.now()}@example.test`;
  const registration = await register(email);
  const user = users.get(email);
  user.emailVerified = false;
  delete user.onboardingCompleted;

  const { response, body } = await login(` ${email.toUpperCase()} `);
  const cookie = response.headers.get('set-cookie');
  const token = cookie.match(/fleetcareAccessToken=([^;]+)/)?.[1];
  const claims = jwt.verify(decodeURIComponent(token), config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });

  assert.equal(registration.response.status, 201);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.user.email, email);
  assert.equal(body.data.user.onboardingCompleted, true);
  assert.equal(claims.sub, user._id.toString());
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api/i);
  assert.equal(user.emailVerified, false);

  const authenticated = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  const sessionBody = await authenticated.json();
  assert.equal(authenticated.status, 200);
  assert.equal(sessionBody.data.user.email, email);
  assert.equal(sessionBody.data.user.onboardingCompleted, true);
});

test('login rejects an incorrect password and unknown account with the same error', async () => {
  const email = `login-check-${Date.now()}@example.test`;
  await register(email);

  const wrongPassword = await login(email, 'WrongPassword123');
  const unknownAccount = await login(`unknown-${email}`);

  assert.equal(wrongPassword.response.status, 401);
  assert.deepEqual(wrongPassword.body.error, {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
  assert.deepEqual(unknownAccount.body.error, wrongPassword.body.error);
  assert.equal(wrongPassword.response.headers.get('set-cookie'), null);
  assert.equal(unknownAccount.response.headers.get('set-cookie'), null);
});

test('OTP routes are removed', async () => {
  const verification = await post('verify-otp', {});
  const resend = await post('resend-otp', {});

  assert.equal(verification.status, 404);
  assert.equal(resend.status, 404);
});

test('invalid and expired JWTs are rejected', async () => {
  const user = [...users.values()][0];
  const expiredToken = jwt.sign(
    {},
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: user._id.toString(),
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
  const email = `csrf-${Date.now()}@example.test`;
  await register(email);
  const { response: loginResponse } = await login(email);
  const cookie = loginResponse.headers.get('set-cookie').split(';')[0];

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
