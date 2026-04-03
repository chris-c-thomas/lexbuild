import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  version: z.string(),
  database: z.object({
    connected: z.boolean(),
    documents: z.number(),
    schema_version: z.number(),
  }),
  uptime: z.number(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  description: "Returns API health status, database connectivity, and document counts.",
  responses: {
    200: {
      content: { "application/json": { schema: healthResponseSchema } },
      description: "API is healthy",
    },
  },
});

/** Register the health check endpoint. */
export function registerHealthRoutes(app: OpenAPIHono, db: Database.Database): void {
  app.openapi(healthRoute, (c) => {
    let dbStatus = { connected: false, documents: 0, schema_version: 0 };

    try {
      const count = db.prepare("SELECT count(*) as count FROM documents").get() as {
        count: number;
      };
      const version = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as {
        value: string;
      };
      dbStatus = {
        connected: true,
        documents: count.count,
        schema_version: parseInt(version.value, 10),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[health] Database check failed: ${msg}`);
    }

    return c.json({
      status: dbStatus.connected ? "ok" : "error",
      version: process.env.npm_package_version ?? "unknown",
      database: dbStatus,
      uptime: process.uptime(),
    });
  });
}
