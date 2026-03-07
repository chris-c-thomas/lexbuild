/**
 * Reads section-level _meta.json files and generates a sitemap.xml
 * with URLs for all titles, chapters, and sections.
 *
 * Usage: npx tsx scripts/generate-sitemap.ts
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONTENT_ROOT = process.env.CONTENT_DIR ?? "./content";
const BASE_URL = process.env.SITE_URL ?? "https://lexbuild.dev";
const OUTPUT = "./public/sitemap.xml";

async function main() {
  const uscDir = join(CONTENT_ROOT, "section", "usc");
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(uscDir, { withFileTypes: true });
  } catch {
    console.error(`Content directory not found: ${uscDir}\nRun generate-content.sh first.`);
    process.exit(1);
  }
  const titleDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("title-"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const urls: string[] = [];

  // Index pages
  urls.push(url("/"));
  urls.push(url("/usc/"));

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
    const chapters = meta.chapters as Record<string, unknown>[] | undefined;

    // Title page
    urls.push(url(`/usc/${dir.name}/`));

    for (const ch of chapters ?? []) {
      const chDir = ch.directory as string;

      // Chapter page
      urls.push(url(`/usc/${dir.name}/${chDir}/`));

      // Section pages
      const sections = ch.sections as Record<string, unknown>[] | undefined;
      for (const s of sections ?? []) {
        const file = (s.file as string).replace(/\.md$/, "");
        urls.push(url(`/usc/${dir.name}/${chDir}/${file}/`));
      }
    }
  }

  // Include reserved titles that have no content directory
  if (!titleDirs.some((d) => d.name === "title-53")) {
    urls.push(url("/usc/title-53/"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  await writeFile(OUTPUT, xml, "utf-8");
  console.log(`wrote sitemap.xml (${urls.length} URLs)`);
}

function url(path: string): string {
  const escaped = `${BASE_URL}${path}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `  <url><loc>${escaped}</loc></url>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
