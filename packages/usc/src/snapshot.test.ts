/**
 * Snapshot tests for output stability.
 *
 * Each test converts a fixture XML file and compares the rendered Markdown
 * against a pinned expected file in `fixtures/expected/`. If the output
 * changes unintentionally, the test fails. Run `vitest --update` to
 * regenerate snapshots after intentional changes.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { convertTitle } from "./converter.js";
import type { ConvertOptions } from "./converter.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments");
const EXPECTED_DIR = resolve(import.meta.dirname, "../../../fixtures/expected");

/** Default options — all notes included, section granularity, plaintext links */
const DEFAULTS: Omit<ConvertOptions, "input" | "output"> = {
  granularity: "section",
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
  dryRun: false,
};

describe("snapshot tests", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "law2md-snap-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // Simple section (Title 1, §2)
  // ---------------------------------------------------------------------------

  it("simple-section", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "simple-section.xml"),
      output: outputDir,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "simple-section.md"));
  });

  // ---------------------------------------------------------------------------
  // Section with subsections (Title 1, §7)
  // ---------------------------------------------------------------------------

  it("subsections", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-subsections.xml"),
      output: outputDir,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "subsections.md"));
  });

  // ---------------------------------------------------------------------------
  // Notes — all included (default)
  // ---------------------------------------------------------------------------

  it("notes-all", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "notes-all.md"));
  });

  // ---------------------------------------------------------------------------
  // Notes — excluded
  // ---------------------------------------------------------------------------

  it("notes-none", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
      includeNotes: false,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "notes-none.md"));
  });

  // ---------------------------------------------------------------------------
  // Notes — amendments only
  // ---------------------------------------------------------------------------

  it("notes-amendments-only", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
      includeNotes: false,
      includeAmendments: true,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "notes-amendments-only.md"));
  });

  // ---------------------------------------------------------------------------
  // Notes — statutory only
  // ---------------------------------------------------------------------------

  it("notes-statutory-only", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-notes.xml"),
      output: outputDir,
      includeNotes: false,
      includeStatutoryNotes: true,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "notes-statutory-only.md"));
  });

  // ---------------------------------------------------------------------------
  // XHTML table
  // ---------------------------------------------------------------------------

  it("table", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-table.xml"),
      output: outputDir,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "table.md"));
  });

  // ---------------------------------------------------------------------------
  // USLM layout table
  // ---------------------------------------------------------------------------

  it("layout", async () => {
    const result = await convertTitle({
      ...DEFAULTS,
      input: resolve(FIXTURES_DIR, "section-with-layout.xml"),
      output: outputDir,
    });

    const content = await readFile(result.files[0]!, "utf-8");
    await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "layout.md"));
  });

  // ---------------------------------------------------------------------------
  // Duplicate sections (Title 5, §3598 ×2 + §3599)
  // ---------------------------------------------------------------------------

  describe("duplicate sections", () => {
    it("first duplicate", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "duplicate-sections.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-35");
      const first = await readFile(join(chapterDir, "section-3598.md"), "utf-8");
      await expect(first).toMatchFileSnapshot(join(EXPECTED_DIR, "duplicate-first.md"));
    });

    it("second duplicate", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "duplicate-sections.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-35");
      const second = await readFile(join(chapterDir, "section-3598-2.md"), "utf-8");
      await expect(second).toMatchFileSnapshot(join(EXPECTED_DIR, "duplicate-second.md"));
    });

    it("non-duplicate sibling", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "duplicate-sections.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-35");
      const other = await readFile(join(chapterDir, "section-3599.md"), "utf-8");
      await expect(other).toMatchFileSnapshot(join(EXPECTED_DIR, "duplicate-other.md"));
    });
  });

  // ---------------------------------------------------------------------------
  // Status sections (Title 5, ch 10 — repealed, transferred, reserved, current)
  // ---------------------------------------------------------------------------

  describe("status sections", () => {
    it("repealed", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "section-with-status.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-10");
      const content = await readFile(join(chapterDir, "section-1001.md"), "utf-8");
      await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "status-repealed.md"));
    });

    it("transferred", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "section-with-status.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-10");
      const content = await readFile(join(chapterDir, "section-1002.md"), "utf-8");
      await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "status-transferred.md"));
    });

    it("reserved", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "section-with-status.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-10");
      const content = await readFile(join(chapterDir, "section-1003.md"), "utf-8");
      await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "status-reserved.md"));
    });

    it("current (no status field)", async () => {
      await convertTitle({
        ...DEFAULTS,
        input: resolve(FIXTURES_DIR, "section-with-status.xml"),
        output: outputDir,
      });

      const chapterDir = join(outputDir, "usc", "title-05", "chapter-10");
      const content = await readFile(join(chapterDir, "section-1004.md"), "utf-8");
      await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "status-current.md"));
    });
  });
});
