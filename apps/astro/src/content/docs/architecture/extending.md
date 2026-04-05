---
title: Adding a New Source
description: Step-by-step guide for extending LexBuild with a new legal source package, from creating the package to registering CLI commands and configuring build tooling.
order: 4
---

LexBuild is designed as a platform for converting multiple legal source types into structured Markdown. The monorepo structure and shared `@lexbuild/core` package provide the foundation for adding new sources. The eCFR and FR packages validate this extensibility model -- both were built from scratch with completely different XML schemas (hierarchical DIV-based eCFR vs flat document-centric FR) while reusing core's entire rendering pipeline.

This guide walks through adding a new source package using "cfr" (annual Code of Federal Regulations) as an example. The same pattern applies to any new legal source.

## Step 1: Create the Package

Create `packages/cfr/` with the standard package structure:

```
packages/cfr/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── CLAUDE.md
└── src/
    ├── index.ts          # Barrel exports (public API)
    ├── builder.ts        # Source-specific AST builder (if XML differs from USLM)
    ├── converter.ts      # Collect-then-write converter
    ├── downloader.ts     # Bulk data fetcher (optional)
    ├── frontmatter.ts    # Source-specific frontmatter construction
    └── paths.ts          # Output path computation
```

Your `package.json` must follow monorepo conventions:

```json
{
  "name": "@lexbuild/cfr",
  "version": "1.10.1",
  "type": "module",
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "...",
    "tsup": "...",
    "typescript": "..."
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

The `pnpm-workspace.yaml` glob covers `packages/*` automatically, so no workspace configuration changes are needed.

## Step 2: Implement a Source-Specific AST Builder

If your source XML format differs from USLM, you need a custom builder. The key contract is that your builder must produce valid AST node types from `@lexbuild/core`: `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, and others.

Follow the same stack-based, emit-at-level pattern used by the existing builders:

```typescript
import type { LevelNode, EmitContext, LevelType } from "@lexbuild/core";

interface CfrBuilderOptions {
  emitAt: LevelType;
  onEmit: (node: LevelNode, context: EmitContext) => void;
}

export class CfrASTBuilder {
  constructor(private options: CfrBuilderOptions) {}

  onOpenElement(name: string, attrs: Record<string, string>): void {
    // Classify element and push appropriate stack frame
  }

  onCloseElement(name: string): void {
    // Pop frame, attach node to parent, emit if at configured level
  }

  onText(text: string): void {
    // Append text to current frame's collector
  }
}
```

If the new source uses USLM (like a USLM 2.x format), you may be able to extend or reuse core's `ASTBuilder` directly.

The eCFR package proves this pattern works with radically different XML. Its `EcfrASTBuilder` handles GPO/SGML XML with DIV-based hierarchy and flat paragraph numbering, yet produces the same AST types that core's renderer consumes.

## Step 3: Implement a Converter

Follow the collect-then-write pattern used by the existing converters:

1. Create a read stream from the source XML file.
2. Configure `XMLParser` and your builder with the target `emitAt` granularity.
3. Collect emitted nodes synchronously in the `onEmit` callback.
4. After parsing completes: compute output paths, register links, render each node, and write files.

The synchronous collection during SAX parsing avoids backpressure issues. All async file I/O happens after the parse stream ends.

```typescript
import { createReadStream } from "node:fs";
import { XMLParser, renderDocument, createLinkResolver, writeFile, mkdir } from "@lexbuild/core";
import type { LevelNode, EmitContext } from "@lexbuild/core";

interface CollectedSection {
  node: LevelNode;
  context: EmitContext;
}

export async function convertCfrTitle(options: CfrConvertOptions): Promise<CfrConvertResult> {
  const collected: CollectedSection[] = [];

  const builder = new CfrASTBuilder({
    emitAt: options.granularity,
    onEmit: (node, context) => {
      collected.push({ node, context }); // synchronous -- no await
    },
  });

  // Parse the XML stream
  const parser = new XMLParser(/* ... */);
  const stream = createReadStream(options.input);
  // ... wire parser events to builder ...

  // After parsing: iterate collected[], render, and write files
  for (const { node, context } of collected) {
    const markdown = renderDocument(node, frontmatter, renderOptions);
    await writeFile(outputPath, markdown);
  }
}
```

Use core's resilient `writeFile` and `mkdir` instead of `node:fs/promises` directly. These wrappers retry on `ENFILE`/`EMFILE` errors that occur when writing thousands of files.

Reference implementations: `convertTitle()` in `@lexbuild/usc` and `convertEcfrTitle()` in `@lexbuild/ecfr`.

## Step 4: Implement a Downloader (Optional)

If the source provides bulk data downloads, implement a downloader following the pattern from the USC or eCFR downloaders. The converter should also accept a local file path so users can convert previously downloaded files.

## Step 5: Create Barrel Exports

Create `src/index.ts` re-exporting the public API:

```typescript
export { convertCfrTitle } from "./converter.js";
export type { CfrConvertOptions, CfrConvertResult } from "./converter.js";
export { CfrASTBuilder } from "./builder.js";
export { downloadCfrTitles } from "./downloader.js";
```

Remember that all relative imports must include the `.js` extension (ESM convention).

## Step 6: Register CLI Commands

Add `download-cfr` and `convert-cfr` commands in `@lexbuild/cli`:

1. Create `src/commands/download-cfr.ts` and `src/commands/convert-cfr.ts` in the CLI package.
2. Follow the `{action}-{source}` naming convention.
3. Add `"@lexbuild/cfr": "workspace:*"` to the CLI's `package.json` dependencies.
4. Register the commands in the CLI's main entry point.

## Step 7: Add Tests

Follow the project's testing conventions:

- Co-locate test files alongside source: `builder.ts` and `builder.test.ts` in the same directory.
- Add small XML fragments to `fixtures/fragments/` at the repo root for unit tests.
- Add expected Markdown output to `fixtures/expected/` for integration tests.
- Use snapshot tests for output stability.
- Name test cases descriptively: `it("converts section with nested paragraphs to indented bold-lettered content")`.

## Step 8: Configure Monorepo Integration

Several configuration files need updates to fully integrate your new package.

### Add to Changesets

Add the package name to the `fixed` array in `.changeset/config.json` so it participates in lockstep versioning with all other published packages.

### Add SourceType

Add a new value to the `SourceType` union in `packages/core/src/ast/types.ts`:

```typescript
type SourceType = "usc" | "ecfr" | "fr" | "cfr";
```

If your source needs additional frontmatter fields, add them as optional properties on the `FrontmatterData` interface in the same file.

### Update Link Resolution

If your source uses a new identifier scheme, update the link resolver in `packages/core/src/markdown/links.ts` to handle it. You will need to add resolution logic and a fallback URL pattern for unresolvable references.

### Configure ESLint Boundary Enforcement

Source packages must be independent -- they depend only on `@lexbuild/core`, never on each other. ESLint `no-restricted-imports` rules in `eslint.config.js` enforce this.

When adding a new source package:

1. Add a `no-restricted-imports` block for your package that prevents it from importing any other source package.
2. Add your package to the restriction lists of all existing source packages.

For example, after adding `@lexbuild/cfr`, the eCFR package's restriction block should include `@lexbuild/cfr`, and your new package's block should list `@lexbuild/usc`, `@lexbuild/ecfr`, and `@lexbuild/fr`.

### Add Documentation

Create a `CLAUDE.md` in the package root documenting:

- The XML schema your source uses
- Builder architecture and element classification
- Edge cases and known anomalies
- Identifier format and link resolution behavior

## What Core Provides

Any source that produces valid AST nodes gets the following from `@lexbuild/core` for free:

| Module | Key Exports | Purpose |
|---|---|---|
| `xml/parser.ts` | `XMLParser` | Streaming SAX parser wrapping saxes |
| `ast/types.ts` | `LevelNode`, `ContentNode`, `InlineNode`, etc. | AST type definitions |
| `ast/types.ts` | `EmitContext`, `DocumentMeta`, `AncestorInfo` | Metadata and context types |
| `ast/types.ts` | `BIG_LEVELS`, `SMALL_LEVELS`, `LEVEL_TYPES` | Level classification constants |
| `ast/types.ts` | `SourceType`, `LegalStatus`, `FrontmatterData` | Frontmatter type definitions |
| `ast/uslm-builder.ts` | `ASTBuilder` | USLM XML to AST conversion (reusable if source uses USLM) |
| `markdown/renderer.ts` | `renderDocument`, `renderSection`, `renderNode` | AST to Markdown rendering |
| `markdown/frontmatter.ts` | `generateFrontmatter`, `FORMAT_VERSION` | YAML frontmatter generation |
| `markdown/links.ts` | `createLinkResolver`, `parseIdentifier` | Cross-reference resolution |
| `fs.ts` | `writeFile`, `mkdir` | Resilient file I/O with retry on descriptor exhaustion |

## The Independence Constraint

Source packages must never import from each other. This ensures that adding or modifying one source cannot break another. The CLI is the only package that depends on multiple source packages. If you find yourself wanting to share logic between two source packages, that logic belongs in `@lexbuild/core`.
