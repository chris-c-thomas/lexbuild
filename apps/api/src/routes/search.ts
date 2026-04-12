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

const SEARCH_RESULT_ATTRIBUTES = [
  "id",
  "source",
  "title_number",
  "title_name",
  "identifier",
  "heading",
  "status",
  "hierarchy",
  "url",
  "document_type",
  "publication_date",
  "agency",
] as const;

/** Meilisearch search timeout in milliseconds. */
const MEILI_TIMEOUT_MS = 5_000;

interface SearchExecutionPlan {
  includeBodySnippets: boolean;
  includeFacets: boolean;
  timeoutMs: number;
}

interface SearchResponseData {
  hits: unknown[];
  query: string;
  processingTimeMs: number;
  estimatedTotalHits?: number;
  facetDistribution?: Record<string, Record<string, number>>;
}

export interface SearchExecutor {
  (query: string, searchOptions: Record<string, unknown>, timeoutMs: number): Promise<SearchResponseData>;
}

/** Translate API query params into a Meilisearch filter string. */
export function buildMeiliFilter(params: z.infer<typeof searchQuerySchema>): string | undefined {
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
export function buildMeiliSort(sort: string | undefined): string[] | undefined {
  if (!sort || sort === "relevance") return undefined;

  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;

  if (!ALLOWED_SORT_FIELDS.has(field)) return undefined;

  return [`${field}:${descending ? "desc" : "asc"}`];
}

/** Parse and validate requested facets. */
export function parseFacets(facetsParam: string | undefined): string[] {
  if (!facetsParam) return ["source", "status"];

  const requested = facetsParam.split(",").map((f) => f.trim());
  return requested.filter((f) => ALLOWED_FACETS.has(f));
}

/** Detect a Meilisearch timeout, including wrapped AbortSignal timeout errors. */
export function isMeiliTimeoutError(err: unknown): boolean {
  const cause = err instanceof Error && "cause" in err ? (err.cause as Error) : undefined;

  return (
    (err instanceof DOMException && err.name === "TimeoutError") ||
    (cause instanceof DOMException && cause.name === "TimeoutError")
  );
}

/** Build the sequence of search attempts from richest response to lean fallback. */
export function buildSearchPlans(params: z.infer<typeof searchQuerySchema>, facets: string[]): SearchExecutionPlan[] {
  const plans: SearchExecutionPlan[] = [];
  const pushUnique = (plan: SearchExecutionPlan) => {
    const exists = plans.some(
      (candidate) =>
        candidate.includeBodySnippets === plan.includeBodySnippets && candidate.includeFacets === plan.includeFacets,
    );
    if (!exists) {
      plans.push(plan);
    }
  };

  pushUnique({
    includeBodySnippets: params.highlight,
    includeFacets: facets.length > 0,
    timeoutMs: MEILI_TIMEOUT_MS,
  });

  if (params.highlight) {
    pushUnique({
      includeBodySnippets: false,
      includeFacets: facets.length > 0,
      timeoutMs: MEILI_TIMEOUT_MS,
    });
  }

  if (facets.length > 0) {
    pushUnique({
      includeBodySnippets: false,
      includeFacets: false,
      timeoutMs: MEILI_TIMEOUT_MS,
    });
  }

  return plans;
}

/** Build Meilisearch options for one execution plan. */
export function buildSearchOptions(
  params: z.infer<typeof searchQuerySchema>,
  filter: string | undefined,
  sort: string[] | undefined,
  facets: string[],
  plan: SearchExecutionPlan,
): Record<string, unknown> {
  const attributesToRetrieve = plan.includeBodySnippets
    ? [...SEARCH_RESULT_ATTRIBUTES, "body"]
    : [...SEARCH_RESULT_ATTRIBUTES];

  const searchOptions: Record<string, unknown> = {
    attributesToRetrieve,
    limit: params.limit,
    offset: params.offset,
  };

  if (params.highlight) {
    searchOptions.highlightPreTag = "<mark>";
    searchOptions.highlightPostTag = "</mark>";
    searchOptions.attributesToHighlight = plan.includeBodySnippets
      ? ["heading", "identifier", "body"]
      : ["heading", "identifier"];

    if (plan.includeBodySnippets) {
      searchOptions.cropLength = 200;
      searchOptions.attributesToCrop = ["body"];
    }
  }

  if (plan.includeFacets && facets.length > 0) {
    searchOptions.facets = facets;
  }
  if (filter) searchOptions.filter = filter;
  if (sort) searchOptions.sort = sort;

  return searchOptions;
}

/** Execute a search, retrying with leaner options when rich responses time out. */
export async function executeSearchWithFallback(
  executor: (searchOptions: Record<string, unknown>, timeoutMs: number) => Promise<SearchResponseData>,
  params: z.infer<typeof searchQuerySchema>,
  filter: string | undefined,
  sort: string[] | undefined,
  facets: string[],
): Promise<SearchResponseData> {
  const plans = buildSearchPlans(params, facets);
  let lastTimeout: unknown;

  for (const [index, plan] of plans.entries()) {
    try {
      return await executor(buildSearchOptions(params, filter, sort, facets, plan), plan.timeoutMs);
    } catch (err: unknown) {
      if (!isMeiliTimeoutError(err)) {
        throw err;
      }

      lastTimeout = err;
      if (index === plans.length - 1) {
        throw err;
      }

      console.warn(
        `[search] Timed out with bodySnippets=${plan.includeBodySnippets} facets=${plan.includeFacets}; retrying with leaner options`,
      );
    }
  }

  throw lastTimeout ?? new DOMException("Search request timed out", "TimeoutError");
}

const searchRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["Search"],
  summary: "Search Documents",
  description:
    "Search across U.S. Code, eCFR, and Federal Register documents with faceted filtering and highlighting.",
  request: { query: searchQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: searchResultSchema } },
      description: "Search results with optional facet distributions",
    },
  },
});

/** Register the search endpoint. */
export function registerSearchRoutes(
  app: OpenAPIHono,
  meiliUrl: string,
  meiliKey: string,
  searchExecutor?: SearchExecutor,
): void {
  const client = new Meilisearch({ host: meiliUrl, apiKey: meiliKey });
  const executeSearch: SearchExecutor =
    searchExecutor ??
    ((query, searchOptions, timeoutMs) =>
      client.index(INDEX_NAME).search(query, searchOptions, { signal: AbortSignal.timeout(timeoutMs) }));

  // Short cache — search results depend on query but are stable between re-indexes
  app.use("/search", cacheHeaders({ maxAge: 60, sMaxAge: 300 }));

  app.openapi(searchRoute, async (c) => {
    const params = c.req.valid("query");

    const filter = buildMeiliFilter(params);
    const sort = buildMeiliSort(params.sort);
    const facets = parseFacets(params.facets);

    let result;
    try {
      result = await executeSearchWithFallback(
        (searchOptions, timeoutMs) => executeSearch(params.q, searchOptions, timeoutMs),
        params,
        filter,
        sort,
        facets,
      );
    } catch (err: unknown) {
      console.error("[search] Meilisearch query failed:", err);

      if (isMeiliTimeoutError(err)) {
        throw new HTTPException(504, { message: "Search request timed out" });
      }

      // Do not leak internal Meilisearch URL or error details to API consumers
      throw new HTTPException(503, { message: "Search service is temporarily unavailable" });
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
