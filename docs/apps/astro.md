# Astro Web App

[LexBuild.dev](https://lexbuild.dev) is a server-rendered web application built with [Astro](https://astro.build) for browsing the U.S. Code and the Code of Federal Regulations as structured Markdown. It serves over 260,000 pages of legal content with full-text search, sidebar navigation, syntax-highlighted frontmatter, and dark mode support.

The app has no code dependency on any `@lexbuild/*` package. Instead, it consumes the output files (`.md` and `_meta.json`) produced by the CLI. It is a private package excluded from changesets and the main Turborepo build.

## Tech Stack

| Technology | Role |
|---|---|
| Astro 6 | SSR framework with `@astrojs/node` adapter |
| React 19 | Island components (hydrated selectively) |
| Tailwind CSS 4 | Styling via `@tailwindcss/vite` plugin |
| shadcn/ui | UI primitives (radix-nova preset, zinc theme) |
| Shiki 4 | Syntax highlighting for YAML frontmatter (pre-rendered) |
| Meilisearch | Full-text search (optional, behind feature flag) |
| IBM Plex fonts | Serif, Sans, and Mono typefaces |

## Architecture

### Island Components

The app uses Astro's island architecture -- most of the page is server-rendered HTML with no JavaScript. Interactive components are hydrated selectively:

| Component | Hydration | Purpose |
|---|---|---|
| `ContentViewer` | `client:load` | Source/preview tabs, copy, download |
| `Sidebar` | `client:load` | Desktop sticky sidebar with resizable width |
| `MobileNav` | `client:load` | Hamburger menu + sheet drawer |
| `SearchDialog` | `client:idle` | Cmd+K full-text search |
| `ThemeToggle` | `client:load` | Dark/light mode toggle |

Static components (`BaseLayout`, `FrontmatterPanel`, `BreadcrumbNav`) render to HTML with no client JavaScript.

### Content Serving

Content is served from the local filesystem -- no database. The `lib/content.ts` module reads `.md` files via `fs.readFile` with path traversal prevention.

### Route Resolution

Routes use catch-all slug patterns:

- `/usc/[...slug].astro` -- USC content (1 segment = title, 2 = chapter, 3 = section)
- `/ecfr/[...slug].astro` -- eCFR content (1 = title, 2 = chapter, 3 = part, 4 = section)

The `routes.ts` module resolves slugs to content file paths based on the source type's granularity depth. Key differences between sources:

- USC chapters use zero-padded Arabic numerals (`chapter-01`). eCFR chapters use Roman numerals (`chapter-IV`).
- Section numbers are strings, never parsed as integers (`"202a"`, `"240.10b-5"`).

### Source Registry

`lib/sources.ts` defines a registry of content sources. Each source specifies its base path, display name, slug structure, and granularity levels. Adding a new source type requires only a registry entry -- no route changes.

### Sidebar Navigation

- **Desktop**: sticky sidebar, resizable via drag handle (200--500px range, persisted to localStorage)
- **Mobile**: sheet drawer (Radix Dialog) with source dropdown
- Both share `SidebarContent.tsx` with lazy-loaded per-title nav JSON
- Sections exceeding 100 entries are virtualized with `@tanstack/react-virtual`
- Breakpoint: `lg` (1024px)

### Search

Meilisearch provides full-text search across approximately 281,000 documents. Controlled by the `ENABLE_SEARCH` environment variable. When disabled, the `SearchDialog` component is not rendered.

- Index: `lexbuild`, searchable fields ranked: `identifier` > `heading` > `body`
- Filterable attributes: `source`, `title_number`, `granularity`, `status`
- Body truncated to 5,000 characters, excluded from displayed attributes
- Search UI is a Cmd+K dialog (`SearchDialog.tsx`)

### Dark Mode

Class-based strategy with localStorage persistence. An inline script in `BaseLayout` reads `localStorage.theme` and sets the `.dark` class before first paint, preventing flash of incorrect theme. The dark palette uses dark slate blue tones (blue-tinted hex values, not default shadcn grey). Semantic tokens adapt automatically via CSS custom properties on `:root`/`.dark` selectors.

### Styling

Tailwind CSS v4 with `@tailwindcss/vite` (not `@astrojs/tailwind`).

Key caveat: `@theme inline` variables are build-time only -- they do not exist as runtime CSS custom properties. However, `var()` references to `:root`/`.dark` runtime vars inside `@theme inline` are preserved and resolve at runtime. Scoped `<style>` blocks in `.astro` components must use `:root`/`.dark` runtime vars or hex values directly.

## Content Pipeline

After converting content with the CLI, five pipeline stages prepare it for the web app. All scripts run from `apps/astro/`:

| Stage | Script | Duration | Description |
|---|---|---|---|
| 1. Link content | `link-content.sh` | instant | Symlink CLI output into `content/` |
| 2. Generate nav | `generate-nav.ts` | ~2s | Build sidebar JSON from `_meta.json` files |
| 3. Generate highlights | `generate-highlights.ts` | ~6 min | Pre-render Shiki HTML for all `.md` files |
| 4. Generate sitemap | `generate-sitemap.ts` | <5s | Build sitemap index + chunked sitemaps |
| 5. Index search | `index-search.ts` | ~26 min | Index into Meilisearch (~281k documents) |

### Highlight Pre-rendering

Shiki syntax highlighting for YAML frontmatter is pre-rendered to `.highlighted.html` sidecar files. The `generate-highlights.ts` script forks child processes in 10,000-file chunks to avoid out-of-memory errors from Shiki's grammar cache (~4GB leak over 260k+ files). A runtime Shiki fallback exists for development when pre-rendered files are not available.

To change Shiki themes, update both `generate-highlights.ts` and `src/lib/shiki.ts`, delete existing `.highlighted.html` files, and re-run the script.

## Development

```bash
# Build packages first (one-time)
pnpm turbo build

# Download and convert content
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
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch URL |
| `MEILI_SEARCH_KEY` | -- | Meilisearch search-only API key |
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
│   │   ├── 400–504.astro              # HTTP error pages (11 total)
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
│   │   ├── sources.ts                  # Source registry (USC, eCFR config)
│   │   ├── types.ts                    # SourceId, Granularity, ContentFrontmatter, nav types
│   │   ├── frontmatter.ts              # gray-matter wrapper
│   │   ├── markdown.ts                 # unified/remark/rehype pipeline
│   │   ├── highlight.ts                # Pre-rendered .highlighted.html loader
│   │   ├── shiki.ts                    # Runtime Shiki singleton (dev fallback)
│   │   ├── search.ts                   # Meilisearch client wrapper
│   │   └── nav.ts                      # Nav JSON reader
│   └── styles/global.css               # Tailwind base, theme tokens, Shiki overrides
├── scripts/
│   ├── link-content.sh                 # Symlink CLI output → content/
│   ├── generate-nav.ts                 # _meta.json → public/nav/ JSON
│   ├── generate-highlights.ts          # Batch Shiki pre-rendering
│   ├── generate-sitemap.ts             # Sitemap index + chunks
│   ├── index-search.ts                 # Full Meilisearch index
│   └── index-search-incremental.ts     # Incremental upsert
└── astro.config.ts
```

## SEO

- Unique `<title>` per page derived from frontmatter
- `<meta name="description">` built per-granularity with sentence-style hierarchy
- Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`
- Canonical URLs via `<link rel="canonical">`
- Sitemap: approximately 292,000 URLs in chunks of 50,000 or fewer, with depth-based priority

## Key Design Decisions

1. **No package dependency:** consumes CLI output files only, enabling independent builds and deployment
2. **Pre-rendered highlights:** avoids shipping Shiki to the client or running it per-request on the server
3. **Filesystem-based content:** no database, no build-time content processing, simple operational model
4. **Optional search:** Meilisearch behind a feature flag for environments without it
5. **Island architecture:** minimal client JavaScript; most pages are static HTML with zero JS overhead
6. **Resizable sidebar:** drag handle with pointer events, width persisted to localStorage, providing a desktop-class browsing experience for large legal hierarchies
7. **Virtualized section lists:** `@tanstack/react-virtual` ensures smooth scrolling even for titles with thousands of sections
