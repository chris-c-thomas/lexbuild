# Monorepo Structure

LexBuild is organized as a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/). This structure separates format-agnostic infrastructure from source-specific logic and CLI tooling, while keeping everything in a single repository with unified versioning, shared configuration, and atomic cross-package changes.

## Directory Tree

```
lexbuild/
├── packages/                    # Published npm packages (the platform core)
│   ├── core/                    # @lexbuild/core — XML parsing, AST, Markdown rendering
│   ├── usc/                     # @lexbuild/usc — U.S. Code source package
│   └── cli/                     # @lexbuild/cli — CLI binary (end-user entry point)
├── apps/                        # Private applications (never published to npm)
│   └── web/                     # Documentation site — Next.js 16, SSR, browse output as HTML
├── fixtures/                    # Shared test data (used by multiple packages)
│   ├── fragments/               # Small synthetic XML snippets for unit tests
│   └── expected/                # Expected output snapshots for integration tests
├── docs/                        # Project documentation (architecture, format spec, guides)
├── downloads/                   # Downloaded source data (gitignored)
│   └── usc/
│       └── xml/                 # Full USC XML files (usc01.xml ... usc54.xml)
├── .changeset/                  # Changeset configuration and pending changesets
├── .github/                     # GitHub Actions CI/CD workflows
├── turbo.json                   # Turborepo pipeline configuration
├── pnpm-workspace.yaml          # Workspace definitions
├── package.json                 # Root scripts, shared devDependencies
├── tsconfig.json                # Root TypeScript config (extended by packages)
├── eslint.config.js             # Root ESLint config
├── prettier.config.js           # Prettier formatting rules
└── CLAUDE.md                    # AI-assisted development instructions
```

## Package Layer vs. App Layer

The monorepo has two distinct layers, defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### Packages (`packages/`)

Packages are **published to npm** under the `@lexbuild` scope. They form the core platform and are consumed by external users, other packages in the monorepo, and applications. Each package has `"publishConfig": { "access": "public" }` in its `package.json`.

| Package | npm Name | Role |
|---------|----------|------|
| `packages/core/` | `@lexbuild/core` | Format-agnostic foundation: XML parser, AST types and builder, Markdown renderer, frontmatter generator, link resolver |
| `packages/usc/` | `@lexbuild/usc` | U.S. Code source package: conversion pipeline, OLRC downloader, file writer, metadata generation |
| `packages/cli/` | `@lexbuild/cli` | CLI binary: `lexbuild` command with `download` and `convert` subcommands |

All packages share the same version number, managed in lockstep via [Changesets](https://github.com/changesets/changesets). The current version is `1.4.2`.

### Apps (`apps/`)

Apps are **private** (`"private": true` in `package.json`) and never published to npm. They consume LexBuild's output files, not its code. Apps are excluded from the default `pnpm turbo build` pipeline to avoid CI failures when generated content is unavailable.

| App | Purpose |
|-----|---------|
| `apps/web/` | Server-rendered documentation site (Next.js 16) for browsing converted U.S. Code as structured Markdown |

The web app has no runtime dependency on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`. It reads `.md` files and `_meta.json` sidecars produced by the CLI. See [dependency-graph.md](dependency-graph.md) for the full relationship model.

## What Lives Where

### Root-Level Configuration

The repository root holds shared tooling configuration that applies across all packages and apps:

| File | Purpose |
|------|---------|
| `turbo.json` | Turborepo task pipeline (build order, caching, outputs) |
| `pnpm-workspace.yaml` | Workspace member definitions |
| `package.json` | Root scripts (`build`, `test`, `lint`, `format`, `release`), shared `devDependencies` |
| `tsconfig.json` | Base TypeScript configuration extended by each package |
| `eslint.config.js` | Shared ESLint rules (`@typescript-eslint`, Prettier integration) |
| `prettier.config.js` | Formatting: double quotes, trailing commas, 100-char print width |
| `.changeset/config.json` | Changeset versioning strategy (lockstep, `linked` groups) |

Root `devDependencies` include tools used across all packages: `turbo`, `eslint`, `prettier`, `typescript-eslint`, and `@changesets/cli`. Package-specific devDependencies (like `tsup`, `vitest`, and `typescript`) live in each package's own `package.json`.

### Inside Each Package

Every package follows a consistent internal layout:

```
packages/{name}/
├── src/                # Source code (TypeScript, ESM)
│   ├── index.ts        # Barrel exports
│   ├── *.ts            # Module files
│   └── *.test.ts       # Co-located test files
├── dist/               # Build output (gitignored)
├── package.json        # Package metadata, dependencies, scripts
├── tsconfig.json       # Extends root tsconfig
├── tsup.config.ts      # Build configuration
└── CLAUDE.md           # Package-specific architecture notes
```

Each package defines the same set of scripts: `build`, `dev`, `typecheck`, `test`, `lint`, and `lint:fix`. Turborepo orchestrates these uniformly across the monorepo.

### Shared Test Fixtures

The `fixtures/` directory at the repository root contains test data shared across packages:

- **`fixtures/fragments/`** -- Small, synthetic XML snippets designed for unit tests (e.g., `simple-section.xml`, `section-with-subsections.xml`, `duplicate-sections.xml`, `section-with-notes.xml`, `section-with-status.xml`).
- **`fixtures/expected/`** -- Expected output snapshots for integration tests, used to verify Markdown output stability.

Packages reference these fixtures via relative paths from their test files. Keeping fixtures at the root avoids duplication and ensures all packages test against the same inputs.

### Downloaded Source Data

The `downloads/` directory stores XML files fetched by the `lexbuild download` command. It is entirely gitignored -- source data is not committed to the repository. Users download the data they need on-demand.

## The Workspace Protocol

All internal dependencies between packages use pnpm's `workspace:*` protocol:

```json
// packages/usc/package.json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}

// packages/cli/package.json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*",
    "@lexbuild/usc": "workspace:*"
  }
}
```

### During Development

`workspace:*` tells pnpm to resolve the dependency to the local copy of the package within the monorepo. There is no version resolution, no registry lookup, and no `node_modules` duplication. When you change code in `packages/core/`, the `usc` and `cli` packages see the change immediately after rebuilding core.

### On Publish

When `pnpm publish` runs (via `changeset publish`), pnpm automatically replaces `workspace:*` with the actual version number being published. For example, `"@lexbuild/core": "workspace:*"` becomes `"@lexbuild/core": "1.4.2"` in the published tarball. External consumers install concrete versions from the npm registry with no awareness of the workspace protocol.

### Why `workspace:*` Instead of `workspace:^`

The `*` variant (rather than `^` or `~`) means "any version in the workspace." Since all LexBuild packages are versioned in lockstep, there is no risk of version drift. On publish, `*` translates to the exact current version, ensuring consumers get precisely compatible packages.

## How New Source Packages Fit In

The monorepo is designed to grow horizontally. Each new legal source (Code of Federal Regulations, state statutes, municipal codes) becomes its own package under `packages/`:

```
packages/
├── core/           # Shared by all source packages
├── usc/            # U.S. Code (USLM 1.0)
├── cfr/            # Code of Federal Regulations (future)
├── state-il/       # Illinois Compiled Statutes (future)
└── cli/            # Registers commands for all source packages
```

A new source package follows the established pattern:

1. Create `packages/{source}/` with `@lexbuild/core` as a `workspace:*` dependency
2. Implement a converter function analogous to `convertTitle()` in `@lexbuild/usc`
3. Reuse core's XML parser, AST types, Markdown renderer, and frontmatter generator
4. Add source-specific download logic if the source provides bulk data
5. Register new CLI commands in `packages/cli/` (e.g., `lexbuild download-cfr`, `lexbuild convert-cfr`)

Source packages are independent of each other. `@lexbuild/usc` and a future `@lexbuild/cfr` would both depend on `@lexbuild/core` but never on each other. This independence means new sources can be developed in parallel without risk of cross-contamination. See [../development/extending.md](../development/extending.md) for the full guide.
