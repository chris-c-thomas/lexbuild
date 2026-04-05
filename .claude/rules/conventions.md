# LexBuild Development Conventions

This document defines the coding conventions, architectural rules, and quality standards for the LexBuild monorepo. Follow these rules for all new code and modifications. When in doubt, match the patterns already established in the codebase.

---

## TypeScript

### Strict Mode

All packages use strict TypeScript. These compiler flags are non-negotiable:

- `strict: true`
- `noUncheckedIndexedAccess: true` (array/record indexing returns `T | undefined`)
- `exactOptionalPropertyTypes: true` (distinguishes `undefined` from "missing")

Do not add `@ts-ignore` or `@ts-expect-error` without an accompanying comment explaining why. Prefer fixing the type error.

### ESM Only

Every `package.json` declares `"type": "module"`. All imports use ESM syntax. Relative imports must include the `.js` extension:

```ts
import { renderSection } from "./renderer.js";
```

### Type-Only Imports

Use `import type` for type-only imports. This is enforced by ESLint (`consistent-type-imports`):

```ts
import type { ConvertOptions } from "./converter.js";
```

### Interface Over Type

Prefer `interface` for object shapes. Use `type` for unions, intersections, mapped types, and utility types:

```ts
// Object shapes
interface ConvertOptions {
  input: string;
  output: string;
}

// Unions, intersections, mapped types
type LevelType = "title" | "chapter" | "section";
type NodeWithChildren = LevelNode & { children: ASTNode[] };
```

### Unknown Over Any

Use `unknown` instead of `any`. If `any` is genuinely required, add an ESLint disable comment with an explanation:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SAX parser callback types are untyped
function handleEvent(data: any): void { ... }
```

### Indexed Array Iteration

`noUncheckedIndexedAccess` makes `arr[i]` return `T | undefined`, and `no-non-null-assertion` forbids `arr[i]!`. Use destructuring iteration:

```ts
for (const [i, item] of arr.entries()) {
  // `item` is typed as T, not T | undefined
}
```

### Barrel Exports

Each package has an `index.ts` barrel file in `src/` that re-exports the public API. Internal modules are not exported from the barrel.

### Nullish Coalescing vs. Logical OR

`??` does not catch empty strings. `"" ?? "fallback"` returns `""`. Use `||` when empty strings should be treated as falsy.

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Project name (prose) | `LexBuild` | "LexBuild converts..." |
| Package names, CLI, URLs, paths, code identifiers | `lexbuild` (lowercase) | `@lexbuild/core`, `lexbuild convert-usc` |
| Files | `kebab-case.ts` | `section-builder.ts` |
| Types / Interfaces | `PascalCase` | `SectionNode`, `ConvertOptions` |
| Functions | `camelCase` | `parseIdentifier`, `renderSection` |
| Constants | `UPPER_SNAKE_CASE` | `USLM_NAMESPACE` |
| Enum-like objects | `PascalCase` keys, `as const satisfies` | `LevelType.Section` |
| CLI commands | `{action}-{source}` | `download-usc`, `convert-ecfr` |

---

## Formatting (Prettier)

These settings are enforced by Prettier and must not be overridden per-file:

| Setting | Value |
|---|---|
| Quotes | Double |
| Trailing commas | All |
| Print width | 100 |
| Semicolons | Yes |
| Tab width | 2 |

---

## Commenting Standard

### Core Principles

1. Comments explain **why**, not **what**.
2. TypeScript is the source of truth for types. Never duplicate type information in comments.
3. Comments must add value or be removed.
4. Code should be readable without relying on comments.

### Exported / Public APIs

All exported functions, classes, and key modules require a docblock:

```ts
/**
 * Converts a parsed XML section into normalized Markdown output.
 *
 * Assumes the input node has already passed structural validation.
 *
 * @param node - Parsed XML section node
 * @param context - Shared pipeline context
 * @returns Markdown document with associated metadata
 * @throws {ConversionError} When required elements are missing
 */
```

Rules for docblocks:

- One-line summary is required.
- `@param` only when the meaning is not obvious from the name and type.
- `@returns` describes semantic output, not the return type.
- `@throws` when the function can throw.
- Do not repeat TypeScript types in JSDoc tags (no `@param {string} id`).
- Do not document trivial functions.

### Internal / Private Code

Do not require docblocks for private or internal helpers. Use inline comments only when they fall into one of these categories:

- **Invariants:** `// At this stage, IDs must already be normalized`
- **Reasoning:** `// Preserve ordering for downstream heading generation`
- **Performance:** `// Stream to avoid loading large XML files into memory`
- **Edge cases:** `// Handle malformed upstream nodes missing wrappers`
- **Constraints:** `// Do not collapse whitespace; citation formatting depends on it`

### Prohibited Comments

Remove or avoid writing:

- Redundant: `// Loop through items`
- Type duplication: `/** @param id string */`
- Obvious: `// Increment counter`
- Stale or incorrect: outdated explanations, comments contradicting implementation

### File-Level Comments

Only include when the file has architectural significance (pipeline entrypoints, parsers, AST definitions, orchestration modules, public boundaries). Keep concise: responsibilities, scope, constraints.

### Complex Functions

Break long functions using numbered section comments only for complex multi-phase flows:

```ts
// 1. Normalize input
// 2. Transform structure
// 3. Emit output
```

### TODOs

All TODOs must be actionable, specific, and use this format:

```ts
// TODO(lexbuild): Actionable description
```

Remove vague TODOs. Do not leave `// TODO: fix this` or similar.

---

## Error Handling

- Use custom error classes extending `Error` with `cause` chaining.
- When re-throwing in catch blocks, always attach `{ cause: err }` (enforced by `preserve-caught-error` lint rule).
- XML parsing errors: warn and continue. Do not crash on anomalous structures.
- File I/O errors: throw with context (file path, operation attempted).
- Never swallow errors silently. At minimum, log at `warn` level.
- No silent `catch {}` blocks.

```ts
export class DownloadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DownloadError";
  }
}
```

---

## Testing (Vitest)

- Co-locate test files: `parser.ts` -> `parser.test.ts` in the same directory.
- Use `describe` blocks mirroring the module's exported API.
- Snapshot tests for Markdown output stability. Update snapshots intentionally, not casually.
- Name test cases descriptively: `it("converts <subsection> with chapeau to indented bold-lettered paragraph")`.
- Non-null assertions (`!`) are allowed in test files (ESLint rule disabled for `**/*.test.ts`).
- Shared test data lives in `fixtures/` at the repo root. Reference via relative paths.

---

## Monorepo Architecture

### Package Boundaries

Source packages (`packages/usc/`, `packages/ecfr/`, `packages/fr/`) are independent. They depend only on `@lexbuild/core`, never on each other. This is enforced by `no-restricted-imports` rules in `eslint.config.js`.

When adding a new source package:

1. Add its `no-restricted-imports` block to `eslint.config.js`.
2. Add it to the restriction lists of all existing source packages.
3. Add it to the `fixed` array in `.changeset/config.json`.

### Dependency Protocol

Internal dependencies use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}
```

### Turborepo Tasks

- `build` uses `"dependsOn": ["^build"]` to respect the dependency graph.
- Apps (`apps/astro/`, `apps/api/`) are excluded from default `pnpm turbo build`. They use dedicated tasks (`build:astro`, `build:api`).
- `lint` depends on `transit` (not `^build`) for cross-package import resolution.
- `dev` is `persistent: true`, `cache: false`.

### Knip (Dead Code Detection)

Knip runs at root level via `pnpm lint:knip`. It is not wrapped in the Turborepo pipeline. Config file must be `knip.jsonc` (not `knip.config.jsonc`).

### Changesets (Versioning)

All published packages use lockstep versioning via Changesets. After changesets bump `packages/*`, also update `version` in root `package.json` and `apps/astro/package.json` to match, and add a corresponding entry to root `CHANGELOG.md`.

---

## Build Configuration (tsup)

Library packages (`core`, `usc`, `ecfr`, `fr`) share an identical tsup config:

```ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

The CLI package adds a shebang banner. The API app bundles npm dependencies but keeps native modules external. Do not deviate from these patterns without justification.

---

## Package Layout

Every package follows this structure:

```
packages/{name}/
├── src/
│   ├── index.ts        # Barrel exports (public API)
│   ├── *.ts            # Module files
│   └── *.test.ts       # Co-located tests
├── dist/               # Build output (gitignored)
├── package.json
├── tsconfig.json       # Extends root tsconfig
├── tsup.config.ts
└── CLAUDE.md           # Package architecture notes
```

Every package defines the same script set: `build`, `dev`, `typecheck`, `test`, `lint`, `lint:fix`.

---

## Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`.

Scopes: `core`, `usc`, `ecfr`, `fr`, `cli`, `astro`, `api`.

---

## Astro (Web App)

- Astro 6 SSR with Node.js adapter.
- Template expressions (`{}`) are plain JS, not TypeScript. Move complex typed logic to the `---` frontmatter section.
- Analytics scripts use `is:inline` to prevent Astro's build pipeline from bundling them as modules.
- Content is gitignored. The app has no code dependency on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`.
- Fonts: IBM Plex Sans (body), Serif (display), Mono (code) via `@fontsource`. No other font families.

---

## Hono (Data API)

- Hono + `@hono/zod-openapi` for contract-first API design.
- SQLite via `better-sqlite3` with `readonly: true` on the content database connection.
- Two separate databases: `lexbuild.db` (content, read-only) and `lexbuild-keys.db` (API keys, read-write).
- `better-sqlite3` native bindings are platform-specific. macOS binaries do not work on Linux.
- `better-sqlite3` requires explicit approval in root `package.json` under `pnpm.onlyBuiltDependencies`.

---

## Infrastructure

- Self-managed VPS (AWS Lightsail) behind Cloudflare CDN/WAF and Caddy reverse proxy.
- PM2 for process management. `ecosystem.config.cjs` reads secrets from `process.env`.
- `.env.production` is generated by `scripts/deploy.sh` on every deploy, never manually maintained.
- Secrets live in `~/.lexbuild-secrets` on the VPS, sourced from `~/.zshenv`.

---

## Writing Style (Documentation and Copy)

- Avoid overuse of hyphens in prose.
- Ora spinner text should NOT end with `...` (the spinner animation provides the "in progress" cue).
- Prefer clear, direct language. No filler or marketing fluff.

---

## Review Checklist

When writing or reviewing code, verify:

- [ ] Exported APIs have docblocks.
- [ ] No redundant or type-duplicating comments.
- [ ] Comments reflect current behavior.
- [ ] `import type` used for type-only imports.
- [ ] No `any` without an eslint-disable comment explaining why.
- [ ] Errors are chained with `{ cause: err }` when re-thrown.
- [ ] Package boundaries are respected (no cross-source-package imports).
- [ ] Test cases are descriptively named.
- [ ] Files use `kebab-case.ts` naming.
- [ ] Prettier formatting is applied (double quotes, trailing commas, 100 char width).
