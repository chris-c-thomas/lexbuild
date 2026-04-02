# LexBuild Web

The web application for [LexBuild](https://github.com/chris-c-thomas/LexBuild) — a multi-source legal content browser serving the U.S. Code (54 titles, 60,000+ sections), eCFR (50 titles, 200,000+ sections), and Federal Register (770,000+ documents, 2000–present) as structured Markdown with syntax-highlighted source views.

**Production:** [lexbuild.dev](https://lexbuild.dev)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro 6](https://astro.build/) (SSR, `@astrojs/node` adapter) |
| Islands | [React 19](https://react.dev/) via `@astrojs/react` |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) via `@tailwindcss/vite` + `@tailwindcss/typography` |
| Components | [shadcn/ui](https://ui.shadcn.com/) (Radix primitives, radix-nova preset, zinc theme) |
| Syntax Highlighting | [Shiki 4](https://shiki.style/) (pre-rendered HTML, runtime fallback for dev) |
| Markdown | unified + remark + rehype pipeline with `rehype-sanitize` |
| Sidebar | `@tanstack/react-virtual` for virtualized section lists |
| Search | [Meilisearch](https://www.meilisearch.com/) (~1.05M docs, gated behind `ENABLE_SEARCH`) |
| Fonts | IBM Plex Sans (body) / IBM Plex Serif (display) / IBM Plex Mono (code) via `@fontsource` |

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10
- **Converted content** — run the CLI to generate Markdown files before starting the app:

```bash
# From the monorepo root
pnpm turbo build
node packages/cli/dist/index.js download-usc --all && node packages/cli/dist/index.js convert-usc --all
node packages/cli/dist/index.js download-ecfr --all && node packages/cli/dist/index.js convert-ecfr --all
node packages/cli/dist/index.js download-fr --recent 30 && node packages/cli/dist/index.js convert-fr --all
```

## Local Development

### 1. Link Content

Symlink CLI output into the app's `content/` directory:

```bash
cd apps/astro
bash scripts/link-content.sh
```

### 2. Generate Navigation Data

Build sidebar JSON from `_meta.json` sidecar files (USC/eCFR) and frontmatter (FR):

```bash
npx tsx scripts/generate-nav.ts                # All sources
npx tsx scripts/generate-nav.ts --source fr    # Single source
```

### 3. Start Dev Server

```bash
pnpm dev
# → http://localhost:4321
```

The dev server uses Astro 6's production runtime via Vite — dev behavior matches production. Syntax highlighting falls back to runtime Shiki when pre-rendered `.highlighted.html` files aren't present.

### Optional: Pre-render Highlights

Generate syntax-highlighted HTML for all Markdown files (recommended for large datasets):

```bash
npx tsx scripts/generate-highlights.ts                    # Full run (~1M files with FR)
npx tsx scripts/generate-highlights.ts --source fr        # Single source
npx tsx scripts/generate-highlights.ts --limit 50         # Test subset
npx tsx scripts/generate-highlights.ts --chunk-size 1000  # Smaller chunks for memory-constrained runs
```

Highlights are generated in forked child processes (2k files/chunk, 2GB heap cap per child) to avoid Shiki memory leaks.

### Optional: Search (Meilisearch)

```bash
brew install meilisearch && brew services start meilisearch
npx tsx scripts/index-search.ts                           # Full reindex (~1M docs, ~15 min)
npx tsx scripts/index-search-incremental.ts --source fr   # Single source incremental
```

Set `ENABLE_SEARCH=true` in `.env.local` to enable the search UI.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTENT_DIR` | `./content` | Root path to content directory |
| `NAV_DIR` | `./public/nav` | Root path to pre-built sidebar JSON |
| `SITE_URL` | `https://lexbuild.dev` | Base URL for sitemap and OG tags |
| `ENABLE_SEARCH` | `false` | Enable Meilisearch-powered search UI |
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch endpoint (`/search` in production for Caddy proxy) |
| `MEILI_SEARCH_KEY` | — | Meilisearch search-only API key (not needed in proxy mode) |

Create `.env.local` for local overrides (git-ignored).

## Content Pipeline

After converting content with the CLI, these scripts prepare the app's data. Run from `apps/astro/`. All scripts support `--source usc|ecfr|fr` to process a single source.

| Script | Purpose | Speed |
|--------|---------|-------|
| `link-content.sh` | Symlink CLI output into `content/` | Instant |
| `generate-nav.ts` | Build sidebar JSON from `_meta.json` (USC/eCFR) and frontmatter (FR) | < 5s |
| `generate-highlights.ts` | Pre-render Shiki HTML for all `.md` files (2k files/chunk, heap-capped) | Incremental |
| `generate-sitemap.ts` | Build sitemap index + chunked sitemaps (~1M URLs) | < 10s |
| `index-search.ts` | Full reindex into Meilisearch (~1.05M docs) | ~15 min |
| `index-search-incremental.ts` | Incremental upsert (`--source`, `--set-checkpoint`, `--prune`) | Varies |

All outputs (`content/`, `public/nav/`, `public/sitemap*.xml`, `*.highlighted.html`) are git-ignored.

## Architecture

### SSR with Filesystem Content

Every page is server-rendered. The server reads `.md` files from the local filesystem, parses YAML frontmatter, renders Markdown to HTML, and serves pre-rendered syntax-highlighted source views. No database, no CMS — content is generated by the CLI and served directly.

### Island Architecture

Astro renders pages as static HTML with zero client-side JavaScript by default. Interactive components are React islands hydrated only where needed:

| Component | Hydration | Purpose |
|---|---|---|
| `ContentViewer` | `client:load` | Tabbed source/preview with copy and download |
| `Sidebar` | `client:load` | Desktop sticky sidebar with resizable drag handle |
| `MobileNav` | `client:load` | Hamburger + Sheet drawer with source switcher (USC / eCFR / FR) |
| `SearchDialog` | `client:idle` | Cmd+K search with source filter tabs |
| `ThemeToggle` | `client:load` | Dark/light mode toggle |

Static components (no JS): `BaseLayout.astro`, `FrontmatterPanel.astro`, `BreadcrumbNav.astro`

### Route Structure

| Source | URL Pattern | Granularity |
|--------|-------------|-------------|
| USC | `/usc/title-01` | title |
| USC | `/usc/title-01/chapter-01` | chapter |
| USC | `/usc/title-01/chapter-01/section-1` | section |
| eCFR | `/ecfr/title-17` | title |
| eCFR | `/ecfr/title-17/chapter-IV` | chapter |
| eCFR | `/ecfr/title-17/chapter-IV/part-240` | part |
| eCFR | `/ecfr/title-17/chapter-IV/part-240/section-240.10b-5` | section |
| FR | `/fr/2026` | year |
| FR | `/fr/2026/03` | month |
| FR | `/fr/2026/03/2026-06029` | document |

USC and eCFR use hierarchical title/chapter paths. FR uses date-based year/month paths. Slug segment count determines granularity per source.

### Sidebar Navigation

All three sources have sidebar navigation:

- **USC**: Title → chapter → section tree (lazy-loaded per title)
- **eCFR**: Title → chapter → part → section tree (lazy-loaded per title)
- **FR**: Year → month tree (loaded from `years.json`, months are links to listing pages)

The sidebar is resizable via drag handle (200–500px range, width persisted to localStorage). Mobile uses a Sheet drawer with a source switcher.

### Search

Meilisearch indexes ~1.05M documents across all three sources. Filterable by `source`, `title_number`, `granularity`, `status`, `document_type`, and `publication_date`. In production, Caddy proxies `/search` to Meilisearch with auth header injection — no API key exposed to the browser.

### No Code Dependency on LexBuild Packages

This app has no `import` from `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, or `@lexbuild/fr`. It consumes their output — `.md` files with YAML frontmatter and `_meta.json` sidecar files — as data.

## Color System

Five brand palettes defined in `src/styles/global.css` as Tailwind `@theme inline` variables:

- **Slate Blue** — primary UI, headings, sidebar, USC accents
- **Summer Green** — eCFR accents, published badges, output section
- **Putty** — future/planned items, warm amber accent
- **Lavender** — FR accents (source cards, parser borders, sidebar)
- **Chestnut** — available for future use (error states, alerts)

Dark mode uses a dark slate-blue palette (not default shadcn grey). Semantic tokens (`bg-surface`, `text-ink-muted`, `border-border-base`) auto-adapt via `:root`/`.dark` runtime vars.

## Build

```bash
pnpm run build:astro    # Production build
pnpm run preview        # Preview production build locally
```

From the monorepo root:

```bash
pnpm turbo build:astro --filter=@lexbuild/astro
```

> **Note:** This app is intentionally excluded from the default `pnpm turbo build` pipeline. It has no `build` script in `package.json` — only `build:astro`. This prevents CI failures since the app requires content files that aren't in git.

## Deployment

The production build produces a standalone Node.js server (`dist/server/entry.mjs`). Deploy behind a reverse proxy (Caddy, Nginx) with a process manager (PM2, systemd). Content is served from the local filesystem — upload converted content to the server and set `CONTENT_DIR` accordingly.

Cache strategy: set long `s-maxage` on responses and let a CDN (Cloudflare, etc.) cache at the edge. Purge cache after content updates.

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
