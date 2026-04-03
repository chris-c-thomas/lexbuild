import { createMiddleware } from "hono/factory";

/** Logs request method, path, status, and response time. */
export const requestLogger = () =>
  createMiddleware(async (c, next) => {
    const start = performance.now();
    await next();
    const ms = (performance.now() - start).toFixed(1);
    const requestId = c.get("requestId") as string | undefined;
    const id = requestId ? requestId.slice(0, 8) : "?";

    console.log(`[${id}] ${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`);
  });
