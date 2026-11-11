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
        ...overrides,
      },
    },
  );
}

function loadProductionConfig(overrides = {}) {
  return runProductionScript("require('./config/env')", overrides);
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

test('approved Vercel preview origins share the CORS and CSRF allowlist', () => {
  const result = runProductionScript(
    "const {isAllowedFrontendOrigin}=require('./config/env'); if (!isAllowedFrontendOrigin('https://fleetcare-feature-123-team-aditya1.vercel.app')) process.exit(1); if (isAllowedFrontendOrigin('https://untrusted.example')) process.exit(1)",
  );

  assert.equal(result.status, 0, result.stderr);
});

test('production authentication cookies default to secure cross-site mode', () => {
  const result = runProductionScript(
    "const {AUTH_COOKIE_OPTIONS}=require('./utils/authCookie'); if (!AUTH_COOKIE_OPTIONS.secure || !AUTH_COOKIE_OPTIONS.httpOnly || AUTH_COOKIE_OPTIONS.sameSite !== 'none') process.exit(1)",
    { AUTH_COOKIE_SAME_SITE: '' },
  );

  assert.equal(result.status, 0, result.stderr);
});

test('production authentication cookies are Secure and support approved cross-site mode', () => {
  const result = runProductionScript(
    "const {AUTH_COOKIE_OPTIONS}=require('./utils/authCookie'); if (!AUTH_COOKIE_OPTIONS.secure || !AUTH_COOKIE_OPTIONS.httpOnly || AUTH_COOKIE_OPTIONS.sameSite !== 'none') process.exit(1)",
    { AUTH_COOKIE_SAME_SITE: 'None' },
  );

  assert.equal(result.status, 0, result.stderr);
});
