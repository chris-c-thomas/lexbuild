# Monorepo Structure

LexBuild is organized as a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo). This separates format-agnostic infrastructure from source-specific logic and CLI tooling while keeping everything in one repository with unified versioning.

## Directory Tree

```
lexbuild/
├── packages/                    # Published npm packages
│   ├── core/                    # @lexbuild/core — XML parsing, AST, Markdown rendering
│   ├── usc/                     # @lexbuild/usc — U.S. Code converter and downloader
│   ├── ecfr/                    # @lexbuild/ecfr — eCFR converter and downloader
│   ├── fr/                      # @lexbuild/fr — Federal Register converter and downloader
│   └── cli/                     # @lexbuild/cli — CLI binary
├── apps/                        # Private applications (never published)
│   └── astro/                   # Web app — Astro 6 SSR
├── fixtures/                    # Shared test data
│   ├── fragments/               # Small synthetic XML snippets for unit tests
│   └── expected/                # Expected output snapshots for integration tests
├── docs/                        # Project documentation
├── downloads/                   # Downloaded source data (gitignored)
│   ├── usc/xml/                 # USC XML files (usc01.xml ... usc54.xml)
│   ├── ecfr/xml/                # eCFR XML files (ECFR-title1.xml ... ECFR-title50.xml)
│   └── fr/                      # FR XML + JSON files (YYYY/MM/doc-number.xml/.json)
├── scripts/                     # Deployment and operations scripts
├── .changeset/                  # Changeset configuration and pending changesets
├── .github/                     # GitHub Actions CI/CD workflows
├── turbo.json                   # Turborepo pipeline configuration
├── pnpm-workspace.yaml          # Workspace definitions
├── package.json                 # Root scripts, shared devDependencies
├── tsconfig.json                # Root TypeScript config
├── eslint.config.js             # Root ESLint config
└── prettier.config.js           # Prettier formatting rules
```

## Package Layer vs. App Layer

The workspace is defined in `pnpm-workspace.yaml` with two member patterns:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

This creates a clean separation between publishable packages and private applications.

### Packages (`packages/`)

Published to npm under the `@lexbuild` scope. All five packages share the same version number, maintained in lockstep by [Changesets](https://github.com/changesets/changesets).

| Package | npm Name | Role |
|---------|----------|------|
| `core/` | `@lexbuild/core` | Format-agnostic foundation: XML parsing, AST types, Markdown rendering, frontmatter, link resolution, resilient file I/O |
| `usc/` | `@lexbuild/usc` | U.S. Code source package: OLRC downloader, conversion pipeline using core's `ASTBuilder` |
| `ecfr/` | `@lexbuild/ecfr` | eCFR source package: dual-source downloader (ecfr.gov API, govinfo bulk), own `EcfrASTBuilder`, conversion pipeline |
| `fr/` | `@lexbuild/fr` | Federal Register source package: FederalRegister.gov API downloader, own `FrASTBuilder`, dual JSON+XML ingestion |
| `cli/` | `@lexbuild/cli` | CLI binary (`lexbuild`): command parsing, progress UI, delegates to source packages |

Lockstep versioning is configured in `.changeset/config.json`:

```json
{
  "fixed": [["@lexbuild/core", "@lexbuild/usc", "@lexbuild/ecfr", "@lexbuild/fr", "@lexbuild/cli"]]
}
```

When any package changes, all five receive the same version bump. This eliminates version drift between packages that are designed to work together.

### Apps (`apps/`)

Applications are marked `"private": true` in their `package.json`. They are never published to npm and are excluded from the Changesets release process via the `ignore` field.

| App | Purpose |
|-----|---------|
| `apps/astro/` | Server-rendered web app for browsing converted legal content at [lexbuild.dev](https://lexbuild.dev) |
| `apps/api/` | REST API for programmatic access to the corpus at [lexbuild.dev/api](https://lexbuild.dev/api) |

The Astro app has **no runtime dependency** on any `@lexbuild/*` package. It reads the `.md` files and `_meta.json` sidecar indexes that the CLI produces. This decoupling means the app can be built and deployed independently of the conversion packages.

The Data API depends on `@lexbuild/core` for shared database schema types (`DocumentRow`, SQL constants) and key hashing utilities, but has no dependency on source packages. It reads from a SQLite database populated by the `lexbuild ingest` CLI command. Like the Astro app, it uses a dedicated build task (`build:api`) and is excluded from the default Turborepo build and from changesets.

## What Lives Where

### Root-Level Configuration

The repository root contains shared tooling configuration that applies across all packages and apps.

| File | Purpose |
|------|---------|
| `turbo.json` | Turborepo task pipeline (build order, caching, outputs) |
| `pnpm-workspace.yaml` | Workspace member definitions |
| `package.json` | Root scripts (`build`, `test`, `lint`, `release`), shared devDependencies, `pnpm.overrides` |
| `tsconfig.json` | Base TypeScript configuration (strict mode, ESM) |
| `eslint.config.js` | Shared ESLint rules (typescript-eslint, prettier integration) |
| `prettier.config.js` | Formatting rules (double quotes, trailing commas, 100 char print width) |
| `.changeset/config.json` | Lockstep versioning strategy and publish configuration |

Root `devDependencies` include tooling shared across all workspaces: `turbo`, `eslint`, `prettier`, `typescript-eslint`, and `@changesets/cli`. Package-specific devDependencies (`tsup`, `vitest`, `typescript`) live in each package's own `package.json`.

### Inside Each Package

Every package follows a standard internal layout:

```
packages/{name}/
├── src/
│   ├── index.ts        # Barrel exports (public API)
│   ├── *.ts            # Module files
│   └── *.test.ts       # Co-located tests (same directory as source)
├── dist/               # Build output (gitignored)
├── package.json        # Package metadata, scripts, dependencies
├── tsconfig.json       # Extends root tsconfig
├── tsup.config.ts      # Build configuration
└── CLAUDE.md           # Package architecture notes
```

Each package defines the same set of scripts:

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsup` | Compile TypeScript to ESM in `dist/` |
| `dev` | `tsup --watch` | Rebuild on file changes |
| `typecheck` | `tsc --noEmit` | Type checking without emitting |
| `test` | `vitest run` | Run tests once |
| `lint` | `eslint src` | Check for lint errors |
| `lint:fix` | `eslint src --fix` | Auto-fix lint errors |

### Shared Test Fixtures

The `fixtures/` directory at the repository root contains test data shared across packages:

- **`fixtures/fragments/`** -- Small synthetic XML snippets used in unit tests. These are hand-crafted to exercise specific parsing behaviors without requiring full title XML files.
- **`fixtures/expected/`** -- Expected output snapshots for integration tests. Snapshot updates should be intentional, not casual.

Packages reference fixtures via relative paths from their test files.

### Downloaded Source Data

The `downloads/` directory stores XML source files fetched by the CLI's download commands. This directory is fully gitignored -- source XML is not committed to the repository.

```
downloads/
├── usc/xml/          # USC XML: usc01.xml through usc54.xml (~2.5 GB total)
├── ecfr/xml/         # eCFR XML: ECFR-title1.xml through ECFR-title50.xml (~1.5 GB total)
└── fr/               # FR XML + JSON: YYYY/MM/doc-number.xml/.json (~600 MB/year)
```

Users populate this directory on-demand by running `lexbuild download-usc`, `lexbuild download-ecfr`, or `lexbuild download-fr`.

## The Workspace Protocol

All internal dependencies use pnpm's `workspace:*` protocol. For example, `@lexbuild/usc` declares its dependency on core as:

```json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}
```

The CLI package depends on all other packages:

```json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*",
    "@lexbuild/usc": "workspace:*",
    "@lexbuild/ecfr": "workspace:*",
    "@lexbuild/fr": "workspace:*"
  }
}
```

During development, `workspace:*` resolves to the local copy of the package -- changes to `@lexbuild/core` are immediately visible to packages that depend on it (after a rebuild). On publish, pnpm replaces `workspace:*` with the concrete version number in the published `package.json`.

The `*` specifier (rather than `^`) is deliberate. Since all packages use lockstep versioning, there is no version drift to protect against. Every release publishes all five packages at the same version.

## Dependency Graph

The dependency relationships form a strict tree with no cycles:

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  ├── @lexbuild/ecfr
  │     └── @lexbuild/core
  ├── @lexbuild/fr
  │     └── @lexbuild/core
  └── @lexbuild/core

apps/astro
  └── (no @lexbuild/* dependencies — consumes output files only)
```

Key constraints:

- **Core depends on nothing** internal. Its only dependencies are third-party libraries (`saxes`, `yaml`, `zod`).
- **Source packages depend only on core.** `@lexbuild/usc`, `@lexbuild/ecfr`, and `@lexbuild/fr` never import from each other.
- **CLI depends on all packages.** It orchestrates source packages and uses core for shared types.
- **The Astro app is fully decoupled.** It has no `@lexbuild/*` dependency at all -- it reads filesystem output.

Turborepo uses this graph to determine build order: core builds first, then `usc`, `ecfr`, and `fr` in parallel, then `cli`.

## Astro App Isolation

The Astro app has several properties that differentiate it from the published packages:

- **No `build` script.** It defines `build:astro` instead. This prevents it from being included in the default `pnpm turbo build` pipeline, which would fail because the app requires content files that are not in git.
- **Excluded from Changesets.** Listed in the `ignore` array in `.changeset/config.json` (as `@lexbuild/astro`). Version bumps and changelogs do not apply.
- **Content is gitignored.** The `content/`, `public/nav/`, `public/sitemap.xml`, and `*.highlighted.html` artifacts are all generated by pipeline scripts and are not committed.
- **Separate Turborepo tasks.** `build:astro` and `dev:astro` are distinct tasks in `turbo.json` with `cache: false`, since the app's output depends on content state that Turborepo cannot track.

## How New Source Packages Fit In

The monorepo is designed to grow horizontally. Adding support for a new legal source (such as annual CFR or state statutes) follows a consistent pattern:

1. Create a new package at `packages/{source}/` with `@lexbuild/core` as a `workspace:*` dependency.
2. Implement a source-specific AST builder if the XML format differs from USLM.
3. Implement a converter function using the collect-then-write pattern.
4. Optionally implement a downloader for the source's bulk data endpoint.
5. Register `download-{source}` and `convert-{source}` commands in `packages/cli`.
6. Add the new package to the `fixed` array in `.changeset/config.json`.

The new package reuses core's XML parser, AST types, Markdown renderer, frontmatter generator, and link resolver. It produces the same output format as existing sources, so downstream consumers (including the Astro app) require no changes.

Source packages must remain independent of each other. They share infrastructure through core, never through direct imports between source packages.

See [Extending LexBuild](../development/extending.md) for a detailed walkthrough.
