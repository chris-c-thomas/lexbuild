/**
 * Federal Register frontmatter builder.
 *
 * Constructs FrontmatterData from an emitted FR AST node, its context,
 * and optional JSON metadata from the FederalRegister.gov API.
 */

import type { LevelNode, EmitContext, FrontmatterData } from "@lexbuild/core";
import type { FrDocumentXmlMeta } from "./fr-builder.js";

/**
 * Metadata from the FederalRegister.gov API JSON response.
 * Stored as a sidecar `.json` file alongside each `.xml` download.
 */
export interface FrDocumentJsonMeta {
  /** FR document number (e.g., "2026-06029") */
  document_number: string;
  /** Document type (Rule, Proposed Rule, Notice, Presidential Document) */
  type: string;
  /** Document title */
  title: string;
  /** Publication date (YYYY-MM-DD) */
  publication_date: string;
  /** Full FR citation (e.g., "91 FR 14523") */
  citation: string;
  /** FR volume number */
  volume: number;
  /** Start page number */
  start_page: number;
  /** End page number */
  end_page: number;
  /** Agencies with hierarchy info */
  agencies: Array<{
    name: string;
    id: number;
    slug: string;
    parent_id?: number | null;
    raw_name?: string;
  }>;
  /** CFR title/part references */
  cfr_references: Array<{ title: number; part: number }>;
  /** Docket identifiers */
  docket_ids: string[];
  /** Regulation Identifier Numbers */
  regulation_id_numbers: string[];
  /** Effective date (YYYY-MM-DD) */
  effective_on?: string | null;
  /** Comment period end date (YYYY-MM-DD) */
  comments_close_on?: string | null;
  /** Action description (e.g., "Final rule.") */
  action?: string | null;
  /** Document abstract */
  abstract?: string | null;
  /** Whether the document is significant */
  significant?: boolean | null;
  /** Topics/keywords */
  topics: string[];
  /** URL to full text XML */
  full_text_xml_url: string;
}

/** Normalize API document type to lowercase snake_case */
function normalizeDocumentType(apiType: string): string {
  const map: Record<string, string> = {
    Rule: "rule",
    "Proposed Rule": "proposed_rule",
    Notice: "notice",
    "Presidential Document": "presidential_document",
  };
  return map[apiType] ?? apiType.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Build FrontmatterData from an FR document node with optional JSON metadata.
 *
 * If JSON metadata is available (from the API sidecar file), it enriches
 * the frontmatter with structured agency, CFR reference, docket, and
 * date information that isn't available in the XML alone.
 */
export function buildFrFrontmatter(
  node: LevelNode,
  _context: EmitContext,
  xmlMeta: FrDocumentXmlMeta,
  jsonMeta?: FrDocumentJsonMeta,
): FrontmatterData {
  const documentNumber = jsonMeta?.document_number ?? xmlMeta.documentNumber ?? "";
  const subject = jsonMeta?.title ?? xmlMeta.subject ?? node.heading ?? "";
  const publicationDate = jsonMeta?.publication_date ?? xmlMeta.publicationDate ?? "";
  const documentType = jsonMeta ? normalizeDocumentType(jsonMeta.type) : xmlMeta.documentTypeNormalized;

  // Build agencies list
  let agencies: string[] | undefined;
  if (jsonMeta?.agencies && jsonMeta.agencies.length > 0) {
    agencies = jsonMeta.agencies.map((a) => a.name);
  } else if (xmlMeta.agency) {
    agencies = [xmlMeta.agency];
    if (xmlMeta.subAgency) {
      agencies.push(xmlMeta.subAgency);
    }
  }

  // Build CFR references list
  let cfrReferences: string[] | undefined;
  if (jsonMeta?.cfr_references && jsonMeta.cfr_references.length > 0) {
    cfrReferences = jsonMeta.cfr_references.map((r) => `${r.title} CFR Part ${r.part}`);
  } else if (xmlMeta.cfrCitation) {
    cfrReferences = [xmlMeta.cfrCitation];
  }

  // Build docket IDs list
  let docketIds: string[] | undefined;
  if (jsonMeta?.docket_ids && jsonMeta.docket_ids.length > 0) {
    docketIds = jsonMeta.docket_ids;
  }

  // Primary agency for the existing `agency` field
  const primaryAgency = agencies && agencies.length > 0 ? agencies[0] : undefined;

  // FR citation
  const frCitation = jsonMeta?.citation;

  // RIN
  const rin = jsonMeta?.regulation_id_numbers?.[0] ?? xmlMeta.rin;

  const fm: FrontmatterData = {
    source: "fr",
    legal_status: "authoritative_unofficial",
    identifier: node.identifier ?? `/us/fr/${documentNumber}`,
    title: subject,
    title_number: 0, // FR documents don't belong to a USC/CFR title
    title_name: "Federal Register",
    section_number: documentNumber,
    section_name: subject,
    positive_law: false,
    currency: publicationDate,
    last_updated: publicationDate,

    // Shared optional fields
    agency: primaryAgency,

    // FR-specific fields
    document_number: documentNumber || undefined,
    document_type: documentType || undefined,
    fr_citation: frCitation,
    fr_volume: jsonMeta?.volume,
    publication_date: publicationDate || undefined,
    agencies: agencies && agencies.length > 0 ? agencies : undefined,
    cfr_references: cfrReferences && cfrReferences.length > 0 ? cfrReferences : undefined,
    docket_ids: docketIds && docketIds.length > 0 ? docketIds : undefined,
    rin: rin || undefined,
    effective_date: jsonMeta?.effective_on ?? undefined,
    comments_close_date: jsonMeta?.comments_close_on ?? undefined,
    fr_action: jsonMeta?.action ?? undefined,
  };

  return fm;
}
