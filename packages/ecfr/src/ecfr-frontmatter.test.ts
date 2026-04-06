import { describe, it, expect, vi, afterEach } from "vitest";
import type { LevelNode, EmitContext, AncestorInfo } from "@lexbuild/core";
import { buildEcfrFrontmatter } from "./ecfr-frontmatter.js";

/** Build a minimal section-level LevelNode for testing */
function makeSection(overrides?: Partial<LevelNode>): LevelNode {
  return {
    type: "level",
    levelType: "section",
    numValue: "1.1",
    heading: "Definitions",
    children: [],
    ...overrides,
  };
}

/** Build a minimal EmitContext with title and chapter ancestors */
function makeContext(overrides?: {
  titleNum?: string;
  titleName?: string;
  chapterNum?: string;
  chapterName?: string;
  partNum?: string;
  partName?: string;
}): EmitContext {
  const ancestors: AncestorInfo[] = [];

  ancestors.push({
    levelType: "title",
    numValue: overrides?.titleNum ?? "17",
    heading: overrides?.titleName ?? "Commodity and Securities Exchanges",
    identifier: `/us/cfr/t${overrides?.titleNum ?? "17"}`,
  });

  if (overrides?.chapterNum || overrides?.chapterName) {
    ancestors.push({
      levelType: "chapter",
      numValue: overrides?.chapterNum,
      heading: overrides?.chapterName,
    });
  }

  if (overrides?.partNum || overrides?.partName) {
    ancestors.push({
      levelType: "part",
      numValue: overrides?.partNum ?? "1",
      heading: overrides?.partName ?? "General Regulations",
    });
  }

  return {
    ancestors,
    documentMeta: {},
  };
}

describe("buildEcfrFrontmatter", () => {
  describe("currencyDate parameter", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses provided currencyDate for currency and last_updated fields", () => {
      const fm = buildEcfrFrontmatter(
        makeSection(),
        makeContext({ partNum: "1" }),
        "2026-03-15",
      );

      expect(fm.currency).toBe("2026-03-15");
      expect(fm.last_updated).toBe("2026-03-15");
    });

    it("falls back to today when currencyDate is omitted", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

      const fm = buildEcfrFrontmatter(makeSection(), makeContext({ partNum: "1" }));

      expect(fm.currency).toBe("2026-06-15");
      expect(fm.last_updated).toBe("2026-06-15");
    });

    it("falls back to today when currencyDate is undefined", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

      const fm = buildEcfrFrontmatter(makeSection(), makeContext({ partNum: "1" }), undefined);

      expect(fm.currency).toBe("2026-06-15");
      expect(fm.last_updated).toBe("2026-06-15");
    });
  });

  describe("source and legal status", () => {
    it("sets source to ecfr and legal_status to authoritative_unofficial", () => {
      const fm = buildEcfrFrontmatter(makeSection(), makeContext({ partNum: "1" }), "2026-01-01");

      expect(fm.source).toBe("ecfr");
      expect(fm.legal_status).toBe("authoritative_unofficial");
      expect(fm.positive_law).toBe(false);
    });
  });

  describe("display title formatting", () => {
    it("formats section display title as CFR section reference", () => {
      const fm = buildEcfrFrontmatter(
        makeSection({ numValue: "240.10b-5", heading: "Employment of Manipulative Devices" }),
        makeContext({ titleNum: "17", partNum: "240" }),
        "2026-01-01",
      );

      expect(fm.title).toBe("17 CFR § 240.10b-5 - Employment of Manipulative Devices");
    });

    it("formats part display title as CFR part reference", () => {
      const node = makeSection({ levelType: "part", numValue: "240", heading: "General Rules" });
      const fm = buildEcfrFrontmatter(node, makeContext({ titleNum: "17" }), "2026-01-01");

      expect(fm.title).toBe("17 CFR Part 240 - General Rules");
    });

    it("formats title display title with em dash", () => {
      const node = makeSection({ levelType: "title", numValue: "17" });
      const fm = buildEcfrFrontmatter(
        node,
        makeContext({ titleNum: "17", titleName: "Commodity and Securities Exchanges" }),
        "2026-01-01",
      );

      expect(fm.title).toBe("Title 17 — Commodity and Securities Exchanges");
    });
  });

  describe("section-level fields", () => {
    it("includes section_number and section_name for section nodes", () => {
      const fm = buildEcfrFrontmatter(
        makeSection({ numValue: "1.1", heading: "Definitions" }),
        makeContext({ partNum: "1" }),
        "2026-01-01",
      );

      expect(fm.section_number).toBe("1.1");
      expect(fm.section_name).toBe("Definitions");
    });

    it("does not include section_number for title-level nodes", () => {
      const node = makeSection({ levelType: "title", numValue: "17" });
      const fm = buildEcfrFrontmatter(node, makeContext({ titleNum: "17" }), "2026-01-01");

      expect(fm.section_number).toBeUndefined();
      expect(fm.section_name).toBeUndefined();
    });
  });

  describe("ancestor fields", () => {
    it("sets chapter_name from chapter ancestor heading", () => {
      const fm = buildEcfrFrontmatter(
        makeSection(),
        makeContext({ partNum: "1", chapterNum: "I", chapterName: "Securities and Exchange Commission" }),
        "2026-01-01",
      );

      expect(fm.chapter_name).toBe("Securities and Exchange Commission");
    });

    it("sets chapter_number only for numeric chapters", () => {
      const fm = buildEcfrFrontmatter(
        makeSection(),
        makeContext({ partNum: "1", chapterNum: "3", chapterName: "Chapter Three" }),
        "2026-01-01",
      );

      expect(fm.chapter_number).toBe(3);
    });

    it("does not set chapter_number for Roman numeral chapters", () => {
      const fm = buildEcfrFrontmatter(
        makeSection(),
        makeContext({ partNum: "1", chapterNum: "IV", chapterName: "Chapter IV" }),
        "2026-01-01",
      );

      expect(fm.chapter_number).toBeUndefined();
      expect(fm.chapter_name).toBe("Chapter IV");
    });

    it("sets part_number and cfr_part from part ancestor", () => {
      const fm = buildEcfrFrontmatter(
        makeSection(),
        makeContext({ partNum: "240", partName: "General Rules" }),
        "2026-01-01",
      );

      expect(fm.part_number).toBe("240");
      expect(fm.cfr_part).toBe("240");
      expect(fm.part_name).toBe("General Rules");
    });
  });

  describe("identifier construction", () => {
    it("uses node identifier when present", () => {
      const fm = buildEcfrFrontmatter(
        makeSection({ identifier: "/us/cfr/t17/s240.10b-5" }),
        makeContext({ partNum: "240" }),
        "2026-01-01",
      );

      expect(fm.identifier).toBe("/us/cfr/t17/s240.10b-5");
    });

    it("constructs identifier from title and section number when node has none", () => {
      const fm = buildEcfrFrontmatter(
        makeSection({ numValue: "1.1" }),
        makeContext({ titleNum: "17", partNum: "1" }),
        "2026-01-01",
      );

      expect(fm.identifier).toBe("/us/cfr/t17/s1.1");
    });
  });
});
