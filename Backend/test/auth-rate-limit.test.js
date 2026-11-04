const assert = require('node:assert/strict');
const express = require('express');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-rate-limit-tests-use-a-32-byte-secret';

const authRouter = require('../routes/auth');
const config = require('../config/env');
const { createAuthRateLimiter } = require('../middleware/authRateLimit');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

let server;
let baseUrl;

before(async () => {
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

function makeRequest(ip = '127.0.0.1') {
  const response = {
    headers: {},
    statusCode: 200,
    body: null,
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let continued = false;

  return {
    req: { ip },
    res: response,
    next() {
      continued = true;
    },
    didContinue() {
      return continued;
    },
  };
}

async function post(path, body) {
  return fetch(`${baseUrl}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: config.frontendOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function assertRateLimited(response) {
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  });
}

test('registration endpoint returns 429 after its per-IP limit', async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await post('register', {});
    assert.equal(response.status, 400);
  }

  await assertRateLimited(await post('register', {}));
});

test('login endpoint returns 429 after its per-IP limit', async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await post('login', {});
    assert.equal(response.status, 400);
  }

  await assertRateLimited(await post('login', {}));
});

test('authentication rate limiter returns a structured 429 and allows requests after the window', () => {
  let currentTime = 1_000;
  const rateLimit = createAuthRateLimiter({
    limit: 1,
    windowMs: 30_000,
    now: () => currentTime,
    cleanupIntervalMs: 0,
  });

  const first = makeRequest();
  rateLimit(first.req, first.res, first.next);
  assert.equal(first.didContinue(), true);

  const limited = makeRequest();
  rateLimit(limited.req, limited.res, limited.next);
  assert.equal(limited.didContinue(), false);
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.res.headers['retry-after'], '30');
  assert.deepEqual(limited.res.body, {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  });

  currentTime += 30_001;
  const afterWindow = makeRequest();
  rateLimit(afterWindow.req, afterWindow.res, afterWindow.next);
  assert.equal(afterWindow.didContinue(), true);
});

test('authentication rate limits are isolated by client IP', () => {
  const rateLimit = createAuthRateLimiter({
    limit: 1,
    windowMs: 30_000,
    cleanupIntervalMs: 0,
  });

  const firstClient = makeRequest('192.0.2.1');
  rateLimit(firstClient.req, firstClient.res, firstClient.next);
  const secondClient = makeRequest('192.0.2.2');
  rateLimit(secondClient.req, secondClient.res, secondClient.next);

  assert.equal(firstClient.didContinue(), true);
  assert.equal(secondClient.didContinue(), true);
});
