# CLAUDE.md — LexBuild Astro App

## Project Overview

`apps/astro/` is the LexBuild web application — an Astro-powered, multi-source legal content browser deployed to a self-managed VPS (AWS Lightsail) behind Cloudflare's edge cache.

The app serves U.S. Code (54 titles, ~60k sections) and eCFR (50 titles, ~200k+ sections) at every granularity level. It has **no code dependency** on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/ecfr` — it consumes their `.md` output as data.

## Monorepo Integration

- **`"private": true`** — excluded from changesets and npm publishing
- **No `build` script** — only `build:astro`. Do NOT add to the default `build` task in turbo.json.
- **Content is gitignored** — `content/`, `public/nav/`, `public/sitemap.xml`, `*.highlighted.html`
- **Deploy** via `./scripts/deploy.sh` from the monorepo root
- **Individual asset deploy**: `deploy.sh --nav-only`, `--sitemaps-only`, `--highlights-only` deploy individual generated assets without a full content rsync

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro 6.x (SSR, `@astrojs/node` adapter) |
| Islands | React 19.x via `@astrojs/react` |
| Styling | Tailwind CSS 4.x via `@tailwindcss/vite` (NOT `@astrojs/tailwind`) + `@tailwindcss/typography` |
| Components | shadcn/ui (radix-nova preset, zinc theme) |
| Fonts | IBM Plex Sans (body) / Serif (display) / Mono (code) via `@fontsource` |
| Highlighting | Shiki 4.x (pre-rendered HTML, runtime fallback for dev) |
| Markdown | unified + remark + rehype pipeline with `rehype-sanitize` |
| Sidebar | @tanstack/react-virtual for large section lists |
| Search | Meilisearch, gated behind `ENABLE_SEARCH` |
| Production | PM2 + Caddy + Cloudflare (see ops guide) |
| Monitoring | Uptime Kuma at `status.lexbuild.dev` (PM2-managed, port 3001) |

## Architecture

### Request Flow

```
Browser → Cloudflare Edge (cache HIT? → serve) → Caddy → Astro (port 4321)
        → fs.readFile() from /srv/lexbuild/content/ (or ./content/ locally)
        → Cache-Control: public, s-maxage=31536000, stale-while-revalidate=86400
```

### Island Components

| Component | Hydration | Purpose |
|---|---|---|
| `ContentViewer` | `client:load` | Source/preview tabs, copy, download |
| `Sidebar` | `client:load` | Desktop sticky sidebar wrapper |
| `MobileNav` | `client:load` | Hamburger + Sheet drawer |
| `SearchDialog` | `client:idle` | Cmd+K search |
| `ThemeToggle` | `client:load` | Dark mode toggle |
| `ApiReference` | `client:only="react"` | Scalar API reference with dark mode sync |

Static components (no JS): `BaseLayout.astro`, `FrontmatterPanel.astro`, `BreadcrumbNav.astro`

## Directory Structure

```
src/
├── layouts/BaseLayout.astro        # HTML shell, dark mode, sidebar, search
├── pages/
│   ├── index.astro                 # Landing page
│   ├── usc/                        # USC routes (index + [...slug] catch-all)
│   ├── ecfr/                       # eCFR routes (index + [...slug] catch-all)
│   ├── fr/                         # FR routes (index + [...slug] catch-all)
│   ├── docs/                       # Docs routes (index + [...slug] catch-all + api.astro)
│   ├── 400–504.astro              # HTTP error pages (11 total, see Error Pages below)
│   └── health.ts                  # Health check endpoint
├── components/
│   ├── content/                    # ContentViewer, FrontmatterPanel, BreadcrumbNav, CopyButton, DownloadButton, HierarchyIndex
│   ├── sidebar/                    # Sidebar, MobileNav, SidebarContent, SectionList
│   ├── search/SearchDialog.tsx
│   ├── nav/SourcesDropdown.tsx     # Source navigation dropdown
│   ├── docs/                       # DocsPagination, DocsSidebar, TableOfContents
│   ├── api-reference/               # ApiReference (Scalar embed with dark mode sync)
│   ├── seo/                        # SEOHead, JsonLd
│   └── ui/                         # shadcn/ui primitives
├── lib/
│   ├── content.ts                  # fs.readFile + path traversal prevention
│   ├── routes.ts                   # Slug → content path + granularity resolution
│   ├── sources.ts                  # Source registry (USC, eCFR, FR config)
│   ├── types.ts                    # SourceId, Granularity, ContentFrontmatter, nav types
│   ├── frontmatter.ts              # gray-matter wrapper
│   ├── markdown.ts                 # unified/remark/rehype pipeline
│   ├── highlight.ts                # Pre-rendered .highlighted.html loader
│   ├── shiki.ts                    # Runtime Shiki singleton (dev fallback)
│   ├── shiki-themes.ts             # LexBuild brand Shiki themes (single source of truth)
│   ├── scalar-theme.ts              # Custom Scalar API reference theme (LexBuild brand)
│   ├── search.ts                   # Meilisearch client wrapper
│   ├── nav.ts                      # Nav JSON reader
│   ├── seo.ts                      # SEO metadata builders (pure functions)
│   ├── docs-nav.ts                 # Docs sidebar navigation tree
│   └── utils.ts                    # cn() utility, title case helper
├── content/docs/                    # Documentation markdown (Content Collections, checked into git)
└── styles/global.css               # Tailwind base, theme tokens, Shiki overrides
scripts/
├── link-content.sh                 # Symlink CLI output → content/
├── generate-nav.ts                 # _meta.json → public/nav/ JSON
├── generate-highlights.ts          # Batch Shiki pre-rendering
├── generate-sitemap.ts             # Sitemap index + chunks
├── og-template.html                # OG image template
├── index-search.ts                 # Full Meilisearch reindex (~1M docs)
└── index-search-incremental.ts     # Incremental upsert
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTENT_DIR` | `./content` | Root content directory |
| `NAV_DIR` | `./public/nav` | Sidebar JSON directory |
| `ENABLE_SEARCH` | `false` | Show search UI |
| `MEILI_URL` | `http://127.0.0.1:7700` (dev) / `/search` (prod) | Meilisearch endpoint (starts with `/` = proxy mode). Docker dev uses port 7711. |
| `MEILI_SEARCH_KEY` | — | Search-only API key (empty in dev, populated in prod) |
| `SITE_URL` | `https://lexbuild.dev` | Base URL for sitemap/OG |

### Env Files

| File | Purpose | Generated? |
|---|---|---|
| `.env.example` | Template for contributors (checked into git) | No |
| `.env.local` | Local dev overrides (gitignored) | No — copy from `.env.example` |
| `.env.production` | VPS production values (gitignored) | Yes — `deploy.sh` generates from `~/.lexbuild-secrets` on every deploy |
| `.env.production.local` | Not used (placeholder for VPS overrides) | No |

**`.env.production` is never manually maintained.** The deploy script regenerates it on every deploy. To change a production value, update `~/.lexbuild-secrets` on the VPS and redeploy.

## Route Resolution

Slug segment count determines granularity per source:

| Source | 1 segment | 2 segments | 3 segments | 4 segments |
|---|---|---|---|---|
| USC | title | chapter | section | — |
| eCFR | title | chapter | part | section |

Content path: `{source}/{granularity}s/{slug-joined}.md` (source-first, plural granularity dir).

Key differences:
- USC chapters: zero-padded Arabic (`chapter-01`). eCFR chapters: Roman (`chapter-IV`).
- Section numbers are **strings** — never parse as integers (`"202a"`, `"240.10b-5"`).
- `Astro.params.slug` is a string (not array) — split on `/` before resolving.

## Content Pipeline

Run from `apps/astro/` after CLI conversion:

```bash
bash scripts/link-content.sh                       # Symlink output → content/
npx tsx scripts/generate-nav.ts                     # Build sidebar JSON (<2s)
npx tsx scripts/generate-highlights.ts              # Shiki pre-render (~1M files w/ FR)
npx tsx scripts/generate-highlights.ts --chunk-size 1000  # Smaller chunks if memory-tight
npx tsx scripts/generate-sitemap.ts                 # Sitemap (~292k URLs, <5s)
npx tsx scripts/index-search.ts                     # Meilisearch full reindex (~1M docs)
npx tsx scripts/index-search-incremental.ts --source fr  # Index only one source
npx tsx scripts/index-search-incremental.ts --set-checkpoint  # Set checkpoint without indexing
```

Script notes:
- **generate-highlights.ts**: Forks child processes in 2k-file chunks (default, tunable via `--chunk-size N`) to avoid Shiki OOM. Each child is heap-capped at 2GB (`--max-old-space-size`). Uses `matter(raw, { cache: false })` to prevent gray-matter from caching every file in memory. Supports `--limit N` for testing. Changing themes requires updating both this script and `src/lib/shiki.ts`, then deleting existing `.highlighted.html` files.
- **index-search.ts** and **index-search-incremental.ts**: Must be kept in sync — sources indexed, `SearchDocument` shape, and `configureIndex` settings must match. Both index USC, eCFR, and FR. Full reindex deletes and rebuilds; incremental upserts only changed files (mtime-based per-source checkpoints in `.search-indexed-at-{usc,ecfr,fr}`). Checkpoints are always written after indexing, even with `--source` — each source tracks independently. Default 500 docs/batch (override with `--batch-size N` or `MEILI_BATCH_SIZE` env var), 300s waitForTask timeout. `--verbose-batches` logs first/last doc ID per flush — pair with `--batch-size 1` to bisect poison docs. Document IDs sanitized (dots/colons → underscores).
- **generate-nav.ts**: Includes reserved title placeholders (USC 53, eCFR 35). Chapter grouping for eCFR derived from filesystem directories, not `_meta.json`.
- **All pipeline scripts support `--source usc|ecfr|fr`**: `generate-nav.ts`, `generate-sitemap.ts`, `generate-highlights.ts`, `index-search.ts` (full), and `index-search-incremental.ts` all accept `--source` to process a single source. Sitemap `--source` doesn't rewrite the sitemap index (run without `--source` to rebuild the full index). Highlights `--source` filters by content path prefix.

## Meilisearch Search

Gated behind `ENABLE_SEARCH`. When `false`, SearchDialog is not rendered.

- Index: `lexbuild`, searchable: `identifier` > `heading` > `body`
- Filterable: `source`, `title_number`, `granularity`, `status`
- Body truncated to 5000 chars, excluded from displayed attributes
- **Production** (`MEILI_URL=/search`): `search.ts` uses `fetch("/search")` — Caddy proxies to Meilisearch and injects the auth header. No API key exposed client-side.
- **Local dev** (`MEILI_URL=http://127.0.0.1:7700`): `search.ts` uses the Meilisearch JS client directly from the browser.
- The proxy/direct switch is automatic based on whether `MEILI_URL` starts with `/` (proxy) or `http` (direct).

## Dark Mode

1. Inline `<script>` in `<head>` checks `localStorage.theme === "dark"`, sets `.dark` class before first paint. Default is light.
2. `ThemeToggle.tsx` is a 2-way toggle (light/dark). Persists to localStorage. Dark theme-color: `#0e1821`
3. Tailwind: `@custom-variant dark (&:is(.dark *))` in `global.css`
4. **Dark palette is dark slate blue**, not default shadcn grey. All `.dark` vars use blue-tinted hex values.
5. Hardcoded `text-slate-blue-*` colors need explicit `dark:` variants. Semantic tokens auto-adapt.

## Error Pages

11 error pages using a shared `ErrorPage.astro` component: 400, 403, 404, 405, 410, 429, 451, 500, 502, 503, 504. `404.astro` and `500.astro` must stay at `src/pages/` root (Astro auto-routes only these two). Cloudflare 5xx codes (520–526) are NOT Astro pages.

## Design Conventions

### shadcn/ui

Initialized with radix-nova preset, zinc theme. Components in `src/components/ui/`.

**Installed**: Button, Card, Badge, Breadcrumb, Separator, ScrollArea, Skeleton, Sheet, Tabs.

### Color System

- **shadcn tokens** (`bg-background`, `text-foreground`, `bg-card`) for shadcn components
- **Semantic tokens** (`bg-surface`, `text-ink-muted`, `border-border-base`, `bg-code-surface`) for custom layouts — dark-mode-aware via `:root`/`.dark` runtime vars. Only 4 exist; add sparingly.
- Slate-blue accent for headings, labels, active states
- `prose prose-zinc` for rendered legal HTML content
- **WCAG AA contrast thresholds**: `slate-blue-600` (#5285a3) fails on white (4.0:1) — use `slate-blue-700` (#476c85, 5.4:1) for body text on light backgrounds. `summer-green-600` (#558b75) also fails (3.93:1) — use `summer-green-700` (#487061, 5.3:1). Both `-400` shades fail on `slate-blue-50` — use `-700` or darker.

### Component Patterns

- **Nav cards**: Plain HTML with `border border-slate-blue-200 rounded-sm p-5 bg-white hover:border-slate-blue-400 dark:bg-card dark:border-border dark:hover:border-slate-blue-600 transition-colors`. NOT shadcn `Card`.
- **Page headings**: `font-display text-2xl font-semibold tracking-tight text-slate-blue-800 dark:text-slate-blue-200`
- **Download**: `<script type="text/plain">` + Blob URL. NOT `<template>` (corrupts Markdown HTML).
- **ContentViewer tabs**: Customized `TabsTrigger` with slate-blue active/hover states.
- **FrontmatterPanel**: Has YAML/Preview toggle (Astro inline `<script>`, not React island). Toolbar matches shadcn TabsList/TabsTrigger styling via scoped CSS with `--color-slate-blue-*` vars. Uses `data-frontmatter-toggle` / `data-frontmatter-view` attributes for JS toggle. Grid view uses scoped `<style>` with plain CSS (Tailwind v4 `grid-cols-*` can silently fail in `.astro` files).
- **Copy/Download buttons**: Standalone React islands in the route pages (not inside ContentViewer). Receive the full reconstructed file (`---\n${rawYaml}\n---\n${body}`) so users get the complete `.md` with frontmatter.
- **Sidebar is resizable**: Drag handle via pointer events, width persisted to localStorage (`lexbuild-sidebar-width`), 200–500px range. Two-div structure: outer positioning container + inner scrollable area with `scrollbar-gutter: stable`.

## Embedded API Reference (/docs/api)

Interactive API docs powered by `@scalar/api-reference-react`, embedded as a `client:only="react"` island inside BaseLayout.

- **Component**: `src/components/api-reference/ApiReference.tsx` — React wrapper with dark mode sync
- **Theme**: `src/lib/scalar-theme.ts` — LexBuild brand CSS variables (no Google Fonts import, uses `@fontsource`). Exports a `SCALAR_THEME_CSS` template literal string passed via the `customCss` config prop (with `theme: "none"`).
- **Tailwind cannot style Scalar internals**: `customCss` is a raw CSS string injected into Scalar's internal stylesheet — not HTML class attributes. Scalar owns its DOM. Tailwind v4 `@theme inline` vars aren't runtime CSS custom properties. Use plain CSS targeting Scalar's internal class names. Runtime `:root`/`.dark` vars (e.g., `var(--primary)`, `var(--surface)`) do work inside the string. See `.claude/internal/docs/astro-app.md` for the full class name reference.
- **Config**: `src/lib/scalar-config.ts` — static Scalar configuration (layout options, hidden clients, HTTP defaults). Dynamic values (`url`, `darkMode`) merged by `ApiReference.tsx`. Matches the JSON shape from Scalar's localhost "Configure" dev tools panel.
- **Page**: `src/pages/docs/api.astro` — no `source` prop, loads spec from `${apiUrl}/api/openapi.json`
- **`API_URL` env var**: `src/pages/docs/api.astro` uses `API_URL ?? SITE_URL` for the spec URL. Set `API_URL=http://localhost:4322` in `.env.local` to load the spec from the local API dev server instead of production.
- **`defaultOpenFirstTag: false`**: Keeps all sidebar groups collapsed on initial load, landing on the Introduction section.
- **Scalar's `darkMode` config prop only applies on init**: `useColorMode` reads `initialColorMode` once during Scalar's internal initialization. Subsequent prop changes via `updateConfiguration()` do NOT toggle the theme. Workaround: directly toggle `.dark-mode`/`.light-mode` on `document.body` via a React `useEffect`.
- **Scalar defaults to `position: fixed; overflow: hidden` on `.scalar-container`**: This creates a full-viewport overlay that blocks page scrolling. Override to `position: static; overflow: visible` in `customCss`.
- **Scalar's sidebar footer** (`.darklight-reference`) contains its own dark mode toggle, MCP links, and branding. Hidden via CSS to avoid conflicting with the site's `ThemeToggle`.
- **Dark code blocks in light mode are intentional**: Scalar applies `.dark-mode` to individual `scalar-card` elements for request snippets. This is Scalar's default design, not a bug.
- **Scalar layout/visibility config uses individual boolean props**: `hideSearch`, `hideClientButton`, `hideDarkModeToggle`, `hideModels`, `defaultOpenAllTags`, `expandAllResponses`, etc. Do NOT use `hideModals` — it is not part of Scalar's official API.
- **Scalar `hiddenClients` controls visible client tabs**: Pass an object with language keys set to `true` to hide them (e.g., `{ ruby: true, php: true }`). Only 3 tabs are shown before "More" — this is hardcoded by Scalar and not configurable.
- **Scalar `defaultHttpClient`**: `{ targetKey: "shell", clientKey: "curl" }` sets the initially selected client. Valid targetKeys: `shell`, `node`, `js`, `python`, `ruby`, etc.
- **Scalar API client (Test Request) needs `position: fixed` on `.scalar-container`**: The embedded layout override sets `position: static` on `.scalar-container`, which breaks the API client overlay. The fix uses `.scalar-container:has(.scalar-client)` to conditionally restore `position: fixed` with card-like inset styling. `transform: translateZ(0)` on `.scalar-client` makes the fixed-position X close button relative to the card instead of the viewport.
- **Scalar has two `.scalar-container` DOM trees**: One is hidden (`display: none` parent), one is visible. Both receive `customCss` rules via `:has()` selectors, but only the visible one renders. `getBoundingClientRect()` and `offsetWidth` return 0 for elements in the hidden branch despite content being visually painted (via the visible branch).
- **Tailwind `group/` classes in Scalar `customCss`**: In the JS template literal, `\/` produces just `/` (invalid CSS selector). Use `\\/` to produce the correct `\/` escape. E.g., `.group\\/group-button > button` in the template literal becomes `.group\/group-button > button` in the CSS output.
- **Scalar dev tools panel** (localhost only): Shows current config as copyable JSON at the bottom of the reference UI. Useful for discovering available configuration options.

## Common Pitfalls

- **Tailwind v4 uses `@tailwindcss/vite`**, NOT `@astrojs/tailwind` (Tailwind v3). No `postcss.config.mjs` needed.
- **Tailwind v4 `@theme inline` vars are build-time only** — not runtime CSS custom properties. However, `var()` references to `:root`/`.dark` runtime vars ARE preserved. Scoped `<style>` must use runtime vars or hex directly.
- **Tailwind v4 utilities may silently fail in `.astro` scoped `<style>` blocks** — but work reliably in template HTML classes, including arbitrary values (`border-[1.5px]`, `rounded-[calc(var(--radius)-2px)]`, `flex-[1.5]`), `dark:` on custom palette colors, and `max-md:` responsive. Prefer Tailwind in template HTML; use scoped `<style>` only for what Tailwind cannot express.
- **eCFR has 4 hierarchy levels, USC has 3.** A 3-segment slug = "section" for USC but "part" for eCFR.
- **Title-level files can be very large** (~10MB). Pre-rendered highlights avoid runtime Shiki cost.
- **`content/` and `public/nav/` are gitignored.** Run `link-content.sh` and `generate-nav.ts` before dev server works.
- **Caddy handles TLS.** Astro listens on HTTP localhost only.
- **`rehype-sanitize` is critical.** Defense-in-depth against injection in Markdown content.
- **PM2 reload not restart.** Use `pm2 reload lexbuild-astro --update-env` for zero-downtime.
- **`ecosystem.config.cjs` manages 4 services**: `lexbuild-astro` (port 4321), `meilisearch` (port 7700), `uptime-kuma` (port 3001), `lexbuild-api` (port 4322). Uptime Kuma is installed at `/srv/uptime-kuma`, not in the monorepo.
- **Search index deployment uses Docker**: `./scripts/deploy.sh --search-docker` builds the Meilisearch index locally in a Docker container (linux/amd64), then transfers the pre-built data directory to the VPS. No re-indexing on the VPS. Use `--source fr|usc|ecfr` for incremental updates. Use `--search-docker-seed` to repopulate the Docker volume from VPS data if the volume is lost.
- **Default Meilisearch port is 7700** (standard). Docker dev runs on port 7711 and requires overriding `MEILI_URL=http://localhost:7711` in `.env.local`. Code fallback is `http://127.0.0.1:7700`.
- **Two Docker volume profiles**: `meili-data-full` (1M+ docs, seeded from VPS) and `meili-data-dev` (548 sample docs, indexed locally). Switch with `MEILI_PROFILE=dev|full`. Only one runs at a time (shared Docker port 7711).
- **Shiki uses LexBuild brand themes** (`lexbuild-light`/`lexbuild-dark`) defined in `src/lib/shiki-themes.ts` — the single source of truth imported by both `src/lib/shiki.ts` (runtime) and `scripts/generate-highlights.ts` (pre-render). After editing themes, delete existing `.highlighted.html` files from `output/` dirs (not `content/` — it's symlinked) and re-run `generate-highlights.ts`.
- **Shiki word wrapping**: `.shiki-wrap` in `global.css` forces `pre-wrap` on Shiki output with `!important`.
- **Shiki outputs uppercase hex in inline styles**: `color:#476C85` not `color:#476c85`. CSS `[style*=...]` attribute selectors are case-sensitive. Use the `i` flag for case-insensitive matching: `span[style*="color:#476C85" i]`.
- **`<pre>` whitespace in Astro templates**: Template indentation inside `<pre>`/`<code>` tags renders as literal whitespace. Always collapse `<pre><code>{content}</code></pre>` onto one line with no surrounding whitespace.
- **Third-party scripts (analytics, tracking) must use `is:inline`**: Without it, Astro processes them as ES modules — `arguments` is invalid in strict mode, and globals like `window.dataLayer` won't attach. Applies to gtag, Clarity, and any script that relies on classic browser globals.
- **External links**: Always use `rel="noopener noreferrer"` on `target="_blank"`.
- **Search in production uses Caddy proxy, not direct Meilisearch access.** `MEILI_URL=/search` in `.env.production`. `BaseLayout.astro` detects proxy mode (`meiliUrl.startsWith("/")`) and passes `undefined` for the key prop — only Caddy has the key.
- **Astro conditionals with strings**: `{str && <jsx>}` can silently fail in `.astro` templates. Use `{str ? <jsx> : null}` with explicit `: null` for ternary conditionals.
- **gray-matter `matter` field starts with `\n`**: When displaying raw YAML from `result.matter`, use `.trim()` to avoid a blank line between `---` and the first field.
- **Theme toggle is 2-way (light/dark)**, default is light. No system preference detection. The inline `<head>` script only applies dark if `localStorage.theme === "dark"`.
- **Astro `<script>` blocks are plain JS, not TypeScript.** Don't use generics like `querySelectorAll<HTMLElement>()`. Only `<script lang="ts">` or bundled component scripts support TypeScript syntax.
- **Homepage sections with hardcoded light backgrounds** (e.g., `bg-[#FAFAFA]`, `bg-summer-green-50/75`) must include `dark:` overrides. Use `dark:bg-background` or `dark:bg-slate-blue-950/50` for subtle dark tinting.
- **gray-matter caching bugs**: (1) In SSR, the `.matter` property is a lazy getter consumed by `.data` access — on repeat requests the cached object returns `undefined` for `.matter`. (2) In batch scripts, caching causes unbounded RSS growth. Always use `matter(raw, { cache: false })` everywhere.
- **React hydration with localStorage**: Don't read localStorage in `useState()` initializer — SSR renders the default, client reads stored value, causing hydration mismatch. Use `useLayoutEffect` to apply stored value after hydration but before paint.
- **Error pages must be at `src/pages/` root** — Astro's 404/500 auto-routing only works for `src/pages/404.astro` and `src/pages/500.astro`. Subdirectories would break auto-routing.
- **Sidebar auto-expand uses `userToggled` flag**: Both `FrSidebarContent` and `TitleSidebarContent` use a `userToggled` one-way latch to prevent auto-expand from fighting manual collapse. Once set to `true`, auto-expand is permanently disabled for that component lifecycle.
- **Sidebar fetch errors use dedicated error states**: `titlesError`/`yearsError`/`failedTitles` track fetch failures separately from empty data. Never swallow fetch errors into empty arrays — show "Failed to load" instead of misleading "No titles found".
- **`fetch()` must check `res.ok`**: `fetch` does not reject on HTTP errors. Always check `res.ok` before calling `res.json()`, otherwise a 404 produces a cryptic JSON parse error.
- **Homepage sample output has three copies**: The `sampleYaml` and `sampleMarkdown` template literals drive the Shiki-highlighted tabs, but the "Preview" tabs use hardcoded HTML. When changing the sample section, update all three: frontmatter data, markdown data, AND the rendered HTML preview grids.
- **Homepage residual CSS is minimal (~50 lines)**: Only `color-mix()` backgrounds, JS-toggled `.active` tab states, `:global()` Shiki overrides, `auto-fit minmax` grid, and adjacent sibling combinators remain as scoped CSS. Everything else uses Tailwind utilities on the markup. The `sample-tab` class is kept as a JS hook (queried by the tab `<script>`) and CSS anchor for hover/active rules.
- **Content Collections markdown rendering is separate from `lib/markdown.ts`**: Uses Astro's built-in pipeline configured in `astro.config.ts` (`markdown.shikiConfig` + `rehypePlugins`). The existing `lib/markdown.ts` unified pipeline is for legal content only. Do not mix them.
- **`vite.ssr.external: ["shiki"]` coexists with Content Collections Shiki**: The external is for the runtime Shiki singleton (`lib/shiki.ts`). Astro's built-in markdown Shiki (Content Collections) uses a separate code path. Both work simultaneously.
- **`astro:middleware` is a virtual module** (like `astro:content`): `import { defineMiddleware } from "astro:middleware"` causes tsc errors outside Astro's build pipeline. This is expected — the build succeeds.
- **No `typecheck` turbo task for the Astro app**: `pnpm turbo typecheck --filter=@lexbuild/astro` runs 0 tasks. Use `pnpm turbo build:astro` to validate types via the Astro/Vite pipeline, or install `@astrojs/check` for standalone checking.

## Documentation Site

The docs site at `/docs/` uses Astro 6 Content Collections — separate from the legal content `fs.readFile()` pipeline.

- **Content Collections use `glob` loader** (Astro 6 pattern), NOT `type: "content"`. Config at `src/content.config.ts`. Schema validates `title`, `description`, `order`, `badge`, `hidden`.
- **`render()` is a standalone import**: `import { getEntry, render } from "astro:content"` — NOT `entry.render()`. Returns `{ Content, headings }`.
- **`src/content/docs/` is checked into git** — completely separate from root `content/` (gitignored symlinked legal data). No collision.
- **DocsLayout wraps BaseLayout with no `source` prop** — gets the bare `<main><slot /></main>` render path. The 3-column layout (sidebar, content, TOC) is rendered inside the slot.
- **Docs pages construct `PageSEO` directly** — `buildPageSEO()` requires `source`/`granularity`/`frontmatter` and is for legal content only.
- **Docs sidebar uses `sidebar-*` design tokens** (`bg-sidebar`, `border-sidebar-border`, `text-sidebar-foreground`, `bg-sidebar-accent`) to match the source browsing sidebar. `p-3` wrapper, `rounded-md` items.
- **MobileNav renders `DocsSidebar`** when `currentPath.startsWith("/docs")`, replacing the source switcher and source sidebar tree.
- **Navigation is a static tree** in `src/lib/docs-nav.ts` — not filesystem-derived. Exports `flattenNav()`, `getPrevNext()`, `getSectionForSlug()`.
- **`rehype-autolink-headings` with `behavior: "wrap"`** wraps heading text in `<a>` tags. The `.docs-prose` CSS must override prose link styles on headings (`text-decoration: none; color: inherit; font-weight: inherit`) or the h1 renders as a black underlined link.
- **Prose heading color uses `--tw-prose-headings` variable** — setting `color` directly on `.docs-prose h1` doesn't work because `prose`'s CSS variable takes precedence. Override the variable instead.
- **Sitemap includes docs URLs** via `collectDocsUrls()` in `generate-sitemap.ts`, which imports `flattenNav()` from `docs-nav.ts`.

## SEO

All SEO is driven by `lib/seo.ts` (pure functions, no Astro imports) and `components/seo/SEOHead.astro`.

- **`src/middleware.ts` ensures `charset=utf-8`** in the `Content-Type` header for all HTML responses. Without this, Astro's Node adapter may send `text/html` without charset, causing crawlers (Bing) to interpret UTF-8 as Latin-1 (e.g., `§` → `Â§`).
- **`BaseLayout` requires a `PageSEO` prop** (not `title`/`description`). Every page must construct a `PageSEO` object.
- **`buildPageSEO()`** handles all source catch-all routes (USC, eCFR, FR — including FR year/month index pages). Source index pages and static pages construct `PageSEO` literals directly. Do not bypass `buildPageSEO()` for catch-all routes.
- **New structured data types** (e.g., `CollectionPage` for FR) belong as branches in `buildJsonLd()` in `seo.ts`, not as inline JSON-LD in page files.
- **`ArticleMeta`** on `PageSEO` provides `article:published_time`, `article:modified_time`, and `article:section` OG tags. Populated automatically by `buildPageSEO()` for section/document pages when frontmatter is available.
- **`siteUrl`** is always resolved from `import.meta.env.SITE_URL` at the call site, passed as a parameter to pure functions.
- **`rawTitle?: true`** suppresses the ` | LexBuild` suffix (used only on the landing page).
- **Error pages** set `robots: "noindex"`.
- **JSON-LD** uses `@graph` approach via `JsonLd.astro`. Builder functions return objects without `@context`.

## Testing

- **Vitest** configured at `vitest.config.ts` with `@` path alias
- Tests in `src/lib/__tests__/`. Run with `pnpm test` or `npx vitest run`
- SEO builder functions are pure — tested without Astro runtime

## Federal Register Integration

FR is the third source (`source: "fr"`) with a fundamentally different structure from USC/eCFR:
- **Date-based, not hierarchical**: URLs follow `/fr/{YYYY}/{MM}/{document_number}` (3 segments)
- **FR sidebar (`FrSidebarContent`)**: Loads `years.json` client-side, renders year → month tree. Years show total doc counts, months show per-month counts with zero-padded month number prefix. `userToggled` flag prevents auto-expand effect from fighting manual toggle. Months are `<a>` links (leaf nodes), not expandable buttons.
- **New granularity values**: `"document"` (content leaf), `"month"` (index), `"year"` (index) added to `Granularity` type. These only flow through FR code paths.
- **Route validation is source-aware**: `isValidSegment()` in `routes.ts` accepts `sourceId` and `index` params. FR segments are `^\d{4}$` (year), `^\d{2}$` (month), `^\d{4}-\d{4,6}$` (doc number) — not the `^(title|chapter|part|section)-` prefix pattern used by USC/eCFR.
- **Content path**: `fr/documents/{YYYY}/{MM}/{doc}.md` — symlinked from `output/fr/` via `link-content.sh`
- **Nav data**: `public/nav/fr/years.json` (year summaries) + `public/nav/fr/{YYYY}-{MM}.json` (per-month document listings). Generated by `generateFrNav()` in `generate-nav.ts`.
- **Month index pages group by publication date** with document type badges (rule/notice/proposed rule/presidential). Logic for grouping must be in the Astro frontmatter section, not in template expressions (Astro templates don't support TypeScript generics like `new Map<string, T>()`).
- **FrontmatterPanel** shows FR-specific fields: Document Type, FR Citation, Publication Date, Agencies, Effective Date, Comments Close Date, Docket IDs, RIN.
- **`hasSidebar` on SourceConfig controls layout**: When `false`, BaseLayout renders a centered max-width `<main>` without sidebar or mobile nav tree. All three sources (USC, eCFR, FR) currently have `hasSidebar: true`. Check `SOURCES[source]?.hasSidebar !== false` in BaseLayout.
- **Nav JSON must exist in two VPS locations**: `/srv/lexbuild/nav/` (server-side `readFile`) AND `~/lexbuild/apps/astro/dist/client/nav/` (client-side `fetch("/nav/...")`). The deploy script syncs to both. If sidebar shows "No years found" but the main content loads, the `dist/client/nav/` copy is missing.
- **Don't pipe long-running scripts through `head`**: `npx tsx scripts/index-search.ts 2>&1 | head -25` kills the process via SIGPIPE when the pipe closes. Run indexer scripts directly or use `run_in_background`.

