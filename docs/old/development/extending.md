# Extending LexBuild

LexBuild is designed as a platform for converting multiple legal source types into structured Markdown. Today it supports the U.S. Code (via `@lexbuild/usc`), but the monorepo structure and the shared `@lexbuild/core` package provide the foundation for adding new sources -- the Code of Federal Regulations, state statutes, the Federal Register, and others. This guide walks through the process of adding a new source package, describes what core provides out of the box, and covers integration patterns for applications that consume LexBuild output.

## Current Architecture

Element handling is built directly into the `ASTBuilder` class in `@lexbuild/core`. It maps USLM element names to AST node types using static lookup sets defined in the namespace module (`LEVEL_ELEMENTS`, `CONTENT_ELEMENTS`, `INLINE_ELEMENTS`, `NOTE_ELEMENTS`, etc.). The `@lexbuild/usc` package orchestrates the pipeline -- XML streaming, AST construction, rendering, file writing -- but does not register custom element handlers.

There is no pluggable handler registry yet. Adding a source with a substantially different XML schema would require extending or adapting the `ASTBuilder`, or creating a source-specific builder that produces the same AST node types. The key contract is the AST type system: as long as a source package produces `LevelNode`, `ContentNode`, `InlineNode`, and the other node types defined in core, it can use the full rendering pipeline.

## Adding a New Source Package

The following steps use `cfr` (Code of Federal Regulations) as an example. Replace `cfr` with your source identifier throughout.

### Step 1: Create the Package

```bash
mkdir -p packages/cfr/src
```

Create `packages/cfr/package.json`:

```json
{
  "name": "@lexbuild/cfr",
  "version": "1.4.2",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^3.2.1",
    "tsup": "^8.5.0",
    "typescript": "^5.8.3"
  }
}
```

Create `packages/cfr/tsconfig.json` matching the project conventions (strict mode, ESM, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

Verify the new package is covered by the workspace glob in `pnpm-workspace.yaml`. The existing `"packages/*"` pattern covers all directories under `packages/`, so no change should be needed.

Then install dependencies:

```bash
pnpm install
```

### Step 2: Implement a Converter

The converter is the central orchestrator for a source package. It wires together the SAX parser, AST builder, renderer, and file writer. The reference implementation is `convertTitle()` in `packages/usc/src/converter.ts`.

Create `packages/cfr/src/converter.ts`:

```typescript
import { createReadStream } from "node:fs";
import {
  XMLParser,
  ASTBuilder,
  renderDocument,
  generateFrontmatter,
  createLinkResolver,
} from "@lexbuild/core";

import type { LevelNode, EmitContext } from "@lexbuild/core";

interface ConvertOptions {
  input: string;
  output: string;
  granularity: "section" | "chapter" | "title";
  // ... source-specific options
}

interface ConvertResult {
  sectionsWritten: number;
  files: string[];
  // ... source-specific results
}

export async function convertRegulation(options: ConvertOptions): Promise<ConvertResult> {
  const { input, output, granularity } = options;

  // 1. Collect emitted nodes synchronously during parsing
  const collected: Array<{ node: LevelNode; context: EmitContext }> = [];
  const builder = new ASTBuilder({
    emitAt: granularity,
    onEmit: (node, context) => {
      collected.push({ node, context });
    },
  });

  // 2. Stream and parse
  const parser = new XMLParser(builder);
  const stream = createReadStream(input, { encoding: "utf-8" });
  await parser.parseStream(stream);

  // 3. Write phase: render and write each collected node
  const linkResolver = createLinkResolver();
  const files: string[] = [];
  for (const { node, context } of collected) {
    const frontmatter = generateFrontmatter(node, context);
    const markdown = renderDocument(node, frontmatter, {
      linkResolver: linkResolver.resolve,
    });
    // Write markdown to output path based on source-specific conventions
    // ...
  }

  return { sectionsWritten: collected.length, files };
}
```

The general pattern follows the same collect-then-write approach used by `@lexbuild/usc`:

1. Create a `ReadStream` for the input XML.
2. Configure the `XMLParser` and `ASTBuilder` with the appropriate `emitAt` granularity.
3. Collect all emitted AST nodes synchronously in the `onEmit` callback (no async I/O during SAX processing).
4. After parsing completes, render each node to Markdown and write to disk.
5. Generate sidecar metadata (`_meta.json` index files) if applicable.

If the source uses a different XML schema (e.g., USLM 2.x for CFR, or HTML for state statutes), you may need to extend or replace the `ASTBuilder`. The constraint is that the output must produce the same AST node types defined in `@lexbuild/core`. This ensures the Markdown renderer, frontmatter generator, and link resolver work unchanged.

### Step 3: Implement a Downloader (Optional)

If the source has a bulk download endpoint, implement a download function. Follow the pattern in `packages/usc/src/downloader.ts`:

```typescript
export async function downloadRegulations(options: DownloadOptions): Promise<DownloadResult> {
  // Fetch from bulk data endpoint
  // Extract from ZIP if needed (use yauzl for streaming extraction)
  // Write XML/HTML files to the download directory
}
```

For reference, the USC downloader supports two modes: a single bulk ZIP for all 54 titles, and per-title downloads. It uses `yauzl` for streaming ZIP extraction.

### Step 4: Create Barrel Exports

Create `packages/cfr/src/index.ts` exporting the public API:

```typescript
export { convertRegulation } from "./converter.js";
export { downloadRegulations } from "./downloader.js";
export type { ConvertOptions, ConvertResult, DownloadOptions, DownloadResult } from "./types.js";
```

Follow the project convention of barrel exports via `index.ts` in each package.

### Step 5: Register CLI Commands

Add a new command in `packages/cli/src/commands/`:

```typescript
// packages/cli/src/commands/convert-cfr.ts
import { Command } from "commander";
import { convertRegulation } from "@lexbuild/cfr";

export const convertCfrCommand = new Command("convert-cfr")
  .description("Convert CFR XML to Markdown")
  .option("-o, --output <dir>", "Output directory", "./output")
  // ... source-specific options
  .action(async (options) => {
    // Delegate to convertRegulation()
  });
```

Update `packages/cli/src/index.ts` to register the new command, and add the dependency to `packages/cli/package.json`:

```json
{
  "dependencies": {
    "@lexbuild/cfr": "workspace:*"
  }
}
```

### Step 6: Add Tests

Follow the existing test patterns:

- **Co-locate test files** with source code: `converter.ts` and `converter.test.ts` in the same directory.
- **Create XML fixtures** in `fixtures/fragments/` for unit tests. Keep them minimal -- just enough XML to exercise the behavior under test.
- **Create expected output files** in `fixtures/expected/` for snapshot tests.
- **Write descriptive test names**: `it("converts CFR <authority> to blockquote")`.

See [Testing](testing.md) for the full testing guide, including how snapshot tests work and when to update them.

### Step 7: Document the Source

Create a `CLAUDE.md` in the package root (`packages/cfr/CLAUDE.md`) documenting:

- The XML schema and element hierarchy
- Download URLs and data format
- Known edge cases and anomalies
- Any differences from the standard AST mapping or output format

### Step 8: Add to Changeset Configuration

Add the new package to the `fixed` array in `.changeset/config.json` so it participates in lockstep versioning:

```json
{
  "fixed": [["@lexbuild/core", "@lexbuild/usc", "@lexbuild/cfr", "@lexbuild/cli"]]
}
```

## What Core Provides

Every source package builds on `@lexbuild/core`. Here is the full set of reusable infrastructure:

| Module | Exports | Purpose |
|--------|---------|---------|
| `xml/parser.ts` | `XMLParser` | Streaming SAX parser with namespace normalization |
| `ast/builder.ts` | `ASTBuilder` | Stack-based XML-to-AST conversion with configurable emit level |
| `ast/types.ts` | `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, `TOCNode`, etc. | AST node type definitions |
| `ast/types.ts` | `EmitContext`, `DocumentMeta` | Metadata passed alongside emitted nodes |
| `ast/types.ts` | `BIG_LEVELS`, `SMALL_LEVELS` | Level classification sets |
| `markdown/renderer.ts` | `renderDocument`, `renderSection`, `renderNode` | AST-to-Markdown conversion |
| `markdown/frontmatter.ts` | `generateFrontmatter`, `FORMAT_VERSION`, `GENERATOR` | YAML frontmatter generation and versioning constants |
| `markdown/links.ts` | `createLinkResolver` | Cross-reference resolution with fallback URLs |
| `xml/namespace.ts` | `LEVEL_ELEMENTS`, `CONTENT_ELEMENTS`, `INLINE_ELEMENTS`, etc. | Element classification sets for namespace-aware parsing |

The key benefit: any source package that produces valid AST nodes gets Markdown rendering, frontmatter generation, link resolution, and output format consistency for free. Downstream consumers (RAG pipelines, search indexes, the Astro app) work identically regardless of which source produced the Markdown.

## Adding an Application

The `apps/` directory hosts applications that consume LexBuild output. Apps are not published to npm -- they live in the monorepo for convenience and as reference implementations.

### Creating an App

```bash
mkdir -p apps/{app-name}
```

Apps typically:

1. **Read the converted Markdown** from the output directory.
2. **Parse YAML frontmatter** using the `yaml` package (or any YAML parser).
3. **Use `_meta.json` indexes** for directory-level metadata without parsing individual files.
4. **Follow the output format spec** for consistent access patterns.

### Important Conventions for Apps

- Apps have `"private": true` in `package.json` and are listed in the changeset `ignore` array.
- Apps are excluded from the default `pnpm turbo build` pipeline. Use a distinct script name (e.g., `build:astro` instead of `build`).
- Apps have no `workspace:*` dependency on any `@lexbuild/*` package. They consume output files, not package code.
- Generated content directories should be gitignored.

### Existing Apps

| App | Description | Stack |
|-----|-------------|-------|
| `apps/astro/` | Documentation site -- browse U.S. Code and eCFR with search and navigation | Astro 6, Tailwind CSS v4, React islands |

## Integration Patterns

### Direct File Consumption

Read `.md` files and `_meta.json` from the output directory. This is the simplest approach and works for any language or framework. No dependency on LexBuild packages is required.

### Programmatic via Packages

Import `@lexbuild/core` types for frontmatter schema validation or AST manipulation:

```typescript
import type { FrontmatterData } from "@lexbuild/core";
```

### Pipeline Integration

Run LexBuild as a build step, then process the output:

```bash
lexbuild download --all
lexbuild convert --all -o ./data
# Your application reads from ./data/usc/
```

## Potential Future Sources

| Source | Format | Provider | Package |
|--------|--------|----------|---------|
| U.S. Code | USLM 1.0 XML | OLRC (uscode.house.gov) | `@lexbuild/usc` (implemented) |
| Code of Federal Regulations | USLM 2.x XML | GPO (govinfo.gov) | `@lexbuild/cfr` |
| Federal Register | USLM 2.x XML | GPO (govinfo.gov) | `@lexbuild/fr` |
| State statutes | Varies (HTML/XML) | State legislature sites | `@lexbuild/state-{abbr}` |

For HTML-based sources (like Illinois Compiled Statutes), a shared HTML-to-AST parser could convert legal HTML into core AST types, letting source-specific packages handle semantic interpretation.
