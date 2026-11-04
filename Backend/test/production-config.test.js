const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function runProductionScript(script, overrides = {}) {
  return spawnSync(
    process.execPath,
    ['-e', script],
    {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/fleetcare?tls=true',
        FRONTEND_ORIGIN: 'https://fleetcare.example',
        JWT_SECRET: 'production-config-test-secret-32-bytes',
        RESEND_API_KEY: '',
        RESEND_FROM: '',
        ...overrides,
      },
    },
  );
}

function loadProductionConfig(overrides = {}) {
  return runProductionScript("require('./config/env')", overrides);
}

function withoutResend(overrides = {}) {
  return {
    RESEND_API_KEY: '',
    RESEND_FROM: '',
    ...overrides,
  };
}

test('production configuration requires an HTTPS frontend origin', () => {
  const result = loadProductionConfig({
    FRONTEND_ORIGIN: 'http://fleetcare.example',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FRONTEND_ORIGIN must use HTTPS in production/);
});

test('production configuration requires TLS for mongodb connection strings', () => {
  const result = loadProductionConfig({
    MONGODB_URI: 'mongodb://127.0.0.1:27017/fleetcare',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MONGODB_URI must enable TLS in production/);
});

test('production configuration accepts HTTPS and TLS-enabled MongoDB settings', () => {
  const result = loadProductionConfig();

  assert.equal(result.status, 0, result.stderr);
});

test('production authentication cookies are Secure and support approved cross-site mode', () => {
  const result = runProductionScript(
    "const {AUTH_COOKIE_OPTIONS}=require('./utils/authCookie'); if (!AUTH_COOKIE_OPTIONS.secure || !AUTH_COOKIE_OPTIONS.httpOnly || AUTH_COOKIE_OPTIONS.sameSite !== 'none') process.exit(1)",
    { AUTH_COOKIE_SAME_SITE: 'None' },
  );

  assert.equal(result.status, 0, result.stderr);
});

test('Resend configuration accepts a complete API key and sender', () => {
  const result = runProductionScript(
    "const {resend}=require('./config/env'); if (!resend || resend.apiKey !== 're_test_api_key' || resend.from !== 'FleetCare <no-reply@example.com>') process.exit(1)",
    withoutResend({
      RESEND_API_KEY: 're_test_api_key',
      RESEND_FROM: 'FleetCare <no-reply@example.com>',
    }),
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes('re_test_api_key'), false);
});

test('Resend configuration rejects missing values without exposing the API key', () => {
  const result = runProductionScript(
    "require('./config/env')",
    withoutResend({
      RESEND_API_KEY: 're_test_api_key',
    }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Incomplete Resend configuration/);
  assert.equal(result.stderr.includes('re_test_api_key'), false);
});

test('Resend configuration rejects invalid sender addresses', () => {
  const completeResend = {
    RESEND_API_KEY: 're_test_api_key',
    RESEND_FROM: 'no-reply@example.com',
  };
  const result = runProductionScript(
    "require('./config/env')",
    withoutResend({ ...completeResend, RESEND_FROM: 'invalid sender' }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RESEND_FROM must contain a valid email address/);
  assert.equal(result.stderr.includes('re_test_api_key'), false);
});
