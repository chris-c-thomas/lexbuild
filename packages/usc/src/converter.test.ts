import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertTitle } from "./converter.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments");

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
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
      linkStyle: "plaintext",
      includeSourceCredits: true,
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
      input: resolve(FIXTURES_DIR, "section-with-subsections.xml"),
      output: outputDir,
      linkStyle: "plaintext",
      includeSourceCredits: true,
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
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
      linkStyle: "plaintext",
      includeSourceCredits: true,
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
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
      linkStyle: "plaintext",
      includeSourceCredits: true,
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
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
      linkStyle: "plaintext",
      includeSourceCredits: false,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    expect(content).not.toContain("**Source Credit**");
  });
});
