const {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} = require('node:crypto');

const OTP_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const OTP_PATTERN = /^\d{6}$/;
const OTP_HASH_PATTERN = /^[a-f\d]{64}$/i;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function generateOtp(now = Date.now()) {
  return {
    code: String(randomInt(0, 1_000_000)).padStart(6, '0'),
    expiresAt: new Date(now + OTP_TTL_MS),
  };
}

function hashOtp(code, secret) {
  if (typeof code !== 'string' || !OTP_PATTERN.test(code)) {
    throw new TypeError('OTP must be a six-digit string');
  }
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new TypeError('OTP hashing secret must be at least 32 bytes');
  }

  return createHmac('sha256', secret)
    .update('fleetcare-email-verification-otp\0')
    .update(code)
    .digest('hex');
}

function generateChallenge(now = Date.now()) {
  return {
    challengeId: randomBytes(32).toString('base64url'),
    expiresAt: new Date(now + CHALLENGE_TTL_MS),
  };
}

function hashChallenge(challengeId, secret) {
  if (
    typeof challengeId !== 'string' ||
    !CHALLENGE_PATTERN.test(challengeId)
  ) {
    throw new TypeError('Challenge identifier is invalid');
  }
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new TypeError('Challenge hashing secret must be at least 32 bytes');
  }

  return createHmac('sha256', secret)
    .update('fleetcare-email-verification-challenge\0')
    .update(challengeId)
    .digest('hex');
}

function verifyOtp(code, storedHash, secret) {
  if (typeof storedHash !== 'string' || !OTP_HASH_PATTERN.test(storedHash)) {
    return false;
  }
  if (typeof code !== 'string' || !OTP_PATTERN.test(code)) {
    return false;
  }

  const candidate = Buffer.from(hashOtp(code, secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return timingSafeEqual(candidate, expected);
}

function isOtpExpired(expiresAt, now = Date.now()) {
  const expiryTime =
    expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt);
  return !Number.isFinite(expiryTime) || expiryTime <= now;
}

module.exports = {
  OTP_TTL_MS,
  CHALLENGE_TTL_MS,
  generateOtp,
  hashOtp,
  generateChallenge,
  hashChallenge,
  verifyOtp,
  isOtpExpired,
};
