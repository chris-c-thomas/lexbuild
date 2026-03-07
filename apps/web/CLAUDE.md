# CLAUDE.md — LexBuild Web App

## Project Overview

`web` (`apps/web/`) is the LexBuild documentation site — a server-rendered web app that displays the entire U.S. Code at three granularity levels: individual sections (~60k), complete chapters (~1,200), and full titles (~58). Every level has its own URL with full SEO and the same viewer UX: syntax-highlighted raw Markdown source, rendered HTML toggle, copy button, and download button.

The site uses **SSR with CDN caching** — not static export. Three template routes fetch Markdown on-demand from a content store, render with Shiki + remark, and return HTML that is cached at the CDN edge. The app build takes seconds (just the application shell), not 30+ minutes. Content volume does not affect build time.

The site lives at `apps/web/` within the LexBuild monorepo. It is marked `"private": true` and is never published to npm.

**Architecture reference**: The site architecture plan (system diagrams, deployment options, cost analysis) is stored locally in `.claude/site-architecture.md` and is not committed to the repository.

## Monorepo Context

```
lexbuild/                              # LexBuild monorepo root
├── packages/
│   ├── core/                          # @lexbuild/core (published to npm)
│   ├── usc/                           # @lexbuild/usc (published to npm)
│   └── cli/                           # @lexbuild/cli (published to npm)
├── apps/
│   └── web/                           # web (private, never published)
│       ├── CLAUDE.md                  # THIS FILE
│       ├── package.json               # "private": true
│       ├── next.config.ts
│       ├── src/
│       ├── content/                   # LexBuild output — three granularities (git-ignored)
│       └── ...
├── docs/                              # User-facing docs
├── .claude/                           # Local dev artifacts (git-ignored)
│   └── site-architecture.md           # Architecture plan (not committed)
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md                          # Root CLAUDE.md (CLI/core conventions)
```

The site has **no code dependency** on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`. It consumes `lexbuild`'s *output* (`.md` files and `_meta.json` sidecars), not its code.

### pnpm Workspace

The monorepo `pnpm-workspace.yaml` must include `apps/web`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### Turborepo Pipeline

```jsonc
// turbo.json (additions to existing config)
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
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

`pnpm turbo build` builds packages only (unchanged). `pnpm turbo build:web --filter=web` builds the site.

## Tech Stack

- **Framework**: Next.js 15.x (App Router, SSR with CDN caching — NOT `output: 'export'`)
- **Language**: TypeScript 5.x, strict mode
- **Runtime**: Node.js >= 20 LTS (ESM)
- **UI**: React 19.x
- **Styling**: Tailwind CSS 4.x + `@tailwindcss/typography`
- **Components**: shadcn/ui (Radix primitives)
- **Syntax Highlighting**: Shiki (server-side per request, cached at CDN)
- **Markdown Rendering**: unified + remark-parse + remark-gfm + remark-rehype + rehype-stringify + rehype-slug
- **Frontmatter Parsing**: gray-matter
- **Sidebar Virtualization**: @tanstack/react-virtual
- **Search**: Pagefind (client-side, static index from source `.md` files)
- **Icons**: lucide-react
- **Deployment**: Vercel (SSR + edge caching) — portable to Cloudflare Workers, AWS, etc.
- **Content Storage**: Filesystem (default), portable to S3, R2, or Vercel Blob via provider abstraction
- **Monorepo**: Turborepo + pnpm workspaces

## Architecture Summary

The site uses server-side rendering with aggressive CDN caching. Three dynamic route templates handle all ~61,500 unique URLs:

1. **Title viewer** (`/usc/title-01/`) — reads `content/title/usc/title-01.md`
2. **Chapter viewer** (`/usc/title-01/chapter-01/`) — reads `content/chapter/usc/title-01/chapter-01.md`
3. **Section viewer** (`/usc/title-01/chapter-01/section-1/`) — reads `content/section/usc/title-01/chapter-01/section-1.md`

On first request, the Server Component fetches the `.md` file from the content provider, parses frontmatter, highlights with Shiki, renders with remark, and returns complete HTML. The response includes `Cache-Control: public, s-maxage=31536000, stale-while-revalidate=86400` — the CDN caches it for 1 year. All subsequent requests are served from cache at < 50ms.

Key design properties:

1. **Three granularity levels, one shared viewer.** The `ContentViewer` client component handles all three. The server component passes `granularity`, `rawMarkdown`, `highlightedSource`, `renderedHtml`, and `frontmatter` as props.
2. **Content is NOT embedded in the build.** It's fetched at request time from the content provider. The app build produces ~10 pages of template code, not 60k pre-rendered pages.
3. **Full SEO.** Server-rendered HTML means crawlers see complete content, unique `<title>`, meta description, and Open Graph tags — identical to static pages.
4. **Content storage is abstracted.** A `ContentProvider` interface decouples the application from the storage backend. Filesystem for dev/initial production; S3, R2, or Vercel Blob later.
5. **Navigation is lazy-loaded from pre-built JSON.** A build-time script generates per-title JSON files from section-level `_meta.json`. These are static assets in `public/nav/`.
6. **Cache invalidation is explicit.** Content changes quarterly (OLRC release points). Purge CDN cache after uploading new content. No automatic revalidation timers.

## Site Directory Structure

All paths relative to `apps/web/`:

```
apps/web/
├── CLAUDE.md                         # This file
├── next.config.ts                    # SSR config (NO output: 'export')
├── tailwind.config.ts
├── tsconfig.json
├── package.json                      # "private": true, "name": "web"
├── .env.local                        # CONTENT_STORAGE=fs, CONTENT_DIR=./content
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (html, body, fonts, theme)
│   │   ├── page.tsx                  # Landing page — title grid with stats
│   │   └── usc/
│   │       ├── layout.tsx            # USC layout — sidebar + content pane
│   │       ├── page.tsx              # /usc — title listing
│   │       └── [title]/
│   │           ├── layout.tsx        # Title layout — breadcrumb context
│   │           ├── page.tsx          # TITLE VIEWER — reads title-NN.md
│   │           └── [chapter]/
│   │               ├── page.tsx      # CHAPTER VIEWER — reads chapter-NN.md
│   │               └── [section]/
│   │                   └── page.tsx  # SECTION VIEWER — reads section-N.md
│   ├── components/
│   │   ├── sidebar/
│   │   │   ├── sidebar.tsx           # Sidebar container (client component)
│   │   │   ├── title-list.tsx        # Title accordion items
│   │   │   ├── chapter-list.tsx      # Chapter accordion
│   │   │   └── section-list.tsx      # Section list (virtualized > 100 entries)
│   │   ├── content/
│   │   │   ├── content-viewer.tsx    # Raw/rendered toggle — SHARED across all granularities
│   │   │   ├── copy-button.tsx       # Copy raw Markdown to clipboard
│   │   │   ├── download-button.tsx   # Download .md file
│   │   │   └── frontmatter-panel.tsx # Metadata display — adapts to granularity
│   │   ├── search/
│   │   │   └── search-dialog.tsx     # Pagefind search — Cmd+K dialog
│   │   └── ui/                       # shadcn/ui primitives
│   ├── lib/
│   │   ├── content/
│   │   │   ├── types.ts              # ContentProvider + NavProvider interfaces
│   │   │   ├── fs-provider.ts        # Filesystem implementation
│   │   │   ├── s3-provider.ts        # S3 implementation (future)
│   │   │   └── index.ts             # Provider factory (env-based selection)
│   │   ├── markdown.ts               # parseFrontmatter() + renderMarkdownToHtml()
│   │   ├── shiki.ts                  # Shiki highlighter singleton
│   │   ├── nav.ts                    # Navigation helpers
│   │   └── types.ts                  # Shared TypeScript interfaces
│   └── styles/
│       └── globals.css
├── scripts/
│   ├── generate-nav.ts               # Read _meta.json → public/nav/*.json
│   ├── generate-content.sh           # Run all three lexbuild convert commands
│   ├── generate-sitemap.ts           # Generate sitemap from _meta.json
│   ├── validate-content.ts           # Verify content directory integrity
│   └── deploy.sh                     # Full pipeline
├── content/                          # LexBuild output — git-ignored
│   ├── section/usc/                  # Section-level (60k files + _meta.json)
│   ├── chapter/usc/                  # Chapter-level (~1,200 files)
│   └── title/usc/                    # Title-level (~58 files)
└── public/
    ├── nav/                          # Pre-built navigation JSON (git-ignored)
    └── _pagefind/                    # Search index (git-ignored, generated from .md files)
```

## Content Provider Abstraction

All content access goes through provider interfaces. Page components never import `node:fs` directly — they call the provider.

### Provider Interfaces

```typescript
// src/lib/content/types.ts

export interface ContentProvider {
  /** Read a file by path (e.g., "section/usc/title-01/chapter-01/section-1.md") */
  getFile(path: string): Promise<string | null>;
  /** Check if a file exists */
  exists(path: string): Promise<boolean>;
}

export interface NavProvider {
  /** Get the top-level titles list */
  getTitles(): Promise<TitleSummary[]>;
  /** Get chapters for a title */
  getChapters(titleDir: string): Promise<ChapterNav[]>;
  /** Get sections for a chapter */
  getSections(titleDir: string, chapterDir: string): Promise<SectionNavEntry[]>;
}
```

### Filesystem Provider (Default)

```typescript
// src/lib/content/fs-provider.ts
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { ContentProvider, NavProvider } from "./types";

const CONTENT_ROOT = process.env.CONTENT_DIR ?? "./content";

export class FsContentProvider implements ContentProvider {
  async getFile(path: string): Promise<string | null> {
    try {
      return await readFile(join(CONTENT_ROOT, path), "utf-8");
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(join(CONTENT_ROOT, path));
      return true;
    } catch {
      return false;
    }
  }
}

export class FsNavProvider implements NavProvider {
  async getTitles(): Promise<TitleSummary[]> {
    // Read all section-level title _meta.json files
    const uscDir = join(CONTENT_ROOT, "section", "usc");
    const entries = await readdir(uscDir, { withFileTypes: true });
    const titleDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("title-"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const titles: TitleSummary[] = [];
    for (const dir of titleDirs) {
      const meta = JSON.parse(
        await readFile(join(uscDir, dir.name, "_meta.json"), "utf-8")
      );
      titles.push({
        number: meta.title_number,
        name: meta.title_name,
        directory: dir.name,
        chapterCount: meta.stats?.chapter_count ?? 0,
        sectionCount: meta.stats?.section_count ?? 0,
        tokenEstimate: meta.stats?.total_tokens_estimate ?? 0,
      });
    }
    return titles;
  }

  async getChapters(titleDir: string): Promise<ChapterNav[]> {
    const metaPath = join(CONTENT_ROOT, "section", "usc", titleDir, "_meta.json");
    const meta = JSON.parse(await readFile(metaPath, "utf-8"));
    return (meta.chapters ?? []).map((ch: any) => ({
      number: ch.number,
      name: ch.name,
      directory: ch.directory,
      sections: (ch.sections ?? []).map((s: any) => ({
        number: s.number,
        name: s.name,
        file: s.file.replace(/\.md$/, ""),
        status: s.status ?? "current",
        hasNotes: s.has_notes ?? false,
      })),
    }));
  }

  async getSections(titleDir: string, chapterDir: string): Promise<SectionNavEntry[]> {
    const chapters = await this.getChapters(titleDir);
    const chapter = chapters.find((ch) => ch.directory === chapterDir);
    return chapter?.sections ?? [];
  }
}
```

### Provider Factory

```typescript
// src/lib/content/index.ts
import type { ContentProvider, NavProvider } from "./types";

let _content: ContentProvider | null = null;
let _nav: NavProvider | null = null;

export function getContentProvider(): ContentProvider {
  if (!_content) {
    const storage = process.env.CONTENT_STORAGE ?? "fs";
    switch (storage) {
      case "fs": {
        const { FsContentProvider } = require("./fs-provider");
        _content = new FsContentProvider();
        break;
      }
      // Future: case "s3", case "r2", case "blob"
      default:
        throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
    }
  }
  return _content;
}

export function getNavProvider(): NavProvider {
  if (!_nav) {
    const storage = process.env.CONTENT_STORAGE ?? "fs";
    switch (storage) {
      case "fs": {
        const { FsNavProvider } = require("./fs-provider");
        _nav = new FsNavProvider();
        break;
      }
      default:
        throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
    }
  }
  return _nav;
}
```

## Content Data Model

### Three Granularity Levels

| Level | Content Dir | Route | Viewer UX |
|---|---|---|---|
| Section | `content/section/usc/` | `/usc/title-01/chapter-01/section-1/` | Source/rendered, copy, download |
| Chapter | `content/chapter/usc/` | `/usc/title-01/chapter-01/` | Source/rendered, copy, download |
| Title | `content/title/usc/` | `/usc/title-01/` | Source/rendered, copy, download |

### Section-Level Frontmatter

```yaml
---
identifier: "/us/usc/t1/s1"
title: "1 USC § 1 - Words denoting number, gender, and so forth"
title_number: 1
title_name: "GENERAL PROVISIONS"
section_number: "1"
section_name: "Words denoting number, gender, and so forth"
chapter_number: 1
chapter_name: "RULES OF CONSTRUCTION"
positive_law: true
currency: "119-73"
last_updated: "2025-12-03"
format_version: "1.0.0"
generator: "lexbuild@1.1.0"
source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633; ...)"
---
```

### Chapter-Level Frontmatter

Section-level fields but scoped to the chapter. `section_number` and `section_name` are absent. Sections are inlined as headings within the body.

### Title-Level Frontmatter (Enriched)

```yaml
---
identifier: "/us/usc/t1"
title: "Title 1 — GENERAL PROVISIONS"
title_number: 1
title_name: "GENERAL PROVISIONS"
positive_law: true
currency: "119-73"
last_updated: "2025-12-03"
format_version: "1.0.0"
generator: "lexbuild@1.1.0"
chapter_count: 3
section_count: 39
total_token_estimate: 35000
---
```

Omits section/chapter-scoped fields. Adds `chapter_count`, `section_count`, `total_token_estimate`.

### Navigation Source

The **section-level `_meta.json`** files (in `content/section/usc/`) are the canonical source for all navigation. Chapter and title content directories provide only their `.md` files — not navigation data.

### Directory Naming Conventions

| Component | Pattern | Examples |
|---|---|---|
| Title directory | `title-{NN}` (2-digit zero-padded) | `title-01`, `title-26` |
| Appendix directory | `title-{NN}-appendix` | `title-05-appendix` |
| Chapter directory/file | `chapter-{NN}` (2-digit zero-padded) | `chapter-01`, `chapter-99` |
| Section file | `section-{ID}.md` (NOT zero-padded) | `section-1.md`, `section-7801.md`, `section-202a.md` |

Section numbers are strings, not integers. They can be alphanumeric. Duplicates are disambiguated with `-2`, `-3` suffixes.

## Build & Dev Commands

### Content Generation (from monorepo root)

```bash
pnpm turbo build --filter=@lexbuild/cli

# Generate all three granularities
node packages/cli/dist/index.js convert --all -g section -o ./apps/web/content/section --link-style canonical
node packages/cli/dist/index.js convert --all -g chapter -o ./apps/web/content/chapter --link-style canonical
node packages/cli/dist/index.js convert --all -g title   -o ./apps/web/content/title   --link-style canonical

# Or from apps/web/:
cd apps/web && bash scripts/generate-content.sh
```

### Site Development

```bash
# From monorepo root
pnpm turbo dev:web --filter=web

# Or directly
cd apps/web && pnpm dev
# Browse: http://localhost:3000/usc/title-01/chapter-01/section-1
```

### Navigation & Search Generation (from apps/web/)

```bash
# Navigation JSON (reads section-level _meta.json)
npx tsx scripts/generate-nav.ts

# Search index (runs against .md source files, NOT rendered HTML)
npx pagefind --source ./content/section/usc --glob "**/*.md" --output-path ./public/_pagefind
```

### Deployment (from apps/web/)

```bash
# Deploy app (fast — seconds, not minutes)
vercel deploy --prod

# Or run full pipeline
bash scripts/deploy.sh
```

### Dev Content Subsets

```bash
# From monorepo root — Phase 1: Minimal
node packages/cli/dist/index.js convert --titles 1 -g section -o ./apps/web/content/section
node packages/cli/dist/index.js convert --titles 1 -g chapter -o ./apps/web/content/chapter
node packages/cli/dist/index.js convert --titles 1 -g title   -o ./apps/web/content/title

# Phase 2: Sidebar stress testing
node packages/cli/dist/index.js convert --titles 1,5,26 -g section -o ./apps/web/content/section
node packages/cli/dist/index.js convert --titles 1,5,26 -g chapter -o ./apps/web/content/chapter
node packages/cli/dist/index.js convert --titles 1,5,26 -g title   -o ./apps/web/content/title
```

After generating content, always run `cd apps/web && npx tsx scripts/generate-nav.ts`.

## TypeScript Interfaces

Define in `src/lib/types.ts`:

```typescript
export type Granularity = "section" | "chapter" | "title";

/**
 * Flexible frontmatter across all three granularities.
 * Section-level has section_number/section_name.
 * Title-level has chapter_count/section_count/total_token_estimate.
 */
export interface ContentFrontmatter {
  identifier: string;
  title: string;
  title_number: number;
  title_name: string;
  positive_law: boolean;
  currency: string;
  last_updated: string;
  format_version: string;
  generator: string;

  // Section-level (optional — absent in title-level output)
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

  // Title-level enriched (optional — only in title-level output)
  chapter_count?: number;
  section_count?: number;
  total_token_estimate?: number;
}

export interface TitleSummary {
  number: number;
  name: string;
  directory: string;
  chapterCount: number;
  sectionCount: number;
  tokenEstimate: number;
}

export interface TitleNav {
  number: number;
  name: string;
  positiveLaw: boolean;
  chapters: ChapterNav[];
}

export interface ChapterNav {
  number: number;
  name: string;
  directory: string;
  sections: SectionNavEntry[];
}

export interface SectionNavEntry {
  number: string;
  name: string;
  file: string;     // "section-1" (no .md)
  status: string;
  hasNotes: boolean;
}

export interface ContentViewerProps {
  rawMarkdown: string;
  highlightedSource: string;
  renderedHtml: string;
  frontmatter: ContentFrontmatter;
  granularity: Granularity;
  downloadFilename: string;
}
```

## Route Details

### Key Difference from Static Export

Routes do NOT use `generateStaticParams()`. They are dynamic Server Components that:

1. Extract route params
2. Read the `.md` file from the content provider
3. Parse frontmatter, highlight with Shiki, render with remark
4. Return HTML with CDN cache headers
5. Return SEO metadata via `generateMetadata()`

### `/usc/[title]/[chapter]/[section]/page.tsx` — Section Viewer

```typescript
import { notFound } from "next/navigation";
import { getContentProvider } from "@/lib/content";
import { parseFrontmatter, renderMarkdownToHtml } from "@/lib/markdown";
import { highlightMarkdown } from "@/lib/shiki";
import { ContentViewer } from "@/components/content/content-viewer";

interface Props {
  params: Promise<{ title: string; chapter: string; section: string }>;
}

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

export async function generateMetadata({ params }: Props) {
  const { title, chapter, section } = await params;
  const content = getContentProvider();
  const raw = await content.getFile(`section/usc/${title}/${chapter}/${section}.md`);
  if (!raw) return { title: "Not found" };
  const { frontmatter } = parseFrontmatter(raw);
  return {
    title: frontmatter.title,
    description: `${frontmatter.title} — Structured Markdown from LexBuild.`,
    openGraph: { title: frontmatter.title, type: "article" },
  };
}
```

### `/usc/[title]/[chapter]/page.tsx` — Chapter Viewer

Same pattern. Reads from `content/chapter/usc/{title}/{chapter}.md`. `granularity="chapter"`.

### `/usc/[title]/page.tsx` — Title Viewer

Same pattern. Reads from `content/title/usc/{title}.md`. `granularity="title"`. Note: title files can be large (Title 26 ~10 MB). Shiki handles this in ~50–200ms. Cached after first request.

### `/usc/page.tsx` — USC Index

Reads all title summaries from `NavProvider.getTitles()`. Renders a grid of title cards with stats.

### `/page.tsx` — Landing Page

Project introduction + title index grid.

### Cache Headers

Every viewer page should set CDN cache headers. In Next.js, this can be configured in `next.config.ts` via the `headers()` function, or in the route handler:

```typescript
// In next.config.ts
async headers() {
  return [
    {
      source: "/usc/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=31536000, stale-while-revalidate=86400",
        },
      ],
    },
  ];
}
```

This tells the CDN to cache viewer pages for 1 year (safe because content updates are explicit + cache purge).

## Key Implementation Notes

### NO `output: 'export'`

This site is NOT statically exported. Do NOT set `output: 'export'` in `next.config.ts`. The site requires a server runtime (Vercel Serverless Functions or similar) for on-demand rendering.

### NO `generateStaticParams`

Dynamic routes do NOT use `generateStaticParams()`. Every request is handled by a Server Component at runtime. Pages that don't exist in the content store return 404 via `notFound()`.

### Content Provider — Not Direct `fs` Reads

Page components read content via `getContentProvider()`, never via direct `import { readFile } from "node:fs/promises"`. This ensures the storage backend can be swapped without changing page code.

**Exception**: Build scripts (`generate-nav.ts`, `generate-sitemap.ts`) can use `node:fs` directly because they always run locally against the filesystem.

### Shiki Singleton

Initialize the highlighter once per server lifetime. In Next.js, module-level singletons persist across requests within the same serverless function instance:

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

### Pagefind Runs Against Source Files

Pagefind indexes the `.md` source files directly (not rendered HTML, since there is no static HTML output):

```bash
npx pagefind --source ./content/section/usc --glob "**/*.md" --output-path ./public/_pagefind
```

The index is committed to `public/_pagefind/` or generated at deploy time. The client loads it from `/_pagefind/pagefind.js`.

### Navigation: Pre-Built Static JSON + API Route

The sidebar navigation uses two layers:

1. **Static JSON** (`public/nav/titles.json`, `public/nav/title-NN.json`) — generated by `scripts/generate-nav.ts` from section-level `_meta.json`. These are static assets served directly by the CDN.
2. **API route** (optional, `/api/nav/[title]`) — if you prefer server-side nav delivery instead of static JSON. Uses `NavProvider` to read `_meta.json` on-demand.

Start with static JSON (simpler). Add the API route later if needed.

### Sidebar Navigation Behavior

- Initial load: 54 title entries from `titles.json` (embedded at build time or fetched on mount)
- Expand a title: fetch `/nav/title-XX.json`, cache in React state
- Section lists > 100 entries: virtualized with `@tanstack/react-virtual`
- Active item: derive from `usePathname()`, auto-expand and scroll into view
- Sidebar links: title name → title viewer, chapter name → chapter viewer, section → section viewer

### FrontmatterPanel Adaptation

Adapts based on field presence (not a `granularity` prop):
- `frontmatter.chapter_count !== undefined` → title-level: show chapter count, section count, token estimate
- `frontmatter.section_number !== undefined` → section-level: show section number, source credit
- Otherwise → chapter-level: show chapter name, positive law, currency

## Code Conventions

### TypeScript

- ESM only (`"type": "module"`)
- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`
- Use `import type` for type-only imports
- Prefer `interface` over `type` for object shapes
- All exported functions and types must have JSDoc comments
- Use `unknown` over `any`

### React / Next.js

- Server Components by default. `"use client"` only for browser APIs, hooks, event handlers.
- Client components: `sidebar.tsx`, `content-viewer.tsx`, `copy-button.tsx`, `download-button.tsx`, `search-dialog.tsx`, `section-list.tsx`
- Server components: all `page.tsx`, `layout.tsx`, `frontmatter-panel.tsx`
- Content is fetched via the content provider in Server Components, passed as props to Client Components.

### Styling

- Tailwind CSS utility classes only
- `@tailwindcss/typography` (`prose` classes) for rendered HTML
- Dark mode via `class` strategy
- Shiki dual themes toggled via CSS class

### Formatting

- Prettier: double quotes, trailing commas, 100 char print width
- ESLint with `@typescript-eslint`

## Common Pitfalls

- **Do NOT set `output: 'export'` in next.config.ts.** This site uses SSR, not static export.
- **Do NOT use `generateStaticParams()`.** Routes are dynamic, rendered on-demand, cached at CDN.
- **Do NOT import `node:fs` in page components.** Use the content provider. Only build scripts use `node:fs` directly.
- **Section numbers are strings.** `"202a"`, `"7701-1"`, `"3598-2"` are valid. Do not parse as integers.
- **Title-level files can be large.** Title 26 is ~10 MB. Test Shiki performance during Phase 1.
- **Navigation comes from section-level `_meta.json` ONLY.** Not from chapter or title content dirs.
- **Three content generation commands are required.** Missing a granularity = missing pages.
- **CDN cache is 1 year.** After content updates, you MUST purge the CDN cache.
- **`content/` and `public/nav/` and `public/_pagefind/` are git-ignored.**
- **Do NOT add the site to the default `build` task in turbo.json.**
- **The app build is fast (seconds).** If build takes minutes, something is wrong — you may have accidentally enabled static generation.
- **Shiki singleton persists across requests** within a serverless function instance. Do NOT reinitialize per request.
- **`process.env.CONTENT_DIR` defaults to `./content`.** Override via `.env.local` for custom paths.
- **`process.env.CONTENT_STORAGE` defaults to `fs`.** Future values: `s3`, `r2`, `blob`.
- **Tailwind CSS v4 requires `@tailwindcss/postcss` and a `postcss.config.mjs`.** Without these, no utility classes or `@theme inline` mappings are generated. Next.js does NOT auto-detect Tailwind v4 — you must configure PostCSS explicitly.
- **Clear `.next/` cache after CSS config changes.** Stale cache can mask PostCSS fixes. Run `rm -rf .next` and restart dev server.
- **shadcn/ui `buttonVariants` is `"use client"`.** Cannot call it in Server Components. Use inline Tailwind classes or a client wrapper for styled links in server pages.

---

## Deployment

See `.claude/deployment-guide.md` for the complete production deployment checklist.

### Future Work

- Additional corpora (CFR, Federal Register) — new content dirs, new route trees, same viewer
- Migrate content storage to S3/R2/Blob if filesystem becomes unwieldy
- Cross-reference link resolution between sections
- Analytics (Vercel Web Analytics, Plausible, or Cloudflare Web Analytics)
