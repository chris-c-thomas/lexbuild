import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import { API_VERSION } from "../lib/version.js";
import { readApiAggregates } from "../lib/api-aggregates.js";
import { memoizeForTtl } from "../lib/ttl-cache.js";

const HEALTH_CACHE_TTL_MS = 30_000;

const healthResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
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
  summary: "Health Check",
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
  const getApiAggregates = memoizeForTtl(HEALTH_CACHE_TTL_MS, () => readApiAggregates(db));
  const getDatabaseStatus = memoizeForTtl(HEALTH_CACHE_TTL_MS, () => {
    const version = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as {
      value: string;
    };
    const aggregates = getApiAggregates();
    const count =
      aggregates?.total_documents ??
      (
        db.prepare("SELECT count(*) as count FROM documents").get() as {
          count: number;
        }
      ).count;

    return {
      connected: true,
      documents: count,
      schema_version: Number.parseInt(version.value, 10),
    };
  });

  app.openapi(healthRoute, (c) => {
    let dbStatus = { connected: false, documents: 0, schema_version: 0 };

    try {
      dbStatus = getDatabaseStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[health] Database check failed: ${msg}`);
    }

    return c.json({
      status: dbStatus.connected ? "ok" : "error",
      version: API_VERSION,
      database: dbStatus,
      uptime: process.uptime(),
    });
  });
}
