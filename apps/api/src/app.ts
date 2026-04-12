/**
 * Hono application factory — assembles middleware stack and route registrations.
 * Exported for use by the server entry point and integration tests.
 */
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { createDatabase } from "./db/client.js";
import { initKeysDatabase } from "./db/keys.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler, buildErrorResponse } from "./middleware/error-handler.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerUscRoutes } from "./routes/usc.js";
import { registerEcfrRoutes } from "./routes/ecfr.js";
import { registerFrRoutes } from "./routes/fr.js";
import {
  registerUscHierarchyRoutes,
  registerEcfrHierarchyRoutes,
  registerFrHierarchyRoutes,
} from "./routes/hierarchy.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerSearchRoutes } from "./routes/search.js";
import { API_VERSION } from "./lib/version.js";

/** Configuration for the Hono app factory. */
export interface AppConfig {
  dbPath: string;
  keysDbPath?: string;
  meiliUrl?: string;
  meiliKey?: string;
}

/** Create and configure the Hono application. Exported for testing. */
export function createApp(config: AppConfig): OpenAPIHono {
  const app = new OpenAPIHono();

  const db = createDatabase(config.dbPath);
  const keysDb = initKeysDatabase(config.keysDbPath ?? "./lexbuild-keys.db");

  // Order matters: request-id must precede logger, error handler must wrap all routes
  app.use("*", requestId());
  app.use("*", requestLogger());
  app.use("*", cors({ origin: "*" }));
  app.use("*", errorHandler());

  // Hono v4 catches HTTPException before middleware catch blocks. This handler
  // ensures HTTPException (thrown by hierarchy routes, validation, etc.) returns
  // structured JSON instead of Hono's default plain text response.
  // Uses shared buildErrorResponse to keep format consistent with errorHandler middleware.
  app.onError((err, c) => {
    // onError's context type doesn't include custom variables, so read request ID
    // from the response header set by the requestId middleware
    const reqId = c.res?.headers.get("X-Request-ID") ?? c.req.header("X-Request-ID");
    return buildErrorResponse(c, err, reqId);
  });

  const v1 = new OpenAPIHono();

  // Must run after request-id (for key tracking) and before route handlers
  v1.use("*", rateLimitMiddleware(keysDb));

  registerHealthRoutes(v1, db);
  registerSourceRoutes(v1, db);
  registerUscRoutes(v1, db);
  registerEcfrRoutes(v1, db);
  registerFrRoutes(v1, db);
  registerUscHierarchyRoutes(v1, db);
  registerEcfrHierarchyRoutes(v1, db);
  registerFrHierarchyRoutes(v1, db);
  registerStatsRoutes(v1, db);

  const meiliUrl = config.meiliUrl ?? "http://127.0.0.1:7700";
  const meiliKey = config.meiliKey ?? "";
  registerSearchRoutes(v1, meiliUrl, meiliKey);

  v1.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "LexBuild API",
      version: API_VERSION,
      description:
        "The LexBuild API provides structured, programmatic access to over one million U.S. legal documents, including the U.S. Code, the eCFR (Code of Federal Regulations), and the Federal Register.\n\n It transforms complex, hard-to-use government legal sources into structured, machine-readable data optimized for LLMs, AI-driven workflows, RAG pipelines, semantic search systems, and other legal-tech applications.\n\n Core capabilities include full-text search with faceted filtering, hierarchical navigation across legal structures, paginated collections, selective field projection, and HTTP caching via ETags for efficient data access.",
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
      contact: { name: "LexBuild", url: "https://lexbuild.dev" },
    },
    servers: [{ url: "https://lexbuild.dev/api", description: "Production" }],
    security: [{ apiKey: [] }],
    tags: [
      {
        name: "System",
        description: "Health checks, available official data sources, and corpus-wide statistics.",
      },
      {
        name: "U.S. Code",
        description:
          "Browse and retrieve sections from the United States Code, provided by the Office of the Law Revision Counsel, organized by title and chapter.",
      },
      {
        name: "eCFR",
        description:
          "Browse and retrieve sections from the Electronic Code of Federal Regulations, published by the National Archives through the Office of the Federal Register, organized by title and chapter.",
      },
      {
        name: "Federal Register",
        description:
          "Browse and retrieve Federal Register documents, published by the National Archives through the Office of the Federal Register, organized by year and month.",
      },
      {
        name: "Search",
        description: "Full-text search across all sources with faceted filtering.",
      },
    ],
  });

  // API reference UI now lives in the Astro app at /docs/api.
  // Redirect old /api/docs URL to the canonical location.
  v1.get("/docs", (c) => c.redirect("/docs/api", 301));

  app.route("/api", v1);

  // Structured JSON 404 for unmatched routes
  app.notFound((c) =>
    c.json(
      {
        error: {
          status: 404,
          code: "NOT_FOUND",
          message: `No endpoint found at ${c.req.method} ${c.req.path}`,
        },
      },
      404,
    ),
  );

  return app;
}
