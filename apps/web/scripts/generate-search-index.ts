/**
 * Generates a Pagefind search index from section-level .md files
 * using the Pagefind Node API with custom records.
 *
 * Usage: npx tsx scripts/generate-search-index.ts
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as pagefind from "pagefind";

const CONTENT_ROOT = process.env.CONTENT_DIR ?? "./content";
const OUTPUT_PATH = "./public/_pagefind";

async function main() {
  const { index } = await pagefind.createIndex({});
  if (!index) {
    console.error("Failed to create Pagefind index");
    process.exit(1);
  }

  const uscDir = join(CONTENT_ROOT, "section", "usc");
  const titleDirs = (await readdir(uscDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name.startsWith("title-"))
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const titleEntry of titleDirs) {
    const titleDir = titleEntry.name;
    const titlePath = join(uscDir, titleDir);
    const chapterDirs = (await readdir(titlePath, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name.startsWith("chapter-"))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const chapterEntry of chapterDirs) {
      const chapterDir = chapterEntry.name;
      const chapterPath = join(titlePath, chapterDir);
      const files = (await readdir(chapterPath))
        .filter((f) => f.endsWith(".md"))
        .sort();

      for (const file of files) {
        const raw = await readFile(join(chapterPath, file), "utf-8");
        const { title, body } = parseFrontmatter(raw);
        const slug = file.replace(/\.md$/, "");

        await index.addCustomRecord({
          url: `/usc/${titleDir}/${chapterDir}/${slug}/`,
          content: body,
          meta: { title: title || `${titleDir} ${chapterDir} ${slug}` },
          language: "en",
        });
        count++;
      }
    }
  }

  await index.writeFiles({ outputPath: OUTPUT_PATH });
  console.log(`wrote Pagefind index (${count} sections)`);
  await pagefind.close();
}

function parseFrontmatter(raw: string): { title: string; body: string } {
  if (!raw.startsWith("---")) return { title: "", body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { title: "", body: raw };

  const fm = raw.slice(3, end);
  const body = raw.slice(end + 4).trim();

  const titleMatch = fm.match(/^title:\s*"?(.+?)"?\s*$/m);
  return { title: titleMatch?.[1] ?? "", body };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
