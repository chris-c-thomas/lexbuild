import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertTitle } from "./converter.js";
import type { ConvertOptions } from "./converter.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments");

/** Default options for tests */
const DEFAULTS: Omit<ConvertOptions, "input" | "output"> = {
  granularity: "section",
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
};

describe("convertTitle", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "law2md-test-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("converts simple-section.xml and writes one section file", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
    });

    expect(result.sectionsWritten).toBe(1);
    expect(result.titleNumber).toBe("1");
    expect(result.titleName).toBe("Title 1");
    expect(result.files).toHaveLength(1);

    // Check the output file exists at the right path
    const expectedPath = join(outputDir, "usc", "title-01", "chapter-01", "section-2.md");
    expect(result.files[0]).toBe(expectedPath);

    // Read and verify content
    const content = await readFile(expectedPath, "utf-8");

    // Should have frontmatter
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("identifier");
    expect(content).toContain("/us/usc/t1/s2");

    // Should have section heading
    expect(content).toContain("# § 2.");
    expect(content).toContain("County");

    // Should have content text
    expect(content).toContain("county");
    expect(content).toContain("parish");

    // Should have source credit
    expect(content).toContain("**Source Credit**");
  });

  it("converts section-with-subsections.xml", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-subsections.xml"),
      output: outputDir,
    });

    expect(result.sectionsWritten).toBe(1);
    expect(result.files).toHaveLength(1);

    const content = await readFile(result.files[0]!, "utf-8");

    // Should have subsection numbering
    expect(content).toContain("**(a)**");
    expect(content).toContain("**(b)**");
    expect(content).toContain("**(c)**");

    // Should have source credit
    expect(content).toContain("**Source Credit**");
  });

  it("creates correct directory structure", async () => {
    await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
    });

    // Check directory structure
    const uscDir = join(outputDir, "usc");
    const titleDir = join(uscDir, "title-01");
    const chapterDir = join(titleDir, "chapter-01");

    const titleContents = await readdir(titleDir);
    expect(titleContents).toContain("chapter-01");

    const chapterContents = await readdir(chapterDir);
    expect(chapterContents).toContain("section-2.md");
  });

  it("generates valid YAML frontmatter with correct fields", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
    });

    const content = await readFile(result.files[0]!, "utf-8");

    // Extract frontmatter
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(content);
    expect(fmMatch).not.toBeNull();

    const fmText = fmMatch![1]!;
    expect(fmText).toContain("title_number: 1");
    expect(fmText).toContain('section_number: "2"');
    expect(fmText).toContain("positive_law: true");
    expect(fmText).toContain("chapter_number: 1");
  });

  it("strips source credits when includeSourceCredits is false", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
      includeSourceCredits: false,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    expect(content).not.toContain("**Source Credit**");
  });

  it("excludes all notes when includeNotes is false", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
      includeNotes: false,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    // Should not contain note headings
    expect(content).not.toContain("## Editorial Notes");
    expect(content).not.toContain("### Amendments");
    expect(content).not.toContain("### Severability");
    // Should still contain section content and source credit
    expect(content).toContain("**(a)**");
    expect(content).toContain("**Source Credit**");
  });

  it("includes only amendments when includeAmendments is set", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
      includeNotes: false,
      includeAmendments: true,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    // Should contain editorial cross-heading and amendments
    expect(content).toContain("## Editorial Notes");
    expect(content).toContain("### Amendments");
    // Should not contain statutory notes
    expect(content).not.toContain("### Severability");
    expect(content).not.toContain("### Findings");
  });

  it("includes only statutory notes when includeStatutoryNotes is set", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
      includeNotes: false,
      includeStatutoryNotes: true,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    // Should contain statutory notes
    expect(content).toContain("## Statutory Notes");
    expect(content).toContain("### Severability");
    expect(content).toContain("### Findings");
    // Should not contain editorial/amendment notes
    expect(content).not.toContain("### Amendments");
  });

  it("outputs chapter-level files when granularity is chapter", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
      granularity: "chapter",
    });

    expect(result.sectionsWritten).toBeGreaterThan(0);
    expect(result.files).toHaveLength(1);

    // Should be a chapter file, not a section file in a subdirectory
    const filePath = result.files[0]!;
    expect(filePath).toContain("chapter-01.md");
    expect(filePath).not.toContain("chapter-01/");

    // Content should have chapter heading and section as H2
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("# Chapter 1");
    expect(content).toContain("## § 2.");
  });
});
