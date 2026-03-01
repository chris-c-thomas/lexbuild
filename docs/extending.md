# Extending law2md

This guide describes how the `law2md` architecture could support new legal source types beyond the U.S. Code.

> **Note**: The extension architecture described here is aspirational. The current codebase only supports U.S. Code (USLM 1.0). Adding a new source type would require building out the abstractions described below. The monorepo structure and `@law2md/core` package are designed to make this feasible, but no pluggable handler interfaces exist yet.

---

## Current Architecture

Today, element handling is built directly into the `ASTBuilder` class in `@law2md/core`. It maps USLM element names to AST node types using a static lookup table. The `@law2md/usc` package orchestrates the pipeline (XML stream, AST builder, renderer, file writer) but does not register custom handlers.

To add a new source type, you would:

1. Create a new package (e.g., `@law2md/cfr`)
2. Implement a converter function analogous to `convertTitle()` in `@law2md/usc`
3. Reuse `@law2md/core` for XML parsing, AST types, Markdown rendering, frontmatter, and link resolution
4. Add a new CLI command in `packages/cli`
5. If the source uses different XML element names or semantics, either:
   - Extend the `ASTBuilder` to handle them, or
   - Create a source-specific builder that produces the same AST node types

---

## Potential Source Types

| Source | XML Format | Provider | Package |
|--------|-----------|----------|---------|
| U.S. Code | USLM 1.0 | OLRC (uscode.house.gov) | `@law2md/usc` (implemented) |
| Code of Federal Regulations | USLM 2.x | GPO (govinfo.gov) | `@law2md/cfr` |
| Federal Register | USLM 2.x | GPO (govinfo.gov) | `@law2md/fr` |
| State statutes | Varies (HTML/XML) | State legislature sites | `@law2md/state-{abbr}` |

---

## Adding a New Source: General Approach

### 1. Create the Package

```bash
mkdir -p packages/{source}/src
```

Create `packages/{source}/package.json` with a dependency on `@law2md/core`:

```json
{
  "name": "@law2md/{source}",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@law2md/core": "workspace:*"
  }
}
```

### 2. Implement a Converter

Create a converter function that orchestrates the pipeline. The USC converter (`packages/usc/src/converter.ts`) is the reference implementation. The general pattern:

1. Create a `ReadStream` for the input XML
2. Configure the `XMLParser` (may need a different default namespace)
3. Configure the `ASTBuilder` with `emitAt` set to the appropriate granularity level
4. In the `onEmit` callback, render each emitted node to Markdown and write to disk
5. After all nodes are emitted, generate `_meta.json` index files

### 3. Implement a Downloader (Optional)

If the source has a bulk download endpoint, implement a download function following the pattern in `packages/usc/src/downloader.ts`.

### 4. Register with the CLI

Add a new command in `packages/cli/src/commands/`:

```typescript
// packages/cli/src/commands/convert-cfr.ts
import { convertCFR } from "@law2md/cfr";
// ... commander setup
```

### 5. Document the Source

Create a `packages/{source}/README.md` documenting the XML schema, element hierarchy, download URLs, and known edge cases.

---

## CFR-Specific Notes

The Code of Federal Regulations has a different hierarchy than the U.S. Code:

```
Title > Subtitle > Chapter > Subchapter > Part > Subpart > Section
```

CFR titles are numbered 1-50. The XML is available from GPO's govinfo bulk data repository in USLM 2.x format. Key differences from USLM 1.0:

- USLM 2.x uses a different namespace URI
- CFR has `<authority>` and `<source>` elements not present in USC
- CFR sections are numbered differently (e.g., `§ 1.1`, `§ 240.10b-5`)
- CFR has an annual revision cycle (titles are revised on a rolling quarterly basis)
- Bulk XML download: `https://www.govinfo.gov/bulkdata/CFR/{year}/title-{N}/`

---

## State Statute Notes

State statutes are the most heterogeneous source. There is no universal XML schema. Common approaches:

- **Illinois (ILCS)**: Available as HTML from ilga.gov. Requires HTML-to-AST parsing rather than XML-to-AST.
- **California**: Available in XML from leginfo.legislature.ca.gov, but uses a custom schema.
- **Uniform Law Commission**: Model acts are available in USLM-like XML.

For HTML sources, a shared HTML-to-AST parser could convert legal HTML to the core AST types, then let source-specific packages handle semantic interpretation.

---

## What Core Provides

Regardless of source type, `@law2md/core` provides:

- `XMLParser` — SAX streaming parser with namespace normalization
- `ASTBuilder` — Stack-based tree construction with configurable emit level
- AST node types — `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc.
- `renderDocument()` / `renderSection()` — AST-to-Markdown rendering
- `generateFrontmatter()` — YAML frontmatter generation
- `createLinkResolver()` — Cross-reference resolution with fallback URLs
- `FORMAT_VERSION` / `GENERATOR` — Output format metadata constants
