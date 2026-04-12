import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type Database from "better-sqlite3";
import { API_SOURCES, toDbSource } from "../lib/source-registry.js";
import { readApiAggregates } from "../lib/api-aggregates.js";
import { memoizeForTtl } from "../lib/ttl-cache.js";

const SOURCES_CACHE_TTL_MS = 60_000;

const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  short_name: z.string(),
  description: z.string(),
  url_prefix: z.string(),
  hierarchy: z.array(z.string()),
  filterable_fields: z.array(z.string()),
  sortable_fields: z.array(z.string()),
  has_titles: z.boolean(),
  document_count: z.number(),
});

const sourcesResponseSchema = z.object({
  data: z.array(sourceSchema),
  meta: z.object({
    api_version: z.string(),
    timestamp: z.string(),
  }),
});

const sourcesRoute = createRoute({
  method: "get",
  path: "/sources",
  tags: ["System"],
  summary: "List Sources",
  description:
    "Returns metadata about all content sources, including document counts, hierarchy structure, and available filters.",
  responses: {
    200: {
      content: { "application/json": { schema: sourcesResponseSchema } },
      description: "List of content sources",
    },
  },
});

/** Register the sources metadata endpoint. */
export function registerSourceRoutes(app: OpenAPIHono, db: Database.Database): void {
  const countBySource = db.prepare("SELECT source, count(*) as count FROM documents GROUP BY source");
  const getApiAggregates = memoizeForTtl(SOURCES_CACHE_TTL_MS, () => readApiAggregates(db));
  const getSourceData = memoizeForTtl(SOURCES_CACHE_TTL_MS, () => {
    const aggregates = getApiAggregates();

    if (aggregates) {
      return Object.values(API_SOURCES).map((source) => ({
        id: source.id,
        name: source.name,
        short_name: source.shortName,
        description: source.description,
        url_prefix: source.urlPrefix,
        hierarchy: source.hierarchy,
        filterable_fields: source.filterableFields,
        sortable_fields: source.sortableFields,
        has_titles: source.hasTitles,
        document_count: aggregates.sources[source.id].document_count,
      }));
    }

    const counts = new Map<string, number>();
    const rows = countBySource.all() as Array<{ source: string; count: number }>;

    for (const row of rows) {
      counts.set(row.source, row.count);
    }

    return Object.values(API_SOURCES).map((source) => {
      const dbSource = toDbSource(source.id);
      return {
        id: source.id,
        name: source.name,
        short_name: source.shortName,
        description: source.description,
        url_prefix: source.urlPrefix,
        hierarchy: source.hierarchy,
        filterable_fields: source.filterableFields,
        sortable_fields: source.sortableFields,
        has_titles: source.hasTitles,
        document_count: counts.get(dbSource) ?? 0,
      };
    });
  });

  app.openapi(sourcesRoute, (c) => {
    try {
      const data = getSourceData();
      return c.json({
        data,
        meta: {
          api_version: "v1",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sources] Failed to query document counts: ${msg}`);
      throw new HTTPException(503, { message: "Source metadata temporarily unavailable" });
    }
  });
}
