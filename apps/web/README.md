# LexBuild Web

A server-rendered documentation site for browsing the complete U.S. Code as structured Markdown.

## Features

- **60,000+ section pages** — every section of all 54 USC titles, rendered on-demand via SSR
- **Three granularity levels** — title, chapter, and section viewers with a shared content component
- **Markdown / Preview toggle** — syntax-highlighted Markdown source (Shiki) and rendered HTML (remark)
- **Sidebar navigation** — lazy-loaded per-title JSON, accordion expand, virtualized section lists (> 100 entries)
- **Full-text search** — Pagefind-powered Cmd+K dialog, indexes all 60k+ sections
- **Dark mode** — class-based toggle, persists to localStorage, respects `prefers-color-scheme`
- **CDN caching** — `s-maxage=31536000` on all viewer pages, cached for 1 year at the edge
- **SEO** — unique `<title>`, Open Graph metadata, `robots.txt`, sitemap with 63k+ URLs
- **Copy & download** — copy raw Markdown to clipboard or download as `.md`
- **Loading skeletons** — skeleton placeholders during route transitions
- **Custom 404** — styled error page with dark mode support

## Architecture

The site uses **SSR with CDN caching** — not static export. Three dynamic route templates handle all URLs:

| Route | Content Source | Granularity |
|---|---|---|
| `/usc/title-01/` | `content/title/usc/title-01.md` | Title |
| `/usc/title-01/chapter-01/` | `content/chapter/usc/title-01/chapter-01.md` | Chapter |
| `/usc/title-01/chapter-01/section-1/` | `content/section/usc/title-01/chapter-01/section-1.md` | Section |

On first request, the server component reads the `.md` file from the content provider, parses frontmatter, highlights with Shiki, renders with remark, and returns complete HTML. The CDN caches it — all subsequent requests are served from cache.

The site has **no code dependency** on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`. It consumes LexBuild's output files only.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- LexBuild CLI built (`pnpm turbo build --filter=@lexbuild/cli`)
- USC XML downloaded (`node packages/cli/dist/index.js download --all`)

## Quick Start

From the monorepo root:

```bash
# 1. Build the CLI
pnpm turbo build --filter=@lexbuild/cli

# 2. Generate content at all three granularities
cd apps/web
bash scripts/generate-content.sh

# 3. Start development server
pnpm dev
```

Browse to [http://localhost:3000](http://localhost:3000).

## Content Generation

The site needs content generated at three granularity levels, plus navigation JSON, a search index, and a sitemap. The `generate-content.sh` script runs everything:

```bash
cd apps/web
bash scripts/generate-content.sh
```

This runs:
1. `lexbuild convert --all -g section` → `content/section/`
2. `lexbuild convert --all -g chapter` → `content/chapter/`
3. `lexbuild convert --all -g title` → `content/title/`
4. `generate-nav.ts` → `public/nav/*.json`
5. `generate-search-index.ts` → `public/_pagefind/`
6. `generate-sitemap.ts` → `public/sitemap.xml`

To generate content for specific titles only (faster for development):

```bash
bash scripts/generate-content.sh "--titles 1,5,26"
```

## Scripts

| Script | Purpose |
|---|---|
| `scripts/generate-content.sh` | Full pipeline: convert + nav + search + sitemap |
| `scripts/generate-nav.ts` | Reads `_meta.json` sidecars → `public/nav/*.json` |
| `scripts/generate-search-index.ts` | Pagefind Node API → `public/_pagefind/` |
| `scripts/generate-sitemap.ts` | Reads `_meta.json` → `public/sitemap.xml` |

## Development

```bash
# Start dev server
pnpm dev

# Lint
pnpm lint

# Type check
pnpm typecheck

# Production build
pnpm build
```

The dev server starts in < 1 second. The production build takes ~20 seconds (application shell only — no static page generation).

## Project Structure

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Geist font, theme script)
│   │   ├── page.tsx                  # Landing page (stats, title grid)
│   │   ├── not-found.tsx             # Custom 404
│   │   └── usc/
│   │       ├── layout.tsx            # Sidebar + content pane + search dialog
│   │       ├── page.tsx              # /usc — title index
│   │       └── [title]/
│   │           ├── layout.tsx        # Breadcrumbs
│   │           ├── page.tsx          # Title viewer
│   │           ├── loading.tsx       # Skeleton
│   │           └── [chapter]/
│   │               ├── page.tsx      # Chapter viewer
│   │               ├── loading.tsx   # Skeleton
│   │               └── [section]/
│   │                   ├── page.tsx  # Section viewer
│   │                   └── loading.tsx
│   ├── components/
│   │   ├── content/                  # ContentViewer, FrontmatterPanel, Copy, Download
│   │   ├── sidebar/                  # Sidebar, TitleList, ChapterList, SectionList
│   │   ├── search/                   # SearchDialog (Cmd+K)
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── breadcrumbs.tsx
│   │   └── theme-toggle.tsx
│   ├── lib/
│   │   ├── content/                  # ContentProvider abstraction (fs-provider)
│   │   ├── markdown.ts               # Frontmatter parsing + remark rendering
│   │   ├── shiki.ts                  # Shiki highlighter singleton (dual themes)
│   │   ├── nav.ts                    # Client-side nav JSON fetching
│   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
│   └── styles/
│       └── globals.css               # Tailwind v4 + shadcn/ui zinc theme
├── scripts/                          # Build-time generation scripts
├── content/                          # Generated .md files (gitignored)
├── public/
│   ├── nav/                          # Generated nav JSON (gitignored)
│   ├── _pagefind/                    # Generated search index (gitignored)
│   ├── icon.svg                      # Favicon
│   └── robots.txt
├── .vercelignore                     # Includes content/ in deploys
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.js
└── tsconfig.json
```

## Content Provider

All content access goes through a `ContentProvider` interface. Page components never import `node:fs` directly.

```typescript
interface ContentProvider {
  getFile(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
}
```

The default implementation (`FsContentProvider`) reads from the local filesystem. The storage backend can be swapped to AWS S3, Cloudeflare R2, Vercel Blob, etc by implementing the same interface and changing the `CONTENT_STORAGE` environment variable.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTENT_STORAGE` | `fs` | Content backend: `fs` (or: `s3`, `r2`, `blob`) |
| `CONTENT_DIR` | `./content` | Path to content directory (filesystem backend) |
| `SITE_URL` | `https://lexbuild.dev` | Base URL for sitemap generation | 

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, SSR) |
| Language | TypeScript 5, strict mode |
| UI | React 19, Tailwind CSS 4, shadcn/ui (base-nova, zinc) |
| Syntax Highlighting | Shiki (github-light / github-dark dual themes) |
| Markdown Rendering | unified + remark-parse + remark-gfm + remark-rehype + rehype-stringify |
| Search | Pagefind (client-side, static index from .md source files) |
| Virtualization | @tanstack/react-virtual |
| Icons | lucide-react |
| Monorepo | Turborepo + pnpm workspaces |

## License

[MIT](../../LICENSE)
