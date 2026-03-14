# Coding Standards

LexBuild follows a consistent set of TypeScript, naming, error handling, and formatting conventions across all packages. These standards keep the codebase readable and predictable, especially as new source packages and contributors are added. This page is the single reference for all code conventions -- when in doubt about style or patterns, check here first.

## TypeScript

### Strict Mode

All packages use strict TypeScript with three critical compiler flags:

| Flag | Effect |
|------|--------|
| `strict: true` | Enables all strict type-checking options (strict null checks, strict function types, no implicit any, etc.) |
| `noUncheckedIndexedAccess: true` | Array and object index access returns `T \| undefined`, forcing explicit null checks |
| `exactOptionalPropertyTypes: true` | Distinguishes between `prop?: string` (missing) and `prop: string \| undefined` (present but undefined) |

These flags catch a wide class of bugs at compile time. Do not weaken or disable them in any package.

### ESM Only

All packages use ECMAScript modules (`"type": "module"` in every `package.json`). There is no CommonJS anywhere in the codebase. Import paths in source code must include the `.js` extension for relative imports:

```typescript
import { XMLParser } from "./xml/parser.js";
```

### Type-Only Imports

Use `import type` for imports that are only used as types. This ensures they are erased at compile time and do not create runtime dependencies:

```typescript
// Correct -- type-only import
import type { LevelNode, EmitContext } from "@lexbuild/core";

// Correct -- mixed import (values and types)
import { ASTBuilder } from "@lexbuild/core";
import type { ASTBuilderOptions } from "@lexbuild/core";
```

### Interface Over Type

Prefer `interface` over `type` for object shapes. Interfaces provide better error messages in the TypeScript compiler output and support declaration merging:

```typescript
// Preferred
interface ConvertOptions {
  input: string;
  output: string;
  granularity: "section" | "chapter" | "title";
}

// Avoid for object shapes
type ConvertOptions = {
  input: string;
  output: string;
  granularity: "section" | "chapter" | "title";
};
```

Use `type` for unions, intersections, mapped types, and other constructs that `interface` cannot express.

### Unknown Over Any

Use `unknown` instead of `any`. If `any` is truly necessary, add an `eslint-disable` comment with a justification explaining why `unknown` is not sufficient:

```typescript
// Preferred
function parseValue(input: unknown): string {
  if (typeof input !== "string") throw new Error("Expected string");
  return input;
}

// When any is unavoidable, explain why
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saxesHandler = parser as any; // saxes typings don't expose internal handler interface
```

### JSDoc Comments

All exported functions, types, and interfaces must have JSDoc comments. Internal functions benefit from comments too, but they are not mandatory:

```typescript
/**
 * Converts a single U.S. Code XML file to structured Markdown.
 *
 * The conversion follows the collect-then-write pattern: all sections are collected
 * during SAX parsing, then written to disk after parsing completes.
 */
export async function convertTitle(options: ConvertOptions): Promise<ConvertResult> {
  // ...
}
```

### Barrel Exports

Each package has a barrel `index.ts` in its `src/` directory that re-exports the package's public API. All imports from outside the package should go through the barrel:

```typescript
// packages/core/src/index.ts
export { XMLParser } from "./xml/parser.js";
export { ASTBuilder } from "./ast/builder.js";
export type { LevelNode, ContentNode, InlineNode } from "./ast/types.js";
export { renderDocument, renderSection } from "./markdown/renderer.js";
// ...
```

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| Files | `kebab-case.ts` | `ast-builder.ts`, `parse-titles.ts`, `link-resolution.ts` |
| Types / Interfaces | `PascalCase` | `SectionNode`, `ConvertOptions`, `EmitContext` |
| Functions | `camelCase` | `parseIdentifier`, `renderSection`, `buildChapterDir` |
| Constants | `UPPER_SNAKE_CASE` | `USLM_NAMESPACE`, `FORMAT_VERSION`, `CURRENT_RELEASE_POINT` |
| Enum-like objects | `PascalCase` keys, `as const satisfies` | `const LevelTypes = { ... } as const satisfies Record<string, string>` |
| Test files | Same name with `.test.ts` suffix | `converter.ts` and `converter.test.ts` |

### Project Name Usage

- **"LexBuild"** in prose, descriptions, and titles (capital L, capital B).
- **`lexbuild`** (all lowercase) for package names (`@lexbuild/*`), CLI commands (`lexbuild convert`), URLs, directory paths, and code identifiers.

## Error Handling

Error handling follows three rules based on the error source:

### XML Parsing Errors: Warn and Continue

The U.S. Code XML contains anomalous structures -- non-standard nesting, missing elements, unexpected attributes. The parser should log a warning and continue processing, not crash:

```typescript
// Log the anomaly, don't throw
console.warn(`Unexpected element <${name}> inside <${parent}>; skipping`);
```

This approach ensures that a single malformed element does not prevent the rest of a 100 MB title from being converted.

### File I/O Errors: Throw with Context

File system errors should throw with enough context for the caller to understand what went wrong:

```typescript
throw new Error(`Failed to write section file: ${filePath}`, { cause: err });
```

Use the `cause` option to chain the underlying error. This preserves the full error chain for debugging while providing a human-readable message.

### Never Swallow Errors Silently

Every error must produce at least a `warn`-level log message. Silent `catch {}` blocks are not acceptable:

```typescript
// Never do this
try {
  await writeFile(path, content);
} catch {
  // silently ignored
}

// Do this instead
try {
  await writeFile(path, content);
} catch (err) {
  console.warn(`Failed to write ${path}: ${err}`);
  throw err;
}
```

### Custom Error Classes

Use custom error classes extending `Error` with `cause` chaining when the error type needs to be distinguishable programmatically:

```typescript
export class DownloadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DownloadError";
  }
}
```

## Formatting

The project uses Prettier for formatting with these settings:

| Setting | Value |
|---------|-------|
| Quotes | Double quotes |
| Trailing commas | All (including function parameters) |
| Print width | 100 characters |
| Semicolons | Yes |

Run formatting manually:

```bash
pnpm format           # Auto-format all files
pnpm format:check     # Check formatting without writing
```

Formatting is checked in CI. PRs with formatting violations will fail the lint step.

## Commit Messages

LexBuild uses [conventional commits](https://www.conventionalcommits.org/). Every commit message follows this format:

```
<type>(<scope>): <description>
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `chore` | Build, CI, dependency updates, version bumps |
| `refactor` | Code restructuring with no behavior change |
| `test` | Adding or updating tests |

### Scopes

Scopes are optional but recommended when a change is scoped to a specific package:

| Scope | Package |
|-------|---------|
| `core` | `@lexbuild/core` |
| `usc` | `@lexbuild/usc` |
| `cli` | `@lexbuild/cli` |
| `web` | `apps/web/` |

### Examples

```
feat(core): add support for <proviso> elements in content blocks
fix(usc): handle duplicate section numbers in Title 5
docs: update conversion pipeline architecture diagram
chore: bump v1.4.2
refactor(cli): extract title parser into separate module
test(usc): add snapshot test for repealed section output
```

## Internal Dependencies

Internal packages reference each other using pnpm's `workspace:*` protocol:

```json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}
```

This always resolves to the local version during development. When packages are published, `workspace:*` is automatically replaced with the concrete version number.
