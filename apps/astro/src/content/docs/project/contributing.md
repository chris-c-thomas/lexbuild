---
title: "Contributing"
description: "How to set up a development environment, run tests, and contribute to LexBuild."
order: 1
---

# Contributing

LexBuild is open source and welcomes contributions. This guide covers setting up a development environment, understanding the codebase, and submitting changes.

**GitHub repository**: [github.com/chris-c-thomas/LexBuild](https://github.com/chris-c-thomas/LexBuild)

## Prerequisites

- **Node.js >= 22 LTS** -- check with `node --version`
- **pnpm >= 10** -- check with `pnpm --version`

## Setup

Clone the repository, install dependencies, and build all packages:

```bash
git clone https://github.com/chris-c-thomas/LexBuild.git
cd LexBuild
pnpm install
pnpm turbo build
```

Turborepo builds packages based on the dependency graph: `usc`, `ecfr`, and `fr` depend on `core`; `cli` depends on `core` and the source packages; `mcp` is independent and builds alongside the others.

Verify everything is working:

```bash
pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
```

## Monorepo Structure

```
lexbuild/
├── packages/
│   ├── core/     # @lexbuild/core -- XML parsing, AST, Markdown rendering
│   ├── usc/      # @lexbuild/usc -- U.S. Code converter and downloader
│   ├── ecfr/     # @lexbuild/ecfr -- eCFR converter and downloader
│   ├── fr/       # @lexbuild/fr -- Federal Register converter and downloader
│   ├── cli/      # @lexbuild/cli -- CLI binary
│   └── mcp/      # @lexbuild/mcp -- MCP server for AI assistants
├── apps/
│   ├── astro/    # Web app (Astro 6, SSR)
│   └── api/      # Data API (Hono, SQLite)
├── fixtures/     # Test fixtures
├── downloads/    # Downloaded XML (gitignored)
└── scripts/      # Deploy and ops scripts
```

Source packages (`usc`, `ecfr`, `fr`) depend only on `core`, never on each other. The CLI depends on all source packages. The MCP server (`mcp`) is fully independent -- it has no dependency on `core` or any source package, connecting to the Data API instead.

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

Use `--filter` to target a specific package:

```bash
pnpm turbo build --filter=@lexbuild/core
pnpm turbo test --filter=@lexbuild/usc
pnpm turbo lint --filter=@lexbuild/cli
```

## Code Standards

LexBuild enforces strict coding standards across all packages:

- **TypeScript strict mode** -- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **ESM only** -- all imports use ESM syntax with `.js` extensions on relative imports
- **`import type`** for type-only imports
- **`unknown` over `any`** -- if `any` is truly needed, add an ESLint disable comment explaining why
- **Prettier formatting** -- double quotes, trailing commas, 100 character print width

## Testing

LexBuild uses [Vitest](https://vitest.dev/) with co-located test files. A module and its tests share the same directory:

```
packages/core/src/xml/
├── parser.ts
├── parser.test.ts
├── uslm-elements.ts
└── uslm-elements.test.ts
```

Write descriptive test names that state the specific behavior under test:

```typescript
describe("renderSection", () => {
  it("converts <subsection> with chapeau to indented bold-lettered paragraph", () => {
    // ...
  });
});
```

Run all tests or target a specific package:

```bash
pnpm turbo test
pnpm turbo test --filter=@lexbuild/core
```

To run a single test file in watch mode:

```bash
cd packages/usc
pnpm exec vitest src/converter.test.ts
```

Snapshot tests verify Markdown output stability. Update snapshots intentionally when you change rendering behavior:

```bash
cd packages/usc
pnpm exec vitest run --update
```

## Making Changes

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes.** Follow the code standards above.

3. **Run the full check suite** before submitting:

   ```bash
   pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
   ```

4. **Create a changeset** for version bumping. Changesets track which packages changed and what kind of change it was (patch, minor, major):

   ```bash
   pnpm changeset
   ```

   Follow the prompts to select affected packages and describe the change.

5. **Commit using Conventional Commits** format:

   ```
   feat(core): add support for new element type
   fix(cli): handle empty title list gracefully
   chore(ecfr): update test fixtures
   ```

   Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`. Scopes: `core`, `usc`, `ecfr`, `fr`, `cli`, `mcp`, `astro`, `api`.

6. **Submit a pull request** to `main`.

## Package Boundaries

Source packages are independent by design. Each source package (`usc`, `ecfr`, `fr`) depends only on `@lexbuild/core` and never imports from another source package. This boundary is enforced by ESLint `no-restricted-imports` rules.

When adding a new source package, add it to the restriction lists of all existing source packages in `eslint.config.js`.
