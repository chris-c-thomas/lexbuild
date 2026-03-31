import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { readdir, readFile, rm, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { convertFrDocuments } from "./converter.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments/fr");
const TEST_OUTPUT = resolve(import.meta.dirname, "../../../.test-output-fr");

/** Recursively find all .md files under a directory */
async function findMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await findMdFiles(full)));
      } else if (entry.name.endsWith(".md")) {
        results.push(full);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

describe("convertFrDocuments", () => {
  beforeAll(async () => {
    if (existsSync(TEST_OUTPUT)) {
      await rm(TEST_OUTPUT, { recursive: true });
    }
    await mkdir(TEST_OUTPUT, { recursive: true });
  });

  afterAll(async () => {
    if (existsSync(TEST_OUTPUT)) {
      await rm(TEST_OUTPUT, { recursive: true });
    }
  });

  describe("single-file mode", () => {
    it("converts a single XML file to Markdown", async () => {
      const outputDir = join(TEST_OUTPUT, "single");
      const result = await convertFrDocuments({
        input: resolve(FIXTURES_DIR, "simple-rule.xml"),
        output: outputDir,
        linkStyle: "plaintext",
        dryRun: false,
      });

      expect(result.documentsConverted).toBe(1);
      expect(result.dryRun).toBe(false);
      expect(result.totalTokenEstimate).toBeGreaterThan(0);

      // Output file should exist and contain frontmatter
      const mdFiles = await findMdFiles(join(outputDir, "fr"));
      expect(mdFiles.length).toBe(1);

      const content = await readFile(mdFiles[0]!, "utf-8");
      expect(content).toContain("---");
      expect(content).toContain('source: "fr"');
      expect(content).toContain('legal_status: "authoritative_unofficial"');
    });

    it("produces Markdown with correct frontmatter fields", async () => {
      const outputDir = join(TEST_OUTPUT, "frontmatter");
      await convertFrDocuments({
        input: resolve(FIXTURES_DIR, "simple-rule.xml"),
        output: outputDir,
        linkStyle: "plaintext",
        dryRun: false,
      });

      const mdFiles = await findMdFiles(join(outputDir, "fr"));
      const content = await readFile(mdFiles[0]!, "utf-8");
      expect(content).toContain("title_number: 0");
      expect(content).toContain('title_name: "Federal Register"');
      expect(content).toContain("positive_law: false");
      expect(content).toContain('document_type: "rule"');
    });
  });

  describe("dry-run mode", () => {
    it("returns count without writing files", async () => {
      const outputDir = join(TEST_OUTPUT, "dryrun");
      const result = await convertFrDocuments({
        input: resolve(FIXTURES_DIR, "simple-rule.xml"),
        output: outputDir,
        linkStyle: "plaintext",
        dryRun: true,
      });

      expect(result.documentsConverted).toBe(1);
      expect(result.totalTokenEstimate).toBe(0);
      expect(result.dryRun).toBe(true);

      // Output directory should not have any files
      expect(existsSync(join(outputDir, "fr"))).toBe(false);
    });
  });

  describe("directory mode", () => {
    it("converts all XML files in a directory", async () => {
      const outputDir = join(TEST_OUTPUT, "batch");
      const result = await convertFrDocuments({
        input: FIXTURES_DIR,
        output: outputDir,
        linkStyle: "plaintext",
        dryRun: false,
      });

      // 3 fixture files: simple-rule.xml, notice.xml, rule-with-regtext.xml
      expect(result.documentsConverted).toBe(3);
      const mdFiles = await findMdFiles(join(outputDir, "fr"));
      expect(mdFiles.length).toBe(3);
    });
  });

  describe("type filtering", () => {
    it("filters by document type", async () => {
      const outputDir = join(TEST_OUTPUT, "typefilter");
      const result = await convertFrDocuments({
        input: FIXTURES_DIR,
        output: outputDir,
        linkStyle: "plaintext",
        dryRun: false,
        types: ["NOTICE"],
      });

      // Only notice.xml should be converted
      expect(result.documentsConverted).toBe(1);
    });
  });

  describe("error handling", () => {
    it("throws descriptive error for non-existent input", async () => {
      await expect(
        convertFrDocuments({
          input: "/nonexistent/path",
          output: TEST_OUTPUT,
          linkStyle: "plaintext",
          dryRun: false,
        }),
      ).rejects.toThrow('Cannot access input path "/nonexistent/path"');
    });
  });
});
