import type { QueryResult } from "../db/queries.js";
import { FORMAT_VERSION } from "@lexbuild/core";
import { toApiSource } from "./source-registry.js";

/** Shape returned by buildListingResponse for the handler to pass to c.json(). */
export interface ListingResponseBody {
  data: Array<{
    id: string;
    identifier: string;
    source: string;
    metadata: Record<string, unknown>;
  }>;
  meta: {
    api_version: string;
    format_version: string;
    timestamp: string;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next: string | null;
  };
}

/**
 * Build a collection listing response envelope from query results.
 * Returns a plain object — the handler calls c.json() with it.
 */
export function buildListingResponse(
  result: QueryResult,
  basePath: string,
  queryString: Record<string, unknown>,
): ListingResponseBody {
  const data = result.rows.map((row) => ({
    id: row.id as string,
    identifier: row.identifier as string,
    source: toApiSource(row.source as string),
    metadata: buildListingMetadata(row),
  }));

  let next: string | null = null;
  if (result.hasMore) {
    const nextOffset = result.offset + result.limit;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryString)) {
      if (value !== undefined && value !== null && key !== "offset" && key !== "cursor") {
        params.set(key, String(value));
      }
    }
    params.set("offset", String(nextOffset));
    params.set("limit", String(result.limit));
    next = `${basePath}?${params.toString()}`;
  }

  return {
    data,
    meta: {
      api_version: "v1",
      format_version: FORMAT_VERSION,
      timestamp: new Date().toISOString(),
    },
    pagination: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      has_more: result.hasMore,
      next,
    },
  };
}

/** Build metadata object for a listing row (no body, no internal fields). */
function buildListingMetadata(row: Record<string, unknown>): Record<string, unknown> {
  return {
    display_title: row.display_title,
    title_number: row.title_number,
    title_name: row.title_name,
    section_number: row.section_number,
    section_name: row.section_name,
    chapter_number: row.chapter_number,
    chapter_name: row.chapter_name,
    part_number: row.part_number,
    part_name: row.part_name,
    legal_status: row.legal_status,
    positive_law: row.positive_law === 1,
    status: row.status,
    currency: row.currency,
    last_updated: row.last_updated,
    document_number: row.document_number,
    document_type: row.document_type,
    publication_date: row.publication_date,
    agency: row.agency,
  };
}
