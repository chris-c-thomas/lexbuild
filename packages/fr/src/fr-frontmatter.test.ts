import { describe, it, expect } from "vitest";
import { buildFrFrontmatter } from "./fr-frontmatter.js";
import type { FrDocumentJsonMeta } from "./fr-frontmatter.js";
import type { FrDocumentXmlMeta } from "./fr-builder.js";
import type { LevelNode, EmitContext } from "@lexbuild/core";

/** Helper: create a minimal LevelNode */
function makeNode(overrides?: Partial<LevelNode>): LevelNode {
  return {
    type: "level",
    levelType: "section",
    children: [],
    ...overrides,
  };
}

/** Helper: create a minimal EmitContext */
function makeContext(): EmitContext {
  return {
    ancestors: [],
    documentMeta: {},
  };
}

/** Helper: create minimal XML metadata */
function makeXmlMeta(overrides?: Partial<FrDocumentXmlMeta>): FrDocumentXmlMeta {
  return {
    documentType: "RULE",
    documentTypeNormalized: "rule",
    ...overrides,
  };
}

/** Helper: create minimal JSON metadata */
function makeJsonMeta(overrides?: Partial<FrDocumentJsonMeta>): FrDocumentJsonMeta {
  return {
    document_number: "2026-06029",
    type: "Rule",
    title: "Test Rule",
    publication_date: "2026-03-28",
    citation: "91 FR 14523",
    volume: 91,
    start_page: 14523,
    end_page: 14530,
    agencies: [{ name: "Test Agency", id: 1, slug: "test-agency" }],
    cfr_references: [{ title: 17, part: 240 }],
    docket_ids: ["Release No. 34-99999"],
    regulation_id_numbers: ["3235-AM00"],
    topics: [],
    full_text_xml_url: "https://example.com/doc.xml",
    ...overrides,
  };
}

describe("buildFrFrontmatter", () => {
  describe("fixed fields", () => {
    it("sets source to fr", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta());
      expect(fm.source).toBe("fr");
    });

    it("sets legal_status to authoritative_unofficial", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta());
      expect(fm.legal_status).toBe("authoritative_unofficial");
    });

    it("sets title_number to 0", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta());
      expect(fm.title_number).toBe(0);
    });

    it("sets title_name to Federal Register", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta());
      expect(fm.title_name).toBe("Federal Register");
    });

    it("sets positive_law to false", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta());
      expect(fm.positive_law).toBe(false);
    });
  });

  describe("XML-only mode (no JSON sidecar)", () => {
    it("uses xmlMeta.documentNumber for document_number", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta({ documentNumber: "2026-06029" }));
      expect(fm.document_number).toBe("2026-06029");
      expect(fm.section_number).toBe("2026-06029");
    });

    it("uses xmlMeta.subject for title", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta({ subject: "Test Subject" }));
      expect(fm.title).toBe("Test Subject");
      expect(fm.section_name).toBe("Test Subject");
    });

    it("uses xmlMeta.documentTypeNormalized for document_type", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta({ documentTypeNormalized: "proposed_rule" }),
      );
      expect(fm.document_type).toBe("proposed_rule");
    });

    it("uses xmlMeta.agency for agencies", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta({ agency: "SEC", subAgency: "Division of Trading" }),
      );
      expect(fm.agencies).toEqual(["SEC", "Division of Trading"]);
    });

    it("uses xmlMeta.cfrCitation for cfr_references", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta({ cfrCitation: "17 CFR Part 240" }));
      expect(fm.cfr_references).toEqual(["17 CFR Part 240"]);
    });

    it("uses xmlMeta.rin for rin", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta({ rin: "3235-AM00" }));
      expect(fm.rin).toBe("3235-AM00");
    });

    it("omits empty agencies", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta());
      expect(fm.agencies).toBeUndefined();
    });
  });

  describe("JSON-enriched mode", () => {
    it("prefers JSON document_number over XML", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta({ documentNumber: "xml-number" }),
        makeJsonMeta({ document_number: "json-number" }),
      );
      expect(fm.document_number).toBe("json-number");
    });

    it("prefers JSON title over XML subject", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta({ subject: "XML Subject" }),
        makeJsonMeta({ title: "JSON Title" }),
      );
      expect(fm.title).toBe("JSON Title");
    });

    it("normalizes JSON document type", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta(), makeJsonMeta({ type: "Proposed Rule" }));
      expect(fm.document_type).toBe("proposed_rule");
    });

    it("uses JSON agencies", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta({ agency: "XML Agency" }),
        makeJsonMeta({
          agencies: [
            { name: "Agency One", id: 1, slug: "a1" },
            { name: "Agency Two", id: 2, slug: "a2" },
          ],
        }),
      );
      expect(fm.agencies).toEqual(["Agency One", "Agency Two"]);
    });

    it("uses JSON cfr_references", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta({ cfrCitation: "XML citation" }),
        makeJsonMeta({ cfr_references: [{ title: 10, part: 2 }] }),
      );
      expect(fm.cfr_references).toEqual(["10 CFR Part 2"]);
    });

    it("uses JSON docket_ids", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta(),
        makeJsonMeta({ docket_ids: ["DOCKET-001", "DOCKET-002"] }),
      );
      expect(fm.docket_ids).toEqual(["DOCKET-001", "DOCKET-002"]);
    });

    it("omits empty docket_ids", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta(), makeJsonMeta({ docket_ids: [] }));
      expect(fm.docket_ids).toBeUndefined();
    });

    it("uses JSON publication_date for currency and last_updated", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta(),
        makeJsonMeta({ publication_date: "2026-03-28" }),
      );
      expect(fm.publication_date).toBe("2026-03-28");
      expect(fm.currency).toBe("2026-03-28");
      expect(fm.last_updated).toBe("2026-03-28");
    });

    it("uses JSON fr_citation and fr_volume", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta(),
        makeJsonMeta({ citation: "91 FR 14523", volume: 91 }),
      );
      expect(fm.fr_citation).toBe("91 FR 14523");
      expect(fm.fr_volume).toBe(91);
    });

    it("uses JSON effective_on for effective_date", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta(),
        makeJsonMeta({ effective_on: "2026-05-27" }),
      );
      expect(fm.effective_date).toBe("2026-05-27");
    });

    it("uses JSON comments_close_on for comments_close_date", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta(),
        makeJsonMeta({ comments_close_on: "2026-06-15" }),
      );
      expect(fm.comments_close_date).toBe("2026-06-15");
    });

    it("uses JSON action for fr_action", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta(), makeJsonMeta({ action: "Final rule." }));
      expect(fm.fr_action).toBe("Final rule.");
    });

    it("handles null optional JSON fields", () => {
      const fm = buildFrFrontmatter(
        makeNode(),
        makeContext(),
        makeXmlMeta(),
        makeJsonMeta({
          effective_on: null,
          comments_close_on: null,
          action: null,
        }),
      );
      expect(fm.effective_date).toBeUndefined();
      expect(fm.comments_close_date).toBeUndefined();
      expect(fm.fr_action).toBeUndefined();
    });
  });

  describe("identifier", () => {
    it("uses node.identifier when present", () => {
      const fm = buildFrFrontmatter(makeNode({ identifier: "/us/fr/2026-06029" }), makeContext(), makeXmlMeta());
      expect(fm.identifier).toBe("/us/fr/2026-06029");
    });

    it("constructs identifier from document number when node has none", () => {
      const fm = buildFrFrontmatter(makeNode(), makeContext(), makeXmlMeta({ documentNumber: "2026-06029" }));
      expect(fm.identifier).toBe("/us/fr/2026-06029");
    });
  });
});
