import { createMiddleware } from "hono/factory";

export interface CacheOptions {
  maxAge: number;
  /** Maps to s-maxage for Cloudflare edge cache */
  sMaxAge?: number;
  staleWhileRevalidate?: number;
}

/** Sets Cache-Control headers on successful GET responses. */
export const cacheHeaders = (options: CacheOptions) =>
  createMiddleware(async (c, next) => {
    await next();

    if (c.req.method !== "GET" || c.res.status !== 200) return;

    const parts = [`public`, `max-age=${options.maxAge}`];
    if (options.sMaxAge !== undefined) parts.push(`s-maxage=${options.sMaxAge}`);
    if (options.staleWhileRevalidate !== undefined) {
      parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }

    c.header("Cache-Control", parts.join(", "));
  });
