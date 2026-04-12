import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

/** Build a structured JSON error response from a caught error. */
export function buildErrorResponse(c: Context, err: unknown, requestId: string | undefined): Response {
  const status = err instanceof HTTPException ? err.status : 500;
  const message = err instanceof Error ? err.message : "Internal server error";

  if (status === 500) {
    console.error(`[${requestId ?? "?"}] ${c.req.method} ${c.req.path}:`, err);
  } else {
    console.error(`[${requestId ?? "?"}] ${status} ${c.req.method} ${c.req.path}: ${message}`);
  }

  return c.json(
    {
      error: {
        status,
        code: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: status === 500 ? "Internal server error" : message,
      },
    },
    { status },
  );
}

/** Global error boundary — catches unhandled non-HTTPException errors and returns structured JSON. */
export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
      return;
    } catch (err: unknown) {
      const requestId = c.get("requestId") as string | undefined;
      return buildErrorResponse(c, err, requestId);
    }
  };
}
