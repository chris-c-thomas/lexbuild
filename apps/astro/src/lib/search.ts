/**
 * Meilisearch search wrapper.
 *
 * In production, searches go through Caddy's /search proxy (which handles
 * auth via server-side MEILI_SEARCH_KEY). The Meilisearch JS client is only
 * used in local dev where the browser can reach Meilisearch directly.
 *
 * Gated behind the ENABLE_SEARCH environment variable.
 */

import { Meilisearch } from "meilisearch";

const INDEX_NAME = "lexbuild";

let client: Meilisearch | null = null;
let searchMode: "proxy" | "direct" = "direct";
let proxyEndpoint = "";

/**
 * Initialize the search client.
 * - If meiliUrl starts with "/", use proxy mode (fetch to /search).
 * - Otherwise, use the Meilisearch client directly (local dev).
 */
export function initSearch(config: { host: string; apiKey: string }): void {
  if (config.host.startsWith("/")) {
    searchMode = "proxy";
    proxyEndpoint = config.host;
  } else {
    searchMode = "direct";
    client = new Meilisearch({
      host: config.host,
      apiKey: config.apiKey,
    });
  }
}

/** Search document shape returned by Meilisearch. */
export interface SearchDocument {
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
}

/** Search result from Meilisearch. */
export interface SearchResult {
  hits: SearchDocument[];
  query: string;
  processingTimeMs: number;
  estimatedTotalHits: number;
  facetDistribution?: Record<string, Record<string, number>>;
}

/** Perform a search query against the lexbuild index. */
export async function search(
  query: string,
  options?: {
    source?: "usc" | "ecfr" | "fr";
    titleNumber?: number;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<SearchResult> {
  const filters: string[] = [];
  if (options?.source) filters.push(`source = "${options.source}"`);
  if (options?.titleNumber) filters.push(`title_number = ${options.titleNumber}`);
  if (options?.status) filters.push(`status = "${options.status}"`);

  const body = {
    q: query,
    filter: filters.length > 0 ? filters.join(" AND ") : undefined,
    facets: ["source", "status"],
    limit: options?.limit ?? 20,
    offset: options?.offset ?? 0,
    attributesToHighlight: ["heading", "identifier"],
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
  };

  if (searchMode === "proxy") {
    // Production: fetch through Caddy proxy (no API key needed, Caddy injects it)
    const res = await fetch(proxyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Search failed: ${res.status} ${res.statusText}`);
    }
    const result = await res.json();
    return {
      hits: result.hits ?? [],
      query: result.query ?? query,
      processingTimeMs: result.processingTimeMs ?? 0,
      estimatedTotalHits: result.estimatedTotalHits ?? 0,
      facetDistribution: result.facetDistribution,
    };
  }

  // Local dev: use Meilisearch client directly
  if (!client) {
    throw new Error("Search client not initialized. Call initSearch() first.");
  }
  const index = client.index<SearchDocument>(INDEX_NAME);
  const result = await index.search(query, body);
  return {
    hits: result.hits as SearchDocument[],
    query: result.query,
    processingTimeMs: result.processingTimeMs,
    estimatedTotalHits: result.estimatedTotalHits ?? 0,
    facetDistribution: result.facetDistribution as Record<string, Record<string, number>> | undefined,
  };
}
