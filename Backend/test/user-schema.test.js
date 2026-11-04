const assert = require('node:assert/strict');
const { test } = require('node:test');
const User = require('../models/User');

test('user schema keeps the normalized unique email index and private password', () => {
  const emailPath = User.schema.path('email');
  const passwordPath = User.schema.path('password');

  assert.equal(User.collection.name, 'users');
  assert.equal(emailPath.options.required, true);
  assert.equal(emailPath.options.lowercase, true);
  assert.equal(emailPath.options.trim, true);
  assert.equal(emailPath.options.unique, true);
  assert.equal(passwordPath.options.select, false);
  assert.deepEqual(User.schema.indexes(), [
    [{ email: 1 }, { unique: true }],
  ]);
  assert.equal(User.schema.path('emailVerified'), undefined);
  assert.equal(User.schema.path('emailVerificationOtpHash'), undefined);
});
