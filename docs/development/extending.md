# Extending LexBuild

LexBuild is designed as a platform for converting multiple legal source types into structured Markdown. It currently supports the U.S. Code (`@lexbuild/usc`) and the eCFR (`@lexbuild/ecfr`). The monorepo structure and shared `@lexbuild/core` package provide the foundation for adding new sources. The eCFR package validates this extensibility model as it was built from scratch with a completely different XML schema while reusing the core's entire rendering pipeline.

## Adding a New Source Package

This walkthrough uses "cfr" (annual Code of Federal Regulations) as an example. The same pattern applies to any new legal source.

### Step 1: Create the Package

Create `packages/cfr/` with a standard package structure:

```
packages/cfr/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── converter.ts
    ├── builder.ts        # if source XML differs from USLM
    └── downloader.ts     # if source has bulk data
```

The `package.json` must follow monorepo conventions:

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
  }
}
```

The `pnpm-workspace.yaml` glob covers `packages/*` automatically, so no workspace configuration changes are needed.

### Step 2: Implement a Source-Specific AST Builder

If the source XML format differs from USLM, create a custom builder that produces the same AST node types defined in `@lexbuild/core`. The key contract: your builder must produce valid `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, and other AST types from `@lexbuild/core`.

The eCFR package proves this pattern works with radically different XML. Its `EcfrASTBuilder` handles GPO/SGML XML with DIV-based hierarchy and flat paragraph numbering, yet produces the same AST types that core's renderer consumes.

Your builder should follow the same stack-based, emit-at-level pattern:

```typescript
import type { LevelNode, EmitContext, LevelType } from "@lexbuild/core";

interface CfrBuilderOptions {
  emitAt: LevelType;
  onEmit: (node: LevelNode, context: EmitContext) => void;
}
```

If the new source uses USLM (like the annual CFR USLM 2.x format), you may be able to extend or reuse core's `ASTBuilder` directly.

### Step 3: Implement a Converter

Follow the collect-then-write pattern used by both existing converters:

1. Create a `ReadStream` from the source XML file
2. Configure `XMLParser` and your builder with the target `emitAt` granularity
3. Collect emitted nodes synchronously in the `onEmit` callback
4. After parsing completes: render each collected node and write files

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
  // ... pipe stream through parser ...

  // After parsing: iterate collected[], render, and write files
  for (const { node, context } of collected) {
    const markdown = renderDocument(node, frontmatter, renderOptions);
    await writeFile(outputPath, markdown);
  }
}
```

Use core's resilient `writeFile` and `mkdir` from `@lexbuild/core` instead of `node:fs/promises` directly. These wrappers retry on `ENFILE`/`EMFILE` errors that can occur when writing thousands of files.

Reference implementations: `convertTitle()` in `@lexbuild/usc` and `convertEcfrTitle()` in `@lexbuild/ecfr`.

### Step 4: Implement a Downloader

If the source provides bulk data downloads, implement a downloader following the pattern from the USC or eCFR downloaders. Downloaders are optional -- the converter should also accept a local file path.

### Step 5: Create Barrel Exports

Create `src/index.ts` re-exporting the public API:

```typescript
export { convertCfrTitle } from "./converter.js";
export type { CfrConvertOptions, CfrConvertResult } from "./converter.js";
export { CfrASTBuilder } from "./builder.js";
export { downloadCfrTitles } from "./downloader.js";
```

### Step 6: Register CLI Commands

Add `download-cfr` and `convert-cfr` commands in `@lexbuild/cli`:

1. Create `src/commands/download-cfr.ts` and `src/commands/convert-cfr.ts` in the CLI package
2. Follow the `{action}-{source}` naming convention
3. Add `"@lexbuild/cfr": "workspace:*"` to the CLI's `package.json` dependencies
4. Register commands in the CLI's main entry point

### Step 7: Add Tests

Follow the project's testing conventions:

- Co-locate test files alongside source: `builder.ts` and `builder.test.ts` in the same directory
- Add small XML fragments to `fixtures/fragments/` for unit tests
- Add expected Markdown output to `fixtures/expected/` for integration tests
- Use snapshot tests for output stability

### Step 8: Document and Configure

Complete the integration:

1. Add a `CLAUDE.md` in the package root documenting the XML schema, builder architecture, and edge cases
2. Add the package name to the `fixed` array in `.changeset/config.json` for lockstep versioning
3. Add a new `SourceType` value to `packages/core/src/ast/types.ts` (e.g., `"cfr"`)
4. Add any source-specific optional fields to the `FrontmatterData` interface in core
5. Update link resolution in `packages/core/src/markdown/links.ts` if the source uses a new identifier scheme

## What Core Provides

Source packages reuse a significant amount of shared infrastructure from `@lexbuild/core`. Any source that produces valid AST nodes gets rendering, frontmatter, link resolution, and output consistency for free.

| Module | Key Exports | Purpose |
|--------|-------------|---------|
| `xml/parser.ts` | `XMLParser` | Streaming SAX parser wrapping `saxes` |
| `xml/uslm-elements.ts` | Element classification sets | USLM element dispatch (source packages define their own) |
| `ast/types.ts` | `LevelNode`, `ContentNode`, `InlineNode`, etc. | AST type definitions |
| `ast/types.ts` | `EmitContext`, `DocumentMeta`, `AncestorInfo` | Metadata and context types |
| `ast/types.ts` | `BIG_LEVELS`, `SMALL_LEVELS`, `LEVEL_TYPES` | Level classification constants |
| `ast/types.ts` | `SourceType`, `LegalStatus`, `FrontmatterData` | Frontmatter type definitions |
| `ast/uslm-builder.ts` | `ASTBuilder` (aliased as `UslmASTBuilder`) | USLM XML to AST conversion |
| `markdown/renderer.ts` | `renderDocument`, `renderSection`, `renderNode` | AST to Markdown rendering |
| `markdown/frontmatter.ts` | `generateFrontmatter`, `FORMAT_VERSION`, `GENERATOR` | YAML frontmatter generation |
| `markdown/links.ts` | `createLinkResolver`, `parseIdentifier` | Cross-reference resolution |
| `fs.ts` | `writeFile`, `mkdir` | Resilient file I/O with retry on descriptor exhaustion |

## Independence Constraint

Source packages must be independent -- they depend only on `@lexbuild/core`, never on each other. This ensures that adding or modifying one source cannot break another. The CLI is the only package that depends on multiple source packages.

## Adding an Application

Applications live in `apps/` and consume LexBuild's output files, not its packages. The Astro web app (`apps/astro/`) demonstrates this pattern -- it has no `workspace:*` dependencies on any `@lexbuild/*` package.

Application conventions:

- Set `"private": true` in `package.json`
- Use a distinct build script name (e.g., `build:astro` instead of `build`) so Turborepo's default `build` task does not include it
- Add to the `ignore` array in `.changeset/config.json`
- Keep content directories gitignored -- content is a build artifact, not source
