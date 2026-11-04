const RATE_LIMIT_CODE = 'RATE_LIMIT_EXCEEDED';
const RATE_LIMIT_MESSAGE = 'Too many authentication attempts. Please try again later.';
const MAX_TRACKED_CLIENTS = 10000;

function createAuthRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  cleanupIntervalMs = Math.min(windowMs, 60_000),
} = {}) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('Rate limit must be a positive integer');
  }
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new TypeError('Rate-limit window must be a positive integer');
  }

  const clients = new Map();
  const cleanupTimer =
    cleanupIntervalMs > 0
      ? setInterval(() => {
          const currentTime = now();
          for (const [clientIp, entry] of clients) {
            if (entry.resetAt <= currentTime) {
              clients.delete(clientIp);
            }
          }
        }, cleanupIntervalMs)
      : null;
  cleanupTimer?.unref();

  return function authRateLimiter(req, res, next) {
    const currentTime = now();
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = clients.get(clientIp);

    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      clients.set(clientIp, entry);
    }

    entry.count += 1;
    if (entry.count > limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetAt - currentTime) / 1000),
      );
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: {
          code: RATE_LIMIT_CODE,
          message: RATE_LIMIT_MESSAGE,
        },
      });
    }

    if (clients.size > MAX_TRACKED_CLIENTS) {
      clients.delete(clients.keys().next().value);
    }

    return next();
  };
}

const loginRateLimiter = createAuthRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
});
const registrationRateLimiter = createAuthRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
});
const otpVerificationRateLimiter = createAuthRateLimiter({
  limit: 30,
  windowMs: 15 * 60 * 1000,
});
const otpResendRateLimiter = createAuthRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

module.exports = {
  createAuthRateLimiter,
  loginRateLimiter,
  registrationRateLimiter,
  otpVerificationRateLimiter,
  otpResendRateLimiter,
};
