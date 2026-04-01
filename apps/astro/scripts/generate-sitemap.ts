/**
 * Generate a sitemap index with chunked sitemap files.
 *
 * Enumerates all browsable URLs for both USC and eCFR at section granularity,
 * splits them into ≤50k-URL files per the sitemap spec, and writes a sitemap
 * index to public/sitemap.xml that references each part.
 *
 * Output:
 *   public/sitemap.xml           ← sitemap index
 *   public/sitemap-usc-0.xml     ← first chunk of USC URLs
 *   public/sitemap-usc-1.xml     ← next chunk (if needed)
 *   public/sitemap-ecfr-0.xml    ← first chunk of eCFR URLs
 *   ...
 *   public/sitemap-misc-0.xml    ← homepage + index pages
 *
 * Usage: npx tsx scripts/generate-sitemap.ts [content-dir]
 */

import { access, copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const SITE_URL = process.env.SITE_URL ?? "https://lexbuild.dev";
const MAX_URLS_PER_FILE = 25_000;

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
  const uscDir = join(contentDir, "usc", "sections");
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
  const ecfrDir = join(contentDir, "ecfr", "sections");
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
        const partMeta = await readJson<EcfrPartMeta>(join(chapterPath, partDir, "_meta.json"));
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

async function collectFrUrls(contentDir: string): Promise<string[]> {
  const urls: string[] = [];
  const frDir = join(contentDir, "fr", "documents");

  let yearDirs: string[];
  try {
    yearDirs = (await listDirs(frDir)).filter((d) => /^\d{4}$/.test(d)).sort();
  } catch {
    return urls;
  }

  // Index page
  urls.push("/fr");

  for (const yearDir of yearDirs) {
    // Year page
    urls.push(`/fr/${yearDir}`);

    const yearPath = join(frDir, yearDir);
    const monthDirs = (await listDirs(yearPath)).filter((d) => /^\d{2}$/.test(d));

    for (const monthDir of monthDirs) {
      // Month page
      urls.push(`/fr/${yearDir}/${monthDir}`);

      // Document pages
      const monthPath = join(yearPath, monthDir);
      let files: string[];
      try {
        files = await readdir(monthPath);
      } catch {
        continue;
      }
      for (const file of files) {
        if (file.endsWith(".md") && file !== ".md") {
          urls.push(`/fr/${yearDir}/${monthDir}/${file.replace(/\.md$/, "")}`);
        }
      }
    }
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Sitemap XML generation
// ---------------------------------------------------------------------------

function buildUrlset(urls: string[], today: string, sourceChangefreq: string): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const path of urls) {
    const depth = path.split("/").length - 1;
    const priority = depth <= 1 ? "1.0" : depth <= 2 ? "0.8" : depth <= 3 ? "0.6" : "0.5";

    xml += `  <url>\n    <loc>${xmlEscape(SITE_URL)}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${sourceChangefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
  }

  xml += "</urlset>\n";
  return xml;
}

function buildSitemapIndex(filenames: string[], today: string): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const filename of filenames) {
    xml += `  <sitemap>\n    <loc>${xmlEscape(SITE_URL)}/${filename}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;
  }

  xml += "</sitemapindex>\n";
  return xml;
}

/** Split a URL list into chunks and write each as a sitemap file. Returns filenames written. */
async function writeChunkedSitemaps(
  urls: string[],
  prefix: string,
  outputDir: string,
  today: string,
  changefreq: string,
): Promise<string[]> {
  const filenames: string[] = [];

  for (let i = 0; i < urls.length; i += MAX_URLS_PER_FILE) {
    const chunk = urls.slice(i, i + MAX_URLS_PER_FILE);
    const chunkIndex = Math.floor(i / MAX_URLS_PER_FILE);
    const filename = `sitemap-${prefix}-${chunkIndex}.xml`;
    const xml = buildUrlset(chunk, today, changefreq);
    await writeFile(join(outputDir, filename), xml, "utf-8");
    filenames.push(filename);
    console.log(`  Wrote ${filename} (${chunk.length.toLocaleString()} URLs)`);
  }

  return filenames;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const contentDir = resolve(process.argv[2] ?? "./content");
  const outputDir = resolve("./public");
  const today = new Date().toISOString().split("T")[0]!;

  console.log(`Content directory: ${contentDir}`);
  console.log(`Output directory: ${outputDir}\n`);

  const [uscUrls, ecfrUrls, frUrls] = await Promise.all([
    collectUscUrls(contentDir),
    collectEcfrUrls(contentDir),
    collectFrUrls(contentDir),
  ]);

  console.log(`USC: ${uscUrls.length.toLocaleString()} URLs`);
  console.log(`eCFR: ${ecfrUrls.length.toLocaleString()} URLs`);
  console.log(`FR: ${frUrls.length.toLocaleString()} URLs`);
  console.log(
    `Total: ${(uscUrls.length + ecfrUrls.length + frUrls.length + 1).toLocaleString()} URLs\n`,
  );

  // Write homepage as a misc sitemap
  const miscUrls = ["/"];
  const allFilenames: string[] = [];

  allFilenames.push(...(await writeChunkedSitemaps(miscUrls, "misc", outputDir, today, "weekly")));
  allFilenames.push(...(await writeChunkedSitemaps(uscUrls, "usc", outputDir, today, "monthly")));
  allFilenames.push(...(await writeChunkedSitemaps(ecfrUrls, "ecfr", outputDir, today, "weekly")));
  allFilenames.push(...(await writeChunkedSitemaps(frUrls, "fr", outputDir, today, "daily")));

  // Write sitemap index
  const indexXml = buildSitemapIndex(allFilenames, today);
  const indexPath = join(outputDir, "sitemap.xml");
  await writeFile(indexPath, indexXml, "utf-8");

  console.log(`\nWrote sitemap index: ${indexPath} (${allFilenames.length} sitemaps)`);

  // If dist/client/ exists (post-build), copy sitemaps there so the running
  // Astro SSR server can serve them without a rebuild.
  const distClientDir = resolve("./dist/client");
  try {
    await access(distClientDir);
  } catch {
    // dist/client/ doesn't exist (pre-build run) — sitemaps will be
    // picked up automatically when the Astro build copies public/.
    return;
  }
  const sitemapFiles = ["sitemap.xml", ...allFilenames];
  for (const file of sitemapFiles) {
    await copyFile(join(outputDir, file), join(distClientDir, file));
  }
  console.log(`Copied ${sitemapFiles.length} sitemap files to ${distClientDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
