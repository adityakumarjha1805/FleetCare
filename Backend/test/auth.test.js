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
const originalFindOne = User.findOne;
const originalFindById = User.findById;
const originalCreate = User.create;
let server;
let baseUrl;

function queryFor(user) {
  return {
    select: async () => user,
  };
}

before(async () => {
  User.findOne = (filter) => {
    const user = users.get(filter.email) || null;
    return queryFor(user);
  };
  User.findById = async (id) => {
    return [...users.values()].find((user) => user._id.toString() === id) || null;
  };
  User.create = async (fields) => {
    const user = {
      ...fields,
      password: await bcrypt.hash(fields.password, 12),
      _id: new mongoose.Types.ObjectId(),
      role: 'user',
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
  User.findOne = originalFindOne;
  User.findById = originalFindById;
  User.create = originalCreate;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function post(path, body) {
  return fetch(`${baseUrl}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('registration validates input, normalizes email, and stores only a password hash', async () => {
  const response = await post('register', {
    name: '  Fleet Manager  ',
    email: '  Manager@Example.com ',
    password: 'FleetCare123',
    role: 'admin',
  });
  const body = await response.json();
  const storedUser = users.get('manager@example.com');

  assert.equal(response.status, 201);
  assert.deepEqual(body.data.user, {
    id: storedUser._id.toString(),
    name: 'Fleet Manager',
    email: 'manager@example.com',
    role: 'user',
    createdAt: storedUser.createdAt.toISOString(),
    updatedAt: storedUser.updatedAt.toISOString(),
  });
  assert.equal(Object.hasOwn(body.data.user, 'password'), false);
  assert.notEqual(storedUser.password, 'FleetCare123');
  assert.equal(await bcrypt.compare('FleetCare123', storedUser.password), true);
});

test('registration rejects duplicate normalized emails', async () => {
  const response = await post('register', {
    name: 'Another Manager',
    email: 'MANAGER@example.com',
    password: 'FleetCare123',
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error.code, 'EMAIL_ALREADY_REGISTERED');
});

test('registration rejects invalid fields and weak passwords', async () => {
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

test('login returns a signed token and safe user profile', async () => {
  const response = await post('login', {
    email: ' MANAGER@EXAMPLE.COM ',
    password: 'FleetCare123',
  });
  const body = await response.json();
  const claims = jwt.verify(body.data.token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });

  assert.equal(response.status, 200);
  assert.equal(claims.sub, users.get('manager@example.com')._id.toString());
  assert.equal(Object.hasOwn(body.data.user, 'password'), false);
  assert.deepEqual(Object.keys(body.data.user).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
    'role',
    'updatedAt',
  ]);
});

test('login rejects wrong passwords with generic credentials errors', async () => {
  const response = await post('login', {
    email: 'manager@example.com',
    password: 'WrongPassword123',
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body.error, {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
});

test("login rejects passwords beyond bcrypt's 72-byte input limit", async () => {
  const password = 'x'.repeat(72);
  const registration = await post('register', {
    name: 'Password Limit',
    email: 'password-limit@example.com',
    password,
  });
  assert.equal(registration.status, 201);

  const response = await post('login', {
    email: 'password-limit@example.com',
    password: `${password}extra`,
  });

  assert.equal(response.status, 401);
});

test('current-user endpoint rejects missing, invalid, and expired tokens', async () => {
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
    { headers: { Authorization: 'Bearer invalid-token' } },
    { headers: { Authorization: `Bearer ${expiredToken}` } },
  ];

  for (const options of cases) {
    const response = await fetch(`${baseUrl}/api/auth/me`, options);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
  }
});

test('current-user endpoint returns the authenticated profile, not a client-supplied ID', async () => {
  const registration = await post('register', {
    name: 'Second Manager',
    email: 'second@example.com',
    password: 'FleetCare123',
  });
  assert.equal(registration.status, 201);

  const login = await post('login', {
    email: 'second@example.com',
    password: 'FleetCare123',
  });
  const { token } = (await login.json()).data;
  const response = await fetch(
    `${baseUrl}/api/auth/me?userId=${users.get('manager@example.com')._id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.user.email, 'second@example.com');
  assert.equal(body.data.user.id, users.get('second@example.com')._id.toString());
  assert.equal(Object.hasOwn(body.data.user, 'password'), false);
});
