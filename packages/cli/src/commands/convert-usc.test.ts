import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveUscXmlPath, discoverTitles } from "./convert-usc.js";

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
