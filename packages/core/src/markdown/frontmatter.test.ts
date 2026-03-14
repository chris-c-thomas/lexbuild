import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { generateFrontmatter, FORMAT_VERSION, GENERATOR } from "./frontmatter.js";
import type { FrontmatterData } from "../ast/types.js";

/** Minimal valid frontmatter data */
const MINIMAL_DATA: FrontmatterData = {
  source: "usc",
  legal_status: "official_legal_evidence",
  identifier: "/us/usc/t1/s1",
  title: "1 USC § 1 - Words denoting number, gender, and so forth",
  title_number: 1,
  title_name: "General Provisions",
  section_number: "1",
  section_name: "Words denoting number, gender, and so forth",
  positive_law: true,
  currency: "119-73",
  last_updated: "2025-12-03",
};

/** Full frontmatter data with all optional fields */
const FULL_DATA: FrontmatterData = {
  ...MINIMAL_DATA,
  chapter_number: 1,
  chapter_name: "Rules of Construction",
  source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
};

describe("generateFrontmatter", () => {
  it("produces valid YAML delimited by ---", () => {
    const result = generateFrontmatter(MINIMAL_DATA);
    expect(result).toMatch(/^---\n/);
    expect(result).toMatch(/\n---$/);
  });

  it("produces parseable YAML", () => {
    const result = generateFrontmatter(FULL_DATA);
    // Strip delimiters for parsing
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["identifier"]).toBe("/us/usc/t1/s1");
    expect(parsed["title_number"]).toBe(1);
    expect(parsed["title_name"]).toBe("General Provisions");
    expect(parsed["section_number"]).toBe("1");
    expect(parsed["positive_law"]).toBe(true);
    expect(parsed["currency"]).toBe("119-73");
    expect(parsed["last_updated"]).toBe("2025-12-03");
  });

  it("includes format_version and generator", () => {
    const result = generateFrontmatter(MINIMAL_DATA);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["format_version"]).toBe(FORMAT_VERSION);
    expect(parsed["generator"]).toBe(GENERATOR);
  });

  it("includes chapter fields when provided", () => {
    const result = generateFrontmatter(FULL_DATA);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["chapter_number"]).toBe(1);
    expect(parsed["chapter_name"]).toBe("Rules of Construction");
  });

  it("omits chapter fields when not provided", () => {
    const result = generateFrontmatter(MINIMAL_DATA);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["chapter_number"]).toBeUndefined();
    expect(parsed["chapter_name"]).toBeUndefined();
  });

  it("includes source_credit when provided", () => {
    const result = generateFrontmatter(FULL_DATA);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["source_credit"]).toBe("(July 30, 1947, ch. 388, 61 Stat. 633.)");
  });

  it("includes status when provided", () => {
    const data: FrontmatterData = { ...MINIMAL_DATA, status: "repealed" };
    const result = generateFrontmatter(data);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["status"]).toBe("repealed");
  });

  it("handles alphanumeric section numbers", () => {
    const data: FrontmatterData = {
      ...MINIMAL_DATA,
      identifier: "/us/usc/t26/s7801",
      section_number: "7801",
      section_name: "Authority of Department of the Treasury",
    };
    const result = generateFrontmatter(data);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["section_number"]).toBe("7801");
  });

  it("handles optional subchapter and part fields", () => {
    const data: FrontmatterData = {
      ...FULL_DATA,
      subchapter_number: "II",
      subchapter_name: "Other Provisions",
      part_number: "A",
      part_name: "General Rules",
    };
    const result = generateFrontmatter(data);
    const yamlContent = result.replace(/^---\n/, "").replace(/\n---$/, "");
    const parsed = parse(yamlContent) as Record<string, unknown>;

    expect(parsed["subchapter_number"]).toBe("II");
    expect(parsed["subchapter_name"]).toBe("Other Provisions");
    expect(parsed["part_number"]).toBe("A");
    expect(parsed["part_name"]).toBe("General Rules");
  });
});
