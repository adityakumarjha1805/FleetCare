const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');
const User = require('../models/User');

test('user schema supports platform roles and keeps password private', () => {
  const emailPath = User.schema.path('email');
  const passwordPath = User.schema.path('password');
  const rolePath = User.schema.path('role');
  assert.equal(User.collection.name, 'users');
  assert.equal(emailPath.options.required, true);
  assert.equal(emailPath.options.lowercase, true);
  assert.equal(emailPath.options.unique, true);
  assert.equal(passwordPath.options.select, false);
  assert.ok(rolePath.options.enum.includes('admin'));
  assert.ok(rolePath.options.enum.includes('user'));
  assert.equal(new User({ name: 'Admin', email: 'admin@example.test', password: 'password', role: 'admin' }).validateSync(), undefined);
  assert.ok(new User({ name: 'Invalid', email: 'invalid@example.test', password: 'password', role: 'invalid' }).validateSync().errors.role);
  assert.equal(User.hydrate({ _id: new mongoose.Types.ObjectId() }).onboardingCompleted, true);
});
