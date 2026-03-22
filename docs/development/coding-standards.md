# Coding Standards

These conventions apply across all packages in the LexBuild monorepo.

## TypeScript

### Strict Mode

Three critical compiler flags are enabled in every `tsconfig.json`:

- **`strict: true`** -- enables all strict type-checking options.
- **`noUncheckedIndexedAccess: true`** -- array and record indexing returns `T | undefined`, preventing silent undefined access.
- **`exactOptionalPropertyTypes: true`** -- distinguishes between `undefined` and "missing" for optional properties.

### ESM Only

Every `package.json` declares `"type": "module"`. All imports use ESM syntax. Relative imports must include the `.js` extension:

```typescript
import { renderSection } from "./renderer.js";
```

### Type-Only Imports

Use `import type` when importing values that are only used in type positions:

```typescript
import type { ConvertOptions } from "./converter.js";
```

### Interface Over Type

Prefer `interface` for object shapes. Interfaces produce clearer error messages and support declaration merging:

```typescript
// Preferred
interface ConvertOptions {
  input: string;
  output: string;
  granularity: "section" | "chapter" | "title";
}

// Use type for unions, intersections, and mapped types
type LevelType = "title" | "chapter" | "section";
type NodeWithChildren = LevelNode & { children: ASTNode[] };
```

### Unknown Over Any

Use `unknown` instead of `any`. If `any` is genuinely required, add an ESLint disable comment with an explanation:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SAX parser callback types are untyped
function handleEvent(data: any): void { ... }
```

### JSDoc Comments

All exported functions, types, and interfaces must have JSDoc comments:

```typescript
/**
 * Convert a single USC XML file to Markdown at the specified granularity.
 *
 * @param options - Conversion configuration including input path, output directory, and granularity.
 * @returns Summary of sections written, files created, and estimated token counts.
 */
export async function convertTitle(options: ConvertOptions): Promise<ConvertResult> { ... }
```

### Barrel Exports

Each package has an `index.ts` barrel file in `src/`. External consumers import through the barrel; internal modules import directly:

```typescript
// External (from another package)
import { renderSection, ASTBuilder } from "@lexbuild/core";

// Internal (within the same package)
import { renderSection } from "./markdown/renderer.js";
```

## Naming Conventions

| Category | Convention | Examples |
|---|---|---|
| Files | `kebab-case.ts` | `ast-builder.ts`, `parse-titles.ts` |
| Types / Interfaces | `PascalCase` | `SectionNode`, `ConvertOptions` |
| Functions | `camelCase` | `parseIdentifier`, `renderSection` |
| Constants | `UPPER_SNAKE_CASE` | `USLM_NAMESPACE`, `FORMAT_VERSION` |
| Enum-like objects | `PascalCase` keys, `as const satisfies` | -- |
| Test files | `.test.ts` suffix | `converter.test.ts` |

### Project Name

Use "LexBuild" (mixed case) in prose, descriptions, and titles. Use lowercase `lexbuild` for package names (`@lexbuild/*`), CLI commands (`lexbuild convert-usc`), URLs, directory paths, and code identifiers.

## Error Handling

### XML Parsing: Warn and Continue

The SAX parser encounters malformed and anomalous XML structures in real-world legal documents. Log a warning and continue processing rather than throwing:

```typescript
if (!expectedElement) {
  console.warn(`Unexpected element <${name}> at line ${line}, skipping`);
  return;
}
```

### File I/O: Throw with Context

Include the file path and operation in the error message. Use `cause` chaining to preserve the original error:

```typescript
throw new Error(`Failed to write section file: ${filePath}`, { cause: err });
```

### Never Swallow Silently

Every caught error must produce at least a `warn`-level log message. Silent `catch {}` blocks are not permitted.

### Custom Error Classes

Use custom error classes when error type needs to be programmatically distinguishable:

```typescript
export class DownloadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DownloadError";
  }
}
```

## Formatting

Prettier enforces consistent formatting across the entire repository.

| Setting | Value |
|---|---|
| Quotes | Double |
| Trailing commas | All |
| Print width | 100 |
| Semicolons | Yes |
| Tab width | 2 |

Run formatting:

```bash
# Format all files
pnpm format

# Check without modifying
pnpm format:check
```

## Commit Messages

Loosely follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `chore` | Build, CI, dependency updates |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `style` | Adding or updating styles |

### Scopes

| Scope | Package |
|---|---|
| `core` | `@lexbuild/core` |
| `usc` | `@lexbuild/usc` |
| `ecfr` | `@lexbuild/ecfr` |
| `cli` | `@lexbuild/cli` |
| `astro` | `@lexbuild/astro` |
