import type { Context, MiddlewareHandler } from "hono";
import type Database from "better-sqlite3";
import { validateApiKey, trackUsage } from "../db/keys.js";

const ANON_LIMIT = 100;
const ANON_WINDOW = 60;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Single-node deployment — no need for Redis or external rate limit store
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 300_000);
    // Prevent the interval from keeping the process alive during shutdown
    this.cleanupInterval.unref();
  }

  /** Check rate limit. Returns whether the request is allowed, remaining count, and reset time. */
  check(key: string, limit: number, windowSeconds: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetAt: Math.ceil((now + windowMs) / 1000) };
    }

    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    const resetAt = Math.ceil((entry.windowStart + windowMs) / 1000);

    return { allowed: entry.count <= limit, remaining, resetAt };
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3600_000;
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart > maxAge) {
        this.store.delete(key);
      }
    }
  }
}

const limiter = new InMemoryRateLimiter();

/** Extract API key from request (Bearer token, X-API-Key header, or query param). */
function extractApiKey(c: Context): string | null {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  const xApiKey = c.req.header("X-API-Key");
  if (xApiKey) return xApiKey;

  return c.req.query("api_key") ?? null;
}

/** Get client IP from Cloudflare or proxy headers. */
function getClientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
}

/** Rate limiting middleware with API key validation and tiered limits. */
export function rateLimitMiddleware(keysDb: Database.Database): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = extractApiKey(c);
    let limit = ANON_LIMIT;
    let windowSeconds = ANON_WINDOW;
    let policy = "anonymous";
    let keyId: string | null = null;

    if (apiKey) {
      try {
        const keyData = validateApiKey(keysDb, apiKey);
        if (keyData) {
          if (keyData.tier === "unlimited") {
            c.header("X-RateLimit-Policy", "unlimited");
            await next();
            try {
              trackUsage(keysDb, keyData.id);
            } catch (trackErr: unknown) {
              const msg = trackErr instanceof Error ? trackErr.message : String(trackErr);
              console.error(`[rate-limit] Usage tracking failed: ${msg}`);
            }
            return;
          }
          limit = keyData.rate_limit;
          windowSeconds = keyData.rate_window;
          policy = keyData.tier;
          keyId = keyData.id;
        }
        // Invalid/expired/revoked key: treat as anonymous (don't reveal key validity)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[rate-limit] API key validation failed, falling back to anonymous: ${msg}`);
      }
    }

    const rateLimitKey = keyId ?? getClientIp(c);
    const result = limiter.check(rateLimitKey, limit, windowSeconds);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(result.resetAt));
    c.header("X-RateLimit-Policy", policy);

    if (!result.allowed) {
      const retryAfter = Math.max(1, result.resetAt - Math.ceil(Date.now() / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: {
            status: 429,
            code: "RATE_LIMIT_EXCEEDED",
            message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
            retry_after: retryAfter,
          },
        },
        429,
      );
    }

    await next();

    // Non-critical — don't fail the request if tracking errors
    if (keyId) {
      try {
        trackUsage(keysDb, keyId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[rate-limit] Usage tracking failed for key ${keyId}: ${msg}`);
      }
    }

    return;
  };
}
