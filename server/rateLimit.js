/** In-memory sliding-window rate limiter (per serverless instance / process). */

const buckets = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function pruneOld(timestamps, windowMs, now) {
  while (timestamps.length && timestamps[0] <= now - windowMs) {
    timestamps.shift();
  }
}

/**
 * @param {{ windowMs?: number, max?: number, keyPrefix?: string }} [opts]
 */
export function createRateLimiter(opts = {}) {
  const windowMs = Number(opts.windowMs) || Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000;
  const max = Number(opts.max) || Number(process.env.AUTH_RATE_LIMIT_MAX) || 30;
  const keyPrefix = opts.keyPrefix || 'rl';

  return function rateLimitMiddleware(req, res, next) {
    const ip = clientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let timestamps = buckets.get(key);
    if (!timestamps) {
      timestamps = [];
      buckets.set(key, timestamps);
    }

    pruneOld(timestamps, windowMs, now);

    if (timestamps.length >= max) {
      const retryAfterSec = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a moment and try again.',
      });
    }

    timestamps.push(now);
    next();
  };
}

/** Periodic cleanup so the map does not grow forever. */
setInterval(() => {
  const now = Date.now();
  const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000;
  for (const [key, timestamps] of buckets.entries()) {
    pruneOld(timestamps, windowMs, now);
    if (!timestamps.length) buckets.delete(key);
  }
}, 120_000).unref?.();
