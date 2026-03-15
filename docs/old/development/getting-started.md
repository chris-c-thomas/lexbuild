# Getting Started

LexBuild is a monorepo that converts legislative XML into structured Markdown for AI and RAG pipelines. This guide walks you through setting up a local development environment, building the project, and orienting yourself in the codebase. By the end, you will have all packages built, tests passing, and the CLI runnable from source.

## Prerequisites

You need two tools installed before cloning the repository:

- **[Node.js](https://nodejs.org/) >= 22 LTS** -- LexBuild uses ESM modules and Node.js APIs that require v22 or later. Run `node --version` to check.
- **[pnpm](https://pnpm.io/) >= 10** -- The monorepo uses pnpm workspaces for dependency management. Install it with `npm install -g pnpm` or [follow the pnpm docs](https://pnpm.io/installation). Run `pnpm --version` to check.

## Clone, Install, and Build

```bash
git clone https://github.com/chris-c-thomas/LexBuild.git
cd LexBuild
pnpm install
pnpm turbo build
```

Turborepo builds the packages in dependency order: `@lexbuild/core` first (no internal dependencies), then `@lexbuild/usc` (depends on core), then `@lexbuild/cli` (depends on both).

## Verify Your Setup

Run the full verification suite to confirm everything is working:

```bash
pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
```

All three commands should complete without errors. If any step fails, check that you are using the correct Node.js and pnpm versions.

## Common Commands

These are the commands you will use most frequently during development. All commands run from the repository root.

| Command | Description |
|---------|-------------|
| `pnpm turbo build` | Build all packages (respects dependency order) |
| `pnpm turbo test` | Run all tests across all packages |
| `pnpm turbo lint` | Lint all packages with ESLint |
| `pnpm turbo typecheck` | Type-check all packages with the TypeScript compiler |
| `pnpm turbo dev` | Watch mode -- rebuilds packages on file change |
| `pnpm format` | Auto-format all files with Prettier |
| `pnpm format:check` | Check formatting without writing changes |

Formatting follows project-wide Prettier settings: double quotes, trailing commas, 100-character print width.

## Scoping Commands to a Single Package

Most Turborepo commands accept `--filter` to target a specific package. This is useful when you are working in one package and want faster feedback:

```bash
# Build only core
pnpm turbo build --filter=@lexbuild/core

# Test only usc
pnpm turbo test --filter=@lexbuild/usc

# Lint only cli
pnpm turbo lint --filter=@lexbuild/cli

# Type-check only core
pnpm turbo typecheck --filter=@lexbuild/core
```

Turborepo automatically builds any upstream dependencies that a filtered package requires, so `--filter=@lexbuild/usc` will build `@lexbuild/core` first if needed.

## Running the CLI Locally

After building, you can run the CLI directly from the compiled output. This is how you test CLI changes during development without installing the package globally:

```bash
# Download U.S. Code XML for Title 1
node packages/cli/dist/index.js download --titles 1

# Convert Title 1 to Markdown
node packages/cli/dist/index.js convert --titles 1 -o ./test-output

# Convert a range of titles
node packages/cli/dist/index.js convert --titles 1-5 -o ./test-output

# Convert a specific XML file
node packages/cli/dist/index.js convert ./downloads/usc/xml/usc01.xml -o ./test-output

# Convert with title-level granularity
node packages/cli/dist/index.js convert --titles 1 -g title -o ./test-output

# Download all 54 titles (single bulk zip from OLRC)
node packages/cli/dist/index.js download --all
```

Downloaded XML files are saved to `downloads/usc/xml/` by default. This directory is gitignored -- the XML files are large (the full corpus is approximately 650 MB) and should not be committed.

## Project Structure

LexBuild is organized as a monorepo with three published packages and a web application:

```
lexbuild/
├── packages/
│   ├── core/           # @lexbuild/core
│   ├── usc/            # @lexbuild/usc
│   └── cli/            # @lexbuild/cli
├── apps/
│   └── astro/          # Documentation site (Astro)
├── fixtures/
│   ├── fragments/      # Synthetic XML snippets for unit tests
│   └── expected/       # Pinned expected output for snapshot tests
├── docs/               # Project documentation (you are here)
├── turbo.json          # Turborepo pipeline config
└── pnpm-workspace.yaml # Workspace definitions
```

### Package Responsibilities

**[@lexbuild/core](../packages/core.md)** -- The format-agnostic foundation. Core provides the streaming SAX-based XML parser, the AST type system and builder, the Markdown renderer, frontmatter generation, and cross-reference link resolution. It knows nothing about any specific legal source. All source packages depend on it.

**[@lexbuild/usc](../packages/usc.md)** -- The U.S. Code source package. It orchestrates the full conversion pipeline for USLM XML: downloading from the Office of the Law Revision Counsel (OLRC), parsing via the core AST builder, writing Markdown files at section/chapter/title granularity, and generating sidecar metadata indexes.

**@lexbuild/cli** -- The published npm package that users install. A thin orchestration layer that wires up `commander` commands (`download`, `convert`) and delegates all heavy lifting to `@lexbuild/usc` and `@lexbuild/core`.

**apps/astro** -- An Astro server-rendered site for browsing converted U.S. Code and eCFR content. It consumes LexBuild's output files (`.md` and `_meta.json`) but has no code dependency on any `@lexbuild/*` package. The Astro app is excluded from the default `pnpm turbo build` pipeline and from changeset versioning.

### Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  └── @lexbuild/core
```

Internal dependencies use pnpm's `workspace:*` protocol, so packages always resolve to the local version during development. As new source packages are added (e.g., `@lexbuild/cfr`), they follow the same pattern: depend on `@lexbuild/core` and get wired into the CLI.

## Where to Go Next

Now that your environment is set up, here are the recommended next reads depending on what you want to do:

- **Write or run tests** -- [Testing](testing.md) covers the test framework, fixture files, snapshot tests, and conventions.
- **Understand code style** -- [Coding Standards](coding-standards.md) covers TypeScript conventions, naming, error handling, and formatting.
- **Understand the system design** -- [Architecture Overview](../architecture/overview.md) explains the three-layer design and how data flows through the system.
- **Learn the AST** -- [AST Model](../architecture/ast-model.md) documents the intermediate representation that sits between XML parsing and Markdown rendering.
- **Add a feature** -- Read the package-level docs for [core](../packages/core.md) or [usc](../packages/usc.md) to understand the module you will be working in.
