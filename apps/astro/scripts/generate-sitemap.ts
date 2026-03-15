/**
 * Generate sitemap.xml from _meta.json sidecar files.
 *
 * Enumerates all browsable URLs for both USC and eCFR at section granularity
 * and writes a sitemap.xml to public/.
 *
 * Usage: npx tsx scripts/generate-sitemap.ts [content-dir]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const SITE_URL = process.env.SITE_URL ?? "https://lexbuild.dev";

// ---------------------------------------------------------------------------
// _meta.json shapes (subset of fields we need)
// ---------------------------------------------------------------------------

interface UscTitleMeta {
  title_number: number;
  chapters: Array<{
    directory: string;
    sections: Array<{ file: string }>;
  }>;
}

interface EcfrPartMeta {
  sections: Array<{ file: string }>;
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

function xmlEscape(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// URL collection
// ---------------------------------------------------------------------------

async function collectUscUrls(contentDir: string): Promise<string[]> {
  const urls: string[] = [];
  const uscDir = join(contentDir, "section", "usc");
  const titleDirs = (await listDirs(uscDir)).filter((d) => d.startsWith("title-"));

  // Index page
  urls.push("/usc");

  for (const titleDir of titleDirs) {
    const meta = await readJson<UscTitleMeta>(join(uscDir, titleDir, "_meta.json"));
    if (!meta) continue;

    // Title page
    urls.push(`/usc/${titleDir}`);

    for (const chapter of meta.chapters) {
      // Chapter page
      urls.push(`/usc/${titleDir}/${chapter.directory}`);

      // Section pages
      for (const section of chapter.sections) {
        const sectionSlug = section.file.replace(/\.md$/, "");
        urls.push(`/usc/${titleDir}/${chapter.directory}/${sectionSlug}`);
      }
    }
  }

  return urls;
}

async function collectEcfrUrls(contentDir: string): Promise<string[]> {
  const urls: string[] = [];
  const ecfrDir = join(contentDir, "section", "ecfr");
  const titleDirs = (await listDirs(ecfrDir)).filter((d) => d.startsWith("title-"));

  // Index page
  urls.push("/ecfr");

  for (const titleDir of titleDirs) {
    // Title page
    urls.push(`/ecfr/${titleDir}`);

    const chapterDirs = (await listDirs(join(ecfrDir, titleDir))).filter((d) =>
      d.startsWith("chapter-"),
    );

    for (const chapterDir of chapterDirs) {
      // Chapter page
      urls.push(`/ecfr/${titleDir}/${chapterDir}`);

      const chapterPath = join(ecfrDir, titleDir, chapterDir);
      const partDirs = (await listDirs(chapterPath)).filter((d) => d.startsWith("part-"));

      for (const partDir of partDirs) {
        // Part page
        urls.push(`/ecfr/${titleDir}/${chapterDir}/${partDir}`);

        // Section pages from part _meta.json
        const partMeta = await readJson<EcfrPartMeta>(
          join(chapterPath, partDir, "_meta.json"),
        );
        if (!partMeta) continue;

        for (const section of partMeta.sections) {
          const sectionSlug = section.file.replace(/\.md$/, "");
          urls.push(`/ecfr/${titleDir}/${chapterDir}/${partDir}/${sectionSlug}`);
        }
      }
    }
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Sitemap XML generation
// ---------------------------------------------------------------------------

function buildSitemap(urls: string[]): string {
  const today = new Date().toISOString().split("T")[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage
  xml += `  <url>\n    <loc>${xmlEscape(SITE_URL)}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  for (const path of urls) {
    const depth = path.split("/").length - 1;
    // Higher priority for index/title pages, lower for sections
    const priority = depth <= 2 ? "0.8" : depth <= 3 ? "0.6" : "0.5";
    const changefreq = depth <= 2 ? "monthly" : "yearly";

    xml += `  <url>\n    <loc>${xmlEscape(SITE_URL)}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
  }

  xml += "</urlset>\n";
  return xml;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const contentDir = resolve(process.argv[2] ?? "./content");
  const outputPath = resolve("./public/sitemap.xml");

  console.log(`Content directory: ${contentDir}`);

  const [uscUrls, ecfrUrls] = await Promise.all([
    collectUscUrls(contentDir),
    collectEcfrUrls(contentDir),
  ]);

  const allUrls = [...uscUrls, ...ecfrUrls];
  console.log(`  USC: ${uscUrls.length} URLs`);
  console.log(`  eCFR: ${ecfrUrls.length} URLs`);
  console.log(`  Total: ${allUrls.length} URLs`);

  const sitemap = buildSitemap(allUrls);
  await writeFile(outputPath, sitemap, "utf-8");
  console.log(`\nWrote ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
