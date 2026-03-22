# Getting Started

This guide walks through setting up a local development environment for LexBuild.

## Prerequisites

- **Node.js >= 22 LTS** -- ESM modules require v22+. Check with `node --version`.
- **pnpm >= 10** -- monorepo dependency management. Check with `pnpm --version`.

## Clone, Install, and Build

```bash
git clone https://github.com/chris-c-thomas/LexBuild.git
cd LexBuild
pnpm install
pnpm turbo build
```

Turborepo builds packages in dependency order: `core` first, then `usc` and `ecfr` in parallel, then `cli` last.

## Verify Your Setup

Run the full check suite to confirm everything is working:

```bash
pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
```

## Common Commands

| Command | Description |
|---|---|
| `pnpm turbo build` | Build all packages |
| `pnpm turbo test` | Run all tests |
| `pnpm turbo lint` | Lint all packages |
| `pnpm turbo typecheck` | Type-check all packages |
| `pnpm turbo dev` | Watch mode (rebuild on change) |
| `pnpm format` | Auto-format with Prettier |
| `pnpm format:check` | Check formatting without modifying files |

## Scoping to a Single Package

Use `--filter` to target a specific package:

```bash
pnpm turbo build --filter=@lexbuild/core
pnpm turbo test --filter=@lexbuild/usc
pnpm turbo test --filter=@lexbuild/ecfr
pnpm turbo lint --filter=@lexbuild/cli
```

## Running the CLI Locally

After building, run the CLI from its compiled output:

```bash
# Download and convert U.S. Code
node packages/cli/dist/index.js download-usc --titles 1
node packages/cli/dist/index.js convert-usc --titles 1 -o ./test-output
node packages/cli/dist/index.js convert-usc --titles 1-5 -o ./test-output
node packages/cli/dist/index.js convert-usc ./downloads/usc/xml/usc01.xml -o ./test-output

# Download and convert eCFR
node packages/cli/dist/index.js download-ecfr --titles 1,17
node packages/cli/dist/index.js convert-ecfr --titles 1 -o ./test-output
node packages/cli/dist/index.js convert-ecfr --titles 17 -g part -o ./test-output
```

Downloaded XML files are stored in `downloads/usc/xml/` and `downloads/ecfr/xml/`, both of which are gitignored.

## Web App Development

The Astro web app requires converted content to run. To set up a minimal local instance:

```bash
# Build packages and convert a single title
pnpm turbo build
node packages/cli/dist/index.js download-usc --titles 1
node packages/cli/dist/index.js convert-usc --titles 1 -o ./output

# Link content and generate navigation
cd apps/astro
bash scripts/link-content.sh
npx tsx scripts/generate-nav.ts
cd ../..

# Start the dev server
pnpm turbo dev:astro --filter=astro
```

The dev server runs at `http://localhost:4321`. See the Astro web app [documentation](../apps/astro.md) for the full architecture and deployment guide.

## Project Structure

```
lexbuild/
├── packages/
│   ├── core/     # @lexbuild/core
│   ├── usc/      # @lexbuild/usc
│   ├── ecfr/     # @lexbuild/ecfr
│   └── cli/      # @lexbuild/cli
├── apps/
│   └── astro/    # Web app (Astro 6, SSR)
├── fixtures/     # Test fixtures (fragments + expected output)
├── downloads/    # Downloaded XML (gitignored)
├── docs/         # Documentation
└── scripts/      # Deploy and ops scripts
```

**Package responsibilities:**

- **[@lexbuild/core](../packages/core.md)** -- Format-agnostic foundation: XML parsing, AST types, Markdown rendering, frontmatter generation, cross-reference link resolution.
- **[@lexbuild/usc](../packages/usc.md)** -- U.S. Code source: USLM XML conversion, OLRC download, release point detection.
- **[@lexbuild/ecfr](../packages/ecfr.md)** -- eCFR source: GPO/SGML XML conversion, ecfr.gov and govinfo download.
- **[@lexbuild/cli](../packages/cli.md)** -- CLI binary: user-facing commands, option parsing, progress UI.

**Dependency graph:**

```
@lexbuild/core
  ├── @lexbuild/usc
  └── @lexbuild/ecfr
        └── @lexbuild/cli (depends on core, usc, ecfr)
```

Source packages depend only on `core` and never on each other. The CLI depends on all three.
