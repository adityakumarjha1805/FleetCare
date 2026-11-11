const assert = require('node:assert/strict');
const { test } = require('node:test');
const { authorize, requireRole } = require('../middleware/authorize');

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('admin role middleware allows admins and rejects normal users', () => {
  let continued = false;
  requireRole('admin')({ user: { role: 'admin' } }, response(), () => { continued = true; });
  assert.equal(continued, true);
  const result = response();
  requireRole('admin')({ user: { role: 'user' } }, result, () => {});
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.error.code, 'INSUFFICIENT_ROLE');
});

test('platform authorization does not require organization membership', () => {
  let continued = false;
  authorize({ roles: ['user'] })({ user: { role: 'user' } }, response(), () => { continued = true; });
  assert.equal(continued, true);
});
