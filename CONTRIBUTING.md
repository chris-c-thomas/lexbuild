# Contributing to law2md

Thanks for your interest in contributing to law2md! This guide covers the basics for getting set up and submitting changes.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20 LTS
- [pnpm](https://pnpm.io/) >= 10

## Setup

```bash
git clone https://github.com/chris-c-thomas/law2md.git
cd law2md
pnpm install
pnpm turbo build
```

## Development Workflow

### Common Commands

```bash
pnpm turbo build        # Build all packages
pnpm turbo test         # Run all tests
pnpm turbo lint         # Lint all packages
pnpm turbo typecheck    # Type-check all packages
pnpm turbo dev          # Watch mode (rebuild on change)
```

To scope commands to a single package:

```bash
pnpm turbo test --filter=@law2md/core
pnpm turbo test --filter=@law2md/usc
pnpm turbo test --filter=law2md
```

### Running the CLI Locally

```bash
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output
node packages/cli/dist/index.js download --title 1
```

### Formatting

```bash
pnpm format             # Auto-format all files
pnpm format:check       # Check formatting without writing
```

## Project Structure

```
packages/
  core/    @law2md/core — XML parsing, AST, Markdown rendering, shared utilities
  usc/    @law2md/usc — U.S. Code conversion logic and OLRC downloader
  cli/    law2md — CLI entry point (the published npm package)
```

The `core` package provides the general-purpose pipeline. The `usc` package adds U.S. Code-specific handling. The `cli` package wires everything together as a command-line tool.

## Code Conventions

- **TypeScript strict mode** — `strict: true`, `noUncheckedIndexedAccess: true`
- **ESM only** — all packages use `"type": "module"`
- **`import type`** for type-only imports
- **`interface`** over `type` for object shapes
- **`unknown`** over `any` — if `any` is truly needed, add an eslint-disable comment with justification
- **Files**: `kebab-case.ts`
- **Types/Interfaces**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

See [CLAUDE.md](CLAUDE.md) for the full conventions reference, USLM schema details, and design decisions.

## Testing

Tests are co-located with source files (`parser.ts` → `parser.test.ts`).

```bash
pnpm turbo test                          # Run all tests
pnpm turbo test --filter=@law2md/usc     # Run one package
```

### Snapshot Tests

Output stability is protected by snapshot tests in `packages/usc/src/snapshot.test.ts`. Expected output files live in `fixtures/expected/`.

If you intentionally change rendering output:

```bash
cd packages/usc && pnpm exec vitest run --update
```

Review the diff in `fixtures/expected/` to confirm only intended changes, then commit the updated snapshots.

### Test Fixtures

- `fixtures/fragments/` — Small synthetic XML snippets for unit tests (committed)
- `fixtures/expected/` — Pinned expected output for snapshot tests (committed)
- `xml/` — Full USC XML files (gitignored, download with `law2md download`)

## Submitting Changes

1. Fork the repository and create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass: `pnpm turbo build && pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck`
4. Write descriptive commit messages using [conventional commits](https://www.conventionalcommits.org/) (e.g., `feat(core):`, `fix(usc):`, `docs:`)
5. Open a pull request against `main`

### PR Checklist

- [ ] Tests pass (`pnpm turbo test`)
- [ ] Lint clean (`pnpm turbo lint`)
- [ ] Type-check clean (`pnpm turbo typecheck`)
- [ ] New features include tests
- [ ] Snapshot updates are intentional and reviewed
- [ ] Commit messages follow conventional commit format

## Changesets

This project uses [changesets](https://github.com/changesets/changesets) for versioning. If your change affects published package behavior:

```bash
pnpm changeset
```

Follow the prompts to describe your change and select the appropriate version bump (patch, minor, major). The changeset file will be committed with your PR and consumed during the next release.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
