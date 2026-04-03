import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { createDatabase } from "./db/client.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerUscRoutes } from "./routes/usc.js";
import { registerCfrRoutes } from "./routes/cfr.js";
import { registerFrRoutes } from "./routes/fr.js";

/** Configuration for the Hono app factory. */
export interface AppConfig {
  dbPath: string;
  meiliUrl?: string;
  meiliKey?: string;
}

/** Create and configure the Hono application. Exported for testing. */
export function createApp(config: AppConfig): OpenAPIHono {
  const app = new OpenAPIHono();

  // Database connection (read-only)
  const db = createDatabase(config.dbPath);

  // Global middleware (order matters)
  app.use("*", requestId());
  app.use("*", requestLogger());
  app.use("*", cors({ origin: "*" }));
  app.use("*", errorHandler());

  // Versioned API routes
  const v1 = new OpenAPIHono();

  // Register route modules
  registerHealthRoutes(v1, db);
  registerSourceRoutes(v1, db);
  registerUscRoutes(v1, db);
  registerCfrRoutes(v1, db);
  registerFrRoutes(v1, db);

  // OpenAPI spec
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
  });

  // Scalar API reference UI
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
