import { describe, it, expect } from "vitest";
import {
  LEVEL_TYPES,
  BIG_LEVELS,
  SMALL_LEVELS,
  type LevelNode,
  type ContentNode,
  type InlineNode,
  type NoteNode,
  type SourceCreditNode,
  type ASTNode,
  type DocumentMeta,
  type AncestorInfo,
  type FrontmatterData,
} from "./types.js";

describe("AST types", () => {
  describe("LEVEL_TYPES", () => {
    it("contains all expected levels in order", () => {
      expect(LEVEL_TYPES[0]).toBe("title");
      expect(LEVEL_TYPES[LEVEL_TYPES.indexOf("section")]).toBe("section");
      expect(LEVEL_TYPES[LEVEL_TYPES.length - 1]).toBe("subsubitem");
    });

    it("has section as the dividing line between big and small", () => {
      const sectionIndex = LEVEL_TYPES.indexOf("section");
      expect(sectionIndex).toBeGreaterThan(0);

      // Everything before section is big (or preliminary)
      for (let i = 0; i < sectionIndex; i++) {
        expect(BIG_LEVELS.has(LEVEL_TYPES[i]!)).toBe(true);
      }

      // Everything after section is small
      for (let i = sectionIndex + 1; i < LEVEL_TYPES.length; i++) {
        expect(SMALL_LEVELS.has(LEVEL_TYPES[i]!)).toBe(true);
      }
    });
  });

  describe("BIG_LEVELS and SMALL_LEVELS", () => {
    it("are disjoint sets", () => {
      for (const level of BIG_LEVELS) {
        expect(SMALL_LEVELS.has(level)).toBe(false);
      }
    });

    it("do not include section (it is the primary level)", () => {
      expect(BIG_LEVELS.has("section")).toBe(false);
      expect(SMALL_LEVELS.has("section")).toBe(false);
    });
  });

  describe("node type construction", () => {
    it("creates a valid LevelNode", () => {
      const node: LevelNode = {
        type: "level",
        levelType: "section",
        num: "§ 1.",
        numValue: "1",
        heading: "Words denoting number, gender, and so forth",
        identifier: "/us/usc/t1/s1",
        children: [],
      };
      expect(node.type).toBe("level");
      expect(node.levelType).toBe("section");
    });

    it("creates a valid ContentNode with inline children", () => {
      const textNode: InlineNode = {
        type: "inline",
        inlineType: "text",
        text: "In determining the meaning of any Act of Congress",
      };
      const node: ContentNode = {
        type: "content",
        variant: "chapeau",
        children: [textNode],
      };
      expect(node.variant).toBe("chapeau");
      expect(node.children).toHaveLength(1);
    });

    it("creates a valid InlineNode with nested children", () => {
      const inner: InlineNode = {
        type: "inline",
        inlineType: "text",
        text: "section 7",
      };
      const ref: InlineNode = {
        type: "inline",
        inlineType: "ref",
        href: "/us/usc/t1/s7",
        children: [inner],
      };
      expect(ref.inlineType).toBe("ref");
      expect(ref.href).toBe("/us/usc/t1/s7");
      expect(ref.children).toHaveLength(1);
    });

    it("creates a valid NoteNode", () => {
      const node: NoteNode = {
        type: "note",
        topic: "amendments",
        heading: "Amendments",
        children: [],
      };
      expect(node.topic).toBe("amendments");
    });

    it("creates a valid SourceCreditNode", () => {
      const text: InlineNode = {
        type: "inline",
        inlineType: "text",
        text: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
      };
      const node: SourceCreditNode = {
        type: "sourceCredit",
        children: [text],
      };
      expect(node.type).toBe("sourceCredit");
    });

    it("uses ASTNode union type correctly", () => {
      const nodes: ASTNode[] = [
        { type: "level", levelType: "section", children: [] },
        { type: "content", variant: "content", children: [] },
        { type: "inline", inlineType: "text", text: "hello" },
        { type: "note", children: [] },
        { type: "sourceCredit", children: [] },
      ];
      expect(nodes).toHaveLength(5);
    });
  });

  describe("context types", () => {
    it("creates valid DocumentMeta", () => {
      const meta: DocumentMeta = {
        dcTitle: "Title 1",
        dcType: "USCTitle",
        docNumber: "1",
        positivelaw: true,
        created: "2025-12-03T10:11:39",
        identifier: "/us/usc/t1",
      };
      expect(meta.docNumber).toBe("1");
      expect(meta.positivelaw).toBe(true);
    });

    it("creates valid AncestorInfo", () => {
      const ancestors: AncestorInfo[] = [
        {
          levelType: "title",
          numValue: "1",
          heading: "GENERAL PROVISIONS",
          identifier: "/us/usc/t1",
        },
        {
          levelType: "chapter",
          numValue: "1",
          heading: "RULES OF CONSTRUCTION",
          identifier: "/us/usc/t1/ch1",
        },
      ];
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0]!.levelType).toBe("title");
    });

    it("creates valid FrontmatterData", () => {
      const fm: FrontmatterData = {
        source: "usc",
        legal_status: "official_legal_evidence",
        identifier: "/us/usc/t1/s1",
        title: "1 USC § 1 - Words denoting number, gender, and so forth",
        title_number: 1,
        title_name: "General Provisions",
        chapter_number: 1,
        chapter_name: "Rules of Construction",
        section_number: "1",
        section_name: "Words denoting number, gender, and so forth",
        positive_law: true,
        source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
        currency: "119-73",
        last_updated: "2025-12-03",
      };
      expect(fm.title_number).toBe(1);
      expect(fm.section_number).toBe("1");
    });
  });
});
