/**
 * HTTP transport using Hono and MCP Streamable HTTP.
 * Serves the hosted MCP endpoint at mcp.lexbuild.dev.
 */
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../server/create-server.js";
import type { ServerDeps } from "../server/create-server.js";
import { RateLimiter } from "../security/rate-limit.js";
import type { Logger } from "../lib/logger.js";

/** Creates the HTTP app with MCP transport, health endpoints, and rate limiting. */
export function createHttpApp(deps: ServerDeps): Hono {
  const app = new Hono();
  const rateLimiter = new RateLimiter(deps.config.LEXBUILD_MCP_RATE_LIMIT_PER_MIN);
  const logger = deps.logger.child({ transport: "http" });

  // Track active transports by session ID for reuse
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

  // Health check — no auth
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  // Readiness check — pings the Data API
  app.get("/readyz", async (c) => {
    try {
      await deps.api.healthCheck();
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "not_ready" }, 503);
    }
  });

  // MCP Streamable HTTP endpoint
  app.all("/mcp", async (c) => {
    // Rate limit by session ID header or IP
    const sessionId = c.req.header("mcp-session-id");
    const rateLimitKey = sessionId ?? c.req.header("cf-connecting-ip") ?? "anonymous";
    const rateResult = rateLimiter.check(rateLimitKey);

    if (!rateResult.allowed) {
      logger.warn("Rate limit exceeded", { key: rateLimitKey });
      return c.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Rate limit exceeded" },
          id: null,
        },
        429,
        {
          "Retry-After": String(rateResult.retryAfterSeconds ?? 60),
        },
      );
    }

    // For initialization requests (no session ID), create a new transport
    if (!sessionId) {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, transport);
          logger.info("MCP session initialized", { sessionId: id });
        },
        onsessionclosed: (id) => {
          sessions.delete(id);
          logger.info("MCP session closed", { sessionId: id });
        },
      });

      const server = createServer(deps);
      await server.connect(transport);
      return transport.handleRequest(c.req.raw);
    }

    // For existing sessions, look up the transport
    const existingTransport = sessions.get(sessionId);
    if (!existingTransport) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found" },
          id: null,
        },
        404,
      );
    }

    return existingTransport.handleRequest(c.req.raw);
  });

  // Log unhandled routes
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}

/** Starts the HTTP server. Exported for use by the bin entrypoint. */
export async function startHttpServer(deps: ServerDeps, logger: Logger): Promise<void> {
  const { serve } = await import("@hono/node-server");

  const app = createHttpApp(deps);

  serve(
    {
      fetch: app.fetch,
      hostname: deps.config.LEXBUILD_MCP_HTTP_HOST,
      port: deps.config.LEXBUILD_MCP_HTTP_PORT,
    },
    (info) => {
      logger.info("lexbuild-mcp HTTP server ready", {
        host: info.address,
        port: info.port,
      });
    },
  );
}
