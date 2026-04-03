import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";

/** Assigns a unique request ID to every request for tracing. */
export const requestId = () =>
  createMiddleware(async (c, next) => {
    const id = c.req.header("X-Request-ID") ?? randomUUID();
    c.header("X-Request-ID", id);
    c.set("requestId", id);
    await next();
  });
