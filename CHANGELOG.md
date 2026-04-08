# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [1.21.1]

### Changed

- Revise comments across the monorepo for production quality: remove redundant comments, fix orphaned docblock in core AST builder, add explaining comment for eCFR duplicate section detection, extract magic number in API rate limiter
- Add file-level docblock to API app factory (`apps/api/src/app.ts`)
- Update fixture files with version bump
- Update CLAUDE.md files

## [1.21.0]

### Added

- MCP integration placeholder in docs and API
- Summer-green accent color across the Astro site

### Changed

- Renamed `/cfr/` API routes to `/ecfr/` for future Annual CFR disambiguation
- Refactored Scalar API reference into standalone config file (`scalar-config.ts`) to match localhost dev workflow
- Various Scalar API docs styling and layout improvements
- Reverted select UI styles back to slate blue accent
- Simplified API endpoint names

### Fixed

- Scalar API client modal positioning and overlay behavior
- Generator output version field in frontmatter
- Test fixture snapshot alignment

## [1.20.1]

### Changed

- Upgraded Astro from 6.0.4 to 6.1.4
- Updated robots.txt: allowed /api/openapi.json, added DeepSeekBot/MistralBot/xAI-Grok/Google-CloudVertexBot, relaxed Ahrefs/Screaming Frog

### Fixed

- Resolved 10 Dependabot vulnerabilities via pnpm overrides (dompurify ^3.3.2, vite ^7.3.2, defu ^6.1.5)

## [1.20.0]

### Added

- Embedded Scalar API reference at `/docs/api` with unified site navbar, footer, and dark mode sync
- `ApiReference` React island (`client:only="react"`) wrapping `@scalar/api-reference-react`
- React Error Boundary for Scalar render failures with fallback link to raw OpenAPI spec
- Custom Scalar theme CSS matching LexBuild brand palette (slate-blue light/dark)
- API Reference entry in docs sidebar navigation with "Interactive" badge
- `/docs/api` included in sitemap generation
- Active state on header "API" nav link when on `/docs/api`

### Changed

- API reference URL moved from `/api/docs` to `/docs/api` — all nav links, docs content, and README references updated
- `/api/docs` now returns a 301 redirect to `/docs/api` for backward compatibility
- Removed `@scalar/hono-api-reference` dependency from API app (no longer used)
- Scalar's fixed-viewport layout overridden to flow within the page with sticky sidebar
- Dark mode syncs via direct body class manipulation (Scalar's config-driven toggle only applies on init)
- Scalar's built-in dark mode toggle and branding hidden in favor of site navbar ThemeToggle

### Fixed

- Body class cleanup on unmount prevents Scalar CSS variable bleed after navigation
- localStorage access wrapped in try-catch for restricted browser contexts
- Stale JSDoc referencing deleted file removed from scalar-theme.ts

## [1.18.1]

### Changed

- Docs update; Version bump

## [1.18.0]

### Added

- Documentation site at `/docs/` with 41 pages across 8 sections (Getting Started, CLI, Web, API, Guides, Architecture, Reference, Project)
- Astro Content Collections with glob loader for docs markdown rendering
- DocsLayout with 3-column layout (sidebar, content, table of contents)
- DocsSidebar React island with collapsible sections and sessionStorage persistence
- TableOfContents React island with IntersectionObserver scroll spy
- DocsPagination with prev/next navigation cards
- Mobile docs navigation in MobileNav sheet drawer
- Code copy button and callout/admonition styling for docs prose
- Docs URLs in sitemap generation
- Active state on header Docs link when on `/docs/` routes

### Changed

- Docs link in header, footer, and mobile nav changed from external GitHub URL to internal `/docs/`
- Added markdown.shikiConfig with LexBuild brand themes and rehype plugins to astro.config.ts

## [1.17.3]

### Changed

- Update documentation for Data API: README.md, docs/, and internal docs

## [1.17.2]

### Added

- Data API (`apps/api/`) — Hono-based REST API serving U.S. legal content from SQLite with Meilisearch search proxy
- Document retrieval endpoints for USC, CFR, and FR with content negotiation (JSON/Markdown/plaintext), field selection, and ETag caching
- Paginated collection listings with multi-field filtering, sorting, and cursor-based pagination
- Hierarchy browsing endpoints: USC/CFR titles, FR years/months
- Corpus statistics endpoint
- Cross-source full-text search with faceted filtering and result highlighting
- API key authentication with PBKDF2 hashing and tiered rate limiting (anonymous/standard/elevated/unlimited)
- CLI commands: `lexbuild api-key create|list|revoke|update`
- Deploy script modes: `--api`, `--api-db`, `--api-full` for API code and database deployment
- Shared API key schema and hashing utilities in `@lexbuild/core`
- OpenAPI 3.1 spec generation with Scalar API reference UI at `/api/v1/docs`
- PM2 ecosystem entry for API process on port 4322

## [1.17.1]

### Changed

- Apply new Prettier formatting to codebase

## [1.17.0]

### Added

- Docker-based Meilisearch search index deployment (`--search-docker`) — indexes locally in a linux/amd64 container, transfers pre-built data directory to VPS with no re-indexing
- Incremental source indexing (`--search-docker --source fr`) — add/update a single source without full rebuild
- Docker volume seeding from VPS (`--search-docker-seed`) — recover local index from production
- `BatchIndexer.flush()` fix — prevents cascading failures when Meilisearch is unavailable
- FR content support in search dump pipeline
- Comprehensive internal documentation set (`.claude/internal/docs/`)

### Changed

- Search deployment uses Docker data directory transfer instead of Meilisearch dumps (removed `--search-dump` and `--search-push`)
- Deploy script cleanup: removed dump-based functions, added Docker container lifecycle management

## [1.16.1]

### Changed

- Update documentation and CLAUDE.md files

## [1.16.0]

### Added

- `enrich-fr` CLI command — fetches rich metadata from the FederalRegister.gov API listing endpoint and patches YAML frontmatter in existing Markdown files converted from govinfo bulk XML
- New `enrichFrDocuments()` function in `@lexbuild/fr` for programmatic frontmatter enrichment
- Exported `buildMonthChunks` and `fetchWithRetry` utilities from `@lexbuild/fr` for reuse
- FR FrontmatterPanel now displays `fr_action` (Action) and `cfr_references` (CFR References) fields
- Per-source search index checkpoints (`.search-indexed-at-{usc,ecfr,fr}`) replacing single global checkpoint — enables `--source fr` incremental runs without full rescans
- `cfr_references` field added to `ContentFrontmatter` type in Astro app

### Changed

- FR content rsync uses mtime-based comparison instead of `--checksum` — avoids hashing 770k+ files on every sync
- `update-fr.sh` updated with per-source checkpoint support and mtime-based rsync

## [1.15.3]

### Added

- `scripts/update-fr.sh` — dedicated script for daily Federal Register updates (download, convert, deploy, incremental search index)
- `cache: false` "why" comments on all `gray-matter` calls in batch processing scripts
- JSDoc for `cn()` utility, "why" comment on FR doc number regex, Shiki SSR externalization comment

### Changed

- Standardized section divider comments across 17 files: replaced 164 lines of full-width `// ----...----` bars with compact `// --- Label ---` format (-167 net lines)
- Removed dividers entirely in pure type-definition files (`core/ast/types.ts`, `astro/lib/types.ts`) where JSDoc already labels each section
- Removed redundant inline comments in `FrontmatterPanel.astro` that restated what the code does

## [1.15.2]

### Fixed

- Sidebar collapse bug: USC/eCFR titles could not be collapsed once auto-expanded. Added `userToggled` flag to prevent auto-expand from fighting manual collapse
- Sidebar error handling: fetch failures now show "Failed to load" with retry instead of silently rendering empty or misleading "No titles found"
- Added `res.ok` checks on all sidebar fetch calls to properly catch HTTP errors
- Homepage sample output tab styling discrepancy between homepage and section pages (border-color and box-shadow)
- Old Title 17 source credit in homepage preview grid not updated with new sample
- Missing `rel="noreferrer"` on `target="_blank"` links in homepage
- Redundant `### Commands` heading in CLI CLAUDE.md
- `400–504.astro` in docs directory tree implying single file instead of 11 separate files

### Changed

- Homepage sample output updated from 17 USC § 107 (Fair Use) to 29 USC § 1022 (Summary Plan Description) with full notes
- CLI Quick Start updated to reference Title 29 with `--include-notes` flag
- Homepage Packages section: added planned PLAW, Bills, and Municipal Code packages alongside Annual CFR and State Statutes
- Added "View on GitHub" button to Packages section linking to packages directory
- Added npm organization link to site footer
- Shiki highlighting on homepage wrapped in try-catch with fallback to unhighlighted code
- CLAUDE.md files optimized across all packages (701 lines removed, redundancies eliminated)
- Monorepo README.md: Sources and Data Sources tables combined, Overview section rewritten

## [1.15.1]

### Changed

- Homepage hero stat updated from "290k+ Sections" to "1.05M+ Documents" to reflect full corpus including Federal Register
- Homepage "Open Source" label changed to "MIT Open Source"
- Comprehensive documentation updates for Federal Register integration across `docs/`, `apps/astro/README.md`, and package docs
- `docs/packages/fr.md` expanded from 123 to 202 lines: govinfo bulk downloader, emphasis map differences, publication date inference, whitespace normalization, converter options
- `docs/packages/cli.md` updated with `download-fr` and `convert-fr` command sections
- `docs/development/getting-started.md` updated with FR CLI examples, project tree, dependency graph
- `apps/astro/README.md` updated with FR routes, content pipeline, corpus counts
- Deploy script: added `--nav-only` and `--sitemaps-only` flags, nav JSON now syncs to both `/srv/lexbuild/nav/` and `dist/client/nav/`

## [1.15.0]

### Added

- **Astro FR integration**: Federal Register as a browsable source on lexbuild.dev with year/month listing pages, document content pages, and breadcrumb navigation
- **FR sidebar navigation**: Year/month tree in the sidebar (consistent with USC title/chapter and eCFR title/chapter/part trees), with doc counts per month and auto-expand to active year
- **FR in mobile nav**: Added FR button to the source switcher in the mobile Sheet drawer
- **Publication date inference from FRDOC**: `closeFrdoc()` extracts `Filed M-D-YY` from XML, computes publication date (+1 day), used as fallback when no JSON sidecar exists
- **FR search indexing**: Both `index-search.ts` and `index-search-incremental.ts` now index FR documents with `publication_date` as a filterable, sortable, and displayed field
- **`--source` flag on incremental indexer**: Index a single source (`--source usc`, `--source ecfr`, `--source fr`) without scanning others
- **`--set-checkpoint` flag on incremental indexer**: Write the mtime checkpoint without indexing (used after per-source runs)
- **`--chunk-size` CLI flag on generate-highlights**: Tune files-per-child-process for memory-constrained runs
- **Govinfo bulk XML downloader** (`govinfo-downloader.ts`): Download daily FR issue XML from govinfo.gov with concurrent worker pool and retry logic
- **Lavender and chestnut color palettes**: Added to Tailwind `@theme inline` in `global.css`
- **FR-specific pipeline diagram colors**: FR uses lavender, future/planned uses putty in the How It Works section
- **Publication date edge case tests**: Month-end rollover, year-end rollover, 2-digit year threshold, missing Filed clause
- **`inferDateFromPath` tests**: Govinfo bulk path, per-document path, non-matching path

### Changed

- **Homepage Packages section**: FR card moved from "Planned" (dashed) to "Published" (linked to npm) with green Published label. Grid widened to 5 columns for published packages, 3 columns for planned
- **Homepage Browse Sources cards**: Descriptions rewritten for consistent length, stats bar uses `justify-evenly` with centered text, FR stats show "Daily since 2000 | ~770k documents"
- **Homepage How It Works diagram**: Added FR as third source (GPO/SGML XML, federalregister.gov) and `@lexbuild/fr` parser. Source/parser cards have per-source border colors (slate-blue/summer-green/lavender). Future placeholder uses putty
- `generate-highlights.ts` default chunk size reduced from 10,000 to 2,000 files per child process
- Child processes in highlight generation now heap-capped at 2GB via `--max-old-space-size`
- `sources.ts`: FR `hasSidebar` changed from `false` to `true`; USC name changed to "United States Code"
- FR month pages sort date groups most-recent-first, undated groups last
- FR month pages suppress redundant date group header when all docs share a single `YYYY-MM` fallback date
- `generate-nav.ts`: FR `publication_date` falls back to `YYYY-MM` from directory path when frontmatter field is empty
- `deploy.sh`: Auto-creates FR content directory on VPS before rsync
- Converter JSDoc updated from "two-pass" to single-pass streaming description

### Fixed

- **gray-matter memory leak in batch scripts**: Added `{ cache: false }` to all `matter()` calls in `generate-highlights.ts`, `index-search.ts`, and `index-search-incremental.ts` — prevents unbounded RSS growth (~30MB per 1,000 files)
- **Child process `execArgv` override**: `fork()` now spreads `process.execArgv` to preserve tsx loader flags alongside `--max-old-space-size`
- **Skip-to-content link stealing logo clicks**: Added `pointer-events-none` when hidden, `focus:pointer-events-auto` when visible — the invisible `z-100` link was intercepting clicks on the logo
- **"Invalid Date" on FR month pages**: `publication_date` was empty for docs without JSON sidecars; nav generator now falls back to directory-based `YYYY-MM`
- **Empty `<h1>` on FR document pages**: Template now uses `pageTitle` (with fallback) instead of raw `frontmatter.title`
- **Duplicate data fetching on FR year/month pages**: `getFrYear()` and `getFrMonthDocuments()` were called twice per request
- **Date validation in FRDOC parsing**: Rejects invalid month/day values (e.g., month 13) instead of silently wrapping via `Date` constructor
- **govinfo-downloader error logging**: Catch block now logs `warn` with date and error message instead of silently incrementing counter
- **Search indexer error logging**: FR catch blocks now log warnings per skipped file instead of swallowing errors
- Removed unused `MONTH_ABBREVS` constant from `SidebarContent.tsx`
- Updated `apps/astro/CLAUDE.md` to reflect FR sidebar existence

## [1.14.1]

### Changed

- Bump changeset

## [1.14.0]

### Added

- **`@lexbuild/fr` — Federal Register source package**: Full XML-to-Markdown conversion pipeline for Federal Register documents from the FederalRegister.gov API
- `FrASTBuilder` — SAX-to-AST builder for FR GPO/SGML XML (document-centric, flat structure)
- `download-fr` CLI command — downloads FR documents (XML + JSON metadata) by date range, single document, or recent days
- `convert-fr` CLI command — converts downloaded FR XML to Markdown with enriched frontmatter from JSON sidecars
- Dual JSON+XML ingestion: structured API metadata (agencies, CFR references, docket IDs, RINs, effective dates) enriches frontmatter beyond what XML alone provides
- FR link resolution with `federalregister.gov` fallback URLs for `/us/fr/` identifiers
- 57 tests across 4 test files (builder, converter, frontmatter, path)
- FR-specific frontmatter fields: `document_number`, `document_type`, `fr_citation`, `fr_volume`, `publication_date`, `agencies`, `cfr_references`, `docket_ids`, `rin`, `effective_date`, `comments_close_date`, `fr_action`
- `FrDocumentType` derived from `FR_DOCUMENT_TYPE_KEYS` const tuple in `fr-elements.ts`

### Changed

- `SourceType` extended: `"usc" | "ecfr" | "fr"`
- `FrontmatterData` extended with 12 FR-specific optional fields
- `parseIdentifier` and `createLinkResolver` in core now handle `/us/fr/` identifiers
- `generateFrontmatter` in core now serializes FR-specific fields
- ESLint `no-restricted-imports` rules updated for FR package boundary enforcement
- Comprehensive documentation updates across all `docs/` files and READMEs to reflect FR as a third source

### Fixed

- Converter parses each XML file once (cached in Map) instead of 2-3 times
- JSON sidecar parse failures now warn instead of being silently swallowed
- `popFrame` in builder warns and returns undefined instead of silently popping wrong frame
- `fetchWithRetry` retries network-level errors (DNS, TLS, connection reset) with exponential backoff
- `Retry-After` header NaN guard prevents zero-delay retry loops
- Per-file error handling: malformed XML files warn and skip instead of crashing the batch
- `--limit` CLI flag validated for NaN/negative values
- Stream pipeline errors include document number and URL context
- API response validation for critical fields (`count`, `document_number`, `publication_date`)
- `parseDateComponents` uses `||` instead of `??` so empty strings properly fall back to `"0000"`/`"00"`
- Dry-run count now applies type filter consistently with actual conversion

## [1.13.3]

### Added

- Download progress indicators — `onProgress` callbacks on USC and eCFR downloaders, spinner text updates per title in CLI
- Spinner around eCFR API metadata preflight fetch

### Fixed

- eCFR govinfo downloader now surfaces HTTP errors structurally instead of `console.warn`
- eCFR API download summary now shows failure count for parity with govinfo path
- Empty response body in govinfo downloader no longer silently skipped

### Security

- Bump transitive deps via `pnpm.overrides`: picomatch ^2.3.2/^4.0.4, path-to-regexp ^8.4.0, brace-expansion ^5.0.5, yaml ^2.8.3, smol-toml ^1.6.1

## [1.13.2]

### Added

- Download progress indicators — `onProgress` callbacks on USC and eCFR downloaders

## [1.13.1]

### Changed

- Bump `yaml` dependency from ^2.7.0 to ^2.8.3 in `@lexbuild/core`

## [1.13.0]

### Added

- SEO module (`lib/seo.ts`) with pure, testable builder functions — `buildPageSEO()`, `buildTitle()`, `buildDescription()`, `buildJsonLd()`, `buildBreadcrumbJsonLd()`
- `SEOHead.astro` component — renders all SEO `<head>` tags from a `PageSEO` prop, replacing inline tags in BaseLayout
- `JsonLd.astro` component — renders JSON-LD structured data via `@graph` approach with HTML-safe serialization
- JSON-LD structured data on all pages: `Legislation` type for sections (USC=Statute, eCFR=Regulation), `WebPage` for indexes, `BreadcrumbList` on all pages
- Twitter/X card meta tags (`summary_large_image`) on all pages
- `og:site_name` ("LexBuild") and per-page `og:type` differentiation (`article` for sections, `website` for indexes)
- `robots.txt` with sitemap reference and Cloudflare CDN cache rules
- HTTP error pages: 400, 403, 404 (refactored), 405, 410, 429, 451, 500, 502, 503, 504 — shared `ErrorPage.astro` component
- `<meta name="robots" content="noindex">` on all error pages
- `PageSEO` interface in `lib/types.ts` with `rawTitle` flag for landing page
- Vitest unit tests for all SEO builder functions (27 tests)
- `test` script added to Astro app `package.json`

### Changed

- `BaseLayout.astro` props simplified from `{title, description?, source?}` to `{seo: PageSEO, source?}` — all SEO concerns now in `SEOHead`
- Catch-all routes (`usc/[...slug].astro`, `ecfr/[...slug].astro`) use `buildPageSEO()` with `NavContext` instead of inline title/description construction
- Landing page `<title>` renders as "LexBuild — U.S. Law as Structured Markdown" (no redundant suffix)
- Improved meta descriptions for index pages with chapter/section/part counts

### Fixed

- XSS vector in JSON-LD serialization — `<`, `>`, `&` now escaped to unicode in `<script>` output
- Unused variables in `buildJsonLd()` removed
- `vitest.config.ts` uses `fileURLToPath` instead of `import.meta.dirname` for cross-environment compatibility

### Documentation

- Updated `apps/astro/CLAUDE.md` with Error Pages section, directory structure, and pitfall about Astro error page routing
- Updated `docs/apps/astro.md` directory listing

## [1.12.0]

### Added

- `lexbuild list-release-points` CLI command — lists available OLRC release points with dates and affected titles, making it easy to discover valid IDs for `download-usc --release-point <id>`
- `fetchReleasePointHistory()` and `parseReleasePointHistoryFromHtml()` in `@lexbuild/usc` — scrapes the OLRC prior release points page for the full history (~370+ releases since 2013)
- `HistoricalReleasePointInfo` type in `@lexbuild/usc` — release point ID, description, date, and affected title numbers
- Three-way theme toggle (system/light/dark) for the Astro web app
- "Show more" expansion for long `source_credit` values in frontmatter panel
- Homepage sample output tabs for YAML frontmatter and Markdown preview
- Shiki theme overrides for consistent code highlighting across light/dark modes
- OG image for social sharing

### Changed

- Homepage styling refresh — updated card borders, shadows, dark mode palette
- Shiki syntax highlighting theme updated for better contrast

### Fixed

- `gray-matter` cache bug causing stale YAML and preview display
- YAML frontmatter `---` delimiter display issue in preview panel
- CLI docs link pointing to wrong URL
- Copilot review issues in release point parser — malformed HTML entries now skipped (best-effort parsing) instead of truncating results

### Documentation

- Updated CLI reference, package docs, READMEs, and CLAUDE.md files for `list-release-points` command and release point history API

## [1.11.0]

### Added

- Uptime Kuma monitoring at `status.lexbuild.dev` — PM2-managed alongside Astro and Meilisearch, Caddy reverse proxy on port 3001
- `/health` endpoint for Astro app — returns `{ status: "ok" }` for uptime monitoring
- Resizable sidebar with drag handle — width persisted to localStorage, 200–500px range
- YAML/Preview toggle tabs on FrontmatterPanel with consistent styling
- Copy and download buttons moved to route pages as standalone React islands
- Comprehensive `docs/` directory — architecture, packages, development guides, CLI reference, element references, glossary, output format spec
- Deploy scripts (`scripts/deploy.sh`, `scripts/setup-secrets.sh`) with 5 deploy modes: code, content, content-only, remote pipeline, search dump/push
- Incremental search indexer with `--prune` flag for removing deleted sections

### Changed

- Move Meilisearch search proxy from `/api/search` to `/search` — frees `/api/` namespace for future Hono data API
- `MEILI_SEARCH_KEY` no longer serialized to browser in proxy mode — `BaseLayout.astro` detects proxy mode and passes `undefined` for the key prop
- `ecosystem.config.cjs` manages 3 services: `lexbuild-astro` (port 4321), `meilisearch` (port 7700), `uptime-kuma` (port 3001)
- Rename package from `@lexbuild/web` to `@lexbuild/astro`
- ThemeToggle redesigned as 3-way pill toggle (system/light/dark)
- Mobile nav uses shadcn Sheet with source dropdown

### Fixed

- React hydration mismatches on source pages — `useLayoutEffect` for localStorage reads instead of `useState` initializer
- Sidebar jiggle on source navigation — `scrollbar-gutter: stable` on scrollable area
- Sidebar hydration flash — two-div structure with outer positioning container
- Duplicate chapter directories in USC `_meta.json` — nav generator merges subchapters sharing the same directory
- Horizontal overflow on mobile viewports
- Sitemap files not copied to `dist/client/` when generated post-build
- Search routing through Caddy proxy in production — `search.ts` proxy/direct mode switch
- Shiki dark theme CSS not taking priority over defaults
- Dependabot transitive dependency vulnerabilities via `pnpm.overrides`

### Documentation

- Add comprehensive monorepo documentation in `docs/` (architecture, packages, development, reference)
- Update all CLAUDE.md files with Uptime Kuma, search migration, proxy-mode key handling, and Caddyfile formatting gotchas

## [1.10.1]

### Added

- Dark slate blue theme for dark mode — replaces default shadcn grey with blue-tinted palette (`#0e1821` background, `#182838` cards, `#243a4e` borders)
- Runtime-aware semantic CSS tokens (`bg-surface`, `text-ink-muted`, `border-border-base`, `bg-code-surface`) that auto-adapt to dark mode via `:root`/`.dark` vars
- Per-title date resolution for eCFR API downloads — each title uses its individual `up_to_date_as_of` date from the `/titles` metadata endpoint
- Retry logic with exponential backoff for transient eCFR API errors (503, 504) and network-level failures (DNS, TLS, connection reset)
- Import-in-progress detection — falls back to previous day when the eCFR API is mid-import, with clear user messaging for unavailable titles
- Hierarchical download filenames with source prefix (e.g., `usc-title-29-chapter-19-section-1001.md`)
- Layers icon as temporary favicon with `prefers-color-scheme` support
- LexBuild logo (layers icon) in header and footer
- Footer with tagline, year, and nav links (CLI, Docs, GitHub)
- Package cards on home page link to their npm pages with external-link icons
- Prettier plugin for `.astro` files (`prettier-plugin-astro`)
- Microsoft Clarity analytics

### Changed

- Redesign landing page with hero section, CLI quick start, browse sources, sample output, and packages sections
- Consistent card styling across all pages — plain HTML cards with `border-slate-blue-200 rounded-sm` instead of shadcn Card components
- Page headings use `font-display` (IBM Plex Serif) with `tracking-tight` throughout
- Switch font stack from Google Sans / JetBrains Mono to IBM Plex Serif / IBM Plex Sans / IBM Plex Mono
- Reorder header nav: U.S. Code, eCFR, CLI, Docs (content-first, external links last)
- Convert summary footer shows primary converted unit only (`Converted 60,215 sections`) instead of title count with parenthetical
- Clean up CSS variable architecture — remove 8 unused tokens, fix `--color-accent` collision with shadcn, add clear section comments documenting the two-tier color system
- Download mechanism uses `<script type="text/plain">` + Blob URL instead of `data:` URI (avoids ~2MB browser limit)
- Generate-highlights script uses forked child processes (10k files per child) instead of in-process batching to prevent OOM at 300k+ files

### Fixed

- eCFR API downloads failing with 404 when import is in progress (global date unavailable)
- eCFR Title 17 and other titles returning 503 during server-side processing — now reported clearly with retry guidance
- `fetchEcfrTitlesMeta()` errors not caught before spinner starts
- `FrontmatterPanel` labels broken by removed `--brand-slate-blue` CSS var — replaced with `var(--primary)`
- `font-regular` (invalid Tailwind utility) → `font-normal`
- `stat.value ? " " : ""` treating `0` as falsy in HierarchyIndex stats
- ThemeToggle dark `theme-color` meta mismatch (`#1b1b1f` → `#0e1821`)
- Search dialog placeholder showing literal `\u2026` instead of ellipsis
- Unused `@fontsource/google-sans` still imported after font switch — removed
- `flatted` transitive dependency vulnerability (CVE-2026-33228) via `pnpm.overrides`
- Lockfile out of sync with overrides configuration

### Documentation

- Update CLAUDE.md files with dark mode architecture, two-tier color system, card patterns, download mechanism, font stack, and eCFR API import-in-progress behavior

## [1.9.4]

### Added

- Meilisearch full-text search across USC and eCFR with Cmd+K dialog and faceted filtering (~281k sections)
- Hierarchical drill-down pages with download at every granularity level
- Mobile sidebar navigation using shadcn Sheet (Radix Dialog drawer)
- Markdown / Preview tab list for content viewing
- Incremental search indexer for Meilisearch
- Sitemap chunking (50k URL limit per file, separated by source)
- Meta tags for SEO (`apps/astro/`)

### Changed

- Refactor UI components to use shadcn/ui (radix-nova preset, zinc theme) as the design system base
- Restructure content directory to source-first layout
- Update design and layout of page sections, frontmatter, download/copy buttons, and breadcrumbs
- Sidebar styling improvements and dark mode hover states
- Search box, header, and landing page styles

### Fixed

- Add resilient `writeFile`/`mkdir` wrappers in `@lexbuild/core` with ENFILE/EMFILE retry and exponential backoff to prevent file descriptor exhaustion during large conversions
- Release token cache every 50k files to free heap during search indexing
- Garbage collect every 50k files to prevent OOM in highlight pre-rendering
- Set search index batch size to 5k (down from 50k) to prevent OOM
- Allow chapters with >100 sections to display properly in sidebar nav
- Add section titles to breadcrumbs on section pages
- Apply `toTitleCase` to USC sidebar entries
- Add error handling for Meilisearch connection issues
- Markdown/preview container word wrap and overflow fixes
- DOM-text-to-HTML validation check
- ESLint error fixes

## [1.9.3]

### Added

- Scaffold Astro 6 SSR app (`apps/astro/`) for browsing converted U.S. Code and eCFR content as Markdown, with island architecture, dark mode, and filesystem-based content serving

### Removed

- Remove `apps/web/` Next.js application from monorepo and update all references, dependencies, and documentation

### Changed

- Rename `apps/astro` package from `"astro"` to `"@lexbuild/web"` to avoid name collision with the Astro framework dependency
- Switch changeset changelog plugin from `@changesets/changelog-github` to default (no GitHub token required for local versioning)

### Fixed

- Dependabot issues: undici, eslint, pnpm-lock.yml updates

## [1.9.2]

### Changed

- Use `turbo run` instead of shorthand `turbo` in root package.json scripts per Turborepo best practices
- Change `test` task dependency from `build` (same package) to `^build` (upstream packages only) since most tests run against source, not dist
- Add transit node pattern for `lint` and `lint:fix` tasks for correct cross-package cache invalidation without sacrificing parallelism
- Add package-level `turbo.json` for `@lexbuild/cli` to override `test` task with `["build", "^build"]` since CLI tests execute the built `dist/index.js` binary
- Add package-level `turbo.json` for `apps/web` to cache `tsconfig.tsbuildinfo` output from incremental typecheck
- Exclude `.next/cache/**` from `build:web` task outputs

## [1.9.1]

### Fixed

eCFR npm publish issue via changeset and publish.yml

## [1.9.0]

### Added

#### Multi-Source Architecture

- **`@lexbuild/ecfr` package**: new source package for the Electronic Code of Federal Regulations (eCFR). Converts GPO/SGML-derived XML from govinfo bulk data into structured Markdown with the same output contract as `@lexbuild/usc`. Includes downloader, SAX-based AST builder (`EcfrASTBuilder`), converter with full feature parity, and element classification for 60+ GPO/SGML elements.
- **eCFR downloader**: fetches individual title XML files directly from `govinfo.gov/bulkdata/ECFR` (plain XML, no ZIP). Reserved Title 35 (Panama Canal) is silently skipped during `--all` downloads.
- **Four granularity modes for eCFR**: `section` (default), `part`, `chapter`, and `title`. Chapter granularity groups sections by chapter ancestor into composite files. Part is the CFR equivalent of USC chapter.
- **eCFR `_meta.json` and `README.md`**: part-level and title-level metadata indexes with section listings, token estimates, and summary READMEs — matching USC's sidecar metadata pattern.
- **Part-level authority/source enrichment**: the eCFR builder captures AUTH and SOURCE notes at the part level in a `partNotes` map during parsing. The converter enriches section frontmatter from this map.

#### CLI Commands

- **`lexbuild download-ecfr`**: download eCFR XML from govinfo with `--titles` or `--all`, spinners, and summary table.
- **`lexbuild convert-ecfr`**: convert eCFR XML with full option parity — granularity (`section`/`part`/`chapter`/`title`), link style, note filtering, dry-run, verbose output.
- **`lexbuild download-usc` / `lexbuild convert-usc`**: renamed from bare `download`/`convert` for consistency with the `{action}-{source}` naming convention.
- **Bare `download` / `convert` stubs**: running `lexbuild download` or `lexbuild convert` without a source suffix prints a helpful error listing available source-specific commands.

#### Core Multi-Source Types

- **`SourceType` and `LegalStatus` types** (`@lexbuild/core`): `source` (`"usc"` | `"ecfr"`) and `legal_status` (`"official_legal_evidence"` | `"official_prima_facie"` | `"authoritative_unofficial"`) added as required fields on `FrontmatterData`.
- **Source-specific optional fields**: `authority`, `regulatory_source`, `agency`, `cfr_part`, `cfr_subpart`, `part_count` added to `FrontmatterData` for eCFR/CFR content.
- **CFR link resolution**: `parseIdentifier()` and `fallbackUrl()` now handle `/us/cfr/` identifiers with ecfr.gov fallback URLs.
- **`FORMAT_VERSION` bumped to `"1.1.0"`** to reflect the new frontmatter fields.
- **`UslmASTBuilder` alias**: `ASTBuilder` re-exported as `UslmASTBuilder` for clarity in multi-source context.

#### Test Fixtures

- **eCFR XML fixtures** (`fixtures/fragments/ecfr/`): 7 synthetic fixtures — simple section, authority, notes, emphasis, table, title structure, appendix.
- **12 eCFR builder unit tests**: DIV/HEAD/P/AUTH/SOURCE/emphasis/hierarchy/emit-at-level/appendix coverage.

### Changed

- **File renames in `@lexbuild/core`**: `builder.ts` → `uslm-builder.ts`, `namespace.ts` → `uslm-elements.ts` — clarifies these are USLM-specific. All imports updated.
- **`parseTitles()` accepts `maxTitle` parameter**: defaults to 54 (USC), 50 for eCFR.
- **USC converter updated**: all three frontmatter construction sites now include `source: "usc"` and `legal_status` fields.
- **Snapshot files updated**: all 16 expected output files include new `source`, `legal_status`, and `format_version: "1.1.0"` fields.
- **`@lexbuild/ecfr` added to changeset lockstep**: all four packages (`core`, `usc`, `ecfr`, `cli`) versioned together.
- **Documentation overhaul**: root `README.md`, all package `README.md` files, root `CLAUDE.md`, and all package `CLAUDE.md` files updated for multi-source architecture, eCFR commands, output structures, and dependency graph.

### Fixed

- **Multi-volume title number extraction** (`ecfr-builder.ts`): eCFR titles with multiple volumes (e.g., Title 17) have multiple DIV1 elements where the `N` attribute is the volume number, not the title number. Fixed to extract from the `NODE` attribute prefix.
- **Two-pass link registration** (`ecfr/converter.ts`): restructured section granularity into true two-pass — pass 1 registers all identifiers, pass 2 renders. Forward cross-references now resolve correctly.
- **Duplicate section link registration**: removed dead code branch (`suffix && occurrence === 1` was unreachable). Canonical identifier now registered only for the first occurrence.
- **Chapter granularity double-nested paths**: `buildEcfrOutputPath` was adding `chapter-X` from ancestor lookup then again as filename, producing `title-17/chapter-I/chapter-I.md`. Fixed with early return for chapter nodes.
- **Regex backtracking vulnerability**: replaced `/\s*--Volume\s+\d+$/i` (super-linear backtracking risk) with `indexOf`-based approach in `stripLevelPrefix`.
- **ESLint clean**: resolved all 18 lint errors in the eCFR package — unused imports, non-null assertions, prefer-const, unnecessary regex escapes, useless assignments.
- **TypeScript strict compliance**: added missing `source` and `legal_status` to `FrontmatterData` test literals in `types.test.ts` and `renderer.test.ts`.

---

## [1.8.0]

### Added

#### Web App — Vercel Blob Content Provider (`apps/web/`)

- **`BlobContentProvider`** (`blob-provider.ts`): production content provider backed by Vercel Blob via the `@vercel/blob` package. The store is public, so reads do not require authentication. Uses `BLOB_READ_WRITE_TOKEN` which is auto-injected by Vercel when a Blob store is connected to the project.
- **`BlobNavProvider`** (`blob-provider.ts`): navigation provider that discovers title directories by listing blobs under the `section/usc/` prefix, then fetches and parses `_meta.json` files. Parsed metadata is cached in a module-level `Map` that persists across requests within the same serverless function instance.
- **`upload-to-blob.ts` script**: uploads the local content directory to Vercel Blob with rate limiting to prevent `429 Too Many Requests` errors.
- **`@vercel/blob` dependency**: added to `apps/web/package.json` for Blob store integration.

### Changed

- **`CONTENT_STORAGE` default for production**: switched from `s3` (Cloudflare R2) to `blob` (Vercel Blob) in `.env.production`. R2 remains available as a legacy option via `CONTENT_STORAGE=s3`.
- **Content provider factory** (`index.ts`): added `blob` case to the provider factory, selecting `BlobContentProvider`/`BlobNavProvider` when `CONTENT_STORAGE=blob`.
- **Documentation**: updated `CLAUDE.md`, `apps/web/CLAUDE.md` with Vercel Blob provider details, environment variables, and deployment workflow.

### Fixed

- **Link prefetch resource overhead** (`apps/web/`): disabled Next.js link prefetching (`prefetch={false}`) on content links to reduce unnecessary RSC prefetch requests to the content store.
- **Blob upload rate limiting**: added throttling to the upload script to prevent Vercel Blob API rate limit errors during bulk content uploads.

---

## [1.7.0]

### Added

#### Web App — Vercel Production Deployment (`apps/web/`)

- **Production deployment to Vercel** at `https://lexbuild.dev` with content served from Cloudflare R2. The site is live with all 54 USC titles, 60k+ sections, sidebar navigation, full-text search, and dark mode.
- **On-demand ISR caching** — viewer pages use empty `generateStaticParams()` + `revalidate = false` + `dynamicParams = true` for Vercel edge caching (`s-maxage=31536000`). Without this pattern, Vercel forces `max-age=0` on dynamic routes.
- **PageFind served from R2** — the search index (~61k files, ~400 MB) is too large for Vercel's static file hosting. Uploaded to R2 under `_pagefind/` prefix and loaded client-side via configurable `NEXT_PUBLIC_PAGEFIND_BASE_URL` env var (defaults to `/_pagefind` for local dev).
- **`.env.production`** (`apps/web/`): sets `CONTENT_STORAGE=s3` — committed to repo, documents production intent. No secrets.
- **Root `.vercelignore`**: excludes `downloads/`, `output/`, `apps/web/content/`, `apps/web/public/_pagefind/` to keep Vercel upload under 10 MB limit. `apps/web/public/nav/` is NOT excluded (sidebar navigation JSON is small and served directly by Vercel).
- **Deployment guide** (`.claude/deployment.md`): complete guide covering R2 public access, CORS, Vercel project setup, env vars, deploy workflow, content refresh, verification checklist, and troubleshooting.

### Changed

- **`search-dialog.tsx`**: PageFind base URL now configurable via `NEXT_PUBLIC_PAGEFIND_BASE_URL` env var instead of hardcoded `/_pagefind`.
- **`apps/web/.vercelignore`**: added `public/_pagefind/` exclusion.
- **`apps/web/.env.example`**: added `NEXT_PUBLIC_PAGEFIND_BASE_URL` entry and clarified that `CONTENT_STORAGE` is set via `.env.production`, not Vercel dashboard.
- **Viewer pages** (`usc/[title]/*`): added `generateStaticParams`, `revalidate`, and `dynamicParams` exports for on-demand ISR.
- **Documentation**: updated `CLAUDE.md`, `apps/web/CLAUDE.md` with deployment workflow, ISR caching strategy, and corrected route classification docs.

### Fixed

- **Vercel cache headers**: viewer pages returned `cache-control: max-age=0` because Vercel treated them as fully dynamic. Fixed by adding empty `generateStaticParams()` to enable ISR, which allows Vercel to respect `s-maxage` headers.
- **TypeScript build error**: `@ts-expect-error` on PageFind import became unused after switching to template literal URL. Removed the directive.

---

## [1.5.1]

### Added

#### Web App — Cloudflare R2 Content Provider (`apps/web/`)

- **`S3ContentProvider`** (`s3-provider.ts`): production content provider backed by Cloudflare R2 (or any S3-compatible store) via `@aws-sdk/client-s3`. Uses `GetObjectCommand` for file reads and `HeadObjectCommand` for existence checks, with the same `null`/`false` return contract as `FsContentProvider`.
- **`S3NavProvider`** (`s3-provider.ts`): navigation provider that discovers title directories via `ListObjectsV2Command` and fetches `_meta.json` sidecars. Title metadata fetches run in parallel via `Promise.all` to minimize cold-start latency. Both the directory listing and parsed metadata are cached at the module level for the lifetime of the serverless function instance.
- **`safeKey()` path validation**: rejects S3 keys containing `..` or not starting with an allowed prefix (`section/`, `chapter/`, `title/`), preventing path traversal via crafted URL segments. Mirrors `safePath()` in the filesystem provider.
- **Dynamic provider imports** (`index.ts`): factory functions use `await import()` so `@aws-sdk/client-s3` (~3 MB) is only loaded when `CONTENT_STORAGE=s3`, avoiding bundle size regression for local development.
- **Promise-cached singleton**: provider factory caches the initialization `Promise` itself (not the resolved value) to prevent race conditions where concurrent requests could each spawn their own provider instance.

### Changed

- **`.vercelignore`**: excludes `content/` and `downloads/` from Vercel deployments (content is now served from R2 in production).
- **`.env.example`**: added R2 configuration variables (`R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION`).
- **Documentation**: updated `apps/web/CLAUDE.md`, `apps/web/README.md`, `docs/apps/web.md`, and `.claude/deployment-guide.md` to reflect the new S3/R2 content provider, environment variables, and deployment workflow.

### Fixed

- **`workspace:*` in published packages**: all prior published versions of `@lexbuild/cli`, `@lexbuild/core`, and `@lexbuild/usc` contained literal `workspace:*` dependencies, making them uninstallable via npm. Fixed by ensuring `pnpm publish` (not `npm publish`) resolves workspace references to real version numbers.
- **Publish workflow OIDC**: switched to Node 24 and removed `registry-url` from `actions/setup-node` to enable npm OIDC trusted publishing without requiring an `NPM_TOKEN` secret.
- **`generate-content.sh` input path**: script was not passing `--input-dir` to the CLI, causing it to look for XML files relative to CWD instead of the monorepo `downloads/` directory.

---

## [1.5.0]

### Fixed

- **Notes default behavior**: documentation across 6 files incorrectly stated notes were "opt-in" / "excluded by default", but the CLI defaults `--include-notes` to `true`. Updated `docs/reference/output-format.md`, `docs/reference/cli-reference.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, and `docs/architecture/ast-model.md` to reflect the actual default.
- **Broken doc links**: docs were reorganized into subdirectories (`docs/reference/`, `docs/development/`, `docs/architecture/`) but `README.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` still referenced the old flat paths (`docs/extending.md`, `docs/output-format.md`, etc.). Updated all links to the new locations.
- **Next.js version inconsistency**: `CLAUDE.md` referenced "Next.js 15" in the Web App Notes section despite the upgrade to Next.js 16 in v1.4.0. Updated to "Next.js 16".
- **README.md docs link**: `docs/README.md` link pointed to a file that doesn't exist at that path. Changed to `docs/`.

---

## [1.4.2]

### Changed

- **GitHub repository rename**: updated all repository URLs from `chris-c-thomas/lexbuild` to `chris-c-thomas/LexBuild` across `package.json` files, `.changeset/config.json`, source code, and documentation.

---

## [1.4.1]

### Fixed

- **`@lexbuild/usc` README npm badge**: badge linked to `@lexbuild/core` instead of `@lexbuild/usc`.
- **Chapter granularity output path**: READMEs for `@lexbuild/usc`, `@lexbuild/cli`, and the monorepo root still showed the pre-1.3.0 path (`title-NN/chapter-NN.md`) instead of the corrected `title-NN/chapter-NN/chapter-NN.md`.

---

## [1.4.0]

### Changed

#### Web App (`apps/web/`)

- **Next.js 15 → 16.1.6**: upgraded framework from Next.js 15.3.3 to 16.1.6. Turbopack is now the default bundler for both `next dev` and `next build`. No breaking changes affected the app — async `params` were already in use, no middleware, no parallel routes, no custom webpack config.
- **React 19.1 → 19.2.4**: upgraded React and React DOM to 19.2.4 (includes View Transitions, `useEffectEvent`, `<Activity>` component).
- **`@types/react` → 19.2.14, `@types/react-dom` → 19.2.3**: updated type definitions to match React 19.2.
- **`next-env.d.ts` updated**: Next.js 16 auto-regenerated this file, switching from triple-slash reference to bare `import` for route types.
- **`tsconfig.json` updated**: Next.js 16 auto-set `jsx: "react-jsx"` and added `.next/dev/types/**/*.ts` to `include` (dev types now output to `.next/dev/`).
- **`CONTENT_DIR` pinned to absolute path**: changed `.env.local` from relative `./content` to absolute path to suppress Turbopack's overly broad file pattern warnings during build. Added `.env.example` for reference.

#### Documentation

- **Package-level `CLAUDE.md` files**: added `CLAUDE.md` to `packages/core/`, `packages/usc/`, and `packages/cli/` with architecture details, module structure, and package-specific conventions.
- **Root `CLAUDE.md`**: added "Package-Level Documentation" section linking to all four package/app `CLAUDE.md` files. Updated Next.js version reference from 15 to 16.
- **`apps/web/CLAUDE.md`**: updated framework version from "Next.js 15.x" to "Next.js 16.x".
- **Root `README.md`**: updated web app description to specify "Next.js 16, React 19, Tailwind CSS 4".
- **`apps/web/README.md`**: updated tech stack table to "Next.js 16 (App Router, SSR, Turbopack)" and "React 19.2".

---

## [1.3.0]

### Fixed

#### Chapter Granularity Output

- **Chapter files placed outside chapter directories**: `writeChapter()` wrote chapter `.md` files as siblings of the chapter directories (e.g., `title-01/chapter-01.md`) instead of inside them (`title-01/chapter-01/chapter-01.md`). The `_meta.json` files were already correctly placed inside the chapter directories, creating an inconsistency. Fixed the output path in `writeChapter()` to place files inside their chapter directory.
- **Empty chapter files for chapters with intermediate levels**: `writeChapter()` only iterated direct children of the chapter node looking for sections, missing all sections nested inside intermediate big levels (subchapter, part, article, etc.). This caused 521 out of 2,668 chapter files (~20%) to contain only frontmatter and a heading with no content. Added `renderChapterChildren()` helper that recursively traverses intermediate big levels, emitting structural headings and rendering all nested sections.
- **Dry-run chapter granularity misses nested sections**: the dry-run path for `granularity === "chapter"` had the same flat-iteration bug — it only checked direct children of the chapter node for sections, producing `sectionsWritten: 0` for any chapter with subchapters/parts. Added `collectChapterSectionsDryRun()` helper mirroring the recursive traversal in `renderChapterChildren()`.
- **`relativeFile` stale after path change**: `SectionMeta.relativeFile` for chapter-granularity sections was set to the bare filename (`chapter-01.md`) instead of the path relative to the title directory (`chapter-01/chapter-01.md`). Updated to include the chapter directory prefix.

### Changed

#### CLI Output

- **Granularity-aware summary table and footer**: the `convert` command's summary table columns and footer message now adapt to the chosen granularity. Section mode shows Chapters + Sections columns, chapter mode shows Chapters only, and title mode shows just Tokens + Duration. The footer reports the primary unit for the granularity (e.g., "Converted 53 titles (2,880 chapters)" for chapter mode instead of always showing section counts).
- **Single-file summary adapts to granularity**: the detailed summary block for single-file conversions now shows only relevant stats — section mode shows Sections + Chapters, chapter mode shows Chapters only, title mode shows neither.

#### Documentation

- **`CLAUDE.md`**: updated chapter granularity output path from `title-{NN}/chapter-{NN}.md` to `title-{NN}/chapter-{NN}/chapter-{NN}.md`.
- **`apps/web/CLAUDE.md`**: updated chapter content file path references in architecture summary and route documentation.

#### Web App

- **Chapter route content path**: updated `apps/web/src/app/usc/[title]/[chapter]/page.tsx` to read chapter files from the new path inside the chapter directory (`chapter/usc/{title}/{chapter}/{chapter}.md`).

---

## [1.2.0]

### Added

#### Web App (`apps/web/`)

- **Documentation site for the U.S. Code** — a server-rendered Next.js 15 application for browsing all 54 titles of the U.S. Code as structured Markdown. The site consumes LexBuild's output files (`.md` and `_meta.json`) — it has no code dependency on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`.

- **Three granularity levels** — title, chapter, and section viewer pages served via SSR with CDN caching (`s-maxage=31536000`). Three dynamic route templates handle all 63,000+ URLs.

- **Markdown / Preview toggle** — syntax-highlighted Markdown source (Shiki with `github-light`/`github-dark` dual themes) and rendered HTML preview (unified + remark + rehype pipeline with `rehype-sanitize` for defence-in-depth).

- **Sidebar navigation** — lazy-loaded per-title JSON from pre-built static files, accordion expand/collapse for titles and chapters, virtualized section lists for large chapters (> 100 entries via `@tanstack/react-virtual`).

- **Full-text search** — Pagefind-powered Cmd+K dialog indexing all 60,000+ sections via the Pagefind Node API (`addCustomRecord`). Search excerpts sanitized with DOMParser (allow `<mark>` only).

- **Dark mode** — class-based toggle using `useSyncExternalStore`, persists to `localStorage`, respects `prefers-color-scheme`. Inline `<head>` script prevents flash of wrong theme.

- **SEO** — unique `<title>` and Open Graph metadata per page, SVG favicon, `robots.txt`, sitemap with 63,000+ URLs generated from `_meta.json`.

- **shadcn/ui integration** — base-nova style, zinc theme, Geist font, CSS variables via Tailwind CSS v4. Button, theme toggle, and content viewer use shadcn primitives.

- **Content provider abstraction** — `ContentProvider` interface decouples page components from storage backend. Default `FsContentProvider` reads from local filesystem with path traversal protection (`safePath`). Swappable to S3, R2, or Vercel Blob.

- **Build scripts** — `generate-content.sh` (full pipeline: convert + nav + search + sitemap), `generate-nav.ts`, `generate-search-index.ts`, `generate-sitemap.ts`.

- **Title 53 (Reserved)** — placeholder page and nav entry for the reserved title, consistent with the OLRC website.

- **Loading skeletons** — shared `ContentSkeleton` component for title, chapter, and section route transitions.

- **Custom 404 page** — styled error page with dark mode support.

- **ESLint config** — `typescript-eslint` strict + `@next/eslint-plugin-next` + `eslint-plugin-react-hooks` (React 19 strict rules).

- **Production deployment** — `.vercelignore` for filesystem deploys, deployment guide in `.claude/deployment-guide.md`.

### Changed

- **Root `README.md`** — updated monorepo tree, replaced planned Apps section with web app description, checked off web viewer in roadmap.
- **`docs/architecture.md`** — updated Apps Layer section with web app details.
- **`docs/extending.md`** — added Existing Apps table, removed web viewer from App Ideas.
- **`apps/web/CLAUDE.md`** — trimmed completed development phases, added deployment reference and pitfalls for Tailwind v4 PostCSS, `.next` cache, and `buttonVariants` server component limitation.
- **`.changeset/config.json`** — added `web` to ignore list (private, not published).
- **`pnpm-workspace.yaml`** — added `apps/*` to workspace packages.
- **`turbo.json`** — added `build:web` and `dev:web` tasks; web app excluded from default `build` task for CI compatibility.
- **`.gitignore`** — added `apps/web/content/`, `apps/web/public/nav/`, `apps/web/public/_pagefind/`, `apps/web/public/sitemap.xml`, `apps/web/.next/`.

---

## [1.1.1]

### Fixed

- **Incomplete table cell escaping**: `renderTable` in `@lexbuild/core` only escaped pipe characters (`|`) in Markdown table cells but not backslashes, which could produce malformed tables when cell content contained backslashes. Added `escapeTableCell()` helper that escapes backslashes first, then pipes, ensuring correct Markdown output.

---

## [1.1.0]

### Added

#### Title-Level Output Granularity

- **`--granularity title`** (`-g title`): new output mode that produces a single Markdown file per title (`output/usc/title-NN.md`) containing the entire title with recursive heading hierarchy. Suitable for feeding a whole title to an LLM context window. ([`0968b27`](../../commit/0968b27))
- **Recursive heading hierarchy**: big levels (subtitle, chapter, subchapter, part, etc.) render as Markdown headings H2–H5. Structural headings beyond H5 fall back to bold text, reserving H6 exclusively for sections — ensuring sections are always visually distinct from their containing levels. ([`0968b27`](../../commit/0968b27), [`18578e8`](../../commit/18578e8))
- **Enriched title-level frontmatter**: title-mode files include `chapter_count`, `section_count`, and `total_token_estimate` fields. No sidecar `_meta.json` or `README.md` files are produced — all metadata is self-contained in YAML frontmatter. ([`0968b27`](../../commit/0968b27))
- **`FrontmatterData` extended**: `section_number` and `section_name` made optional; added optional `chapter_count`, `section_count`, `total_token_estimate` fields to `@lexbuild/core` for title-level output. ([`0968b27`](../../commit/0968b27))

#### CLI Improvements

- **Enhanced `--help` output**: all three commands (`lexbuild`, `lexbuild download`, `lexbuild convert`) now display usage examples, granularity/input-mode descriptions, and documentation links via Commander's `addHelpText()`. ([`b60c8a5`](../../commit/b60c8a5))
- **Runtime validation for `--granularity` and `--link-style`**: Commander `.choices()` now rejects invalid values at parse time with a clear error message (e.g., `argument 'foo' is invalid. Allowed choices are section, chapter, title.`). ([`18578e8`](../../commit/18578e8))

#### Testing

- **Title-granularity snapshot test**: pinned expected output in `fixtures/expected/title-granularity.md` covering frontmatter, heading hierarchy, and content rendering for title-level mode. ([`6a06243`](../../commit/6a06243))

### Fixed

- **Heading level off-by-one at depth 5**: `renderSection` adds 1 to `headingOffset`, so passing `headingOffset: headingLevel` produced H4 instead of H3 for sections inside chapters. Fixed formula to `Math.min(headingLevel - 1, 5)`. Tightened test assertions to use `toMatch(/^### §/m)` instead of `toContain`. ([`bd0ac38`](../../commit/bd0ac38))
- **Heading collision at depth 6**: structural headings (e.g., Subpart) and sibling sections both rendered at H6. Fixed by capping structural headings at H5 with bold text fallback, reserving H6 for sections. ([`18578e8`](../../commit/18578e8))
- **Shallow chapter lookup in title-level rendering**: `findChapterInParent` only checked the immediate parent, missing chapters for sections nested inside subchapters/parts. Replaced with `currentChapter` parameter threaded through recursion. Same fix applied to dry-run path in `collectSectionMetasFromTree`. ([`45007c1`](../../commit/45007c1))
- **`chapter_count` overcount**: empty `chapterIdentifier` strings counted as a distinct chapter in the Set. Fixed with `.filter(Boolean)` in both `ConvertResult` and frontmatter construction. ([`45007c1`](../../commit/45007c1), [`9643e25`](../../commit/9643e25))
- **`section_number`/`section_name` semantic confusion**: title-level output was stuffing title number/name into section-scoped frontmatter fields. Made both optional on `FrontmatterData` and omitted from title-level frontmatter. ([`45007c1`](../../commit/45007c1))
- **Appendix title naming collision**: both Title 5 and Title 5 appendix produced `title-05.md`. Fixed by using `buildTitleDirFromDocNumber()` which produces `title-05-appendix.md` for appendix documents. ([`db9bf75`](../../commit/db9bf75))
- **Token estimate inconsistency**: `ConvertResult.totalTokenEstimate` was based on per-section content lengths (excluding structural headings), while `total_token_estimate` in frontmatter used the full body. Both now use the accurate full-body estimate for title granularity. ([`08053cc`](../../commit/08053cc), [`18578e8`](../../commit/18578e8))
- **`writeWholeTitle` null return type**: function always returns a result but was typed `Promise<WriteTitleResult | null>` with an unnecessary null guard at the call site. Removed the dead `| null`. ([`0672a8b`](../../commit/0672a8b))
- **Orphaned JSDoc blocks**: removed 3 stale JSDoc comments left behind during refactoring. ([`1faf32a`](../../commit/1faf32a))

### Changed

- **Documentation updates**: updated root `README.md` (title-level examples, consolidated CLI reference tables), package READMEs, `docs/output-format.md` (title-level directory layout, frontmatter schema, heading hierarchy examples with bold text fallback, memory note), `docs/architecture.md`, and `CLAUDE.md` (streaming output caveat for title mode). ([`78d437f`](../../commit/78d437f), [`6e50a6f`](../../commit/6e50a6f), [`f33a033`](../../commit/f33a033))
- **Publish workflow**: disabled automatic GitHub Releases creation in changeset action. ([`e15fea5`](../../commit/e15fea5))

---

## [1.0.5]

### Fixed

- **Package files**: Fixed `README.md` file.

## [1.0.4]

### Fixed

- **Package files**: Fixed `package.json` and `README.md` files.

## [1.0.3]

### Updated

- **Package files**: Updated `package.json` and `README.md` files.

## [1.0.2]

### Fixed

- **Package `package.json` files**: Fixed links in `package.json` files for `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/cli`.

## [1.0.1]

### Added

- **Package `README.md` files**: add `README.md` files to `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/cli`.

## [1.0.0]

### Changed

- **Stable release**: first public release of `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/cli` to npm.
- **Renamed project**: `law2md` → `lexbuild` with `@lexbuild/` scoped packages.
- **Package metadata**: added `publishConfig`, `sideEffects`, per-package keywords, and repository fields.

## [0.7.1]

### Changed

- **Organization**: General repository maintenance and cleanup.

## [0.7.0]

### Added

- **`convert --all` flag**: converts all downloaded titles found in `--input-dir` instead of requiring an explicit `--titles` spec. Scans the input directory for `usc{NN}.xml` files and converts whatever is present — works with partial downloads (e.g., only titles 1, 3, 9, 10).
- **Bulk download for `download --all`**: when downloading all 54 titles, the downloader now fetches a single `xml_uscAll@{releasePoint}.zip` instead of making 54 individual HTTP requests. Falls back to per-title downloads if the bulk zip is unavailable. No CLI changes — same `--all` flag, same output.

### Fixed

- **Spurious root dependency**: removed accidental `"dependencies": { "lexbuild-monorepo": "link:" }` from root `package.json`

### Changed

- **`.gitignore` cleanup**: removed duplicate patterns, consolidated editor/OS/package-manager sections, fixed a bare comment parsed as a pattern
- **CLAUDE.md reference materials**: replaced local file paths (`docs/reference/uslm/`) with public OLRC URLs for the user guide PDF and schema zip
- **Removed `.gitkeep` files**: `fixtures/expected/.gitkeep` and `fixtures/fragments/.gitkeep` no longer needed

## [0.6.0]

### Changed

#### Compact Multi-Title Convert Output

- **Compact summary table for `convert --titles`**: multi-title conversions now display a single data table (one row per title) with columns for Title, Name, Sections, Chapters, Tokens, and Duration — plus a bold totals row — instead of printing a full summary block per title. Matches the download command's compact table pattern. Single-file mode (`convert <input>`) retains the detailed per-title summary block. ([`cf19a5e`](../../commit/cf19a5e))
- **Title names in output**: `ConvertResult.titleName` now uses the XML `<heading>` element (e.g., "GENERAL PROVISIONS", "LABOR") instead of `dc:title` (which only contains "Title N"). Affects both the convert summary table and single-file summary block. ([`cf19a5e`](../../commit/cf19a5e))

### Fixed

- **Table horizontal rules too narrow**: `cli-table3` border characters `top-mid`, `bottom-mid`, and `mid-mid` were `""` (0 chars) while the column separator `middle` was `"  "` (2 chars), causing horizontal rules to be `2*(N-1)` characters narrower than content rows. Fixed by setting mid-intersection chars to `"──"`. Affects both `summaryBlock()` and `dataTable()` in download and convert output. ([`cf19a5e`](../../commit/cf19a5e))
- **Filename zero-padding resolution**: `resolveUscXmlPath()` now correctly handles `noUncheckedIndexedAccess` for the regex match group ([`5a45455`](../../commit/5a45455))

---

## [0.5.0]

### Added

#### Multi-Title Selection

- **`--titles <spec>` option** on both `download` and `convert` commands: supports single numbers (`29`), comma-separated lists (`1,3,8,11`), ranges (`1-5`), and mixed formats (`1-5,8,11`). Replaces the single-title `--title <n>` option on download. ([`3a29a8e`](../../commit/3a29a8e))
- **`--input-dir <dir>` option** on `convert` command: specifies the directory containing USC XML files when using `--titles` (default: `./downloads/usc/xml`) ([`3a29a8e`](../../commit/3a29a8e))
- **Multi-title convert output**: per-title summary tables with progress labels (`"Converting Title 1 (1/5)..."`) followed by an aggregate footer (`"Converted 5 titles (2,450 sections) in 3.2s"`) ([`3a29a8e`](../../commit/3a29a8e))
- **`parseTitles()` utility** (`packages/cli/src/parse-titles.ts`): title spec parser with validation (1-54 range, ascending ranges, deduplication, sorting) and 23 unit tests ([`3a29a8e`](../../commit/3a29a8e))

### Changed

- **`convert` command**: `<input>` argument is now optional — use either a file path or `--titles` ([`3a29a8e`](../../commit/3a29a8e))
- **`download` command**: `--title <n>` replaced by `--titles <spec>` ([`3a29a8e`](../../commit/3a29a8e))

---

## [0.4.1]

### Added

#### Terminal UI

- **Polished CLI output** (`packages/cli/src/ui.ts`): `chalk`, `ora`, and `cli-table3` for spinners, formatted summary blocks, and data tables in download and convert commands ([`a182dbe`](../../commit/a182dbe))

### Fixed

- **Default download/output locations**: adjusted default paths for `--output` on download and convert commands ([`9e15faf`](../../commit/9e15faf), [`5cbffd5`](../../commit/5cbffd5))

### Changed

- **Documentation cleanup**: renamed/reorganized docs, removed reference development docs, updated README with OLRC user guide details ([`52afb03`](../../commit/52afb03), [`0fc4a7e`](../../commit/0fc4a7e))

---

## [0.4.0] — Phase 4: Polish & Publish

### Added

#### Snapshot Tests

- **Output stability tests** (`packages/usc/src/snapshot.test.ts`): 15 pinned snapshot tests using vitest `toMatchFileSnapshot()` covering all 7 fragment fixtures — simple sections, subsections, notes filtering (all/none/amendments-only/statutory-only), XHTML tables, USLM layout tables, duplicate sections, and status sections (repealed/transferred/reserved/current). Run `vitest --update` to regenerate after intentional changes. ([`23917e8`](../../commit/23917e8))
- **15 expected output files** in `fixtures/expected/` with descriptive names replacing stale Phase 1 snapshots ([`23917e8`](../../commit/23917e8))

#### Title-Level README.md Generation

- **`README.md` in each title output directory**: generated alongside `_meta.json` during convert with title heading, stats table (positive law, currency, chapters, sections, estimated tokens, granularity), chapter listing with section counts and directory links ([`79f1189`](../../commit/79f1189))
- **Fixed `title_name` in `_meta.json`**: now uses XML `<heading>` element instead of `dc:title` (which only contains "Title N"), consistent with section frontmatter ([`79f1189`](../../commit/79f1189))

#### Documentation

- **CONTRIBUTING.md**: contributor guide covering setup, development workflow, code conventions, testing (including snapshot update process), PR checklist, and changesets workflow ([`07da9e0`](../../commit/07da9e0))
- **Phase 4 handoff**: `docs/handoffs/phase4.md` with task list, decisions, and technical notes ([`b18c8aa`](../../commit/b18c8aa))

#### CI/CD

- **GitHub Actions CI** (`.github/workflows/ci.yml`): lint, typecheck, and test on push to main and pull requests. Node 20/22 matrix, pnpm store caching, concurrency groups. ([`b8f45a7`](../../commit/b8f45a7))
- **npm publish workflow** (`.github/workflows/publish.yml`): changeset-based publish via `changesets/action@v1`. Creates version PR when changesets pending, publishes `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/cli` to npm when version PR merged. Requires `NPM_TOKEN` secret. ([`ef8d3b2`](../../commit/ef8d3b2))

### Changed

- **README.md**: updated for public launch — CI badge, npm install instructions, `lexbuild` command in usage examples, Phase 4 status complete, test count 121→137, link to CONTRIBUTING.md ([`d33e1ff`](../../commit/d33e1ff))

---

## [0.3.0] — Phase 3: Scale & Download

### Added

#### OLRC Downloader

- **Downloader** (`packages/usc/src/downloader.ts`): `downloadTitles()` fetches USC XML zips from OLRC, extracts via `yauzl`, cleans up temp files. Hardcoded `CURRENT_RELEASE_POINT` with `--release-point` override for future automation. ([`69444bc`](../../commit/69444bc))
- **`lexbuild download` command** (`packages/cli/src/commands/download.ts`): `--title N` for individual titles, `--all` for all 54, `-o` for output directory. Reports per-title file sizes and elapsed time. ([`1743e7c`](../../commit/1743e7c))

#### Dry-Run Mode

- **`--dry-run` flag** on convert command: parses XML and walks AST for structure estimation without writing files. Reports chapters, sections, estimated tokens, timing, and peak memory. ([`c043bf0`](../../commit/c043bf0))

#### Progress Reporting

- **Peak memory tracking** via `process.memoryUsage.rss()` sampled at parse and write phases. Token estimates and peak memory shown in verbose mode; chapter count shown in standard output. ([`a2030fe`](../../commit/a2030fe))

#### Appendix Title Handling

- **Appendix output directories**: titles with appendices (5a, 11a, 18a, 28a) write to separate directories (e.g., `title-05-appendix/`). Detected via `docNumber` format or `<appendix>` ancestor. ([`6c25445`](../../commit/6c25445))
- **Chapter-equivalent containers**: `<compiledAct>` and `<reorganizationPlan>` elements treated as chapter-level directories with slugified headings. ([`6c25445`](../../commit/6c25445))

#### Edge Cases

- **Duplicate section disambiguation**: sections sharing the same number within a chapter (e.g., Title 5 §3598, §5757) produce separate files with `-2` suffix (`section-3598.md`, `section-3598-2.md`). Both listed in `_meta.json`. ([`47d3879`](../../commit/47d3879))
- **Status in frontmatter and `_meta.json`**: sections with `status` attributes (repealed, reserved, transferred, etc.) include status in YAML frontmatter. All sections report status in `_meta.json` (defaulting to `"current"`). ([`47d3879`](../../commit/47d3879))

#### Test Fixtures

- `fixtures/fragments/duplicate-sections.xml` — synthetic Title 5 with duplicate section numbers ([`47d3879`](../../commit/47d3879))
- `fixtures/fragments/section-with-status.xml` — sections with repealed/transferred/reserved status ([`47d3879`](../../commit/47d3879))

### Performance

- **E2E all 54 titles**: 58 files (54 titles + 4 appendices), 60,261 sections, 25 seconds total, zero failures
- **Memory profiling**: Title 26 (53MB XML) → 401 MB peak RSS / 1.14s; Title 42 (107MB XML) → 661 MB peak RSS / 2.85s

---

## [0.2.0] — Phase 2: Content Fidelity

### Added

#### Cross-Reference Link Resolution

- **Link resolver** (`src/markdown/links.ts`): `parseIdentifier()` parses USLM URIs into components, `createLinkResolver()` provides register/resolve/fallback for cross-reference resolution within the output corpus ([`6e18acf`](../../commit/6e18acf))
- **Three link modes**: `--link-style plaintext` (default, display text only), `--link-style canonical` (OLRC website URLs for USC refs), `--link-style relative` (relative file paths within the output tree) ([`6e18acf`](../../commit/6e18acf))
- **Two-pass resolution**: converter registers all section paths after parsing, then renders with resolver available for intra-title cross-references ([`6e18acf`](../../commit/6e18acf))

#### Table Conversion

- **XHTML table conversion**: `TableCollector` in the AST builder captures `xhtml:table/thead/tbody/tr/th/td` structure and produces Markdown pipe tables with header rows, column count normalization, and pipe escaping ([`8549930`](../../commit/8549930))
- **USLM layout table conversion**: `layoutCollector` handles `<layout>/<header>/<row>/<tocItem>/<column>` elements used in TOC structures and tabular notes, rendered by the same Markdown table renderer ([`fed17d6`](../../commit/fed17d6))

#### Notes Filtering

- **`NotesFilter`** interface in the renderer classifies notes by topic: amendments/effectiveDateOfAmendment/shortTitleOfAmendment → amendments; codification/dispositionOfSections → editorial; changeOfName/regulations/miscellaneous/repeals/separability/crossReferences → statutory ([`0a67096`](../../commit/0a67096))
- **CLI flags**: `--no-include-notes` (exclude all), `--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments` — selective flags auto-switch from "include all" to "selected only" mode ([`0a67096`](../../commit/0a67096))

#### Metadata Indexes

- **`_meta.json` sidecar files** at title and chapter levels after all sections are written ([`8fe9689`](../../commit/8fe9689))
- **Title-level index**: format_version, generator, generated_at, identifier, title info, stats (chapter_count, section_count, total_tokens_estimate), chapters array with nested section listings ([`8fe9689`](../../commit/8fe9689))
- **Chapter-level index**: identifier, chapter_number, chapter_name, section_count, sections array with token_estimate, has_notes, and status fields ([`8fe9689`](../../commit/8fe9689))

#### Chapter-Level Granularity

- **`--granularity chapter`** CLI option outputs one file per chapter (`chapter-NN.md`) with sections inlined as H2 headings instead of individual section files ([`0457994`](../../commit/0457994))

#### Test Fixtures

- `fixtures/fragments/section-with-table.xml` — section with 3-column XHTML table ([`8549930`](../../commit/8549930))
- `fixtures/fragments/section-with-layout.xml` — section with layout table + chapter TOC ([`fed17d6`](../../commit/fed17d6))
- `fixtures/fragments/section-with-notes.xml` — section with editorial + statutory notes for filtering tests ([`0a67096`](../../commit/0a67096))

### Fixed

- **Extra blank lines in content rendering**: multiple `<p>` elements inside `<content>` produced triple-spaced paragraphs. Fixed by skipping whitespace-only text events between `<p>` elements in the builder and adding `normalizeWhitespace()` in the renderer to collapse multi-newline runs. ([`6e18acf`](../../commit/6e18acf))
- **Collector zone ordering in AST builder**: table, layout, and toc collector checks were positioned after normal element handlers (level, content, inline). This caused `<ref>`, `<note>`, and other elements inside `<toc>/<layout>/<column>` to create stale stack frames via the normal handlers instead of routing to the collectors. Moved all collector checks before normal handlers. This was essential for chapter-level granularity and also improves section-level correctness. ([`0457994`](../../commit/0457994))

### Changed

- **Versioning setup**: added `@changesets/cli` with lockstep versioning across all packages, version read from `package.json` dynamically in CLI and frontmatter generator ([`87e869e`](../../commit/87e869e))

---

## [0.1.0] — Phase 1: Foundation

### Added

#### Scaffold

- **Monorepo scaffold** with pnpm workspaces, Turborepo pipeline (build/test/lint/typecheck/dev), and three packages: `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/cli` (CLI) ([`9f55906`](../../commit/9f55906))
- **TypeScript 5.x strict mode** with `tsup` (ESM-only) builds, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` ([`9f55906`](../../commit/9f55906))
- **ESLint** flat config with `typescript-eslint` strict + Prettier integration ([`9f55906`](../../commit/9f55906))
- **Vitest** per-package test configs with co-located test files ([`9f55906`](../../commit/9f55906))
- **Fixture directories**: `fixtures/xml/` (gitignored, user-provided USC XML), `fixtures/fragments/` (synthetic test XML), `fixtures/expected/` (output snapshots) ([`9f55906`](../../commit/9f55906))

#### Core (`@lexbuild/core`)

- **XML Parser** (`src/xml/parser.ts`): streaming SAX parser wrapping `saxes` with namespace normalization — USLM default namespace elements emit bare names (`section`), other namespaces emit prefixed names (`xhtml:table`, `dc:title`). Supports `parseString()` and `parseStream()`. ([`120a553`](../../commit/120a553))
- **Namespace constants** (`src/xml/namespace.ts`): `USLM_NS`, `XHTML_NS`, `DC_NS`, `DCTERMS_NS`, `XSI_NS`, plus element classification sets (`LEVEL_ELEMENTS`, `CONTENT_ELEMENTS`, `INLINE_ELEMENTS`, `NOTE_ELEMENTS`, etc.) ([`120a553`](../../commit/120a553))
- **AST node types** (`src/ast/types.ts`): `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `SourceCreditNode`, `TableNode`, `TOCNode`, `NotesContainerNode`, `QuotedContentNode`, plus `AncestorInfo`, `DocumentMeta`, `EmitContext`, `FrontmatterData` context types ([`120a553`](../../commit/120a553))
- **AST Builder** (`src/ast/builder.ts`): stack-based XML-to-AST construction with section-emit pattern — emits completed section subtrees via callback for bounded memory usage. Handles levels, content blocks, inline formatting, refs, notes, source credits, quoted content, and metadata extraction from `<meta>`. ([`47cf7a9`](../../commit/47cf7a9))
- **Markdown Renderer** (`src/markdown/renderer.ts`): stateless AST-to-Markdown conversion with bold inline numbering for subsections (not headings), three cross-reference link modes (plaintext/canonical/relative), source credits after horizontal rule, notes with H2/H3 headings, and blockquote rendering for quoted content ([`9c7189d`](../../commit/9c7189d))
- **Frontmatter Generator** (`src/markdown/frontmatter.ts`): `FrontmatterData` to YAML serialization with controlled field ordering, `format_version` ("1.0.0"), and `generator` metadata ([`9c7189d`](../../commit/9c7189d))

#### USC (`@lexbuild/usc`)

- **USC Converter** (`src/converter.ts`): full pipeline orchestrator for a single USC XML file — ReadStream → SAX parser → AST builder (emit at section) → Markdown renderer + frontmatter → file writer. Outputs to `usc/title-NN/chapter-NN/section-N.md`. Supports source credit toggling. Uses collect-then-write pattern to avoid async issues during SAX streaming. ([`eb22560`](../../commit/eb22560))

#### CLI (`lexbuild`)

- **`lexbuild convert` command** (`src/commands/convert.ts`): accepts input XML path, output directory, link style, and source credit toggle. Validates input, reports timing and section count, supports verbose mode. ([`2147c05`](../../commit/2147c05))

#### Documentation

- **CLAUDE.md**: project overview, tech stack, build commands, code conventions, USLM schema reference, design decisions ([`11de6db`](../../commit/11de6db), [`28f3d6c`](../../commit/28f3d6c))
- **DEVELOPMENT_PLAN.md**: 4-phase plan, architecture, CLI spec, element mapping, risk register ([`11de6db`](../../commit/11de6db))
- **ARCHITECTURE.md**: system overview, package dependency graph, data flow, interface specs ([`11de6db`](../../commit/11de6db))
- **OUTPUT_FORMAT.md**: directory layout, frontmatter schema, content structure, notes rendering, RAG guidance ([`11de6db`](../../commit/11de6db))
- **XML_ELEMENT_REFERENCE.md**: element-by-element conversion reference with attributes and Markdown output ([`11de6db`](../../commit/11de6db), [`28f3d6c`](../../commit/28f3d6c))
- **EXTENDING.md**: guide for adding new legal source types ([`11de6db`](../../commit/11de6db))
- **USLM reference materials**: user guide PDF, XSD schemas (1.0, 1.0.15), CSS stylesheet, Dublin Core schemas ([`6f08a5a`](../../commit/6f08a5a))
- **Phase 1 handoff**: `docs/handoffs/phase1.md` with architecture summary, test coverage, bugs fixed, known limitations ([`fc60c65`](../../commit/fc60c65))

#### Test Fixtures

- `fixtures/fragments/simple-section.xml` — minimal title/chapter/section ([`120a553`](../../commit/120a553))
- `fixtures/fragments/section-with-subsections.xml` — section with (a)(b)(c) subsections ([`120a553`](../../commit/120a553))
- `fixtures/expected/section-2.md` — expected output snapshot for simple section ([`966b6f5`](../../commit/966b6f5))
- `fixtures/expected/section-7.md` — expected output snapshot for section with subsections + notes ([`966b6f5`](../../commit/966b6f5))

### Fixed

- **Quoted content sections emitted as standalone files**: `<section>` elements inside `<quotedContent>` (quoted bills in statutory notes) were being emitted as standalone Markdown files, causing overwrites. Fixed by tracking `quotedContentDepth` in the AST builder and suppressing emission when inside quotes. ([`966b6f5`](../../commit/966b6f5))
- **Cross-heading note headings empty**: `<heading><b>Editorial Notes</b></heading>` pattern caused empty heading text because the `<b>` inline element captured text in its own frame. Fixed by adding `bubbleTextToCollector()` that propagates text from inline frames up to parent heading/num collector frames. ([`966b6f5`](../../commit/966b6f5))

### Changed

- **Barrel exports cleaned up**: removed legacy `USLM_NAMESPACE` / `XHTML_NAMESPACE` / `DC_NAMESPACE` / `DCTERMS_NAMESPACE` aliases from `@lexbuild/core`. Use `USLM_NS`, `XHTML_NS`, `DC_NS`, `DCTERMS_NS` instead. ([`d42bb21`](../../commit/d42bb21))
