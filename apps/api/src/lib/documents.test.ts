import { describe, it, expect } from "vitest";
import type { DocumentRow } from "@lexbuild/core";
import { resolveIdentifier, buildMetadata, requestNeedsDocumentBody, selectFields } from "./documents.js";

describe("resolveIdentifier", () => {
  it("resolves USC shorthand to canonical identifier", () => {
    expect(resolveIdentifier("usc", "t1/s1")).toBe("/us/usc/t1/s1");
  });

  it("resolves eCFR shorthand to /us/cfr/ identifier", () => {
    expect(resolveIdentifier("ecfr", "t17/s240.10b-5")).toBe("/us/cfr/t17/s240.10b-5");
  });

  it("resolves FR shorthand to canonical identifier", () => {
    expect(resolveIdentifier("fr", "2026-06029")).toBe("/us/fr/2026-06029");
  });

  it("passes through full identifiers unchanged", () => {
    expect(resolveIdentifier("usc", "/us/usc/t1/s1")).toBe("/us/usc/t1/s1");
  });

  it("decodes URL-encoded identifiers", () => {
    expect(resolveIdentifier("usc", "%2Fus%2Fusc%2Ft1%2Fs1")).toBe("/us/usc/t1/s1");
  });
});

function makeRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "us-usc-t1-s1",
    source: "usc",
    identifier: "/us/usc/t1/s1",
    title_number: 1,
    title_name: "General Provisions",
    section_number: "1",
    section_name: "Words denoting number",
    chapter_number: "1",
    chapter_name: "Rules of Construction",
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "law",
    positive_law: 1,
    status: "in_force",
    currency: "2024-01-03",
    last_updated: "2024-01-03",
    display_title: "1 U.S.C. 1",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: null,
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
    frontmatter_yaml: 'source: "usc"',
    markdown_body: "# Test\n\nContent.",
    file_path: "usc/title-01/section-1.md",
    content_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    format_version: "1.1.0",
    generator: "lexbuild-test",
    ingested_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildMetadata", () => {
  it("includes standard metadata fields", () => {
    const meta = buildMetadata(makeRow());
    expect(meta.identifier).toBe("/us/usc/t1/s1");
    expect(meta.source).toBe("usc");
    expect(meta.title_number).toBe(1);
    expect(meta.legal_status).toBe("law");
  });

  it("converts positive_law from integer to boolean", () => {
    expect(buildMetadata(makeRow({ positive_law: 1 })).positive_law).toBe(true);
    expect(buildMetadata(makeRow({ positive_law: 0 })).positive_law).toBe(false);
  });

  it("includes source_credit for USC", () => {
    const meta = buildMetadata(makeRow({ source: "usc" }));
    expect(meta.source_credit).toBeDefined();
  });

  it("includes eCFR-specific fields for ecfr source", () => {
    const meta = buildMetadata(
      makeRow({
        source: "ecfr",
        authority: "15 U.S.C. 78a",
        agency: "SEC",
        cfr_part: "240",
      }),
    );
    expect(meta.authority).toBe("15 U.S.C. 78a");
    expect(meta.agency).toBe("SEC");
    expect(meta.cfr_part).toBe("240");
  });

  it("includes FR-specific fields for fr source", () => {
    const meta = buildMetadata(
      makeRow({
        source: "fr",
        document_number: "2026-06029",
        document_type: "rule",
        publication_date: "2026-03-15",
        agency: "EPA",
        agencies: '["EPA"]',
      }),
    );
    expect(meta.document_number).toBe("2026-06029");
    expect(meta.document_type).toBe("rule");
    expect(meta.publication_date).toBe("2026-03-15");
  });
});

describe("selectFields", () => {
  it("returns all metadata and body when fields is undefined", () => {
    const { metadata, includeBody } = selectFields(makeRow(), undefined);
    expect(metadata.identifier).toBe("/us/usc/t1/s1");
    expect(includeBody).toBe(true);
  });

  it('returns all metadata without body for fields="metadata"', () => {
    const { metadata, includeBody } = selectFields(makeRow(), "metadata");
    expect(metadata.identifier).toBe("/us/usc/t1/s1");
    expect(includeBody).toBe(false);
  });

  it('returns empty metadata with body for fields="body"', () => {
    const { metadata, includeBody } = selectFields(makeRow(), "body");
    expect(Object.keys(metadata)).toHaveLength(0);
    expect(includeBody).toBe(true);
  });

  it("returns only requested fields plus identifier and source", () => {
    const { metadata, includeBody } = selectFields(makeRow(), "title_number,status");
    expect(metadata.identifier).toBe("/us/usc/t1/s1");
    expect(metadata.source).toBe("usc");
    expect(metadata.title_number).toBe(1);
    expect(metadata.status).toBe("in_force");
    expect(metadata.chapter_name).toBeUndefined();
    expect(includeBody).toBe(false);
  });
});

describe("requestNeedsDocumentBody", () => {
  function makeContext(url: string, headers?: Record<string, string>) {
    const requestInit = headers ? { headers } : undefined;
    const request = new Request(`https://lexbuild.dev${url}`, requestInit);
    return {
      req: {
        query: (name: string) => new URL(request.url).searchParams.get(name) ?? undefined,
        header: (name: string) => request.headers.get(name) ?? undefined,
      },
    } as Parameters<typeof requestNeedsDocumentBody>[0];
  }

  it("returns false for metadata-only JSON requests", () => {
    expect(requestNeedsDocumentBody(makeContext("/api/usc/documents/t1?fields=metadata"))).toBe(false);
  });

  it("returns false when selected fields omit body", () => {
    expect(requestNeedsDocumentBody(makeContext("/api/usc/documents/t1?fields=title_number,status"))).toBe(false);
  });

  it("returns true for markdown requests", () => {
    expect(requestNeedsDocumentBody(makeContext("/api/usc/documents/t1?format=markdown"))).toBe(true);
  });

  it("returns true for default JSON requests", () => {
    expect(requestNeedsDocumentBody(makeContext("/api/usc/documents/t1"))).toBe(true);
  });
});
