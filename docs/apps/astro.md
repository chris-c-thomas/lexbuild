# Astro Web App

[LexBuild.dev](https://lexbuild.dev) is a server-rendered web application built with [Astro](https://astro.build) for browsing U.S. federal legal content as structured Markdown. It serves over 1 million pages across three sources (U.S. Code, eCFR, and Federal Register) with full-text search, sidebar navigation, syntax-highlighted frontmatter, and dark mode.

The app has no code dependency on any `@lexbuild/*` package. It consumes the output files (`.md` and `_meta.json`) produced by the CLI as data. It is a private package excluded from changesets and the main Turborepo build.

## Tech Stack

| Technology | Role |
|---|---|
| Astro 6 | SSR framework with `@astrojs/node` adapter |
| React 19 | Island components (hydrated selectively) |
| Tailwind CSS 4 | Styling via `@tailwindcss/vite` plugin |
| shadcn/ui | UI primitives (radix-nova preset, zinc theme) |
| Shiki 4 | Syntax highlighting for YAML frontmatter (pre-rendered) |
| Meilisearch | Full-text search (~1.05M docs, optional, behind feature flag) |
| IBM Plex fonts | Serif (display), Sans (body), Mono (code) via `@fontsource` |

## Architecture

### Island Components

The app uses Astro's island architecture. Most of the page is server-rendered HTML with no JavaScript. Interactive components are hydrated selectively:

| Component | Hydration | Purpose |
|---|---|---|
| `ContentViewer` | `client:load` | Source/preview tabs, copy, download |
| `Sidebar` | `client:load` | Desktop sticky sidebar with resizable width |
| `MobileNav` | `client:load` | Hamburger menu + sheet drawer with source switcher |
| `SearchDialog` | `client:idle` | Cmd+K full-text search with source filter tabs |
| `ThemeToggle` | `client:load` | Dark/light mode toggle |

Static components (`BaseLayout`, `FrontmatterPanel`, `BreadcrumbNav`) render to HTML with no client JavaScript.

### Content Serving

Content is served from the local filesystem with no database. The `lib/content.ts` module reads `.md` files via `fs.readFile` with path traversal prevention.

### Route Resolution

Routes use catch-all slug patterns:

- `/usc/[...slug].astro` — USC content (1 segment = title, 2 = chapter, 3 = section)
- `/ecfr/[...slug].astro` — eCFR content (1 = title, 2 = chapter, 3 = part, 4 = section)
- `/fr/[...slug].astro` — FR content (1 = year, 2 = month, 3 = document)

The `routes.ts` module resolves slugs to content file paths based on the source type's granularity depth. Key differences:

- USC chapters use zero-padded Arabic numerals (`chapter-01`). eCFR chapters use Roman numerals (`chapter-IV`).
- Section numbers are strings, never parsed as integers (`"202a"`, `"240.10b-5"`).
- FR segments are validated differently: `^\d{4}$` (year), `^\d{2}$` (month), `^\d{4}-\d{4,6}$` (document number).

### Source Registry

`lib/sources.ts` defines a registry of content sources (USC, eCFR, FR). Each source specifies its base path, display name, slug structure, granularity levels, and sidebar configuration. Adding a new source type requires only a registry entry, no route changes.

### Sidebar Navigation

All three sources have sidebar navigation with a consistent tree pattern:

- **USC**: title → chapter → section (lazy-loaded per title from `_meta.json`)
- **eCFR**: title → chapter → part → section (lazy-loaded per title)
- **FR**: year → month (loaded from `years.json`, months are links to listing pages with document counts)

Desktop: sticky sidebar, resizable via drag handle (200-500px range, persisted to localStorage). Mobile: sheet drawer (Radix Dialog) with source switcher (USC / eCFR / FR). Both share `SidebarContent.tsx`. Sections exceeding 100 entries are virtualized with `@tanstack/react-virtual`. Breakpoint: `lg` (1024px).

### Search

Meilisearch provides full-text search across approximately 1.05 million documents. Controlled by the `ENABLE_SEARCH` environment variable. When disabled, the `SearchDialog` component is not rendered.

- Index: `lexbuild`, searchable fields ranked: `identifier` > `heading` > `body`
- Filterable attributes: `source`, `title_number`, `granularity`, `status`, `document_type`, `publication_date`
- Sortable attributes: `title_number`, `identifier`, `publication_date`
- Body truncated to 5,000 characters, excluded from displayed attributes
- Production: Caddy proxies `/search` to Meilisearch with auth header injection (no API key exposed to browser)
- Local dev: browser connects directly to `http://127.0.0.1:7700`

### Dark Mode

Class-based strategy with localStorage persistence. An inline script in `BaseLayout` reads `localStorage.theme` and sets the `.dark` class before first paint, preventing flash of incorrect theme. The dark palette uses dark slate blue tones (blue-tinted hex values, not default shadcn grey). Semantic tokens adapt automatically via CSS custom properties on `:root`/`.dark` selectors.

### Styling

Tailwind CSS v4 with `@tailwindcss/vite` (not `@astrojs/tailwind`). Five brand color palettes defined in `global.css`:

- **Slate Blue** — primary UI, headings, sidebar, USC accents
- **Summer Green** — eCFR accents, published badges, output section
- **Putty** — future/planned items, warm amber accent
- **Lavender** — FR accents (source cards, parser borders, sidebar)
- **Chestnut** — reserved for future use

Key caveat: `@theme inline` variables are build-time only. They do not exist as runtime CSS custom properties. However, `var()` references to `:root`/`.dark` runtime vars inside `@theme inline` are preserved and resolve at runtime. Scoped `<style>` blocks in `.astro` components must use `:root`/`.dark` runtime vars or hex values directly.

## Content Pipeline

After converting content with the CLI, six pipeline stages prepare it for the web app. All scripts run from `apps/astro/` and support `--source usc|ecfr|fr` to process a single source.

| Stage | Script | Duration | Description |
|---|---|---|---|
| 1. Link content | `link-content.sh` | instant | Symlink CLI output into `content/` |
| 2. Generate nav | `generate-nav.ts` | < 5s | Build sidebar JSON from `_meta.json` (USC/eCFR) and frontmatter (FR) |
| 3. Generate highlights | `generate-highlights.ts` | incremental | Pre-render Shiki HTML (2k files/chunk, 2GB heap cap per child) |
| 4. Generate sitemap | `generate-sitemap.ts` | < 10s | Build sitemap index + chunked sitemaps (~1M URLs) |
| 5. Full search index | `index-search.ts` | ~15 min | Full reindex into Meilisearch (~1.05M documents) |
| 6. Incremental index | `index-search-incremental.ts` | varies | Upsert changed files (`--source`, `--set-checkpoint`, `--prune`) |

### Highlight Pre-rendering

Shiki syntax highlighting for YAML frontmatter is pre-rendered to `.highlighted.html` sidecar files. The script forks child processes in 2,000-file chunks (configurable with `--chunk-size`) to avoid out-of-memory errors from Shiki's grammar cache. Each child process is heap-capped at 2GB via `--max-old-space-size`. Uses `matter(raw, { cache: false })` to prevent gray-matter from caching parsed files in memory.

A runtime Shiki fallback exists for development when pre-rendered files are not available. To change Shiki themes, update `src/lib/shiki-themes.ts`, delete existing `.highlighted.html` files, and re-run the script.

## Development

```bash
# Build packages first (one-time)
pnpm turbo build

# Download and convert content (any or all sources)
node packages/cli/dist/index.js download-usc --titles 1
node packages/cli/dist/index.js convert-usc --titles 1 -o ./output

# Set up content for the app
cd apps/astro
bash scripts/link-content.sh
npx tsx scripts/generate-nav.ts

# Start dev server
cd ../..
pnpm turbo dev:astro --filter=@lexbuild/astro
```

Dev server runs at `http://localhost:4321`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTENT_DIR` | `./content` | Content directory path |
| `NAV_DIR` | `./public/nav` | Navigation JSON directory |
| `ENABLE_SEARCH` | `false` | Enable Meilisearch search |
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch URL (`/search` in production for Caddy proxy) |
| `MEILI_SEARCH_KEY` | — | Meilisearch search-only API key (not needed in proxy mode) |
| `SITE_URL` | `https://lexbuild.dev` | Canonical site URL |

## Directory Structure

```
apps/astro/
├── src/
│   ├── layouts/BaseLayout.astro        # HTML shell, dark mode, sidebar, search
│   ├── pages/
│   │   ├── index.astro                 # Landing page
│   │   ├── usc/[...slug].astro        # USC catch-all route
│   │   ├── ecfr/[...slug].astro       # eCFR catch-all route
│   │   ├── fr/[...slug].astro         # FR catch-all route (year/month/document)
│   │   ├── fr/index.astro             # FR landing page
│   │   ├── 400.astro … 504.astro      # HTTP error pages (11 separate files)
│   │   └── health.ts                  # Health check endpoint
│   ├── components/
│   │   ├── content/                    # ContentViewer, FrontmatterPanel, BreadcrumbNav
│   │   ├── sidebar/                    # Sidebar, MobileNav, SidebarContent, SectionList
│   │   ├── search/SearchDialog.tsx
│   │   ├── ui/                         # shadcn/ui primitives
│   │   └── landing/                    # SourceCard, HeroSection
│   ├── lib/
│   │   ├── content.ts                  # fs.readFile + path traversal prevention
│   │   ├── routes.ts                   # Slug → content path + granularity resolution
│   │   ├── sources.ts                  # Source registry (USC, eCFR, FR)
│   │   ├── types.ts                    # SourceId, Granularity, ContentFrontmatter, nav types
│   │   ├── frontmatter.ts              # gray-matter wrapper
│   │   ├── markdown.ts                 # unified/remark/rehype pipeline with rehype-sanitize
│   │   ├── highlight.ts                # Pre-rendered .highlighted.html loader
│   │   ├── shiki.ts                    # Runtime Shiki singleton (dev fallback)
│   │   ├── shiki-themes.ts            # LexBuild brand Shiki themes (light + dark)
│   │   ├── search.ts                   # Meilisearch client wrapper (proxy/direct mode)
│   │   ├── seo.ts                      # SEO builder functions (pure, no Astro imports)
│   │   └── nav.ts                      # Nav JSON reader (USC/eCFR titles, FR years/months)
│   └── styles/global.css               # Tailwind base, 5 brand palettes, Shiki overrides
├── scripts/
│   ├── link-content.sh                 # Symlink CLI output → content/
│   ├── generate-nav.ts                 # _meta.json/frontmatter → public/nav/ JSON
│   ├── generate-highlights.ts          # Batch Shiki pre-rendering (forked child workers)
│   ├── generate-sitemap.ts             # Sitemap index + chunked sitemaps
│   ├── index-search.ts                 # Full Meilisearch reindex (~1.05M docs)
│   └── index-search-incremental.ts     # Incremental upsert with --source/--set-checkpoint
└── astro.config.ts
```

## SEO

- Unique `<title>` per page derived from frontmatter
- `<meta name="description">` built per-granularity with sentence-style hierarchy
- Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`
- Canonical URLs via `<link rel="canonical">`
- JSON-LD: `Legislation` for sections, `WebPage` for indexes, `BreadcrumbList` on all pages
- Sitemap: approximately 1.05 million URLs in chunks of 25,000, with per-source `changefreq` (USC=monthly, eCFR=weekly, FR=daily)

## Key Design Decisions

1. **No package dependency:** consumes CLI output files only, enabling independent builds and deployment
2. **Pre-rendered highlights:** avoids shipping Shiki to the client or running it per-request on the server
3. **Filesystem content:** no database, no build-time content processing, simple operational model
4. **Optional search:** Meilisearch behind a feature flag for environments without it
5. **Island architecture:** minimal client JavaScript; most pages are static HTML with zero JS overhead
6. **Resizable sidebar:** drag handle with pointer events, width persisted to localStorage
7. **Virtualized section lists:** `@tanstack/react-virtual` ensures smooth scrolling for titles with thousands of sections
8. **Per-source `--source` flag:** all pipeline scripts can target a single source for faster iteration
