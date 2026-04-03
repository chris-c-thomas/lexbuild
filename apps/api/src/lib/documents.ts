import type { Context } from "hono";
import type { DocumentRow } from "@lexbuild/core";
import { resolveFormat } from "./content-negotiation.js";
import { stripMarkdown } from "./markdown-strip.js";

/**
 * Resolve a URL path parameter to a canonical identifier.
 * Accepts both shorthand (t1/s1) and full identifiers (/us/usc/t1/s1).
 */
export function resolveIdentifier(source: string, raw: string): string {
  const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;

  if (decoded.startsWith("/us/")) return decoded;

  const prefix = source === "cfr" ? "/us/cfr/" : source === "fr" ? "/us/fr/" : `/us/${source}/`;
  return `${prefix}${decoded}`;
}

/** Build metadata object from a DocumentRow, omitting internal/content fields. */
export function buildMetadata(row: DocumentRow): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    identifier: row.identifier,
    source: row.source === "ecfr" ? "cfr" : row.source,
    legal_status: row.legal_status,
    display_title: row.display_title,
    title_number: row.title_number,
    title_name: row.title_name,
    section_number: row.section_number,
    section_name: row.section_name,
    chapter_number: row.chapter_number,
    chapter_name: row.chapter_name,
    subchapter_number: row.subchapter_number,
    subchapter_name: row.subchapter_name,
    part_number: row.part_number,
    part_name: row.part_name,
    positive_law: row.positive_law === 1,
    status: row.status,
    currency: row.currency,
    last_updated: row.last_updated,
  };

  // Source-specific fields — only include when present
  if (row.source === "usc") {
    meta.source_credit = row.source_credit;
  }

  if (row.source === "ecfr") {
    meta.authority = row.authority;
    meta.regulatory_source = row.regulatory_source;
    meta.agency = row.agency;
    meta.cfr_part = row.cfr_part;
    meta.cfr_subpart = row.cfr_subpart;
  }

  if (row.source === "fr") {
    meta.document_number = row.document_number;
    meta.document_type = row.document_type;
    meta.publication_date = row.publication_date;
    meta.agency = row.agency;
    meta.agencies = row.agencies ? JSON.parse(row.agencies) : null;
    meta.fr_citation = row.fr_citation;
    meta.fr_volume = row.fr_volume;
    meta.effective_date = row.effective_date;
    meta.comments_close_date = row.comments_close_date;
    meta.fr_action = row.fr_action;
    meta.docket_ids = row.docket_ids ? JSON.parse(row.docket_ids) : null;
    meta.cfr_references = row.cfr_references ? JSON.parse(row.cfr_references) : null;
  }

  return meta;
}

/**
 * Apply field selection to a document row.
 * Returns the filtered metadata and whether to include the body.
 */
export function selectFields(
  row: DocumentRow,
  fields: string | undefined,
): { metadata: Record<string, unknown>; includeBody: boolean } {
  const allMetadata = buildMetadata(row);

  if (!fields) {
    return { metadata: allMetadata, includeBody: true };
  }

  if (fields === "metadata") {
    return { metadata: allMetadata, includeBody: false };
  }

  if (fields === "body") {
    return { metadata: {}, includeBody: true };
  }

  // Comma-separated field names
  const requested = new Set(fields.split(",").map((f) => f.trim()));
  const filtered: Record<string, unknown> = {};

  // Always include identifier and source
  filtered.identifier = row.identifier;
  filtered.source = row.source === "ecfr" ? "cfr" : row.source;

  for (const [key, value] of Object.entries(allMetadata)) {
    if (requested.has(key)) {
      filtered[key] = value;
    }
  }

  return { metadata: filtered, includeBody: requested.has("body") };
}

/**
 * Render the full HTTP response for a document row, handling content negotiation,
 * ETag, and field selection. Returns the Hono Response.
 */
export function renderDocumentResponse(
  c: Context,
  row: DocumentRow,
): Response {
  // ETag from content hash
  const etag = `"${row.content_hash.slice(0, 16)}"`;
  c.header("ETag", etag);

  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304);
  }

  const format = resolveFormat(c);

  if (format === "markdown") {
    c.header("Content-Type", "text/markdown; charset=utf-8");
    return c.body(`---\n${row.frontmatter_yaml.trim()}\n---\n${row.markdown_body}`);
  }

  if (format === "text") {
    c.header("Content-Type", "text/plain; charset=utf-8");
    return c.body(stripMarkdown(row.markdown_body));
  }

  // JSON with field selection
  const fields = c.req.query("fields");
  const { metadata, includeBody } = selectFields(row, fields);

  return c.json({
    data: {
      id: row.id,
      identifier: row.identifier,
      source: row.source === "ecfr" ? "cfr" : row.source,
      metadata,
      ...(includeBody ? { body: row.markdown_body } : {}),
    },
    meta: {
      api_version: "v1",
      format_version: row.format_version,
      timestamp: new Date().toISOString(),
    },
  });
}
