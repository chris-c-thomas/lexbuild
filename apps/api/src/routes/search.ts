import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { z } from "zod";
import { Meilisearch } from "meilisearch";
import { HTTPException } from "hono/http-exception";
import { searchQuerySchema, searchResultSchema } from "../schemas/search.js";
import { cacheHeaders } from "../middleware/cache-headers.js";
import { toApiSource } from "../lib/source-registry.js";

const INDEX_NAME = "lexbuild";

interface MeiliSearchDocument {
  id: string;
  source: "usc" | "ecfr" | "fr";
  title_number: number;
  title_name: string;
  identifier: string;
  heading: string;
  status: string;
  hierarchy: string[];
  url: string;
  document_type?: string;
  publication_date?: string;
  agency?: string;
}

const ALLOWED_FACETS = new Set([
  "source",
  "title_number",
  "document_type",
  "agency",
  "status",
  "granularity",
  "publication_date",
]);

const ALLOWED_SORT_FIELDS = new Set(["publication_date", "title_number", "identifier", "document_number"]);

/** Translate API query params into a Meilisearch filter string. */
function buildMeiliFilter(params: z.infer<typeof searchQuerySchema>): string | undefined {
  const filters: string[] = [];

  if (params.source) {
    filters.push(`source = "${params.source}"`);
  }

  if (params.title_number !== undefined) {
    filters.push(`title_number = ${params.title_number}`);
  }

  if (params.document_type) {
    filters.push(`document_type = "${params.document_type}"`);
  }

  if (params.agency) {
    // Strip quotes, backslashes, and control chars to prevent filter injection
    const sanitized = params.agency.replace(/["\\\n\r]/g, "");
    filters.push(`agency = "${sanitized}"`);
  }

  if (params.status) {
    const sanitized = params.status.replace(/["\\\n\r]/g, "");
    filters.push(`status = "${sanitized}"`);
  }

  if (params.date_from) {
    filters.push(`publication_date >= "${params.date_from}"`);
  }

  if (params.date_to) {
    filters.push(`publication_date <= "${params.date_to}"`);
  }

  return filters.length > 0 ? filters.join(" AND ") : undefined;
}

/** Map API sort param to Meilisearch sort format. */
function buildMeiliSort(sort: string | undefined): string[] | undefined {
  if (!sort || sort === "relevance") return undefined;

  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;

  if (!ALLOWED_SORT_FIELDS.has(field)) return undefined;

  return [`${field}:${descending ? "desc" : "asc"}`];
}

/** Parse and validate requested facets. */
function parseFacets(facetsParam: string | undefined): string[] {
  if (!facetsParam) return ["source", "status"];

  const requested = facetsParam.split(",").map((f) => f.trim());
  return requested.filter((f) => ALLOWED_FACETS.has(f));
}

const searchRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["Search"],
  summary: "Search Documents",
  description:
    "Search across U.S. Code, Code of Federal Regulations, and Federal Register documents with faceted filtering and highlighting.",
  request: { query: searchQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: searchResultSchema } },
      description: "Search results with optional facet distributions",
    },
  },
});

/** Register the search endpoint. */
export function registerSearchRoutes(app: OpenAPIHono, meiliUrl: string, meiliKey: string): void {
  const client = new Meilisearch({ host: meiliUrl, apiKey: meiliKey });

  // Short cache — search results depend on query but are stable between re-indexes
  app.use("/search", cacheHeaders({ maxAge: 60, sMaxAge: 300 }));

  app.openapi(searchRoute, async (c) => {
    const params = c.req.valid("query");

    const filter = buildMeiliFilter(params);
    const sort = buildMeiliSort(params.sort);
    const facets = parseFacets(params.facets);

    let result;
    try {
      // Build search options, omitting undefined values for exactOptionalPropertyTypes
      const searchOptions: Record<string, unknown> = {
        facets,
        limit: params.limit,
        offset: params.offset,
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
        cropLength: 200,
        attributesToHighlight: params.highlight ? ["heading", "identifier", "body"] : [],
        attributesToCrop: params.highlight ? ["body"] : [],
      };
      if (filter) searchOptions.filter = filter;
      if (sort) searchOptions.sort = sort;

      result = await client.index(INDEX_NAME).search(params.q, searchOptions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search service unavailable";
      console.error("[search] Meilisearch query failed:", err);
      throw new HTTPException(503, { message: `Search service unavailable: ${message}` });
    }

    const estimatedTotal = result.estimatedTotalHits ?? 0;

    const hits = (result.hits as MeiliSearchDocument[]).map((hit) => {
      // Access _formatted for highlights (Meilisearch adds this to each hit)
      const formatted = (hit as unknown as Record<string, unknown>)._formatted as Record<string, string> | undefined;

      return {
        id: hit.id,
        source: toApiSource(hit.source),
        identifier: hit.identifier,
        heading: hit.heading,
        title_number: hit.title_number ?? null,
        title_name: hit.title_name ?? null,
        status: hit.status,
        url: hit.url,
        document_type: hit.document_type,
        publication_date: hit.publication_date,
        hierarchy: hit.hierarchy ?? [],
        highlights:
          params.highlight && formatted
            ? {
                heading: formatted.heading,
                identifier: formatted.identifier,
                body: formatted.body,
              }
            : undefined,
      };
    });

    return c.json({
      data: {
        hits,
        query: result.query,
        processing_time_ms: result.processingTimeMs,
        estimated_total_hits: estimatedTotal,
      },
      facets: result.facetDistribution ?? undefined,
      meta: {
        api_version: "v1",
        timestamp: new Date().toISOString(),
      },
      pagination: {
        total: estimatedTotal,
        limit: params.limit,
        offset: params.offset,
        has_more: params.offset + hits.length < estimatedTotal,
      },
    });
  });
}
