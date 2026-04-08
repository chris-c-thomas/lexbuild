/**
 * In-memory sliding window rate limiter for the HTTP transport.
 * Keys by session ID or IP. Anonymous sessions use the configured default limit.
 */

/** Rate limit check result. */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number | undefined;
}

/** In-memory sliding window rate limiter. */
export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly windows: Map<string, number[]> = new Map();

  constructor(maxRequestsPerMinute: number) {
    this.windowMs = 60_000;
    this.maxRequests = maxRequestsPerMinute;

    // Periodic cleanup of stale entries
    setInterval(() => this.cleanup(), 300_000).unref();
  }

  /** Checks and records a request for the given key. */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Remove expired timestamps
    let first = timestamps[0];
    while (first !== undefined && first < windowStart) {
      timestamps.shift();
      first = timestamps[0];
    }

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0] ?? now;
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - timestamps.length,
    };
  }

  /** Removes entries older than 1 hour. */
  private cleanup(): void {
    const cutoff = Date.now() - 3_600_000;
    for (const [key, timestamps] of this.windows.entries()) {
      const lastTimestamp = timestamps[timestamps.length - 1];
      if (timestamps.length === 0 || (lastTimestamp !== undefined && lastTimestamp < cutoff)) {
        this.windows.delete(key);
      }
    }
  }
}
