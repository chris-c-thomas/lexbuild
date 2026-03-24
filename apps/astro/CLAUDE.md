# CLAUDE.md — LexBuild Astro App

## Project Overview

`apps/astro/` is the LexBuild web application — an Astro-powered, multi-source legal content browser deployed to a self-managed VPS (AWS Lightsail) behind Cloudflare's edge cache.

The app serves U.S. Code (54 titles, ~60k sections) and eCFR (50 titles, ~200k+ sections) at every granularity level. It has **no code dependency** on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/ecfr` — it consumes their `.md` output as data.

## Monorepo Integration

- **`"private": true`** — excluded from changesets and npm publishing
- **No `build` script** — only `build:astro`. Do NOT add to the default `build` task in turbo.json.
- **Content is gitignored** — `content/`, `public/nav/`, `public/sitemap.xml`, `*.highlighted.html`
- **Deploy** via `./scripts/deploy.sh` from the monorepo root (see `.claude/guides/lexbuild-ops.md`)

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

Static components (no JS): `BaseLayout.astro`, `FrontmatterPanel.astro`, `BreadcrumbNav.astro`

## Directory Structure

```
src/
├── layouts/BaseLayout.astro        # HTML shell, dark mode, sidebar, search
├── pages/
│   ├── index.astro                 # Landing page
│   ├── usc/[...slug].astro        # USC catch-all (3 slug segments)
│   ├── ecfr/[...slug].astro       # eCFR catch-all (4 slug segments)
│   ├── 400–504.astro              # HTTP error pages (11 total, see Error Pages below)
│   └── health.ts                  # Health check endpoint
├── components/
│   ├── content/                    # ContentViewer, FrontmatterPanel, BreadcrumbNav
│   ├── sidebar/                    # Sidebar, MobileNav, SidebarContent, SectionList
│   ├── search/SearchDialog.tsx
│   ├── ui/                         # shadcn/ui primitives
│   └── landing/                    # SourceCard, HeroSection
├── lib/
│   ├── content.ts                  # fs.readFile + path traversal prevention
│   ├── routes.ts                   # Slug → content path + granularity resolution
│   ├── sources.ts                  # Source registry (USC, eCFR config)
│   ├── types.ts                    # SourceId, Granularity, ContentFrontmatter, nav types
│   ├── frontmatter.ts              # gray-matter wrapper
│   ├── markdown.ts                 # unified/remark/rehype pipeline
│   ├── highlight.ts                # Pre-rendered .highlighted.html loader
│   ├── shiki.ts                    # Runtime Shiki singleton (dev fallback)
│   ├── search.ts                   # Meilisearch client wrapper
│   └── nav.ts                      # Nav JSON reader
└── styles/global.css               # Tailwind base, theme tokens, Shiki overrides
scripts/
├── link-content.sh                 # Symlink CLI output → content/
├── generate-nav.ts                 # _meta.json → public/nav/ JSON
├── generate-highlights.ts          # Batch Shiki pre-rendering
├── generate-sitemap.ts             # Sitemap index + chunks
├── index-search.ts                 # Full Meilisearch index (281k docs)
└── index-search-incremental.ts     # Incremental upsert
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTENT_DIR` | `./content` | Root content directory |
| `NAV_DIR` | `./public/nav` | Sidebar JSON directory |
| `ENABLE_SEARCH` | `false` | Show search UI |
| `MEILI_URL` | `http://127.0.0.1:7700` (dev) / `/search` (prod) | Meilisearch endpoint (starts with `/` = proxy mode) |
| `MEILI_SEARCH_KEY` | — | Search-only API key |
| `SITE_URL` | `https://lexbuild.dev` | Base URL for sitemap/OG |

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
npx tsx scripts/generate-highlights.ts              # Shiki pre-render (~287k files, ~6 min)
npx tsx scripts/generate-sitemap.ts                 # Sitemap (~292k URLs, <5s)
npx tsx scripts/index-search.ts                     # Meilisearch index (~281k docs)
```

Script notes:
- **generate-highlights.ts**: Forks child processes in 10k-file chunks to avoid Shiki OOM (grammar cache leaks ~4GB over 260k+ files). Changing themes requires updating both this script and `src/lib/shiki.ts`, then deleting existing `.highlighted.html` files.
- **index-search.ts**: 500 docs/batch, 300s waitForTask timeout. Requires `MEILI_URL` and optionally `MEILI_MASTER_KEY` env vars. Document IDs sanitized (dots/colons → underscores).
- **generate-nav.ts**: Includes reserved title placeholders (USC 53, eCFR 35). Chapter grouping for eCFR derived from filesystem directories, not `_meta.json`.

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

11 error pages using a shared `ErrorPage.astro` component: 400, 403, 404, 405, 410, 429, 451, 500, 502, 503, 504.

- **`404.astro` and `500.astro` must stay at `src/pages/` root** — Astro auto-routes only these two (404 for unmatched routes, 500 as SSR error boundary). Other error pages are regular pages at their numeric URL paths.
- **`ErrorPage.astro`** component: `status` (decorative large number, `aria-hidden`), `title` (`<h1>`), `description`, optional `showHomeLink`.
- **BaseLayout `title` includes status code** for browser tab clarity: e.g., `title="404 Not Found"` → `<title>404 Not Found | LexBuild</title>`.
- **Cloudflare 5xx codes (520–526) are NOT Astro pages** — Cloudflare intercepts these before reaching the origin. See `.claude/todo/http-error-pages.md` for reference.

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

## Common Pitfalls

- **Tailwind v4 uses `@tailwindcss/vite`**, NOT `@astrojs/tailwind` (Tailwind v3). No `postcss.config.mjs` needed.
- **Tailwind v4 `@theme inline` vars are build-time only** — not runtime CSS custom properties. However, `var()` references to `:root`/`.dark` runtime vars ARE preserved. Scoped `<style>` must use runtime vars or hex directly.
- **Tailwind v4 utilities may silently fail in `.astro`** scoped content. Verify with DevTools; use scoped `<style>` as fallback for layout-critical properties.
- **eCFR has 4 hierarchy levels, USC has 3.** A 3-segment slug = "section" for USC but "part" for eCFR.
- **Title-level files can be very large** (~10MB). Pre-rendered highlights avoid runtime Shiki cost.
- **`content/` and `public/nav/` are gitignored.** Run `link-content.sh` and `generate-nav.ts` before dev server works.
- **Caddy handles TLS.** Astro listens on HTTP localhost only.
- **`rehype-sanitize` is critical.** Defense-in-depth against injection in Markdown content.
- **PM2 reload not restart.** Use `pm2 reload lexbuild-astro --update-env` for zero-downtime.
- **`ecosystem.config.cjs` manages 3 services**: `lexbuild-astro` (port 4321), `meilisearch` (port 7700), `uptime-kuma` (port 3001). Uptime Kuma is installed at `/srv/uptime-kuma`, not in the monorepo.
- **Shiki uses LexBuild brand themes** (`lexbuild-light`/`lexbuild-dark`) defined in `src/lib/shiki-themes.ts` — the single source of truth imported by both `src/lib/shiki.ts` (runtime) and `scripts/generate-highlights.ts` (pre-render). Uses 3 palettes: putty for headings, slate-blue for body/punctuation, summer-green for bold/code.
- **Changing Shiki themes**: Edit `src/lib/shiki-themes.ts`. Delete existing `.highlighted.html` files and re-run `generate-highlights.ts` after changes.
- **Delete `.highlighted.html` from `output/` dirs, not `content/`**: The `content/` directory is symlinked. `find content/ -delete` silently fails on symlink targets. Always delete from `output/`, `output-chapter/`, `output-title/` directly: `find /path/to/output -name "*.highlighted.html" -type f -delete`.
- **Shiki word wrapping**: `.shiki-wrap` in `global.css` forces `pre-wrap` on Shiki output with `!important`.
- **`<pre>` whitespace in Astro templates**: Template indentation inside `<pre>`/`<code>` tags renders as literal whitespace. Always collapse `<pre><code>{content}</code></pre>` onto one line with no surrounding whitespace.
- **Third-party scripts (analytics, tracking) must use `is:inline`**: Without it, Astro processes them as ES modules — `arguments` is invalid in strict mode, and globals like `window.dataLayer` won't attach. Applies to gtag, Clarity, and any script that relies on classic browser globals.
- **External links**: Always use `rel="noopener noreferrer"` on `target="_blank"`.
- **Search in production uses Caddy proxy, not direct Meilisearch access.** `MEILI_URL=/search` in `.env.production` — the browser's `127.0.0.1:7700` is the user's machine, not the VPS.
- **`MEILI_SEARCH_KEY` is not passed to the browser in proxy mode.** `BaseLayout.astro` detects proxy mode (`meiliUrl.startsWith("/")`) and passes `undefined` for the key prop. Only Caddy has the key. In direct mode (local dev), the key is passed to the Meilisearch client.
- **After dump import, API keys change.** Update `~/.lexbuild-secrets`, `.env.production` (via deploy.sh), AND `/etc/caddy/environment`.
- **Astro conditionals with strings**: `{str && <jsx>}` can silently fail in `.astro` templates. Use `{str ? <jsx> : null}` with explicit `: null` for ternary conditionals.
- **gray-matter `matter` field starts with `\n`**: When displaying raw YAML from `result.matter`, use `.trim()` to avoid a blank line between `---` and the first field.
- **Theme toggle is 2-way (light/dark)**, default is light. No system preference detection. Legacy `"system"` values in localStorage are migrated to `"light"` on read. The inline `<head>` script only applies dark if `localStorage.theme === "dark"`.
- **Astro `<script>` blocks are plain JS, not TypeScript.** Don't use generics like `querySelectorAll<HTMLElement>()`. Only `<script lang="ts">` or bundled component scripts support TypeScript syntax.
- **Homepage sections with hardcoded light backgrounds** (e.g., `bg-[#FAFAFA]`, `bg-summer-green-50/75`) must include `dark:` overrides. Use `dark:bg-background` or `dark:bg-slate-blue-950/50` for subtle dark tinting.
- **gray-matter cache corrupts `.matter`**: `gray-matter` caches results by input string. The `.matter` property is a lazy getter consumed by `.data` access. On the second SSR request with the same file, the cached object returns `undefined` for `.matter`. Always use `matter(raw, { cache: false })` when reading `.matter`.
- **React hydration with localStorage**: Don't read localStorage in `useState()` initializer — SSR renders the default, client reads stored value, causing hydration mismatch. Use `useLayoutEffect` to apply stored value after hydration but before paint.
- **`--content` deploy doesn't regenerate anything**: It only rsyncs existing local files. To update nav/sitemap after code changes, either regenerate locally then `--content`, or SSH into VPS and regenerate there. `--remote` runs the full pipeline.
- **Error pages must be at `src/pages/` root** — Astro's 404/500 auto-routing only works for `src/pages/404.astro` and `src/pages/500.astro`. Subdirectories (e.g., `src/pages/errors/`) would change the URL path and break auto-routing.
- **Sitemap chunk size is 25,000 URLs** (not 50k). 50k produced ~10MB XML files that Googlebot intermittently failed to fetch. `MAX_URLS_PER_FILE` in `scripts/generate-sitemap.ts`.
- **Sitemap `changefreq` is per-source**: eCFR=`weekly` (updated daily), USC=`monthly` (release points every few weeks), misc=`weekly`. Passed as parameter to `writeChunkedSitemaps()`.
- **Locally generated sitemaps need `--content` deploy**: `./scripts/deploy.sh --content` rsyncs `public/sitemap*.xml` to the VPS. Plain `deploy.sh` only does git pull + build and won't pick up gitignored sitemap files.

## SEO

All SEO is driven by `lib/seo.ts` (pure functions, no Astro imports) and `components/seo/SEOHead.astro`.

- **`BaseLayout` requires a `PageSEO` prop** (not `title`/`description`). Every page must construct a `PageSEO` object.
- **`buildPageSEO()`** handles content pages (catch-all routes). Static pages construct `PageSEO` literals directly.
- **`siteUrl`** is always resolved from `import.meta.env.SITE_URL` at the call site, passed as a parameter to pure functions.
- **`rawTitle?: true`** suppresses the ` | LexBuild` suffix (used only on the landing page).
- **Error pages** set `robots: "noindex"`.
- **JSON-LD** uses `@graph` approach via `JsonLd.astro`. Builder functions return objects without `@context`. HTML-safe serialization escapes `<`, `>`, `&` in `<script>` output.
- **`og:type`**: `"article"` for sections, `"website"` for everything else.
- Sitemap: ~292k URLs in ≤50k chunks with depth-based priority

## Testing

- **Vitest** configured at `vitest.config.ts` with `@` path alias
- Tests in `src/lib/__tests__/`. Run with `pnpm test` or `npx vitest run`
- SEO builder functions are pure — tested without Astro runtime

## `astro.config.ts`

```typescript
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  server: { host: "127.0.0.1", port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ["shiki"] },
  },
});
```
