# law2md Workspace Instructions

## Scope
These instructions apply to all work in this repository. Keep changes minimal, targeted, and consistent with existing package boundaries.

## Build and Test
Run commands from the repository root.

```bash
pnpm install
pnpm turbo build
pnpm turbo test
pnpm turbo typecheck
pnpm turbo lint
```

Useful package-scoped pattern:

```bash
pnpm turbo <task> --filter=@law2md/core
```

## Architecture
This is a Turborepo + pnpm monorepo with three packages:

- `packages/core` (`@law2md/core`): namespace-aware XML parsing, AST building, markdown rendering, shared utilities.
- `packages/usc` (`@law2md/usc`): USC-specific conversion and OLRC downloading logic.
- `packages/cli` (`law2md`): CLI commands (`convert`, `download`) and user-facing command surface.

Respect boundaries: keep generic parsing/rendering logic in `core`, USC-specific behavior in `usc`, and CLI orchestration in `cli`.

## Code Style
- Use TypeScript strict mode conventions already configured in the repo.
- Use ESM imports/exports only.
- Prefer `interface` for object shapes.
- Use `import type` for type-only imports.
- Avoid `any`; use `unknown` unless a justified exception is required.
- Add JSDoc for exported functions and types.
- Keep file naming and symbol naming consistent with existing conventions.

## Testing Conventions
- Co-locate tests with implementation files (`*.test.ts`).
- Prefer descriptive test names.
- Preserve and intentionally update markdown snapshots when behavior changes.

## XML/USLM Pitfalls
- Treat XML as namespace-aware: XHTML tables are in `http://www.w3.org/1999/xhtml`.
- Do not assume strict legal hierarchy nesting in input XML.
- Handle anomalous/repealed/empty sections without crashing; output should still be produced when applicable.
- Handle interstitial `<continuation>` and multi-paragraph `<content>` correctly.

## References
Link to source docs instead of duplicating details:

- `CLAUDE.md`
- `CONTRIBUTING.md`
- `docs/architecture.md`
- `docs/extending.md`
- `docs/output-format.md`
- `docs/xml-element-reference.md`
