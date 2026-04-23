import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { resolveUscXmlPath, discoverTitles, parseGranularityList } from "./convert-usc.js";

describe("resolveUscXmlPath", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function setup(filename: string): string {
    tempDir = mkdtempSync(join(tmpdir(), "lexbuild-test-"));
    const filePath = join(tempDir, filename);
    writeFileSync(filePath, "<xml/>");
    return tempDir;
  }

  it("returns exact path when file exists", () => {
    const dir = setup("usc03.xml");
    const exactPath = join(dir, "usc03.xml");
    expect(resolveUscXmlPath(exactPath)).toBe(exactPath);
  });

  it("resolves unpadded usc3.xml to zero-padded usc03.xml", () => {
    const dir = setup("usc03.xml");
    const unpadded = join(dir, "usc3.xml");
    expect(resolveUscXmlPath(unpadded)).toBe(join(dir, "usc03.xml"));
  });

  it("returns undefined when padded file does not exist", () => {
    tempDir = mkdtempSync(join(tmpdir(), "lexbuild-test-"));
    const missingPath = join(tempDir, "usc03.xml");
    expect(resolveUscXmlPath(missingPath)).toBeUndefined();
  });

  it("returns undefined for non-USC filename that does not exist", () => {
    tempDir = mkdtempSync(join(tmpdir(), "lexbuild-test-"));
    const missingPath = join(tempDir, "report.xml");
    expect(resolveUscXmlPath(missingPath)).toBeUndefined();
  });

  it("does not attempt fallback for non-USC filename", () => {
    const dir = setup("usc03.xml");
    const nonUsc = join(dir, "report.xml");
    expect(resolveUscXmlPath(nonUsc)).toBeUndefined();
  });

  it("handles already-padded path that exists directly", () => {
    const dir = setup("usc42.xml");
    const exactPath = join(dir, "usc42.xml");
    expect(resolveUscXmlPath(exactPath)).toBe(exactPath);
  });
});

describe("discoverTitles", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("finds USC XML files and returns sorted title numbers", () => {
    tempDir = mkdtempSync(join(tmpdir(), "lexbuild-test-"));
    writeFileSync(join(tempDir, "usc26.xml"), "<xml/>");
    writeFileSync(join(tempDir, "usc01.xml"), "<xml/>");
    writeFileSync(join(tempDir, "usc10.xml"), "<xml/>");
    expect(discoverTitles(tempDir)).toEqual([1, 10, 26]);
  });

  it("ignores non-USC files", () => {
    tempDir = mkdtempSync(join(tmpdir(), "lexbuild-test-"));
    writeFileSync(join(tempDir, "usc05.xml"), "<xml/>");
    writeFileSync(join(tempDir, "readme.txt"), "hi");
    writeFileSync(join(tempDir, "uscAll.zip"), "zip");
    expect(discoverTitles(tempDir)).toEqual([5]);
  });

  it("returns empty array for non-existent directory", () => {
    expect(discoverTitles("/tmp/does-not-exist-lexbuild")).toEqual([]);
  });

  it("returns empty array for directory with no USC XML files", () => {
    tempDir = mkdtempSync(join(tmpdir(), "lexbuild-test-"));
    writeFileSync(join(tempDir, "notes.txt"), "hi");
    expect(discoverTitles(tempDir)).toEqual([]);
  });
});

describe("parseGranularityList", () => {
  /** Build a ConvertCommandOptions with just the fields parseGranularityList reads. */
  const opts = (over: {
    granularities?: string;
    output?: string;
    outputSection?: string;
    outputChapter?: string;
    outputTitle?: string;
  }) =>
    ({
      output: over.output ?? "./output",
      all: false,
      inputDir: "./in",
      granularity: "section" as const,
      linkStyle: "plaintext" as const,
      includeSourceCredits: true,
      includeNotes: true,
      includeEditorialNotes: false,
      includeStatutoryNotes: false,
      includeAmendments: false,
      dryRun: false,
      verbose: false,
      ...over,
    }) as Parameters<typeof parseGranularityList>[0];

  it("returns empty array when --granularities is not set", () => {
    expect(parseGranularityList(opts({}))).toEqual([]);
  });

  it("returns empty array when --granularities is an empty string", () => {
    expect(parseGranularityList(opts({ granularities: "" }))).toEqual([]);
  });

  it("parses a single granularity using --output for section", () => {
    const result = parseGranularityList(opts({ granularities: "section", output: "./out" }));
    expect(result).toEqual([{ granularity: "section", output: resolve("./out") }]);
  });

  it("prefers --output-section over --output when both are set", () => {
    const result = parseGranularityList(opts({ granularities: "section", output: "./out", outputSection: "./out-s" }));
    expect(result).toEqual([{ granularity: "section", output: resolve("./out-s") }]);
  });

  it("parses multiple granularities with matching --output-<g> flags", () => {
    const result = parseGranularityList(
      opts({
        granularities: "section,chapter,title",
        output: "./out",
        outputChapter: "./out-c",
        outputTitle: "./out-t",
      }),
    );
    expect(result).toEqual([
      { granularity: "section", output: resolve("./out") },
      { granularity: "chapter", output: resolve("./out-c") },
      { granularity: "title", output: resolve("./out-t") },
    ]);
  });

  it("trims whitespace around granularity names", () => {
    const result = parseGranularityList(
      opts({
        granularities: " section , title ",
        output: "./out",
        outputTitle: "./out-t",
      }),
    );
    expect(result.map((p) => p.granularity)).toEqual(["section", "title"]);
  });

  it("throws on unknown granularity name", () => {
    expect(() => parseGranularityList(opts({ granularities: "foo" }))).toThrow(/Unknown granularity "foo"/);
  });

  it("throws on unknown granularity while accepting known ones in the same list", () => {
    expect(() => parseGranularityList(opts({ granularities: "section,foo", output: "./out" }))).toThrow(
      /Unknown granularity "foo"/,
    );
  });

  it("throws on duplicate granularity in the list", () => {
    expect(() => parseGranularityList(opts({ granularities: "section,section", output: "./out" }))).toThrow(
      /Duplicate granularity "section"/,
    );
  });

  it("throws when a listed granularity has no matching --output-<g> flag", () => {
    expect(() => parseGranularityList(opts({ granularities: "title", output: "./out" }))).toThrow(
      /Missing --output-title/,
    );
  });

  it("throws when section is listed but neither --output nor --output-section is given", () => {
    const o = opts({ granularities: "section" });
    // Commander defaults output to "./output"; to simulate absent output, override.
    const stripped = { ...o, output: undefined as unknown as string, outputSection: undefined };
    expect(() => parseGranularityList(stripped as Parameters<typeof parseGranularityList>[0])).toThrow(
      /Missing --output/,
    );
  });
});
