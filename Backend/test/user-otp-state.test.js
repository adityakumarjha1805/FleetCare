const assert = require('node:assert/strict');
const { test } = require('node:test');
const User = require('../models/User');

test('user OTP fields default safely and are excluded from serialized users', () => {
  const user = new User({
    name: 'Fleet Manager',
    email: 'manager@example.com',
    password: 'not-a-persisted-test-user',
    emailVerificationOtpHash: 'private-hash',
    emailVerificationOtpExpiresAt: new Date(),
    emailVerificationChallengeHash: 'private-challenge-hash',
    emailVerificationChallengeExpiresAt: new Date(),
    emailVerificationFailedAttempts: 2,
    emailVerificationResendAvailableAt: new Date(),
    emailVerificationResendCount: 1,
  });
  const serializedUser = user.toJSON();

  assert.equal(user.emailVerified, false);
  assert.equal(user.emailVerificationFailedAttempts, 2);
  assert.equal(User.schema.path('emailVerificationOtpHash').options.select, false);
  assert.equal(User.schema.path('emailVerificationOtpExpiresAt').options.select, false);
  assert.equal(User.schema.path('emailVerificationChallengeHash').options.select, false);
  assert.equal(User.schema.path('emailVerificationChallengeExpiresAt').options.select, false);
  assert.equal(User.schema.path('emailVerificationFailedAttempts').options.select, false);
  assert.equal(User.schema.path('emailVerificationResendAvailableAt').options.select, false);
  assert.equal(User.schema.path('emailVerificationResendCount').options.select, false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationOtpHash'), false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationOtpExpiresAt'), false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationChallengeHash'), false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationChallengeExpiresAt'), false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationFailedAttempts'), false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationResendAvailableAt'), false);
  assert.equal(Object.hasOwn(serializedUser, 'emailVerificationResendCount'), false);
  assert.equal(Object.hasOwn(serializedUser, 'password'), false);
});
