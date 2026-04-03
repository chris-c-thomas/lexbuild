import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
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
import { registerCfrRoutes } from "./routes/cfr.js";
import { registerFrRoutes } from "./routes/fr.js";
import {
  registerUscHierarchyRoutes,
  registerCfrHierarchyRoutes,
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
  registerCfrRoutes(v1, db);
  registerFrRoutes(v1, db);
  registerUscHierarchyRoutes(v1, db);
  registerCfrHierarchyRoutes(v1, db);
  registerFrHierarchyRoutes(v1, db);
  registerStatsRoutes(v1, db);

  const meiliUrl = config.meiliUrl ?? "http://127.0.0.1:7700";
  const meiliKey = config.meiliKey ?? "";
  registerSearchRoutes(v1, meiliUrl, meiliKey);

  v1.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "LexBuild API",
      version: "1.0.0",
      description:
        "Programmatic access to U.S. legal texts — U.S. Code, Code of Federal Regulations, Federal Register, and more.",
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
      contact: { name: "LexBuild", url: "https://lexbuild.dev" },
    },
    servers: [
      { url: "https://lexbuild.dev/api/v1", description: "Production" },
      { url: "http://localhost:4322/api/v1", description: "Local development" },
    ],
    security: [{ apiKey: [] }],
  });

  v1.get(
    "/docs",
    apiReference({
      url: "/api/v1/openapi.json",
      theme: "kepler",
      title: "LexBuild API Reference",
    }),
  );

  app.route("/api/v1", v1);

  return app;
}
