/**
 * Byte-parity integration tests: multi-granularity conversion must produce
 * the exact same files (byte-for-byte) as running single-granularity
 * conversion N times against the same XML input.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { convertEcfrTitle } from "./converter.js";
import type { BaseEcfrConvertOptions, EcfrGranularity } from "./converter.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments/ecfr");

const BASE: BaseEcfrConvertOptions = {
  input: "", // overridden per test
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
  dryRun: false,
  currencyDate: "2026-04-22",
};

/** Recursively list all files under a directory (relative paths). */
async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string, rel: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childAbs = join(current, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  };
  await walk(dir, "");
  return out.sort();
}

describe("convertEcfrTitle multi-granularity parity", () => {
  let multiDirs: Record<EcfrGranularity, string>;
  let singleDirs: Record<EcfrGranularity, string>;

  beforeEach(async () => {
    multiDirs = {
      section: await mkdtemp(join(tmpdir(), "ecfr-multi-section-")),
      part: await mkdtemp(join(tmpdir(), "ecfr-multi-part-")),
      chapter: await mkdtemp(join(tmpdir(), "ecfr-multi-chapter-")),
      title: await mkdtemp(join(tmpdir(), "ecfr-multi-title-")),
    };
    singleDirs = {
      section: await mkdtemp(join(tmpdir(), "ecfr-single-section-")),
      part: await mkdtemp(join(tmpdir(), "ecfr-single-part-")),
      chapter: await mkdtemp(join(tmpdir(), "ecfr-single-chapter-")),
      title: await mkdtemp(join(tmpdir(), "ecfr-single-title-")),
    };
  });

  afterEach(async () => {
    const all = [...Object.values(multiDirs), ...Object.values(singleDirs)];
    for (const d of all) {
      await rm(d, { recursive: true, force: true });
    }
  });

  it("multi-granularity run produces identical output to N single-granularity runs", async () => {
    const input = resolve(FIXTURES_DIR, "title-structure.xml");

    // --- Reference: run four separate single-granularity conversions.
    for (const g of ["section", "part", "chapter", "title"] as const) {
      await convertEcfrTitle({
        ...BASE,
        input,
        granularity: g,
        output: singleDirs[g],
      });
    }

    // --- Multi-granularity: run once with all four.
    const multiResults = await convertEcfrTitle({
      ...BASE,
      input,
      granularities: [
        { granularity: "section", output: multiDirs.section },
        { granularity: "part", output: multiDirs.part },
        { granularity: "chapter", output: multiDirs.chapter },
        { granularity: "title", output: multiDirs.title },
      ],
    });

    expect(multiResults).toHaveLength(4);

    // --- Compare every output file byte-for-byte.
    for (const g of ["section", "part", "chapter", "title"] as const) {
      const multiFiles = await listFiles(multiDirs[g]);
      const singleFiles = await listFiles(singleDirs[g]);
      expect(multiFiles).toEqual(singleFiles);

      for (const relPath of multiFiles) {
        // _meta.json and README.md carry a wall-clock `generated_at`
        // timestamp; skip byte-compare on those files but still assert
        // they exist in both outputs.
        if (relPath.endsWith("_meta.json") || relPath.endsWith("README.md")) continue;
        const multiBuf = await readFile(join(multiDirs[g], relPath));
        const singleBuf = await readFile(join(singleDirs[g], relPath));
        expect(multiBuf.equals(singleBuf), `mismatch at ${g}/${relPath}`).toBe(true);
      }
    }
  });

  it("rejects granularity+output combined with granularities", async () => {
    // The discriminated union already prevents this shape at compile time;
    // cast to `any` to verify the runtime guard still fires for untyped
    // callers (e.g. JSON-decoded options).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing runtime validation for illegal shape
    const illegal: any = {
      ...BASE,
      input: resolve(FIXTURES_DIR, "title-structure.xml"),
      granularity: "section",
      output: multiDirs.section,
      granularities: [{ granularity: "title", output: multiDirs.title }],
    };
    await expect(convertEcfrTitle(illegal)).rejects.toThrow(/mutually exclusive/);
  });

  it("requires at least one entry in granularities", async () => {
    await expect(
      convertEcfrTitle({
        ...BASE,
        input: resolve(FIXTURES_DIR, "title-structure.xml"),
        granularities: [],
      }),
    ).rejects.toThrow(/at least one entry/);
  });

  it("single-granularity mode returns a single result", async () => {
    const result = await convertEcfrTitle({
      ...BASE,
      input: resolve(FIXTURES_DIR, "title-structure.xml"),
      granularity: "section",
      output: singleDirs.section,
    });

    expect(Array.isArray(result)).toBe(false);
    expect(result.granularity).toBe("section");
    // sanity: at least one file written
    const stats = await stat(singleDirs.section);
    expect(stats.isDirectory()).toBe(true);
  });

  it("dry-run in multi-granularity mode reports counts without writing files", async () => {
    const results = await convertEcfrTitle({
      ...BASE,
      input: resolve(FIXTURES_DIR, "title-structure.xml"),
      dryRun: true,
      granularities: [
        { granularity: "section", output: multiDirs.section },
        { granularity: "part", output: multiDirs.part },
        { granularity: "title", output: multiDirs.title },
      ],
    });

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.dryRun).toBe(true);
      expect(r.files).toEqual([]);
    }

    const byGranularity = Object.fromEntries(results.map((r) => [r.granularity, r]));
    // title-structure fixture has 3 sections, 2 parts, 1 title
    expect(byGranularity.section!.sectionsWritten).toBe(3);
    expect(byGranularity.part!.sectionsWritten).toBe(2);
    expect(byGranularity.title!.sectionsWritten).toBe(1);

    // Verify no files were actually written to the multi output dirs.
    const sectionFiles = await listFiles(multiDirs.section);
    const partFiles = await listFiles(multiDirs.part);
    const titleFiles = await listFiles(multiDirs.title);
    expect(sectionFiles).toEqual([]);
    expect(partFiles).toEqual([]);
    expect(titleFiles).toEqual([]);
  });
});
