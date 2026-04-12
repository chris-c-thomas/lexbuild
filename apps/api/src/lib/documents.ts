import type { Context } from "hono";
import type { DocumentRow } from "@lexbuild/core";
import { resolveFormat } from "./content-negotiation.js";
import { stripMarkdown } from "./markdown-strip.js";
import { toApiSource } from "./source-registry.js";

/** Columns needed to render metadata and ETag responses without loading Markdown content. */
export const DOCUMENT_METADATA_COLUMNS =
  "id, source, identifier, title_number, title_name, section_number, section_name, " +
  "chapter_number, chapter_name, subchapter_number, subchapter_name, part_number, part_name, " +
  "legal_status, positive_law, status, currency, last_updated, display_title, " +
  "document_number, document_type, publication_date, agency, fr_citation, fr_volume, " +
  "effective_date, comments_close_date, fr_action, authority, regulatory_source, cfr_part, " +
  "cfr_subpart, agencies, cfr_references, docket_ids, source_credit, content_hash, format_version";

/** Row shape used to render document responses before optionally loading the Markdown body. */
export interface DocumentRenderableRow extends Omit<
  DocumentRow,
  "frontmatter_yaml" | "markdown_body" | "file_path" | "generator" | "ingested_at"
> {
  frontmatter_yaml?: string;
  markdown_body?: string;
}

/** Safely parse a JSON column value, returning null on malformed data. */
function safeJsonParse(value: string | null, field: string, identifier: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (err: unknown) {
    const parseMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[documents] Malformed JSON in ${field} for ${identifier}: ${parseMsg}`);
    return null;
  }
}

/**
 * Resolve a URL path parameter to a canonical identifier.
 * Accepts both shorthand (t1/s1) and full identifiers (/us/usc/t1/s1).
 */
export function resolveIdentifier(source: string, raw: string): string {
  const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;

  if (decoded.startsWith("/us/")) return decoded;

  const prefix = source === "ecfr" ? "/us/cfr/" : source === "fr" ? "/us/fr/" : `/us/${source}/`;
  return `${prefix}${decoded}`;
}

/** Determine whether the request needs Markdown content loaded from the database. */
export function requestNeedsDocumentBody(c: Context): boolean {
  const format = resolveFormat(c);
  if (format === "markdown" || format === "text") {
    return true;
  }

  const fields = c.req.query("fields");
  if (!fields) {
    return true;
  }

  if (fields === "metadata") {
    return false;
  }

  return fields
    .split(",")
    .map((field) => field.trim())
    .includes("body");
}

/** Build metadata object from a DocumentRow, omitting internal/content fields. */
export function buildMetadata(row: DocumentRenderableRow): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    identifier: row.identifier,
    source: toApiSource(row.source),
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
    meta.agencies = safeJsonParse(row.agencies, "agencies", row.identifier);
    meta.fr_citation = row.fr_citation;
    meta.fr_volume = row.fr_volume;
    meta.effective_date = row.effective_date;
    meta.comments_close_date = row.comments_close_date;
    meta.fr_action = row.fr_action;
    meta.docket_ids = safeJsonParse(row.docket_ids, "docket_ids", row.identifier);
    meta.cfr_references = safeJsonParse(row.cfr_references, "cfr_references", row.identifier);
  }

  return meta;
}

/**
 * Apply field selection to a document row.
 * Returns the filtered metadata and whether to include the body.
 */
export function selectFields(
  row: DocumentRenderableRow,
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

  const requested = new Set(fields.split(",").map((f) => f.trim()));
  const filtered: Record<string, unknown> = {};

  // Identifier and source are always returned regardless of field selection
  filtered.identifier = row.identifier;
  filtered.source = toApiSource(row.source);

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
export function renderDocumentResponse(c: Context, row: DocumentRenderableRow): Response {
  const etag = `"${row.content_hash.slice(0, 16)}"`;
  c.header("ETag", etag);

  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304);
  }

  const format = resolveFormat(c);

  if (format === "markdown") {
    if (row.frontmatter_yaml === undefined || row.markdown_body === undefined) {
      throw new Error(`Markdown requested without loaded content for ${row.identifier}`);
    }

    c.header("Content-Type", "text/markdown; charset=utf-8");
    return c.body(`---\n${row.frontmatter_yaml.trim()}\n---\n${row.markdown_body}`);
  }

  if (format === "text") {
    if (row.markdown_body === undefined) {
      throw new Error(`Plain text requested without loaded content for ${row.identifier}`);
    }

    c.header("Content-Type", "text/plain; charset=utf-8");
    return c.body(stripMarkdown(row.markdown_body));
  }

  const fields = c.req.query("fields");
  const { metadata, includeBody } = selectFields(row, fields);

  if (includeBody && row.markdown_body === undefined) {
    throw new Error(`Body requested without loaded content for ${row.identifier}`);
  }

  return c.json({
    data: {
      id: row.id,
      identifier: row.identifier,
      source: toApiSource(row.source),
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
