/**
 * Reads section-level _meta.json files from content/section/usc/ and generates
 * static navigation JSON files in public/nav/ for the sidebar.
 *
 * Output:
 *   public/nav/titles.json       — array of TitleSummary objects
 *   public/nav/title-{NN}.json   — per-title with chapters + sections
 *
 * Usage: npx tsx scripts/generate-nav.ts
 */

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONTENT_ROOT = process.env.CONTENT_DIR ?? "./content";
const OUTPUT_DIR = "./public/nav";

interface TitleSummary {
  number: number;
  name: string;
  directory: string;
  positiveLaw: boolean;
  chapterCount: number;
  sectionCount: number;
  tokenEstimate: number;
}

interface SectionNavEntry {
  number: string;
  name: string;
  file: string;
  status: string;
  hasNotes: boolean;
}

interface ChapterNav {
  number: number;
  name: string;
  directory: string;
  sections: SectionNavEntry[];
}

interface TitleNav {
  number: number;
  name: string;
  positiveLaw: boolean;
  chapters: ChapterNav[];
}

async function main() {
  const uscDir = join(CONTENT_ROOT, "section", "usc");
  const entries = await readdir(uscDir, { withFileTypes: true });
  const titleDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("title-"))
    .sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(OUTPUT_DIR, { recursive: true });

  const titles: TitleSummary[] = [];

  for (const dir of titleDirs) {
    const metaPath = join(uscDir, dir.name, "_meta.json");
    let raw: string;
    try {
      raw = await readFile(metaPath, "utf-8");
    } catch {
      console.warn(`  skipping ${dir.name}: missing _meta.json`);
      continue;
    }
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.warn(`  skipping ${dir.name}: malformed _meta.json`);
      continue;
    }
    const stats = meta.stats as Record<string, number> | undefined;
    const chapters = meta.chapters as Record<string, unknown>[] | undefined;

    titles.push({
      number: meta.title_number as number,
      name: meta.title_name as string,
      directory: dir.name,
      positiveLaw: (meta.positive_law as boolean) ?? false,
      chapterCount: stats?.chapter_count ?? 0,
      sectionCount: stats?.section_count ?? 0,
      tokenEstimate: stats?.total_tokens_estimate ?? 0,
    });

    const titleNav: TitleNav = {
      number: meta.title_number as number,
      name: meta.title_name as string,
      positiveLaw: (meta.positive_law as boolean) ?? false,
      chapters: (chapters ?? []).map((ch) => ({
        number: ch.number as number,
        name: ch.name as string,
        directory: ch.directory as string,
        sections: ((ch.sections as Record<string, unknown>[] | undefined) ?? []).map((s) => ({
          number: s.number as string,
          name: s.name as string,
          file: (s.file as string).replace(/\.md$/, ""),
          status: (s.status as string) ?? "current",
          hasNotes: (s.has_notes as boolean) ?? false,
        })),
      })),
    };

    await writeFile(join(OUTPUT_DIR, `${dir.name}.json`), JSON.stringify(titleNav), "utf-8");
    console.log(`  wrote ${dir.name}.json (${titleNav.chapters.length} chapters)`);
  }

  // Inject Title 53 (Reserved) if not present — it has no content but is part of the USC structure
  if (!titles.some((t) => t.number === 53)) {
    titles.push({
      number: 53,
      name: "RESERVED",
      directory: "title-53",
      positiveLaw: false,
      chapterCount: 0,
      sectionCount: 0,
      tokenEstimate: 0,
    });
    titles.sort((a, b) => a.number - b.number);

    const reservedNav: TitleNav = {
      number: 53,
      name: "RESERVED",
      positiveLaw: false,
      chapters: [],
    };
    await writeFile(join(OUTPUT_DIR, "title-53.json"), JSON.stringify(reservedNav), "utf-8");
    console.log("  wrote title-53.json (reserved)");
  }

  await writeFile(join(OUTPUT_DIR, "titles.json"), JSON.stringify(titles), "utf-8");
  console.log(`wrote titles.json (${titles.length} titles)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
