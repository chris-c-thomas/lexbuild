# Extending LexBuild

This guide describes how the LexBuild monorepo supports adding new legal source types beyond the U.S. Code, as well as applications that consume the converted output.

> **Note**: The extension architecture described here is aspirational in parts. The current codebase only supports U.S. Code (USLM 1.0). Adding a new source type would require building out some of the abstractions described below. The monorepo structure and `@lexbuild/core` package are designed to make this feasible, but no pluggable handler interfaces exist yet.

---

## Current Architecture

Today, element handling is built directly into the `ASTBuilder` class in `@lexbuild/core`. It maps USLM element names to AST node types using a static lookup table. The `@lexbuild/usc` package orchestrates the pipeline (XML stream, AST builder, renderer, file writer) but does not register custom handlers.

The project is structured as a monorepo with three layers:

```
packages/           ← Shared libraries (published to npm)
  core/             ← Format-agnostic foundation
  usc/              ← U.S. Code source package
  cli/              ← CLI binary
apps/               ← Applications consuming output (not published)
```

---

## Adding a New Source Package

To add support for a new legal source (e.g., CFR, state statutes), follow this pattern:

### 1. Create the Package

```bash
mkdir -p packages/{source}/src
```

Create `packages/{source}/package.json` with a dependency on `@lexbuild/core`:

```json
{
  "name": "@lexbuild/{source}",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}
```

Add the package to `pnpm-workspace.yaml` if not already covered by the glob pattern.

### 2. Implement a Converter

Create a converter function that orchestrates the pipeline. The USC converter (`packages/usc/src/converter.ts`) is the reference implementation. The general pattern:

1. Create a `ReadStream` for the input XML (or HTML)
2. Configure the `XMLParser` (may need a different default namespace)
3. Configure the `ASTBuilder` with `emitAt` set to the appropriate granularity level
4. In the `onEmit` callback, render each emitted node to Markdown and write to disk
5. After all nodes are emitted, generate `_meta.json` index files

If the source uses different XML element names or semantics, either:
- Extend the `ASTBuilder` to handle them, or
- Create a source-specific builder that produces the same AST node types

The key constraint: the output must produce the same AST node types defined in `@lexbuild/core`. This ensures the Markdown renderer, frontmatter generator, and link resolver work unchanged.

### 3. Implement a Downloader (Optional)

If the source has a bulk download endpoint, implement a download function following the pattern in `packages/usc/src/downloader.ts`.

### 4. Register with the CLI

Add a new command in `packages/cli/src/commands/`:

```typescript
// packages/cli/src/commands/convert-cfr.ts
import { convertCFR } from "@lexbuild/cfr";
// ... commander setup
```

Update `packages/cli/package.json` to add the dependency:

```json
{
  "dependencies": {
    "@lexbuild/cfr": "workspace:*"
  }
}
```

### 5. Add Tests

Follow the existing test patterns:

- Co-locate test files with source: `converter.ts` → `converter.test.ts`
- Add XML fixtures to `fixtures/fragments/` for unit tests
- Add expected output to `fixtures/expected/` for snapshot tests
- Descriptive test names: `it("converts CFR <authority> to blockquote")`

### 6. Document the Source

Create a `packages/{source}/README.md` documenting:

- The XML schema and element hierarchy
- Download URLs and data format
- Known edge cases and anomalies
- Any differences from the standard output format

---

## Potential Source Types

| Source | XML/HTML Format | Provider | Package |
|--------|----------------|----------|---------|
| U.S. Code | USLM 1.0 | OLRC (uscode.house.gov) | `@lexbuild/usc` (implemented) |
| Code of Federal Regulations | USLM 2.x | GPO (govinfo.gov) | `@lexbuild/cfr` |
| Federal Register | USLM 2.x | GPO (govinfo.gov) | `@lexbuild/fr` |
| State statutes | Varies (HTML/XML) | State legislature sites | `@lexbuild/state-{abbr}` |

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

Regardless of source type, `@lexbuild/core` provides:

- `XMLParser` — SAX streaming parser with namespace normalization
- `ASTBuilder` — Stack-based tree construction with configurable emit level
- AST node types — `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc.
- `renderDocument()` / `renderSection()` — AST-to-Markdown rendering
- `generateFrontmatter()` — YAML frontmatter generation
- `createLinkResolver()` — Cross-reference resolution with fallback URLs
- `FORMAT_VERSION` / `GENERATOR` — Output format metadata constants

---

## Adding an Application

The `apps/` directory hosts applications that consume LexBuild output. Apps are not published to npm — they live in the monorepo for convenience and to serve as reference implementations.

### Creating an App

```bash
mkdir -p apps/{app-name}
```

Apps typically:

1. **Read the converted Markdown** from the output directory
2. **Parse frontmatter** using the `yaml` package (same one used by `@lexbuild/core`)
3. **Use `_meta.json` indexes** for directory-level metadata without parsing individual files
4. **Follow the output format spec** documented in [output-format.md](output-format.md)

### Existing Apps

| App | Description | Status |
|-----|-------------|--------|
| [Web](../apps/web/) | Documentation site — browse U.S. Code with search and navigation | Complete |

### App Ideas

| App | Description | Stack |
|-----|-------------|-------|
| RAG demo | Legal Q&A system using vector embeddings of LexBuild output | LangChain/LlamaIndex, vector DB |
| MCP server | Model Context Protocol server exposing legal text to AI assistants | Node.js, MCP SDK |
| API server | REST/GraphQL API for programmatic access to converted data | Express/Fastify |
| Diff viewer | Compare sections across OLRC release points | React, diff library |

### Integration Patterns

**Direct file consumption**: Read `.md` files and `_meta.json` from the output directory. This is the simplest approach and works for any language/framework.

**Programmatic via packages**: Import `@lexbuild/core` types for frontmatter schema validation:

```typescript
import type { FrontmatterData } from "@lexbuild/core";
```

**Pipeline integration**: Run LexBuild as a build step, then process the output:

```bash
lexbuild download --all
lexbuild convert --all -o ./data
# Your app reads from ./data/usc/
```
