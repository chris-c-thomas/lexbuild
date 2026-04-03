import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import { SCHEMA_VERSION } from "@lexbuild/core";
import { cacheHeaders } from "../middleware/cache-headers.js";

const statsResponseSchema = z.object({
  data: z.object({
    total_documents: z.number(),
    sources: z.object({
      usc: z.object({
        document_count: z.number(),
        title_count: z.number(),
        last_updated: z.string().nullable(),
      }),
      cfr: z.object({
        document_count: z.number(),
        title_count: z.number(),
        last_updated: z.string().nullable(),
      }),
      fr: z.object({
        document_count: z.number(),
        date_range: z.object({
          earliest: z.string().nullable(),
          latest: z.string().nullable(),
        }),
        document_types: z.record(z.number()),
      }),
    }),
    database: z.object({
      schema_version: z.number(),
    }),
  }),
  meta: z.object({ api_version: z.string(), timestamp: z.string() }),
});

const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  tags: ["System"],
  summary: "Corpus statistics",
  description:
    "Returns corpus-wide statistics including document counts per source, title counts, date ranges, and database metadata.",
  responses: {
    200: {
      content: { "application/json": { schema: statsResponseSchema } },
      description: "Corpus statistics",
    },
  },
});

/** Register the statistics endpoint. */
export function registerStatsRoutes(app: OpenAPIHono, db: Database.Database): void {
  // Expensive queries — cache aggressively
  app.use("/stats", cacheHeaders({ maxAge: 3600, sMaxAge: 86400, staleWhileRevalidate: 604800 }));

  const totalCount = db.prepare("SELECT count(*) as total FROM documents");

  const uscStats = db.prepare(
    "SELECT count(*) as document_count, count(DISTINCT title_number) as title_count, " +
      "max(last_updated) as last_updated FROM documents WHERE source = 'usc'",
  );

  const cfrStats = db.prepare(
    "SELECT count(*) as document_count, count(DISTINCT title_number) as title_count, " +
      "max(last_updated) as last_updated FROM documents WHERE source = 'ecfr'",
  );

  const frStats = db.prepare(
    "SELECT count(*) as document_count, " +
      "min(publication_date) as earliest, max(publication_date) as latest " +
      "FROM documents WHERE source = 'fr'",
  );

  const frDocTypes = db.prepare(
    "SELECT document_type, count(*) as count FROM documents " +
      "WHERE source = 'fr' AND document_type IS NOT NULL GROUP BY document_type",
  );

  app.openapi(statsRoute, (c) => {
    const { total } = totalCount.get() as { total: number };
    const usc = uscStats.get() as { document_count: number; title_count: number; last_updated: string | null };
    const cfr = cfrStats.get() as { document_count: number; title_count: number; last_updated: string | null };
    const fr = frStats.get() as { document_count: number; earliest: string | null; latest: string | null };
    const docTypes = frDocTypes.all() as Array<{ document_type: string; count: number }>;

    const documentTypes: Record<string, number> = {};
    for (const dt of docTypes) {
      documentTypes[dt.document_type] = dt.count;
    }

    return c.json({
      data: {
        total_documents: total,
        sources: {
          usc: {
            document_count: usc.document_count,
            title_count: usc.title_count,
            last_updated: usc.last_updated,
          },
          cfr: {
            document_count: cfr.document_count,
            title_count: cfr.title_count,
            last_updated: cfr.last_updated,
          },
          fr: {
            document_count: fr.document_count,
            date_range: { earliest: fr.earliest, latest: fr.latest },
            document_types: documentTypes,
          },
        },
        database: {
          schema_version: SCHEMA_VERSION,
        },
      },
      meta: { api_version: "v1", timestamp: new Date().toISOString() },
    });
  });
}
