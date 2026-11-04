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
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_SECURE: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: '',
        ...overrides,
      },
    },
  );
}

function loadProductionConfig(overrides = {}) {
  return runProductionScript("require('./config/env')", overrides);
}

function withoutSmtp(overrides = {}) {
  return {
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_SECURE: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: '',
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

test('SMTP configuration accepts complete valid settings', () => {
  const result = runProductionScript(
    "const {smtp}=require('./config/env'); if (!smtp || smtp.port !== 587 || smtp.secure !== false || smtp.pass !== 'smtp-test-password') process.exit(1)",
    withoutSmtp({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-test-user',
      SMTP_PASS: 'smtp-test-password',
      SMTP_FROM: 'FleetCare <no-reply@example.com>',
    }),
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes('smtp-test-password'), false);
});

test('SMTP configuration rejects incomplete settings without exposing values', () => {
  const result = runProductionScript(
    "require('./config/env')",
    withoutSmtp({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-test-user',
      SMTP_PASS: 'smtp-test-password',
    }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Incomplete SMTP configuration/);
  assert.equal(result.stderr.includes('smtp-test-password'), false);
});

test('SMTP configuration rejects invalid port, security mode, and sender address', () => {
  const completeSmtp = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-test-user',
    SMTP_PASS: 'smtp-test-password',
    SMTP_FROM: 'no-reply@example.com',
  };
  const invalidCases = [
    { SMTP_PORT: '70000', expected: /SMTP_PORT must be an integer/ },
    { SMTP_HOST: 'smtp.example.com/path', expected: /SMTP_HOST must be a hostname/ },
    { SMTP_SECURE: 'sometimes', expected: /SMTP_SECURE must be true or false/ },
    { SMTP_FROM: 'invalid sender', expected: /SMTP_FROM must contain a valid email address/ },
  ];

  for (const { expected, ...override } of invalidCases) {
    const result = runProductionScript(
      "require('./config/env')",
      withoutSmtp({ ...completeSmtp, ...override }),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
    assert.equal(result.stderr.includes('smtp-test-password'), false);
  }
});
