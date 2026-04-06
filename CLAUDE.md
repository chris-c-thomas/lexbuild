# CLAUDE.md — LexBuild

## Project Overview

LexBuild converts U.S. legal source data into structured Markdown for AI/RAG ingestion. It currently supports federal sources: U.S. Code (USLM schema), eCFR (GPO/SGML-derived XML), and Federal Register (FederalRegister.gov API), with an architecture designed for additional sources at the federal (public laws, congressional bills), state, and local level. It is a monorepo built with Turborepo, pnpm workspaces, TypeScript, and Node.js.

## Repository Structure

```
lexbuild/
├── packages/
│   ├── core/        # @lexbuild/core — XML parsing, AST, Markdown rendering, shared utilities
│   ├── usc/         # @lexbuild/usc — U.S. Code-specific element handlers and downloader
│   ├── ecfr/        # @lexbuild/ecfr — eCFR (Code of Federal Regulations) converter and downloader
│   ├── fr/          # @lexbuild/fr — Federal Register converter and downloader
│   └── cli/         # @lexbuild/cli — CLI binary (the published npm package users install)
├── apps/
│   ├── astro/       # LexBuild web app — Astro 6, SSR, browse U.S. Code + eCFR as Markdown
│   └── api/         # @lexbuild/api — Data API (Hono, SQLite, Meilisearch proxy)
├── scripts/
│   ├── deploy.sh              # Production deploy (code, content, or full remote pipeline)
│   ├── update.sh              # Unified incremental content update (all sources)
│   ├── update-ecfr.sh         # eCFR incremental update (auto-detects changed titles)
│   ├── update-fr.sh           # FR incremental update (date-range based)
│   ├── update-usc.sh          # USC incremental update (release point detection)
│   ├── ecfr-changed-titles.ts # eCFR change detection helper (API metadata vs checkpoint)
│   ├── setup-secrets.sh       # Initialize ~/.lexbuild-secrets on VPS
│   └── .deploy.env.example    # Template for .deploy.env (VPS_HOST config)
├── downloads/
│   ├── usc/
│   │   └── xml/     # Full USC XML files (usc01.xml ... usc54.xml) — gitignored
│   ├── ecfr/
│   │   └── xml/     # Full eCFR XML files (ECFR-title1.xml ... ECFR-title50.xml) — gitignored
│   └── fr/          # FR XML + JSON files (YYYY/MM/doc-number.xml/.json) — gitignored
├── fixtures/
│   ├── fragments/   # Small synthetic XML snippets for unit tests
│   └── expected/    # Expected output snapshots for integration tests
├── turbo.json       # Turborepo pipeline config
└── CLAUDE.md        # This file
```

## Package-Level Documentation

Each package and app has its own `CLAUDE.md` with architecture details, module structure, and package-specific conventions:

- [`packages/core/CLAUDE.md`](packages/core/CLAUDE.md) — XML→AST→Markdown pipeline, emit-at-level streaming, AST node types, rendering, link resolution, resilient filesystem utilities
- [`packages/usc/CLAUDE.md`](packages/usc/CLAUDE.md) — Collect-then-write pattern, granularity output, edge cases (duplicates, appendices), downloader
- [`packages/ecfr/CLAUDE.md`](packages/ecfr/CLAUDE.md) — eCFR GPO/SGML XML→AST→Markdown, DIV-based hierarchy, element classification, downloader
- [`packages/fr/CLAUDE.md`](packages/fr/CLAUDE.md) — Federal Register XML→AST→Markdown, document-centric structure, dual JSON+XML ingestion, API downloader
- [`packages/cli/CLAUDE.md`](packages/cli/CLAUDE.md) — Commands, options, UI module, title parser, build config
- [`apps/astro/CLAUDE.md`](apps/astro/CLAUDE.md) — Astro 6 SSR site, island architecture, multi-source content browser, deployment
- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) — Data API (Hono + SQLite + Meilisearch), endpoints, rate limiting, deployment

## Additional Project Instructions and References

- [`.claude/rules/conventions.md`](.claude/rules/conventions.md) — Coding conventions, architectural rules, and quality standards for the LexBuild monorepo
- [`.claude/reference/uslm-xml-user-guide.md`](.claude/reference/uslm-xml-user-guide.md) — USLM XML user guide
- [`.claude/reference/uslm-schema/`](.claude/reference/uslm-schema/) — USLM XML schema reference files (XSD, documentation)
- [`.claude/reference/ecfr-xml-user-guide.md`](.claude/reference/ecfr-xml-user-guide.md) — Electronic Code of Federal Regulations XML user guide
- [`.claude/reference/fr-xml-user-guide.md`](.claude/reference/fr-xml-user-guide.md) — Federal Register XML User Guide
- [`.claude/reference/cfr-xml-user-guide.md`](.claude/reference/cfr-xml-user-guide.md) — Code of Federal Regulations XML user guide
- [`.claude/reference/bills-xml-user-guide.md`](.claude/reference/bills-xml-user-guide.md) — Bills XML user guide
- [`.claude/reference/bills-summary-xml-user-guide.md`](.claude/reference/bills-summary-xml-user-guide.md) — Bills Summary XML user guide
- [`.claude/llms/`](.claude/llms/) - Various llms.txt files for Cloudflare, Astro, Hono, and Scalar

## Tech Stack

- **Runtime**: Node.js >= 22 LTS (ESM)
- **Language**: TypeScript 5.x, strict mode, no `any` unless explicitly justified
- **XML Parsing**: `saxes` (SAX streaming)
- **CLI**: `commander`
- **CLI Output**: `chalk`, `ora`, `cli-table3`
- **Fonts**: IBM Plex Sans (body), Serif (display), Mono (code) — self-hosted via `@fontsource`. No other font families.
- **YAML**: `yaml` package
- **Zip**: `yauzl`
- **Token Counting**: character/4 heuristic
- **Testing**: `vitest`
- **Build**: `tsup`
- **Linting**: ESLint + `@typescript-eslint`
- **Unused code detection**: `knip` (config: `knip.jsonc` — must use this exact filename, not `knip.config.jsonc`)
- **Formatting**: Prettier (double quotes, trailing commas, 100 char print width)
- **Monorepo**: Turborepo + pnpm workspaces
- **Versioning**: `@changesets/cli` with lockstep versioning across all packages
- **Root and Astro app versions are manually synced** with published packages. After changesets bump `packages/*` to a new version, also update `version` in root `package.json` and `apps/astro/package.json` to match, and add a corresponding entry to root `CHANGELOG.md`.

## Build & Dev Commands

```bash
# Core monorepo commands (from repo root)
pnpm install
pnpm turbo build                                  # Build all packages
pnpm turbo build --filter=@lexbuild/core           # Build specific package
pnpm turbo test                                    # Run all tests
pnpm turbo test --filter=@lexbuild/usc             # Test specific package
pnpm turbo typecheck
pnpm turbo lint
pnpm turbo dev                                     # Watch + rebuild

# Run the CLI locally (build first)
node packages/cli/dist/index.js download-usc --all
node packages/cli/dist/index.js convert-usc --all
node packages/cli/dist/index.js download-ecfr --all
node packages/cli/dist/index.js convert-ecfr --all
node packages/cli/dist/index.js download-fr --recent 30
node packages/cli/dist/index.js convert-fr --all
node packages/cli/dist/index.js enrich-fr --from 2000-01-01  # Only needed for govinfo bulk downloads
node packages/cli/dist/index.js list-release-points

# Astro app — NOT included in default `pnpm turbo build`
pnpm turbo dev:astro --filter=@lexbuild/astro      # Dev server (http://localhost:4321)
pnpm turbo build:astro --filter=@lexbuild/astro    # Production build

# Data API — NOT included in default `pnpm turbo build`
pnpm turbo dev:api --filter=@lexbuild/api          # Dev server (http://localhost:4322)
pnpm turbo build:api --filter=@lexbuild/api        # Production build

# Deploy to production VPS (from monorepo root)
./scripts/deploy.sh                # Code only (git pull, build, pm2 reload)
./scripts/deploy.sh --content      # Code + rsync local output/ to VPS
./scripts/deploy.sh --content-only # Rsync only, no code deploy
./scripts/deploy.sh --remote       # Full pipeline on VPS (download + convert + build)
./scripts/deploy.sh --api                        # Deploy API code (git pull, build:api, pm2 reload)
./scripts/deploy.sh --api-db                     # Sync lexbuild.db to VPS + reload API
./scripts/deploy.sh --api-full                   # API code + database sync + reload
./scripts/deploy.sh --search-docker              # Build search index in Docker, transfer to VPS
./scripts/deploy.sh --search-docker --source fr   # Incremental: index one source into existing volume
./scripts/deploy.sh --search-docker-seed          # Seed Docker volume from VPS (recover after volume loss)

# Incremental content updates (from monorepo root)
./scripts/update.sh                                # All sources incrementally
./scripts/update.sh --source ecfr                  # One source
./scripts/update.sh --skip-deploy                  # Local only
./scripts/update-ecfr.sh                           # eCFR only (auto-detects changed titles)
./scripts/update-ecfr.sh --titles 1,17             # Specific eCFR titles
./scripts/update-fr.sh --days 3                    # FR last 3 days
./scripts/update-usc.sh                            # USC (checks for new release point)
```

See `packages/cli/CLAUDE.md` for full command options. See `apps/astro/CLAUDE.md` for content pipeline scripts.

### CI / Release

- **Publish workflow** (`.github/workflows/publish.yml`): Uses `changesets/action` with `commitMode: github-api` and a GitHub App token (`lexbuild-release-bot`) for verified commits that satisfy branch protection. Secrets: `RELEASE_BOT_APP_ID`, `RELEASE_BOT_PRIVATE_KEY` (repo secrets).

### Astro App

The Astro app (`apps/astro/`) is deployed to a self-managed VPS (AWS Lightsail) behind Cloudflare's edge cache. It has **no code dependency** on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`. See `apps/astro/CLAUDE.md` for the full architecture spec.

- **Excluded from `pnpm turbo build`** — no `build` script in its `package.json` (only `build:astro`). Prevents CI failures since the app requires content files that aren't in git.
- **Excluded from changesets** — `"private": true` and listed in `.changeset/config.json` `ignore`.
- **Content is gitignored** — `apps/astro/content/`, `public/nav/`, `public/sitemap.xml`, `*.highlighted.html` are all generated artifacts.

### Data API

The Data API (`apps/api/`) serves legal content programmatically at `https://lexbuild.dev/api/`. Hono + SQLite + Meilisearch. See `apps/api/CLAUDE.md` for the full spec.

- **Excluded from `pnpm turbo build`** — uses `build:api` (same pattern as Astro app)
- **Excluded from changesets** — `"private": true`
- **Two SQLite databases**: `lexbuild.db` (content, read-only, rebuilt by `lexbuild ingest`) and `lexbuild-keys.db` (API keys, read-write, persists across re-ingestion)
- **`better-sqlite3` native bindings are platform-specific** — macOS binaries don't work on Linux. Run `pnpm install` on the VPS after code deployment.
- **API port 4322 is not exposed in the Lightsail firewall** — traffic reaches the API through Caddy (ports 80/443). Same pattern as Meilisearch on 7700.
- **VPS needs `build-essential` for `better-sqlite3`** — `sudo apt-get install -y build-essential`. Required once for native addon compilation.

## Code Conventions

### TypeScript

- pnpm workspaces with `workspace:*` protocol for internal deps
- **Transitive dependency vulnerabilities**: Dependabot cannot update transitive deps in pnpm monorepos. Use `pnpm.overrides` in root `package.json` (e.g., `"flatted": "^3.4.2"`). Use `^` ranges (not `>=`) for determinism.
- **`pnpm.overrides` version-range selectors**: Use `"picomatch@^2": "^2.3.2"` to target a specific major version range when a transitive dep exists at multiple majors (e.g., picomatch v2 from changesets and picomatch v4 from astro). Without the `@^2` selector, the override applies to all versions and can break packages expecting a different major.
- ESM only (`"type": "module"` in all package.json files)
- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Use `import type` for type-only imports
- Prefer `interface` over `type` for object shapes (better error messages, declaration merging)
- All exported functions and types must have JSDoc comments
- Use `unknown` over `any`; if `any` is truly needed, add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why
- Barrel exports via `index.ts` in each package `src/`

### Naming

- Project name: "LexBuild" in prose/descriptions/titles. Lowercase `lexbuild` only for package names (`@lexbuild/*`), CLI commands (`lexbuild convert-usc`), URLs, directory paths, and code identifiers.
- CLI commands follow `{action}-{source}` pattern: `download-usc`, `convert-usc`, `download-ecfr`, `convert-ecfr`. Bare `download`/`convert` commands show a source selection error.
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase` (e.g., `SectionNode`, `ConvertOptions`)
- Functions: `camelCase` (e.g., `parseIdentifier`, `renderSection`)
- Constants: `UPPER_SNAKE_CASE` for true constants (e.g., `USLM_NAMESPACE`)
- Enum-like objects: `PascalCase` keys using `as const` satisfies pattern

### Error Handling

- Use custom error classes extending `Error` with `cause` chaining
- **`preserve-caught-error` lint rule** (from `tseslint.configs.strict`): When re-throwing errors in catch blocks, always attach `{ cause: err }` to the new Error. E.g., `throw new Error("context message", { cause: err })`.
- XML parsing errors: warn and continue (log malformed elements, don't crash on anomalous structures)
- File I/O errors: throw with context (file path, operation attempted)
- Never swallow errors silently — at minimum, log at `warn` level

### Testing

- Co-locate test files: `parser.ts` → `parser.test.ts` in same directory
- Use `describe` blocks mirroring the module's exported API
- Snapshot tests for Markdown output stability (update snapshots intentionally, not casually)
- Name test cases descriptively: `it("converts <subsection> with chapeau to indented bold-lettered paragraph")`

## Reference Materials

- [USLM User Guide (PDF)](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) — v0.1.4, Oct 2013. Covers abstract/concrete model, identification, referencing, metadata, versioning, and presentation models.
- [USLM Schema & CSS](https://uscode.house.gov/download/resources/schemaandcss.zip) — USLM-1.0.xsd, USLM-1.0.15.xsd, usctitle.css, Dublin Core schemas, XHTML schema

## USLM XML Schema — Key Facts

The XML files use the USLM 1.0 schema (patch level 1.0.15). Namespace: `http://xml.house.gov/schemas/uslm/1.0`. See `packages/core/CLAUDE.md` for element classification details.

### Element Hierarchy (Big → Small)

```
title > subtitle > chapter > subchapter > article > subarticle > part > subpart > division > subdivision
  > section (PRIMARY LEVEL)
    > subsection > paragraph > subparagraph > clause > subclause > item > subitem > subsubitem
```

Additional level elements: `<preliminary>` (outside main hierarchy), `<compiledAct>`, `<courtRules>`/`<courtRule>`, `<reorganizationPlans>`/`<reorganizationPlan>` (title appendices).

**Important**: The schema intentionally does NOT enforce strict hierarchy — any `<level>` can nest inside any `<level>`. This is a deliberate design choice, not a bug.

### Identifier / Reference Format

LexBuild uses canonical URI paths as identifiers for all sources:

**USC identifiers** (from USLM `identifier` attributes):
```
/us/usc/t{title}/s{section}    — e.g., /us/usc/t1/s1
```
Reference prefixes (big levels): `t` = title, `st` = subtitle, `ch` = chapter, `sch` = subchapter, `art` = article, `p` = part, `sp` = subpart, `d` = division, `sd` = subdivision, `s` = section. Small levels (subsection and below) use their number directly without a prefix.

**CFR identifiers** (constructed by the eCFR builder from `NODE` and `N` attributes):
```
/us/cfr/t{title}/s{section}    — e.g., /us/cfr/t17/s240.10b-5
```
Note: identifiers use `/us/cfr/` (content type) not `/us/ecfr/` (data source). Both eCFR and future annual CFR use the same identifier space.

**FR identifiers** (from FederalRegister.gov document numbers):
```
/us/fr/{document_number}       — e.g., /us/fr/2026-06029
```

**Link resolution**: `/us/usc/` → relative links or OLRC fallback URLs. `/us/cfr/` → relative links or ecfr.gov fallback URLs. `/us/fr/` → relative links or federalregister.gov fallback URLs. `/us/stat/`, `/us/pl/` → plain text citations.

## Key Design Decisions

1. **SAX over DOM**: Large titles (26, 42) can exceed 100MB XML. SAX streaming keeps memory bounded. DOM is not used.

2. **Section as the atomic unit**: A section is the smallest citable legal unit in both USC and CFR. Subsections, paragraphs, etc. are rendered within the section file, not as separate files.

3. **Frontmatter + sidecar index**: Both YAML frontmatter on every .md file AND `_meta.json` per directory. Frontmatter enables file-level RAG ingestion. Sidecar enables index-based retrieval without parsing every file.

4. **Multi-source frontmatter**: Every file includes `source` (`"usc"`, `"ecfr"`, or `"fr"`) and `legal_status` fields. Source-specific optional fields (e.g., `authority`, `cfr_part`) are included when relevant. The `source` discriminator lets consumers know which fields to expect.

5. **Relative cross-reference links**: Cross-refs within the converted corpus use relative Markdown links. USC refs fall back to OLRC website URLs; CFR refs fall back to ecfr.gov URLs.

6. **Notes included by default**: All notes (editorial, statutory, amendments) are included by default. Notes can be disabled with `--no-include-notes` or selectively filtered with `--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`.

7. **Identifier scheme**: USC uses `/us/usc/` identifiers from USLM `identifier` attributes. CFR uses `/us/cfr/` identifiers constructed from the eCFR `NODE` and `N` attributes. Both eCFR and future annual CFR share the `/us/cfr/` space since they represent the same content.

8. **Resilient file I/O**: `@lexbuild/core` exports `writeFile`, `writeFileIfChanged`, and `mkdir` wrappers (`packages/core/src/fs.ts`). `writeFile` retries on `ENFILE`/`EMFILE` errors with exponential backoff. `writeFileIfChanged` additionally compares content before writing, preserving mtimes on unchanged files so downstream tools (highlights, search indexing) skip reprocessing.

9. **Secrets management**: `~/.lexbuild-secrets` on the VPS is the single source of truth. `ecosystem.config.cjs` reads secrets from `process.env` (populated via `~/.zshenv` → `~/.lexbuild-secrets`). `.env.production` is **generated** by `scripts/deploy.sh` on every deploy — never manually maintained.

## Common Pitfalls

- **`??` does not catch empty strings**: `"" ?? "fallback"` returns `""`, not `"fallback"`. Use `||` when empty strings should be treated as falsy (e.g., date components defaulting to `"0000"`).
- **`const` temporal dead zone in closures**: A closure that captures a `const` variable defined later in the same scope will throw `ReferenceError` when invoked — even though the closure itself is defined without error. Watch for this with `resolveLink` callbacks that reference `outputPath`.
- **XHTML namespace tables**: `<table>` elements in USC XML are in the XHTML namespace, not the USLM namespace. The SAX parser must handle namespace-aware element names.
- **Anomalous structures**: Some sections have non-standard nesting (e.g., `<paragraph>` directly under `<section>` without a `<subsection>`). Handlers must not assume strict hierarchy.
- **Empty/repealed sections**: Some sections contain only a `<note>` with status information (e.g., "Repealed" or "Transferred"). These should still produce an output file with appropriate frontmatter.
- **Multiple `<p>` elements in content**: A single `<content>` or `<note>` may contain multiple `<p>` elements. Each should be a separate paragraph in Markdown output.
- **Permissive content model**: `<content>` uses `processContents="lax"` with `namespace="##any"` — it can contain elements from any namespace. The SAX parser must handle unexpected elements gracefully.
- **`<continuation>` is interstitial**: Not just "after sub-levels" but also between elements of the same level. Handle as a text block in whatever position it appears.
- **Quoted content sections**: `<section>` elements inside `<quotedContent>` (quoted bills in statutory notes) must not be emitted as standalone files. Track `quotedContentDepth` to suppress emission.
- **Duplicate section numbers**: Some titles have multiple sections with the same number within a chapter (e.g., Title 5). Output files are disambiguated with `-2` suffixes.
- **CLI `-o` flag appends source subdirectories**: `convert-usc -o /some/path` writes to `/some/path/usc/...`, not `/some/path/...` directly. Same for eCFR.
- **gray-matter `{ cache: false }` in batch scripts**: gray-matter caches every parsed file by input string, causing unbounded memory growth. Always pass `{ cache: false }` when calling `matter()` in loops or batch processing scripts.
- **Ora spinner text should NOT end with `...`**: The trailing dots conflict with ora's own dots animation. The spinner animation itself provides the "in progress" cue.
- **Indexed array iteration with strict TypeScript**: `noUncheckedIndexedAccess` makes `arr[i]` return `T | undefined`, and `no-non-null-assertion` forbids `arr[i]!`. Use `for (const [i, item] of arr.entries())` to get typed values without assertions.
- **Astro template expressions are plain JS, not TypeScript**: `new Map<string, T>()` and other generics in template `{}` expressions cause esbuild errors. Move complex typed logic to the `---` frontmatter section.
- **Meilisearch dumps re-index on import**: Dumps are blueprints, not ready-to-use databases. Use Docker data directory transfer (`--search-docker`) instead — VPS import is instant.
- **LMDB is architecture-dependent**: Meilisearch data directories from macOS won't work on Linux. Docker with `--platform linux/amd64` produces compatible data.
- **SQLite is architecture-independent**: Unlike LMDB, SQLite `.db` files transfer between macOS and Linux without issues. SCP directly.
- **`gray-matter` `cache` option not in TypeScript types**: The `{ cache: false }` option works at runtime but isn't in the type definitions. Use `as any` with an eslint-disable comment in typechecked code.
- **`pnpm.onlyBuiltDependencies`**: Native packages like `better-sqlite3` need explicit approval in root `package.json` under `pnpm.onlyBuiltDependencies` to compile during install.
- **Turborepo app task naming**: Apps excluded from default `build` need matching script names (e.g., `build:api` in both `turbo.json` and the app's `package.json`).
- **Docker Meilisearch stores data at `data.ms/` inside the volume**: When tarring/extracting, use `-C /data/data.ms` not `-C /data`. Extracting at the wrong level causes "failed to infer database version" on the VPS.
- **Docker volume profiles**: `MEILI_PROFILE=dev|full` selects volume (`meili-data-dev` or `meili-data-full`). Dev mode runs without master key (`MEILI_ENV=development`). Full mode requires `MEILI_MASTER_KEY` for VPS-compatible data.

## When Adding New Source Types

The multi-source architecture is proven — `@lexbuild/ecfr` and `@lexbuild/fr` validate the pattern with completely different XML schemas (hierarchical DIV-based eCFR vs flat document-centric FR). Adding a new source follows the established pattern:

1. Create `packages/{source}/` with a dependency on `@lexbuild/core`
2. Implement a source-specific AST builder (SAX events → LexBuild AST nodes) in the source package
3. Implement a converter function (collect-then-write) analogous to `convertTitle()` or `convertEcfrTitle()`
4. Implement a downloader if the source has bulk data available
5. Add `download-{source}` and `convert-{source}` CLI commands in `packages/cli`
6. Reuse `@lexbuild/core` for XML parsing, AST types, Markdown rendering, frontmatter, and link resolution
7. Add new `SourceType` value to `packages/core/src/ast/types.ts` and any source-specific optional fields to `FrontmatterData`
8. Add the package to the `fixed` array in `.changeset/config.json`
9. Document the source's XML schema in the package's `CLAUDE.md`

Source packages must be independent — they depend only on core, never on each other.

10. **Package boundary enforcement**: ESLint `no-restricted-imports` rules in `eslint.config.js` prevent source packages from importing each other. When adding a new source package, add it to the restriction lists of all other source packages and add its own restriction block.
