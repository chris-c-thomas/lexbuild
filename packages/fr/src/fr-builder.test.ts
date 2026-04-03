import { describe, it, expect } from "vitest";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import { XMLParser } from "@lexbuild/core";
import type { LevelNode, ContentNode, InlineNode, NoteNode, EmitContext } from "@lexbuild/core";
import { FrASTBuilder } from "./fr-builder.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments/fr");

/** Helper: parse an XML fixture and collect emitted nodes */
async function parseFixture(
  fixtureName: string,
): Promise<{ collected: Array<{ node: LevelNode; context: EmitContext }>; builder: FrASTBuilder }> {
  const collected: Array<{ node: LevelNode; context: EmitContext }> = [];

  const builder = new FrASTBuilder({
    onEmit: (node, context) => {
      collected.push({ node, context });
    },
  });

  const parser = new XMLParser({ defaultNamespace: "" });
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  const stream = createReadStream(resolve(FIXTURES_DIR, fixtureName), "utf-8");
  await parser.parseStream(stream);

  return { collected, builder };
}

/** Helper: find content nodes with text matching a pattern */
function findContentWithText(node: LevelNode, pattern: RegExp): ContentNode | undefined {
  for (const child of node.children) {
    if (child.type === "content") {
      const contentNode = child as ContentNode;
      for (const inline of contentNode.children) {
        if (inline.type === "inline" && (inline as InlineNode).text?.match(pattern)) {
          return contentNode;
        }
      }
    }
  }
  return undefined;
}

describe("FrASTBuilder", () => {
  describe("simple-rule.xml", () => {
    it("parses a RULE into a section-level LevelNode", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      expect(collected.length).toBe(1);

      const { node } = collected[0]!;
      expect(node.type).toBe("level");
      expect(node.levelType).toBe("section");
      expect(node.sourceElement).toBe("RULE");
    });

    it("extracts SUBJECT as heading", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;
      expect(node.heading).toBe("Amendments to Exchange Act Rule 10b-5");
    });

    it("builds identifier from FRDOC document number", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;
      expect(node.identifier).toBe("/us/fr/2026-06029");
      expect(node.numValue).toBe("2026-06029");
    });

    it("extracts AGENCY metadata", async () => {
      const { collected, builder } = await parseFixture("simple-rule.xml");
      expect(collected.length).toBe(1);

      const metas = builder.getDocumentMetas();
      expect(metas.length).toBe(1);
      expect(metas[0]!.agency).toBe("SECURITIES AND EXCHANGE COMMISSION");
      expect(metas[0]!.subAgency).toBe("Division of Trading and Markets");
    });

    it("extracts CFR citation and RIN metadata", async () => {
      const { builder } = await parseFixture("simple-rule.xml");
      const metas = builder.getDocumentMetas();
      expect(metas[0]!.cfrCitation).toBe("17 CFR Part 240");
      expect(metas[0]!.rin).toBe("3235-AM00");
    });

    it("extracts document type as normalized string", async () => {
      const { builder } = await parseFixture("simple-rule.xml");
      const metas = builder.getDocumentMetas();
      expect(metas[0]!.documentType).toBe("RULE");
      expect(metas[0]!.documentTypeNormalized).toBe("rule");
    });

    it("creates ContentNode children for preamble sections", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;

      // Preamble sections create bold label content nodes
      const contentNodes = node.children.filter((c) => c.type === "content") as ContentNode[];
      expect(contentNodes.length).toBeGreaterThan(0);

      // First content should be the "AGENCY:" bold label
      const firstContent = contentNodes[0]!;
      const firstInline = firstContent.children[0] as InlineNode;
      expect(firstInline.inlineType).toBe("bold");
    });

    it("creates ContentNode children for SUPLINF paragraphs", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;

      // Should have content from SUPLINF paragraphs
      const textContent = findContentWithText(node, /Securities Exchange Act of 1934 governs/);
      expect(textContent).toBeDefined();
    });

    it("handles E emphasis codes (T=03 as italic for citations)", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;

      // The DATES section has <E T="03">Effective date:</E>
      // T="03" maps to italic in FR (used for case names, citations, publication titles)
      const contentNodes = node.children.filter((c) => c.type === "content") as ContentNode[];
      let foundItalicEmphasis = false;
      for (const content of contentNodes) {
        for (const inline of content.children) {
          if (inline.type === "inline" && (inline as InlineNode).inlineType === "italic") {
            const italicNode = inline as InlineNode;
            const text = italicNode.text ?? "";
            const childText = italicNode.children?.map((c) => (c as InlineNode).text ?? "").join("") ?? "";
            if (text.includes("Effective date") || childText.includes("Effective date")) {
              foundItalicEmphasis = true;
            }
          }
        }
      }
      expect(foundItalicEmphasis).toBe(true);
    });

    it("handles italic inline elements", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;

      // The SUPLINF has <I>any manipulative or deceptive device</I>
      const contentNodes = node.children.filter((c) => c.type === "content") as ContentNode[];
      let foundItalic = false;
      for (const content of contentNodes) {
        for (const inline of content.children) {
          if (inline.type === "inline" && (inline as InlineNode).inlineType === "italic") {
            foundItalic = true;
          }
        }
      }
      expect(foundItalic).toBe(true);
    });

    it("creates signature NoteNode", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { node } = collected[0]!;

      const sigNodes = node.children.filter(
        (c) => c.type === "note" && (c as NoteNode).noteType === "signature",
      ) as NoteNode[];
      expect(sigNodes.length).toBe(1);

      // Signature should have content children with name/title/date
      expect(sigNodes[0]!.children.length).toBeGreaterThan(0);
    });

    it("populates EmitContext with documentMeta", async () => {
      const { collected } = await parseFixture("simple-rule.xml");
      const { context } = collected[0]!;

      expect(context.documentMeta.dcTitle).toBe("Amendments to Exchange Act Rule 10b-5");
      expect(context.documentMeta.dcType).toBe("rule");
    });

    it("infers publication date from FRDOC filing date", async () => {
      // Fixture has: Filed 3-27-26 → publication date = 2026-03-28
      const { builder } = await parseFixture("simple-rule.xml");
      const metas = builder.getDocumentMetas();
      expect(metas[0]!.publicationDate).toBe("2026-03-28");
    });
  });

  describe("publication date edge cases", () => {
    // Helper to build minimal XML with a specific FRDOC line
    function buildFrdocXml(frdocText: string): string {
      return `<RULE><PREAMB><AGENCY TYPE="F">TEST</AGENCY><SUBJECT>Test</SUBJECT></PREAMB><FRDOC>${frdocText}</FRDOC></RULE>`;
    }

    async function parseFrdocDate(frdocText: string): Promise<string | undefined> {
      const builder = new FrASTBuilder({ onEmit: () => {} });
      const parser = new XMLParser({ defaultNamespace: "" });
      parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
      parser.on("closeElement", (name) => builder.onCloseElement(name));
      parser.on("text", (text) => builder.onText(text));

      const stream = Readable.from(buildFrdocXml(frdocText));
      await parser.parseStream(stream);

      const metas = builder.getDocumentMetas();
      return metas[0]?.publicationDate;
    }

    it("handles month-end rollover (Jan 31 → Feb 1)", async () => {
      const date = await parseFrdocDate("[FR Doc. 2026-00001 Filed 1-31-26; 8:45 am]");
      expect(date).toBe("2026-02-01");
    });

    it("handles year-end rollover (Dec 31 → Jan 1 next year)", async () => {
      const date = await parseFrdocDate("[FR Doc. 2025-99999 Filed 12-31-25; 8:45 am]");
      expect(date).toBe("2026-01-01");
    });

    it("maps 2-digit year 99 to 1999", async () => {
      const date = await parseFrdocDate("[FR Doc. 99-12345 Filed 6-15-99; 8:45 am]");
      expect(date).toBe("1999-06-16");
    });

    it("returns undefined when FRDOC has no Filed clause", async () => {
      const date = await parseFrdocDate("[FR Doc. 2026-00001]");
      expect(date).toBeUndefined();
    });
  });

  describe("notice.xml", () => {
    it("parses a NOTICE document", async () => {
      const { collected, builder } = await parseFixture("notice.xml");
      expect(collected.length).toBe(1);

      const { node } = collected[0]!;
      expect(node.sourceElement).toBe("NOTICE");
      expect(node.heading).toBe("Meeting of the Advisory Board on Radiation and Worker Health");

      const metas = builder.getDocumentMetas();
      expect(metas[0]!.documentTypeNormalized).toBe("notice");
      expect(metas[0]!.documentNumber).toBe("2026-06030");
    });
  });

  describe("rule-with-regtext.xml", () => {
    it("parses REGTEXT amendment paragraphs", async () => {
      const { collected } = await parseFixture("rule-with-regtext.xml");
      expect(collected.length).toBe(1);

      const { node } = collected[0]!;

      // AMDPAR text should appear as content
      const amdContent = findContentWithText(node, /authority citation for part 71/);
      expect(amdContent).toBeDefined();
    });

    it("renders REGTEXT CFR reference as bold label", async () => {
      const { collected } = await parseFixture("rule-with-regtext.xml");
      const { node } = collected[0]!;

      // REGTEXT TITLE="14" PART="71" should produce "14 CFR Part 71" bold label
      const contentNodes = node.children.filter((c) => c.type === "content") as ContentNode[];
      let foundCfrLabel = false;
      for (const content of contentNodes) {
        for (const inline of content.children) {
          if (inline.type === "inline" && (inline as InlineNode).inlineType === "bold") {
            const text =
              (inline as InlineNode).text ??
              (inline as InlineNode).children?.map((c) => (c as InlineNode).text ?? "").join("") ??
              "";
            if (text.includes("14 CFR Part 71")) {
              foundCfrLabel = true;
            }
          }
        }
      }
      expect(foundCfrLabel).toBe(true);
    });

    it("extracts FRDOC document number", async () => {
      const { builder } = await parseFixture("rule-with-regtext.xml");
      const metas = builder.getDocumentMetas();
      expect(metas[0]!.documentNumber).toBe("2026-06086");
    });
  });
});
