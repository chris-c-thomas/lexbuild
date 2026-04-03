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

// --- Types (matches src/lib/types.ts nav interfaces) ---

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

// --- _meta.json shapes (from CLI output) ---

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

// --- Helpers ---

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

// --- USC navigation generation ---

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

    // Build per-title nav JSON, merging subchapters that share the same
    // directory (e.g. Title 5 Chapter 89 has three subchapters all in
    // chapter-89/). Without merging, duplicate React keys and broken
    // expand/collapse result.
    const chapterMap = new Map<string, ChapterNav>();
    for (const ch of meta.chapters) {
      const sections: SectionNavEntry[] = ch.sections.map((s) => ({
        number: s.number,
        name: s.name,
        file: s.file.replace(/\.md$/, ""),
        status: s.status,
        hasNotes: s.has_notes,
      }));

      const existing = chapterMap.get(ch.directory);
      if (existing) {
        existing.sections!.push(...sections);
      } else {
        chapterMap.set(ch.directory, {
          number: String(ch.number),
          name: ch.name,
          directory: ch.directory,
          sections,
        });
      }
    }
    const chapters: ChapterNav[] = [...chapterMap.values()];

    const titleNav: TitleNav = { chapters };
    await writeFile(join(outDir, `${titleDir}.json`), JSON.stringify(titleNav, null, 2) + "\n", "utf-8");
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

  await writeFile(join(outDir, "titles.json"), JSON.stringify(titles, null, 2) + "\n", "utf-8");

  console.log(`  USC: ${titles.length} titles, ${titles.reduce((s, t) => s + t.sectionCount, 0)} sections`);
}

// --- eCFR navigation generation ---

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
    const chapterDirs = (await listDirs(join(ecfrDir, titleDir))).filter((d) => d.startsWith("chapter-"));

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
    await writeFile(join(outDir, `${titleDir}.json`), JSON.stringify(titleNav, null, 2) + "\n", "utf-8");
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

  await writeFile(join(outDir, "titles.json"), JSON.stringify(titles, null, 2) + "\n", "utf-8");

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

// --- FR navigation ---

interface FrYearSummary {
  year: number;
  months: FrMonthSummary[];
  documentCount: number;
}

interface FrMonthSummary {
  month: number;
  documentCount: number;
  typeCounts: Record<string, number>;
}

interface FrDocumentNav {
  document_number: string;
  title: string;
  document_type: string;
  publication_date: string;
  agencies: string[];
  file: string;
}

/**
 * Generate FR navigation by scanning the documents directory.
 * Produces years.json (year/month summaries) and per-month document listing files.
 */
async function generateFrNav(contentDir: string, outDir: string): Promise<void> {
  const frDocsDir = join(contentDir, "fr", "documents");

  let yearDirs: string[];
  try {
    yearDirs = (await readdir(frDocsDir)).filter((d) => /^\d{4}$/.test(d)).sort();
  } catch {
    console.log("  No FR documents directory found, skipping.");
    return;
  }

  if (yearDirs.length === 0) {
    console.log("  No FR year directories found, skipping.");
    return;
  }

  const years: FrYearSummary[] = [];

  for (const yearDir of yearDirs) {
    const yearNum = parseInt(yearDir, 10);
    const yearPath = join(frDocsDir, yearDir);
    let monthDirs: string[];
    try {
      monthDirs = (await readdir(yearPath)).filter((d) => /^\d{2}$/.test(d)).sort();
    } catch {
      continue;
    }

    const months: FrMonthSummary[] = [];
    let yearDocCount = 0;

    for (const monthDir of monthDirs) {
      const monthNum = parseInt(monthDir, 10);
      const monthPath = join(yearPath, monthDir);
      let files: string[];
      try {
        files = (await readdir(monthPath)).filter((f) => f.endsWith(".md") && f !== ".md");
      } catch {
        continue;
      }

      const typeCounts: Record<string, number> = {};
      const docs: FrDocumentNav[] = [];

      for (const file of files) {
        const filePath = join(monthPath, file);
        try {
          // Read only the frontmatter (first ~2KB is enough)
          const raw = await readFile(filePath, "utf-8");
          const endIdx = raw.indexOf("\n---", 4);
          if (endIdx === -1) continue;
          const fm = raw.slice(4, endIdx);

          const docNum = extractYamlField(fm, "document_number") || file.replace(/\.md$/, "");
          const title = extractYamlField(fm, "section_name") || extractYamlField(fm, "title") || docNum;
          const docType = extractYamlField(fm, "document_type") || "unknown";
          const pubDate = extractYamlField(fm, "publication_date") || `${yearDir}-${monthDir}`;
          const agencyRaw = extractYamlField(fm, "agency") || "";

          const agencies: string[] = [];
          if (agencyRaw) agencies.push(agencyRaw);

          typeCounts[docType] = (typeCounts[docType] || 0) + 1;

          docs.push({
            document_number: docNum,
            title: title.length > 120 ? title.slice(0, 117) + "..." : title,
            document_type: docType,
            publication_date: pubDate,
            agencies,
            file: file.replace(/\.md$/, ""),
          });
        } catch {
          // Skip unparseable files
        }
      }

      // Sort by publication date, then document number
      docs.sort(
        (a, b) =>
          a.publication_date.localeCompare(b.publication_date) || a.document_number.localeCompare(b.document_number),
      );

      months.push({ month: monthNum, documentCount: docs.length, typeCounts });
      yearDocCount += docs.length;

      // Write per-month document listing
      const monthKey = `${yearDir}-${monthDir}`;
      await writeFile(join(outDir, `${monthKey}.json`), JSON.stringify(docs, null, 2), "utf-8");
      console.log(`  ${monthKey}: ${docs.length} documents`);
    }

    years.push({ year: yearNum, months, documentCount: yearDocCount });
  }

  // Write years summary
  await writeFile(join(outDir, "years.json"), JSON.stringify(years, null, 2), "utf-8");
  console.log(
    `  Total: ${years.reduce((sum, y) => sum + y.documentCount, 0)} documents across ${years.length} year(s)`,
  );
}

/** Extract a simple scalar YAML field value (string or number). */
function extractYamlField(yaml: string, field: string): string | undefined {
  const re = new RegExp(`^${field}:\\s*"?([^"\\n]*)"?\\s*$`, "m");
  const match = re.exec(yaml);
  return match?.[1]?.trim() || undefined;
}

// --- Main ---

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let contentDir = "./content";
  let sourceFilter: "usc" | "ecfr" | "fr" | null = null;

  for (const arg of args) {
    if (arg === "--source" && args[args.indexOf(arg) + 1]) {
      const val = args[args.indexOf(arg) + 1]!;
      if (val !== "usc" && val !== "ecfr" && val !== "fr") {
        console.error(`Invalid source: ${val}. Must be usc, ecfr, or fr.`);
        process.exit(1);
      }
      sourceFilter = val;
    } else if (!arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--source") {
      contentDir = arg;
    }
  }

  const resolvedContentDir = resolve(contentDir);
  const publicNavDir = resolve("./public/nav");

  console.log(`Content directory: ${resolvedContentDir}`);
  console.log(`Output directory: ${publicNavDir}`);
  if (sourceFilter) console.log(`Source filter: ${sourceFilter}`);

  if (!sourceFilter || sourceFilter === "usc") {
    const uscOutDir = join(publicNavDir, "usc");
    await mkdir(uscOutDir, { recursive: true });
    console.log("\nGenerating USC navigation...");
    await generateUscNav(resolvedContentDir, uscOutDir);
  }

  if (!sourceFilter || sourceFilter === "ecfr") {
    const ecfrOutDir = join(publicNavDir, "ecfr");
    await mkdir(ecfrOutDir, { recursive: true });
    console.log("\nGenerating eCFR navigation...");
    await generateEcfrNav(resolvedContentDir, ecfrOutDir);
  }

  if (!sourceFilter || sourceFilter === "fr") {
    const frOutDir = join(publicNavDir, "fr");
    await mkdir(frOutDir, { recursive: true });
    console.log("\nGenerating FR navigation...");
    await generateFrNav(resolvedContentDir, frOutDir);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
