# Future Sources

LexBuild is designed as a platform for converting multiple legal corpora into structured Markdown, not just the U.S. Code. The monorepo architecture separates format-agnostic infrastructure in `@lexbuild/core` from source-specific logic in dedicated packages, so each new legal source follows the same pattern: a new package that produces the same AST node types, reuses the shared renderer and frontmatter generator, and registers a new CLI command.

## What Core Provides

Regardless of the input source, `@lexbuild/core` handles the common infrastructure:

| Capability | Module | What It Does |
|------------|--------|--------------|
| XML Parser | `src/xml/parser.ts` | SAX streaming with namespace normalization and typed events |
| AST Builder | `src/ast/builder.ts` | Stack-based tree construction with configurable emit level |
| AST Types | `src/ast/types.ts` | `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc. |
| Markdown Renderer | `src/markdown/renderer.ts` | Stateless AST-to-Markdown conversion with note filtering |
| Frontmatter Generator | `src/markdown/frontmatter.ts` | YAML frontmatter from structured metadata |
| Link Resolver | `src/markdown/links.ts` | Cross-reference resolution with registration and fallback URLs |

The key constraint for any new source package: it must produce the same AST node types defined in `@lexbuild/core`. This ensures that the Markdown renderer, frontmatter generator, and link resolver work identically across all sources. Downstream consumers -- RAG pipelines, search indexes, the web app -- get a consistent output format regardless of which legal corpus produced it.

## Potential Source Types

| Source | Format | Provider | Package |
|--------|--------|----------|---------|
| U.S. Code | USLM 1.0 XML | OLRC (uscode.house.gov) | `@lexbuild/usc` (implemented) |
| Code of Federal Regulations | USLM 2.x XML | GPO (govinfo.gov) | `@lexbuild/cfr` |
| Federal Register | USLM 2.x XML | GPO (govinfo.gov) | `@lexbuild/fr` |
| State statutes | Varies (HTML/XML) | State legislature sites | `@lexbuild/state-{abbr}` |

## Code of Federal Regulations (CFR)

The CFR is the most natural next source. It uses a variant of the same USLM schema and is available as bulk XML from GPO's govinfo repository.

### Hierarchy

The CFR has a different structural hierarchy than the U.S. Code:

```
Title > Subtitle > Chapter > Subchapter > Part > Subpart > Section
```

CFR titles are numbered 1-50 (distinct from USC titles 1-54). The section is still the primary citable unit, but it sits below `Part` rather than directly below `Chapter`.

### Key Differences from USC

| Aspect | USC (USLM 1.0) | CFR (USLM 2.x) |
|--------|-----------------|-----------------|
| Namespace | `http://xml.house.gov/schemas/uslm/1.0` | Different namespace URI (USLM 2.x) |
| Section numbering | `section 1`, `section 201` | `section 1.1`, `section 240.10b-5` (part-prefixed) |
| Unique elements | `<sourceCredit>`, `<notes type="uscNote">` | `<authority>`, `<source>` (regulatory provenance) |
| Update cycle | Per public law (irregular) | Annual revision, rolling quarterly basis |
| Bulk data URL | `uscode.house.gov/download/` | `govinfo.gov/bulkdata/CFR/{year}/title-{N}/` |

### Implementation Considerations

A `@lexbuild/cfr` package would need to:

- Configure the XML parser with the USLM 2.x namespace URI
- Handle CFR-specific elements (`<authority>`, `<source>`) by mapping them to appropriate AST node types
- Implement part-prefixed section numbering in file naming (e.g., `section-1.1.md`, `section-240.10b-5.md`)
- Account for the annual revision cycle in metadata and frontmatter
- Implement a downloader targeting the govinfo bulk data API

The `ASTBuilder` in `@lexbuild/core` would likely need to be extended to handle CFR-specific elements, or the CFR package would create a specialized builder that produces the same core AST types.

## Federal Register

The Federal Register shares the USLM 2.x format with CFR and is also available from govinfo. It contains daily publications of proposed rules, final rules, notices, and presidential documents. A `@lexbuild/fr` package would handle the document-oriented (rather than code-oriented) structure of Federal Register entries.

## State Statutes

State statutes present the most heterogeneous challenge. There is no universal XML schema across states, and the available formats vary widely:

| State | Format | Source | Notes |
|-------|--------|--------|-------|
| Illinois (ILCS) | HTML | ilga.gov | Requires HTML-to-AST parsing |
| California | Custom XML | leginfo.legislature.ca.gov | State-specific schema |
| Uniform Law Commission | USLM-like XML | uniformlaws.org | Closest to existing pipeline |

### Challenges

- **No standard schema**: Each state may require its own parser configuration or even a custom parser
- **HTML sources**: States like Illinois publish statutes as HTML, requiring an HTML-to-AST conversion layer rather than XML-to-AST
- **Structural variation**: State codes use different hierarchical levels (Title, Article, Division, Chapter, Section) in different orders
- **Update frequency**: Some states update on legislative session boundaries, others more frequently

### Approach

For HTML sources, a shared HTML-to-AST parser could be added to `@lexbuild/core` (or as a separate utility package) that converts legal HTML into the standard AST node types. Source-specific packages would then handle semantic interpretation -- determining which HTML elements correspond to sections, subsections, headings, and notes.

## How the Monorepo Scales

Each new source follows an identical pattern within the monorepo:

```
@lexbuild/cli
  +-- @lexbuild/usc        (U.S. Code -- USLM 1.0)
  +-- @lexbuild/cfr         (Code of Federal Regulations -- USLM 2.x)
  +-- @lexbuild/state-il    (Illinois Compiled Statutes -- HTML)
  +-- @lexbuild/core        (shared by all)
```

The steps to add a new source package:

1. **Create the package** in `packages/{source}/` with a dependency on `@lexbuild/core`
2. **Implement a converter** function analogous to `convertTitle()` in `@lexbuild/usc`
3. **Implement a downloader** if the source has a bulk data endpoint
4. **Register CLI commands** in `packages/cli/` (e.g., `lexbuild download-cfr`, `lexbuild convert-cfr`)
5. **Add test fixtures** in `fixtures/fragments/` and `fixtures/expected/`
6. **Document the source** schema and edge cases in the package README

Source packages are independent of each other. Adding `@lexbuild/cfr` does not affect `@lexbuild/usc` in any way. Turborepo handles the build graph, Changesets manages lockstep versioning, and CI validates everything together.

For the step-by-step guide to implementing a new source package, see [../development/extending.md](../development/extending.md). For the package dependency structure, see [dependency-graph.md](dependency-graph.md).
