/**
 * Generate pre-built sidebar navigation JSON from _meta.json sidecar files.
 *
 * Reads section-level _meta.json files from the content directory and produces:
 *   public/nav/usc/titles.json      — array of TitleSummary
 *   public/nav/usc/title-NN.json    — chapters + sections for each USC title
 *   public/nav/ecfr/titles.json     — array of TitleSummary
 *   public/nav/ecfr/title-NN.json   — chapters + parts + sections for each eCFR title
 *
 * Usage: npx tsx scripts/generate-nav.ts [content-dir]
 */

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types (matches src/lib/types.ts nav interfaces)
// ---------------------------------------------------------------------------

interface TitleSummary {
  number: number;
  name: string;
  directory: string;
  positiveLaw?: boolean;
  chapterCount: number;
  sectionCount: number;
  partCount?: number;
  tokenEstimate: number;
}

interface ChapterNav {
  number: string;
  name: string;
  directory: string;
  sections?: SectionNavEntry[];
  parts?: PartNav[];
}

interface PartNav {
  number: string;
  name: string;
  directory: string;
  sections: SectionNavEntry[];
}

interface SectionNavEntry {
  number: string;
  name: string;
  file: string;
  status: string;
  hasNotes: boolean;
}

interface TitleNav {
  chapters: ChapterNav[];
}

// ---------------------------------------------------------------------------
// _meta.json shapes (from CLI output)
// ---------------------------------------------------------------------------

interface UscTitleMeta {
  title_number: number;
  title_name: string;
  positive_law?: boolean;
  stats: {
    chapter_count: number;
    section_count: number;
    total_tokens_estimate: number;
  };
  chapters: Array<{
    identifier: string;
    number: number;
    name: string;
    directory: string;
    sections: Array<{
      number: string;
      name: string;
      file: string;
      token_estimate: number;
      has_notes: boolean;
      status: string;
    }>;
  }>;
}

interface EcfrTitleMeta {
  title_number: number;
  title_name: string;
  stats: {
    part_count: number;
    section_count: number;
    total_tokens_estimate: number;
  };
  parts: Array<{
    identifier: string;
    number: string;
    name: string;
    directory: string;
    sections: Array<{
      number: string;
      name: string;
      file: string;
      token_estimate: number;
      has_notes: boolean;
      status: string;
    }>;
  }>;
}

interface EcfrPartMeta {
  identifier: string;
  part_number: string;
  part_name: string;
  title_number: number;
  section_count: number;
  sections: Array<{
    number: string;
    name: string;
    file: string;
    token_estimate: number;
    has_notes: boolean;
    status: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Reserved USC titles (assigned but no enacted content). */
const USC_RESERVED_TITLES: TitleSummary[] = [
  {
    number: 53,
    name: "Reserved",
    directory: "title-53",
    chapterCount: 0,
    sectionCount: 0,
    tokenEstimate: 0,
  },
];

/** Reserved eCFR titles (assigned but no published content). */
const ECFR_RESERVED_TITLES: TitleSummary[] = [
  {
    number: 35,
    name: "Panama Canal [Reserved]",
    directory: "title-35",
    chapterCount: 0,
    sectionCount: 0,
    partCount: 0,
    tokenEstimate: 0,
  },
];

// ---------------------------------------------------------------------------
// USC navigation generation
// ---------------------------------------------------------------------------

async function generateUscNav(contentDir: string, outDir: string): Promise<void> {
  const uscDir = join(contentDir, "usc", "sections");
  const titleDirs = (await listDirs(uscDir)).filter((d) => d.startsWith("title-"));

  const titles: TitleSummary[] = [];

  for (const titleDir of titleDirs) {
    const metaPath = join(uscDir, titleDir, "_meta.json");
    const meta = await readJson<UscTitleMeta>(metaPath);
    if (!meta) {
      console.warn(`  Skipping ${titleDir}: no _meta.json`);
      continue;
    }

    // Build title summary
    titles.push({
      number: meta.title_number,
      name: meta.title_name,
      directory: titleDir,
      positiveLaw: meta.positive_law,
      chapterCount: meta.stats.chapter_count,
      sectionCount: meta.stats.section_count,
      tokenEstimate: meta.stats.total_tokens_estimate,
    });

    // Build per-title nav JSON
    const chapters: ChapterNav[] = meta.chapters.map((ch) => ({
      number: String(ch.number),
      name: ch.name,
      directory: ch.directory,
      sections: ch.sections.map((s) => ({
        number: s.number,
        name: s.name,
        file: s.file.replace(/\.md$/, ""),
        status: s.status,
        hasNotes: s.has_notes,
      })),
    }));

    const titleNav: TitleNav = { chapters };
    await writeFile(
      join(outDir, `${titleDir}.json`),
      JSON.stringify(titleNav, null, 2) + "\n",
      "utf-8",
    );
  }

  // Add reserved titles that have no content
  const existingNumbers = new Set(titles.map((t) => t.number));
  for (const reserved of USC_RESERVED_TITLES) {
    if (!existingNumbers.has(reserved.number)) {
      titles.push(reserved);
      // Write empty nav file for reserved title
      await writeFile(
        join(outDir, `${reserved.directory}.json`),
        JSON.stringify({ chapters: [] }, null, 2) + "\n",
        "utf-8",
      );
    }
  }

  // Sort by title number
  titles.sort((a, b) => a.number - b.number);

  await writeFile(
    join(outDir, "titles.json"),
    JSON.stringify(titles, null, 2) + "\n",
    "utf-8",
  );

  console.log(`  USC: ${titles.length} titles, ${titles.reduce((s, t) => s + t.sectionCount, 0)} sections`);
}

// ---------------------------------------------------------------------------
// eCFR navigation generation
// ---------------------------------------------------------------------------

async function generateEcfrNav(contentDir: string, outDir: string): Promise<void> {
  const ecfrDir = join(contentDir, "ecfr", "sections");
  const titleDirs = (await listDirs(ecfrDir)).filter((d) => d.startsWith("title-"));

  const titles: TitleSummary[] = [];

  for (const titleDir of titleDirs) {
    const metaPath = join(ecfrDir, titleDir, "_meta.json");
    const meta = await readJson<EcfrTitleMeta>(metaPath);
    if (!meta) {
      console.warn(`  Skipping ${titleDir}: no _meta.json`);
      continue;
    }

    // Discover chapter directories from filesystem
    const chapterDirs = (await listDirs(join(ecfrDir, titleDir))).filter((d) =>
      d.startsWith("chapter-"),
    );

    // Build chapter → parts mapping by scanning chapter directories
    const chapters: ChapterNav[] = [];
    let totalChapterCount = 0;

    for (const chapterDir of chapterDirs) {
      const chapterPath = join(ecfrDir, titleDir, chapterDir);
      const partDirs = (await listDirs(chapterPath)).filter((d) => d.startsWith("part-"));

      const parts: PartNav[] = [];

      for (const partDir of partDirs) {
        const partMeta = await readJson<EcfrPartMeta>(join(chapterPath, partDir, "_meta.json"));
        if (!partMeta) continue;

        parts.push({
          number: partMeta.part_number,
          name: partMeta.part_name,
          directory: partDir,
          sections: partMeta.sections.map((s) => ({
            number: s.number,
            name: s.name,
            file: s.file.replace(/\.md$/, ""),
            status: s.status,
            hasNotes: s.has_notes,
          })),
        });
      }

      // Sort parts numerically
      parts.sort((a, b) => {
        const numA = parseFloat(a.number) || 0;
        const numB = parseFloat(b.number) || 0;
        return numA - numB;
      });

      // Extract chapter number from directory name (chapter-IV → IV)
      const chapterNumber = chapterDir.replace("chapter-", "");

      // Derive chapter name from the title meta's parts (first part's identifier prefix)
      // or fall back to the directory name
      const chapterName = deriveEcfrChapterName(chapterNumber);

      if (parts.length > 0) {
        chapters.push({
          number: chapterNumber,
          name: chapterName,
          directory: chapterDir,
          parts,
        });
        totalChapterCount++;
      }
    }

    // Sort chapters by Roman numeral order
    chapters.sort((a, b) => romanToInt(a.number) - romanToInt(b.number));

    titles.push({
      number: meta.title_number,
      name: meta.title_name,
      directory: titleDir,
      chapterCount: totalChapterCount,
      sectionCount: meta.stats.section_count,
      partCount: meta.stats.part_count,
      tokenEstimate: meta.stats.total_tokens_estimate,
    });

    const titleNav: TitleNav = { chapters };
    await writeFile(
      join(outDir, `${titleDir}.json`),
      JSON.stringify(titleNav, null, 2) + "\n",
      "utf-8",
    );
  }

  // Add reserved titles that have no content
  const existingEcfrNumbers = new Set(titles.map((t) => t.number));
  for (const reserved of ECFR_RESERVED_TITLES) {
    if (!existingEcfrNumbers.has(reserved.number)) {
      titles.push(reserved);
      await writeFile(
        join(outDir, `${reserved.directory}.json`),
        JSON.stringify({ chapters: [] }, null, 2) + "\n",
        "utf-8",
      );
    }
  }

  titles.sort((a, b) => a.number - b.number);

  await writeFile(
    join(outDir, "titles.json"),
    JSON.stringify(titles, null, 2) + "\n",
    "utf-8",
  );

  const totalSections = titles.reduce((s, t) => s + t.sectionCount, 0);
  console.log(`  eCFR: ${titles.length} titles, ${totalSections} sections`);
}

/**
 * Derive a chapter name for eCFR. Chapter names aren't stored in part-level
 * _meta.json, so we use a placeholder. The sidebar displays the chapter number
 * prominently; the name is secondary.
 */
function deriveEcfrChapterName(chapterNumber: string): string {
  return `Chapter ${chapterNumber}`;
}

/** Convert Roman numeral string to integer for sorting. */
function romanToInt(roman: string): number {
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = map[roman[i]!] ?? 0;
    const next = map[roman[i + 1]!] ?? 0;
    result += current < next ? -current : current;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const contentDir = resolve(process.argv[2] ?? "./content");
  const publicNavDir = resolve("./public/nav");

  console.log(`Content directory: ${contentDir}`);
  console.log(`Output directory: ${publicNavDir}`);

  // Create output directories
  const uscOutDir = join(publicNavDir, "usc");
  const ecfrOutDir = join(publicNavDir, "ecfr");
  await mkdir(uscOutDir, { recursive: true });
  await mkdir(ecfrOutDir, { recursive: true });

  console.log("\nGenerating USC navigation...");
  await generateUscNav(contentDir, uscOutDir);

  console.log("\nGenerating eCFR navigation...");
  await generateEcfrNav(contentDir, ecfrOutDir);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
