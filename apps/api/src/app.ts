import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { createDatabase } from "./db/client.js";
import { initKeysDatabase } from "./db/keys.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
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
      version: "1.20.1",
      description:
        "The LexBuild API provides structured, programmatic access to over one million U.S. legal documents, including the U.S. Code, the Code of Federal Regulations, and the Federal Register.\n\n It transforms complex, hard-to-use government legal sources into structured, machine-readable data optimized for LLMs, AI-driven workflows, RAG pipelines, semantic search systems, and other legal-tech applications.\n\n Core capabilities include full-text search with faceted filtering, hierarchical navigation across legal structures, paginated collections, selective field projection, and HTTP caching via ETags for efficient data access.",
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
      contact: { name: "LexBuild", url: "https://lexbuild.dev" },
    },
    servers: [
      { url: "https://lexbuild.dev/api", description: "Production" },
    ],
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

  return app;
}
