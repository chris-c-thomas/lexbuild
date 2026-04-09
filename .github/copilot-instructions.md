# GitHub Copilot Instructions for LexBuild

## Start Here

- Read `README.md` for the current product overview, supported interfaces, CLI usage, and development commands.
- Read `CLAUDE.md` for repo-wide architecture, coding conventions, and package boundaries.
- Then read the closest package or app guide instead of inferring behavior from unrelated code:
  - `packages/core/CLAUDE.md`
  - `packages/usc/CLAUDE.md`
  - `packages/ecfr/CLAUDE.md`
  - `packages/fr/CLAUDE.md`
  - `packages/cli/CLAUDE.md`
  - `packages/mcp/CLAUDE.md`
  - `apps/astro/CLAUDE.md`
  - `apps/api/CLAUDE.md`
- If a file also matches a scoped instruction under `.github/instructions/`, follow that scoped file in addition to this repo-wide guide.

Prefer linking to the relevant `CLAUDE.md` or `README.md` in comments, reviews, and generated docs instead of duplicating detailed architecture notes.

## Repo Shape

- LexBuild is a Turborepo monorepo with six packages and two apps.
- Packages:
  - `packages/core` contains the shared XML parser, AST types/builders, Markdown renderer, frontmatter generation, shared DB schema, link resolution, and resilient filesystem helpers.
  - `packages/usc`, `packages/ecfr`, and `packages/fr` are source-specific conversion and download packages. They depend on `@lexbuild/core` and must remain independent of each other.
  - `packages/cli` is the published CLI toolchain. It is a thin orchestration layer over the source packages and also owns ingest and API key commands.
  - `packages/mcp` is the published Model Context Protocol server. It is a thin typed client over the Data API and does not access SQLite directly.
- Apps:
  - `apps/astro` is the private web app and docs site. It consumes generated Markdown, nav JSON, highlighted HTML, and search data as content.
  - `apps/api` is the private Hono + SQLite Data API and Meilisearch proxy.
- Search spans multiple surfaces:
  - Astro browser client and UI: `apps/astro/src/lib/search.ts`, `apps/astro/src/components/search/`
  - API proxy: `apps/api/src/routes/search.ts`
  - Indexing scripts: `apps/astro/scripts/index-search.ts`, `apps/astro/scripts/index-search-incremental.ts`
- Documentation for the public site lives in `apps/astro/src/content/docs/`, with navigation defined in `apps/astro/src/lib/docs-nav.ts`.
- Generated artifacts live under `downloads/`, `output/`, `output-chapter/`, `output-part/`, `output-title/`, `apps/astro/content/`, and generated files in `apps/astro/public/`. Do not edit them unless the task explicitly targets generated output.

## Environment And Commands

- Use Node.js `>=22` and pnpm `>=10`.
- Install dependencies from the repo root with `pnpm install`.
- Common repo commands:
  - `pnpm turbo build`
  - `pnpm turbo test`
  - `pnpm turbo lint`
  - `pnpm turbo typecheck`
  - `pnpm turbo dev`
- Scope work with Turborepo filters using the actual workspace names:
  - `@lexbuild/core`
  - `@lexbuild/usc`
  - `@lexbuild/ecfr`
  - `@lexbuild/fr`
  - `@lexbuild/cli`
  - `@lexbuild/mcp`
  - `@lexbuild/astro`
  - `@lexbuild/api`
- App-specific tasks use dedicated script names:
  - `pnpm turbo dev:astro --filter=@lexbuild/astro`
  - `pnpm turbo build:astro --filter=@lexbuild/astro`
  - `pnpm turbo dev:api --filter=@lexbuild/api`
  - `pnpm turbo build:api --filter=@lexbuild/api`
- To run the CLI locally, build first and then execute `node packages/cli/dist/index.js ...`.
- The current CLI surface includes `download-usc`, `convert-usc`, `download-ecfr`, `convert-ecfr`, `download-fr`, `convert-fr`, `enrich-fr`, `ingest`, `list-release-points`, and `api-key` subcommands.

## Working Conventions

- TypeScript is strict, ESM-only, and uses `import type` for type-only imports.
- Prefer `interface` over `type` for object shapes.
- Avoid `any`; use `unknown` unless there is a documented reason not to.
- Keep file names in kebab case and exported APIs documented with JSDoc.
- Preserve existing package boundaries. Shared parsing, rendering, DB schema, and filesystem helpers belong in `@lexbuild/core`; source-format-specific behavior belongs in the relevant source package.
- When writing many files from converters or tooling, use the resilient filesystem helpers exported by `@lexbuild/core` rather than raw `node:fs/promises` writes.
- Keep changes focused. Do not reformat or modernize unrelated code while solving a targeted task.

## Architecture Rules That Matter

- The core pattern is source XML -> source-specific builder -> LexBuild AST -> Markdown/frontmatter renderer -> file output.
- USC, eCFR, and Federal Register use different XML formats and builders. Do not assume a fix in one source package applies to another.
- Converter pipelines collect parse results synchronously and write files after parsing. Do not add async I/O inside SAX event handlers.
- `apps/astro` does not import converter package code. It reads generated content as data.
- `apps/api` depends on `@lexbuild/core` for shared schema types and constants, not on source packages or the CLI.
- `packages/mcp` is a typed API client layer over the Data API. Do not add direct SQLite access or converter dependencies there.
- The Astro and API apps are intentionally excluded from the default package build pipeline. Do not add plain `build` scripts to those apps; use `build:astro` and `build:api`.

## Documentation, UI, And Search

- Treat `apps/astro/src/content/docs/` as the canonical source for the website documentation.
- When adding, removing, or reordering docs pages, update `apps/astro/src/lib/docs-nav.ts` so the sidebar and prev/next links stay correct.
- For web UI work, preserve the existing Astro + React island architecture, Tailwind 4 setup, and LexBuild visual language rather than introducing an unrelated design system.
- Search behavior is environment-sensitive. In Astro, `MEILI_URL` starting with `/` means proxy mode through the app. Do not expose server-only search credentials in browser code.
- The interactive API reference lives in the Astro app, not the API app.

## Testing And Validation

- Tests are usually co-located with source files as `*.test.ts`.
- Snapshot stability matters for converter output. Update snapshots intentionally.
- Prefer targeted validation before repo-wide runs:
  - package tests for source-package or CLI changes
  - `@lexbuild/astro` tests or targeted scripts for docs, web, or search changes
  - `@lexbuild/api` tests for Data API changes
  - `@lexbuild/mcp` tests for MCP server changes

## Useful Entry Points

- `README.md` for current product overview and user-facing commands
- `CLAUDE.md` for repo-wide architecture and conventions
- `package.json` for authoritative root scripts and engine requirements
- `turbo.json` for task wiring
- `eslint.config.js` for lint and package-boundary rules
- `apps/astro/README.md` for the web app, docs site, and content pipeline
- `apps/api/README.md` for the Data API
- `packages/mcp/README.md` for MCP installation and transports when the task touches the MCP package