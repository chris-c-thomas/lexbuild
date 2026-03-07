# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

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
