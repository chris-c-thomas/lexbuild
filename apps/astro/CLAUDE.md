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
| Fonts | IBM Plex Sans / Serif / Mono, JetBrains Mono via `@fontsource` |
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
│   └── 404.astro
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

1. Inline `<script>` in `<head>` reads `localStorage.theme`, sets `.dark` class before first paint
2. `ThemeToggle.tsx` toggles class + persists. Dark theme-color: `#0e1821`
3. Tailwind: `@custom-variant dark (&:is(.dark *))` in `global.css`
4. **Dark palette is dark slate blue**, not default shadcn grey. All `.dark` vars use blue-tinted hex values.
5. Hardcoded `text-slate-blue-*` colors need explicit `dark:` variants. Semantic tokens auto-adapt.

## Design Conventions

### shadcn/ui

Initialized with radix-nova preset, zinc theme. Components in `src/components/ui/`.

**Installed**: Button, Card, Badge, Breadcrumb, Separator, ScrollArea, Skeleton, Sheet, Tabs.

### Color System

- **shadcn tokens** (`bg-background`, `text-foreground`, `bg-card`) for shadcn components
- **Semantic tokens** (`bg-surface`, `text-ink-muted`, `border-border-base`, `bg-code-surface`) for custom layouts — dark-mode-aware via `:root`/`.dark` runtime vars. Only 4 exist; add sparingly.
- Slate-blue accent for headings, labels, active states
- `prose prose-zinc` for rendered legal HTML content

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
- **Changing Shiki themes**: Update `generate-highlights.ts` AND `src/lib/shiki.ts`, delete `.highlighted.html` files, re-run.
- **Shiki word wrapping**: `.shiki-wrap` in `global.css` forces `pre-wrap` on Shiki output with `!important`.
- **External links**: Always use `rel="noopener noreferrer"` on `target="_blank"`.
- **Search in production uses Caddy proxy, not direct Meilisearch access.** `MEILI_URL=/search` in `.env.production` — the browser's `127.0.0.1:7700` is the user's machine, not the VPS.
- **After dump import, API keys change.** Update `~/.lexbuild-secrets`, `.env.production` (via deploy.sh), AND `/etc/caddy/environment`.
- **Astro conditionals with strings**: `{str && <jsx>}` can silently fail in `.astro` templates. Use `{str ? <jsx> : null}` with explicit `: null` for ternary conditionals.
- **gray-matter `matter` field starts with `\n`**: When displaying raw YAML from `result.matter`, use `.trim()` to avoid a blank line between `---` and the first field.
- **React hydration with localStorage**: Don't read localStorage in `useState()` initializer — SSR renders the default, client reads stored value, causing hydration mismatch. Use `useLayoutEffect` to apply stored value after hydration but before paint.
- **`--content` deploy doesn't regenerate anything**: It only rsyncs existing local files. To update nav/sitemap after code changes, either regenerate locally then `--content`, or SSH into VPS and regenerate there. `--remote` runs the full pipeline.

## SEO

- Unique `<title>` per page from frontmatter
- `<meta name="description">` built per-granularity in catch-all routes (sentence-style hierarchy)
- Open Graph: `og:title`, `og:description`, `og:type`, `og:url`
- Canonical URLs via `<link rel="canonical">`
- Sitemap: ~292k URLs in ≤50k chunks with depth-based priority
- TODO: `og:image`, JSON-LD structured data

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
