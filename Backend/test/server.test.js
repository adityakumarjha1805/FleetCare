const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const errorHandler = require('../middleware/errorHandler');

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetcare_test';
}
if (!process.env.FRONTEND_ORIGIN) {
  process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
}

const app = require('../app');
let server;
let baseUrl;

before(async () => {
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('health endpoint reports database readiness without exposing configuration', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body, {
    success: false,
    data: {
      status: 'degraded',
      database: { connected: false },
    },
  });
  assert.equal(JSON.stringify(body).includes(process.env.MONGODB_URI), false);
});

test('unknown API routes return a structured 404 response', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(body, {
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

test('malformed JSON is handled by centralized error middleware', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    success: false,
    error: {
      code: 'INVALID_JSON',
      message: 'Request body must contain valid JSON',
    },
  });
});

test('unexpected errors return a generic response without leaking details', () => {
  const response = {
    headersSent: false,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    errorHandler(new Error('private database connection detail'), {}, response, () => {});
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
  assert.equal(JSON.stringify(response.body).includes('private database'), false);
});

test('CORS allows the configured local frontend origin', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: process.env.FRONTEND_ORIGIN },
  });

  assert.equal(
    response.headers.get('access-control-allow-origin'),
    process.env.FRONTEND_ORIGIN,
  );
});
