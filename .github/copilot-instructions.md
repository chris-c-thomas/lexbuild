# LexBuild Workspace Instructions

## Scope

These instructions apply to all work in this repository. Keep changes minimal, targeted, and consistent with existing package boundaries. See `CLAUDE.md` for the full USLM schema reference, design decisions, and common pitfalls.

## Project Overview

LexBuild converts U.S. legislative XML (USLM schema) into structured Markdown for AI/RAG ingestion. It is a monorepo built with Turborepo, pnpm workspaces, TypeScript, and Node.js.

## Build and Test

Run commands from the repository root. Always use `pnpm`, not `npm`.

```bash
pnpm install
pnpm turbo build
pnpm turbo test
pnpm turbo typecheck
pnpm turbo lint
```

Package-scoped pattern:

```bash
pnpm turbo <task> --filter=@lexbuild/core
pnpm turbo <task> --filter=@lexbuild/usc
pnpm turbo <task> --filter=@lexbuild/cli
```

Run the CLI locally during development:

```bash
node packages/cli/dist/index.js download --titles 1
node packages/cli/dist/index.js convert --all
node packages/cli/dist/index.js convert --titles 1-5 -o ./test-output
```

## Architecture

This is a Turborepo + pnpm monorepo with three packages:

- `packages/core` (`@lexbuild/core`): namespace-aware XML parsing (SAX via `saxes`), AST building, Markdown rendering, frontmatter generation, shared utilities.
- `packages/usc` (`@lexbuild/usc`): USC-specific conversion pipeline and OLRC downloader. Contains `convertTitle()` which orchestrates ReadStream → SAX → AST → Markdown → file writer.
- `packages/cli` (`@lexbuild/cli`): CLI commands (`convert`, `download`), terminal UI (`chalk`, `ora`, `cli-table3`), and user-facing command surface.

Respect boundaries: keep generic parsing/rendering logic in `core`, USC-specific behavior in `usc`, and CLI orchestration in `cli`. Internal packages use `workspace:*` protocol for dependencies.

### Key files

- `packages/core/src/xml/parser.ts` — SAX streaming parser with namespace normalization
- `packages/core/src/ast/builder.ts` — Stack-based XML-to-AST construction with section-emit pattern
- `packages/core/src/markdown/renderer.ts` — Stateless AST-to-Markdown conversion
- `packages/core/src/markdown/frontmatter.ts` — YAML frontmatter generation
- `packages/core/src/xml/namespace.ts` — Namespace constants and element classification sets
- `packages/usc/src/converter.ts` — Full USC conversion pipeline orchestrator
- `packages/usc/src/downloader.ts` — OLRC download logic, `CURRENT_RELEASE_POINT` constant
- `packages/cli/src/ui.ts` — Terminal output formatting (spinners, tables, summary blocks)
- `packages/cli/src/parse-titles.ts` — Title spec parser (`1-5,8,11`)

## Tech Stack

- **Runtime**: Node.js >= 20 LTS (ESM only)
- **Language**: TypeScript 5.x, strict mode
- **XML Parsing**: `saxes` (SAX streaming)
- **CLI**: `commander`, `chalk`, `ora`, `cli-table3`
- **YAML**: `yaml` package
- **Zip**: `yauzl`
- **Testing**: `vitest`
- **Build**: `tsup`
- **Linting**: ESLint + `@typescript-eslint` + Prettier
- **Versioning**: `@changesets/cli` with lockstep versioning

## Code Style

- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- ESM imports/exports only (`"type": "module"` in all package.json files)
- Prefer `interface` over `type` for object shapes
- Use `import type` for type-only imports
- Avoid `any`; use `unknown` unless a justified exception is required with an eslint-disable comment
- Add JSDoc for all exported functions and types
- Barrel exports via `index.ts` in each package `src/`
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Prettier: double quotes, trailing commas, 100 char print width

## Error Handling

- Use custom error classes extending `Error` with `cause` chaining
- XML parsing errors: warn and continue (don't crash on anomalous structures)
- File I/O errors: throw with context (file path, operation attempted)
- Never swallow errors silently — at minimum, log at `warn` level

## Testing Conventions

- Co-locate tests with implementation files (`parser.ts` → `parser.test.ts`)
- Use `describe` blocks mirroring the module's exported API
- Name test cases descriptively: `it("converts <subsection> with chapeau to indented bold-lettered paragraph")`
- Snapshot tests in `packages/usc/src/snapshot.test.ts` with expected output in `fixtures/expected/`
- Update snapshots intentionally: `cd packages/usc && pnpm exec vitest run --update`
- Fixtures: `fixtures/fragments/` (synthetic XML, committed), `fixtures/expected/` (snapshots, committed)
- Commit messages: [conventional commits](https://www.conventionalcommits.org/) (e.g., `feat(core):`, `fix(usc):`, `docs:`)

## Key Design Decisions

- **SAX over DOM**: Large titles exceed 100MB. SAX streaming keeps memory bounded.
- **Section as atomic unit**: Each section is its own Markdown file. Subsections render inline, not as separate files.
- **Collect-then-write**: Sections are collected during SAX streaming and written after the stream completes.
- **Frontmatter + sidecar**: YAML frontmatter on every .md file AND `_meta.json` per directory.
- **Notes included by default**: All notes are included. Disable with `--no-include-notes` or selectively filter with `--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`.
- **Token estimation**: character/4 heuristic in `_meta.json`.

## XML/USLM Pitfalls

- Treat XML as namespace-aware: XHTML tables are in `http://www.w3.org/1999/xhtml`, inline `<b>`/`<i>` are in the USLM namespace.
- Do not assume strict legal hierarchy nesting — the schema is intentionally permissive.
- Handle anomalous/repealed/empty sections without crashing; output should still be produced.
- Handle interstitial `<continuation>` (between same-level elements, not just after sub-levels).
- Handle multi-paragraph `<content>` (multiple `<p>` elements).
- `<section>` inside `<quotedContent>` must not emit standalone files — track `quotedContentDepth`.
- Some titles have duplicate section numbers — output disambiguated with `-2` suffix.

## Output File Naming

```
output/usc/title-{NN}/chapter-{NN}/section-{N}.md
```

- Title dirs: zero-padded (`title-01` through `title-54`)
- Chapter dirs: zero-padded (`chapter-01`, `chapter-02`)
- Section files: NOT zero-padded, may be alphanumeric (`section-7801.md`, `section-106a.md`)
- Appendix titles: separate directories (`title-05-appendix/`)

## References

See these docs for deeper detail:

- `CLAUDE.md` — Full USLM schema reference, identifier format, namespaces, notes taxonomy, status values, download URLs
- `CONTRIBUTING.md` — Setup, workflow, PR checklist, changesets
- `docs/architecture/overview.md` — System overview, package design, data flow
- `docs/reference/output-format.md` — Directory layout, frontmatter schema, metadata indexes, RAG guidance
- `docs/reference/xml-element-reference.md` — Element-by-element conversion reference
- `docs/development/extending.md` — Guide for adding new legal source types
