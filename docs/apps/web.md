# Web App

The LexBuild web app is a server-rendered documentation site for browsing the entire U.S. Code as structured Markdown. It displays all 60,000+ sections, 1,200+ chapters, and 58 titles at three granularity levels, each with its own URL. The site uses SSR with aggressive CDN caching -- not static export. Three dynamic route templates handle all URLs, rendering on first request and caching at the edge for one year. The app build takes seconds (just the application shell), and content volume does not affect build time.

The web app lives at `apps/web/` within the LexBuild monorepo. It is marked `"private": true`, is never published to npm, and has no code dependency on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`. It consumes LexBuild's output files (`.md` files and `_meta.json` sidecars) as data, not as code.

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, SSR, Turbopack) |
| Language | TypeScript 5, strict mode |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix primitives) |
| Syntax Highlighting | Shiki (github-light / github-dark dual themes) |
| Markdown Rendering | unified + remark-parse + remark-gfm + remark-rehype + rehype-stringify + rehype-slug |
| Frontmatter Parsing | gray-matter |
| Search | Pagefind (client-side, static index from `.md` source files) |
| Sidebar Virtualization | @tanstack/react-virtual |
| Icons | lucide-react |
| Deployment | Vercel (SSR + edge caching), portable to Cloudflare Workers, AWS, etc. |

### SSR with CDN Caching

Every viewer page is a Server Component that:

1. Extracts route parameters.
2. Reads the `.md` file from the content provider.
3. Parses frontmatter with `gray-matter`.
4. Highlights the raw Markdown source with Shiki (dual themes for light/dark mode).
5. Renders the Markdown body to HTML with the unified/remark/rehype pipeline.
6. Returns complete HTML with CDN cache headers.

The response includes `Cache-Control: public, s-maxage=31536000, stale-while-revalidate=86400` -- the CDN caches it for one year. Subsequent requests are served from the edge at sub-50ms latency. Cache invalidation is explicit: content updates happen quarterly (OLRC release points), and the CDN cache is purged after uploading new content.

### Key Design Properties

1. **Three granularity levels, one shared viewer.** The `ContentViewer` client component handles title, chapter, and section views identically. The server component passes `granularity`, `rawMarkdown`, `highlightedSource`, `renderedHtml`, and `frontmatter` as props.

2. **Content is NOT embedded in the build.** It is fetched at request time from the content provider. The app build produces a small application shell, not 60,000+ pre-rendered pages.

3. **Full SEO.** Server-rendered HTML means crawlers see complete content with unique `<title>`, meta description, and Open Graph tags -- identical to static pages.

4. **Content storage is abstracted.** A `ContentProvider` interface decouples the application from the storage backend. Filesystem for local development, Cloudflare R2 for production.

5. **Navigation is lazy-loaded from pre-built JSON.** A build-time script generates per-title JSON files from section-level `_meta.json`. These are static assets in `public/nav/`.

6. **No `generateStaticParams`.** Routes do not use Next.js static generation. Every request is handled by a Server Component at runtime. Pages that do not exist return 404 via `notFound()`.

---

## Content Provider Abstraction

**File**: `apps/web/src/lib/content/types.ts`

All content access goes through provider interfaces. Page components never import `node:fs` directly -- they call the provider. This enables swapping the storage backend without modifying any page code.

### ContentProvider Interface

```typescript
interface ContentProvider {
  getFile(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
}
```

The `path` parameter is relative to the content root, e.g., `"section/usc/title-01/chapter-01/section-1.md"`.

### NavProvider Interface

```typescript
interface NavProvider {
  getTitles(): Promise<TitleSummary[]>;
  getChapters(titleDir: string): Promise<ChapterNav[]>;
  getSections(titleDir: string, chapterDir: string): Promise<SectionNavEntry[]>;
}
```

Navigation data comes exclusively from section-level `_meta.json` files. Chapter and title content directories provide only their `.md` files, not navigation data.

### Filesystem Provider (Local Development)

**File**: `apps/web/src/lib/content/fs-provider.ts`

The `FsContentProvider` reads files from the local filesystem using `node:fs/promises`. The content root defaults to `./content` and can be overridden via the `CONTENT_DIR` environment variable.

The `FsNavProvider` reads `_meta.json` files from the section-level content directory to build navigation structures. It extracts title summaries by scanning title directories, and chapter/section lists by parsing the hierarchical `_meta.json` data.

### S3/R2 Provider (Production)

**File**: `apps/web/src/lib/content/s3-provider.ts`

The `S3ContentProvider` reads content from a Cloudflare R2 bucket (or any S3-compatible store) using `@aws-sdk/client-s3`. It uses `GetObjectCommand` for file reads and `HeadObjectCommand` for existence checks. Returns `null` on `NoSuchKey` errors (same contract as the filesystem provider).

The `S3NavProvider` discovers title directories via `ListObjectsV2Command` on the `section/usc/` prefix, then fetches and parses `_meta.json` files. Parsed metadata is cached in a module-level `Map` that persists across requests within the same serverless function instance.

Configuration via environment variables:

| Variable | Description |
|---|---|
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Bucket name (default: `lexbuild-content`) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_REGION` | Region (default: `auto`) |

### Provider Factory

**File**: `apps/web/src/lib/content/index.ts`

```typescript
function getContentProvider(): ContentProvider;
function getNavProvider(): NavProvider;
```

The factory uses the `CONTENT_STORAGE` environment variable (default: `"fs"`) to select the provider implementation. Singletons are cached for the lifetime of the process.

| Value | Provider | Use Case |
|---|---|---|
| `fs` (default) | `FsContentProvider` / `FsNavProvider` | Local development |
| `s3` | `S3ContentProvider` / `S3NavProvider` | Production (Cloudflare R2) |

---

## Content Pipeline

### Generation

Content is generated by running LexBuild's `convert` command three times, once for each granularity level:

```bash
# From apps/web/
bash scripts/generate-content.sh
```

This runs:

1. `lexbuild convert --all -g section -o ./content/section --link-style canonical`
2. `lexbuild convert --all -g chapter -o ./content/chapter --link-style canonical`
3. `lexbuild convert --all -g title -o ./content/title --link-style canonical`
4. `generate-nav.ts` -- reads `_meta.json` sidecars and writes `public/nav/*.json`
5. `generate-search-index.ts` -- runs Pagefind against section-level `.md` files, writes to `public/_pagefind/`
6. `generate-sitemap.ts` -- reads `_meta.json` and writes `public/sitemap.xml`

For development, a subset of titles can be generated:

```bash
bash scripts/generate-content.sh "--titles 1,5,26"
```

### Content Directory Structure

```
apps/web/content/
  section/usc/        # ~60,000 .md files + _meta.json sidecars
    title-01/
      _meta.json
      chapter-01/
        _meta.json
        section-1.md
        section-2.md
  chapter/usc/        # ~1,200 .md files
    title-01/
      chapter-01/
        chapter-01.md
  title/usc/          # ~58 .md files
    title-01.md
```

All content directories are gitignored. The `.vercelignore` excludes `content/` and `downloads/` from Vercel deployments (content is served from R2 in production).

### Directory Naming Conventions

| Component | Pattern | Examples |
|---|---|---|
| Title directory | `title-{NN}` (2-digit zero-padded) | `title-01`, `title-26` |
| Appendix directory | `title-{NN}-appendix` | `title-05-appendix` |
| Chapter directory/file | `chapter-{NN}` (2-digit zero-padded) | `chapter-01`, `chapter-99` |
| Section file | `section-{ID}.md` (NOT zero-padded) | `section-1.md`, `section-7801.md`, `section-202a.md` |

Section numbers are strings, not integers. They can be alphanumeric. Duplicates are disambiguated with `-2`, `-3` suffixes.

---

## Routes

### Route Structure

| Route | Content Source | Granularity |
|---|---|---|
| `/` | -- | Landing page with title grid and stats |
| `/usc` | `NavProvider.getTitles()` | USC index: grid of all titles |
| `/usc/title-01/` | `content/title/usc/title-01.md` | Title viewer |
| `/usc/title-01/chapter-01/` | `content/chapter/usc/title-01/chapter-01/chapter-01.md` | Chapter viewer |
| `/usc/title-01/chapter-01/section-1/` | `content/section/usc/title-01/chapter-01/section-1.md` | Section viewer |

### Viewer Page Pattern

All three viewer pages follow the same server component pattern:

```typescript
// apps/web/src/app/usc/[title]/[chapter]/[section]/page.tsx

export default async function SectionPage({ params }: Props) {
  const { title, chapter, section } = await params;
  const content = getContentProvider();

  const raw = await content.getFile(
    `section/usc/${title}/${chapter}/${section}.md`
  );
  if (!raw) notFound();

  const { frontmatter, body } = parseFrontmatter(raw);
  const highlightedSource = await highlightMarkdown(raw);
  const renderedHtml = await renderMarkdownToHtml(body);

  return (
    <ContentViewer
      rawMarkdown={raw}
      highlightedSource={highlightedSource}
      renderedHtml={renderedHtml}
      frontmatter={frontmatter}
      granularity="section"
      downloadFilename={`${section}.md`}
    />
  );
}
```

Each page also exports `generateMetadata()` for SEO, producing unique `<title>`, description, and Open Graph tags from the frontmatter.

### Layout Hierarchy

```
app/layout.tsx              # Root: html, body, fonts, theme script
  app/usc/layout.tsx        # USC: sidebar + content pane + search dialog
    app/usc/[title]/layout.tsx    # Title: breadcrumb context
      app/usc/[title]/page.tsx                      # Title viewer
      app/usc/[title]/[chapter]/page.tsx             # Chapter viewer
      app/usc/[title]/[chapter]/[section]/page.tsx   # Section viewer
```

Each level has a `loading.tsx` skeleton for route transitions.

---

## Key Components

### ContentViewer

**File**: `apps/web/src/components/content/content-viewer.tsx`

A client component (`"use client"`) shared across all three granularity levels. Features:

- **Source/Preview toggle** -- switches between syntax-highlighted Markdown source (Shiki) and rendered HTML (remark).
- **Copy button** -- copies raw Markdown to clipboard.
- **Download button** -- downloads the raw Markdown as a `.md` file.
- **FrontmatterPanel** -- displays metadata. Adapts based on field presence, not a granularity prop:
  - `chapter_count` present: title-level display (chapter count, section count, token estimate).
  - `section_number` present: section-level display (section number, source credit).
  - Otherwise: chapter-level display (chapter name, positive law, currency).

### ContentViewerProps

```typescript
interface ContentViewerProps {
  rawMarkdown: string;
  highlightedSource: string;
  renderedHtml: string;
  frontmatter: ContentFrontmatter;
  granularity: Granularity;
  downloadFilename: string;
}
```

### Sidebar

**Files**: `apps/web/src/components/sidebar/`

The sidebar provides hierarchical navigation across all 54 titles, their chapters, and sections.

- **Initial load**: 54 title entries from `titles.json` (fetched on mount or embedded at build time).
- **Expand a title**: fetches `/nav/title-XX.json`, caches in React state.
- **Section lists > 100 entries**: virtualized with `@tanstack/react-virtual` to maintain scroll performance.
- **Active item**: derived from `usePathname()`, auto-expands ancestors and scrolls into view.
- **Links**: title name links to the title viewer, chapter name to the chapter viewer, section entries to the section viewer.

### Search

**File**: `apps/web/src/components/search/search-dialog.tsx`

Full-text search powered by Pagefind. Opens with Cmd+K (or Ctrl+K). The Pagefind index is generated from `.md` source files (not rendered HTML, since there is no static HTML output):

```bash
npx pagefind --source ./content/section/usc --glob "**/*.md" --output-path ./public/_pagefind
```

The client loads the index from `/_pagefind/pagefind.js`.

### Shiki Singleton

**File**: `apps/web/src/lib/shiki.ts`

The Shiki highlighter is initialized once per server lifetime using a module-level singleton. In Next.js, module-level singletons persist across requests within the same serverless function instance:

```typescript
let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["markdown", "yaml"],
    });
  }
  return highlighter;
}
```

This avoids reinitializing the highlighter per request, which would add 100-200ms of latency.

---

## Monorepo Integration

### No Code Dependency

The web app does NOT import from `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`. It consumes their output -- `.md` files with YAML frontmatter and `_meta.json` sidecar files -- as data.

### Excluded from Default Build

The app has no `build` script in its `package.json` (only `build:web`). This means `pnpm turbo build` does not attempt to build the web app, which would fail without generated content. To build the app:

```bash
pnpm turbo build:web --filter=web
```

### Excluded from Changesets

The app is `"private": true` and listed in `.changeset/config.json` `ignore`. Version bumps to the published packages do not create changesets for the web app.

### Turborepo Tasks

```jsonc
{
  "tasks": {
    "build:web": {
      "dependsOn": ["^build"],
      "outputs": [".next/**"],
      "cache": false
    },
    "dev:web": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## TypeScript Interfaces

**File**: `apps/web/src/lib/types.ts`

```typescript
type Granularity = "section" | "chapter" | "title";

interface ContentFrontmatter {
  identifier: string;
  title: string;
  title_number: number;
  title_name: string;
  positive_law: boolean;
  currency: string;
  last_updated: string;
  format_version: string;
  generator: string;
  // Section-level (absent in title-level output)
  section_number?: string;
  section_name?: string;
  chapter_number?: number;
  chapter_name?: string;
  subchapter_number?: string;
  subchapter_name?: string;
  part_number?: string;
  part_name?: string;
  source_credit?: string;
  status?: string;
  // Title-level enriched (only in title-level output)
  chapter_count?: number;
  section_count?: number;
  total_token_estimate?: number;
}

interface TitleSummary {
  number: number;
  name: string;
  directory: string;
  chapterCount: number;
  sectionCount: number;
  tokenEstimate: number;
}

interface ChapterNav {
  number: number;
  name: string;
  directory: string;
  sections: SectionNavEntry[];
}

interface SectionNavEntry {
  number: string;      // String, not integer ("202a", "7701-1")
  name: string;
  file: string;        // "section-1" (no .md extension)
  status: string;
  hasNotes: boolean;
}
```

---

## Deployment

### Vercel (Production)

The site deploys to Vercel via the local CLI, not GitHub-triggered CI:

```bash
cd apps/web
vercel deploy --prod
```

The `.vercelignore` file overrides `.gitignore` to include `content/`, `public/nav/`, `public/_pagefind/`, and `public/sitemap.xml` in the deployment payload.

### Full Pipeline

```bash
cd apps/web
bash scripts/deploy.sh
```

This runs content generation, navigation/search/sitemap generation, and then `vercel deploy --prod`.

### CDN Caching

All viewer pages set `s-maxage=31536000` (one year). This is safe because content updates are explicit:

1. OLRC publishes a new release point (quarterly).
2. Run `generate-content.sh` with the new XML.
3. Deploy with `vercel deploy --prod`.
4. Purge the CDN cache.

No automatic revalidation timers are used.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTENT_STORAGE` | `fs` | Content backend: `fs` or `s3` |
| `CONTENT_DIR` | `./content` | Path to content directory (filesystem provider only) |
| `R2_ENDPOINT` | — | R2/S3 endpoint URL (S3 provider only) |
| `R2_BUCKET` | `lexbuild-content` | R2/S3 bucket name (S3 provider only) |
| `R2_ACCESS_KEY_ID` | — | R2/S3 access key ID (S3 provider only) |
| `R2_SECRET_ACCESS_KEY` | — | R2/S3 secret access key (S3 provider only) |
| `R2_REGION` | `auto` | R2/S3 region (S3 provider only) |
| `SITE_URL` | `https://lexbuild.dev` | Base URL for sitemap generation |

---

## Server vs Client Components

| Component | Type | Reason |
|---|---|---|
| All `page.tsx` | Server | Content fetching, Shiki highlighting, remark rendering |
| All `layout.tsx` | Server | Static layout structure |
| `content-viewer.tsx` | Client | Toggle state, clipboard API, download API |
| `copy-button.tsx` | Client | Clipboard API |
| `download-button.tsx` | Client | Blob/URL APIs |
| `sidebar.tsx` | Client | Accordion state, lazy JSON fetching, virtualization |
| `section-list.tsx` | Client | @tanstack/react-virtual |
| `search-dialog.tsx` | Client | Pagefind client-side search, keyboard shortcut |
| `frontmatter-panel.tsx` | Server | Pure display, no client APIs |

### Styling

- Tailwind CSS v4 utility classes only.
- `@tailwindcss/typography` (`prose` classes) for rendered HTML content.
- Dark mode via `class` strategy, persisted to `localStorage`, respects `prefers-color-scheme`.
- Shiki dual themes toggled via CSS class.
- Tailwind v4 requires `@tailwindcss/postcss` and a `postcss.config.mjs`. Without these, no styles are generated.

---

## Common Pitfalls

- **Do NOT set `output: 'export'` in `next.config.ts`.** The site uses SSR, not static export.
- **Do NOT use `generateStaticParams()`.** Routes are dynamic, rendered on-demand, cached at CDN.
- **Do NOT import `node:fs` in page components.** Use the content provider.
- **Section numbers are strings.** `"202a"`, `"7701-1"`, `"3598-2"` are all valid.
- **Title-level files can be large.** Title 26 is approximately 10 MB. Shiki handles this in 50-200ms.
- **Navigation comes from section-level `_meta.json` ONLY.** Not from chapter or title content directories.
- **Three content generation commands are required.** Missing a granularity level means missing pages at that level.
- **CDN cache is one year.** After content updates, you must purge the CDN cache.
- **`content/`, `public/nav/`, and `public/_pagefind/` are gitignored.**
- **Clear `.next/` cache after CSS config changes.** Stale cache can mask PostCSS fixes.
