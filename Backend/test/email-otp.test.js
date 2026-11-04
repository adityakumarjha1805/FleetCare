const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
  verifyOtp,
  isOtpExpired,
} = require('../utils/emailOtp');

const secret = 'email-otp-test-secret-with-at-least-32-bytes';

test('OTP generation returns a cryptographically generated six-digit code and five-minute expiry', () => {
  const now = 1_800_000_000_000;
  const { code, expiresAt } = generateOtp(now);

  assert.match(code, /^\d{6}$/);
  assert.equal(expiresAt.getTime(), now + OTP_TTL_MS);
  assert.equal(OTP_TTL_MS, 5 * 60 * 1000);
});

test('OTP hash verification accepts the matching code and rejects an incorrect code', () => {
  const storedHash = hashOtp('012345', secret);

  assert.notEqual(storedHash, '012345');
  assert.equal(verifyOtp('012345', storedHash, secret), true);
  assert.equal(verifyOtp('012346', storedHash, secret), false);
  assert.equal(verifyOtp('invalid', storedHash, secret), false);
  assert.equal(verifyOtp('012345', 'not-a-hash', secret), false);
});

test('OTP expiry treats the expiry instant and invalid dates as expired', () => {
  const now = 1_800_000_000_000;
  const expiresAt = new Date(now + OTP_TTL_MS);

  assert.equal(isOtpExpired(expiresAt, now), false);
  assert.equal(isOtpExpired(expiresAt, expiresAt.getTime()), true);
  assert.equal(isOtpExpired('invalid-date', now), true);
});
