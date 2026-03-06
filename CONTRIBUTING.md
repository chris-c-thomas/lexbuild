# Contributing to LexBuild

Thanks for your interest in contributing! This guide covers everything you need to get set up and submit changes.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20 LTS
- [pnpm](https://pnpm.io/) >= 10

## Setup

```bash
git clone https://github.com/chris-c-thomas/lexbuild.git
cd lexbuild
pnpm install
pnpm turbo build
```

Verify everything is working:

```bash
pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
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
pnpm turbo build --filter=@lexbuild/core
pnpm turbo test --filter=@lexbuild/usc
pnpm turbo test --filter=@lexbuild/cli
```

### Running the CLI Locally

After building, run the CLI directly from the dist output:

```bash
node packages/cli/dist/index.js download --titles 1
node packages/cli/dist/index.js convert --titles 1-5 -o ./output
node packages/cli/dist/index.js convert ./downloads/usc/xml/usc01.xml -o ./output
```

### Formatting

```bash
pnpm format             # Auto-format all files
pnpm format:check       # Check formatting without writing
```

Formatting is enforced by Prettier (double quotes, trailing commas, 100 char print width).

## Project Structure

```
packages/
  core/    @lexbuild/core — XML parsing, AST, Markdown rendering, shared utilities
  usc/    @lexbuild/usc — U.S. Code conversion logic and OLRC downloader
  cli/    @lexbuild/cli — CLI entry point (the published npm package)
```

The `core` package provides the general-purpose XML-to-Markdown pipeline. The `usc` package adds U.S. Code-specific handling. The `cli` package wires everything together as a command-line tool. Internal packages use `workspace:*` protocol for dependencies.

## Code Conventions

### TypeScript

- **Strict mode** — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **ESM only** — all packages use `"type": "module"`
- **`import type`** for type-only imports
- **`interface`** over `type` for object shapes
- **`unknown`** over `any` — if `any` is truly needed, add an eslint-disable comment with justification

### Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Files | `kebab-case.ts` | `ast-builder.ts` |
| Types / Interfaces | `PascalCase` | `SectionNode`, `ConvertOptions` |
| Functions | `camelCase` | `parseIdentifier`, `renderSection` |
| Constants | `UPPER_SNAKE_CASE` | `USLM_NAMESPACE` |

### Error Handling

- XML parsing errors: warn and continue (don't crash on anomalous structures)
- File I/O errors: throw with context (file path, operation attempted)
- Never swallow errors silently — at minimum, log at `warn` level

## Testing

Tests are co-located with source files (`parser.ts` → `parser.test.ts`).

```bash
pnpm turbo test                          # Run all tests
pnpm turbo test --filter=@lexbuild/usc     # Run one package
```

Name test cases descriptively:

```ts
it("converts <subsection> with chapeau to indented bold-lettered paragraph")
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
- `downloads/usc/xml/` — Full USC XML files (gitignored, download with `lexbuild download`)

## Submitting Changes

1. Fork the repository and create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass:
   ```bash
   pnpm turbo build && pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
   ```
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
