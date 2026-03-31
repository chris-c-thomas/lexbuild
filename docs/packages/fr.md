# @lexbuild/fr

Federal Register source package for LexBuild. Converts Federal Register XML (GPO/SGML-derived format from the FederalRegister.gov API) into structured Markdown. This package includes its own AST builder (`FrASTBuilder`) because the FR XML format is document-centric and flat, unlike the hierarchical structures of USLM or eCFR.

The package depends on `@lexbuild/core` for the XML parser, AST types, Markdown renderer, frontmatter generator, link resolver, and resilient file I/O. It does not depend on `@lexbuild/usc` or `@lexbuild/ecfr` -- source packages are independent by design.

## Module Map

```
packages/fr/src/
  index.ts                 # Barrel exports
  converter.ts             # Conversion orchestrator
  converter.test.ts        # 6 integration tests
  fr-builder.ts            # FR SAX --> AST state machine
  fr-builder.test.ts       # 16 unit tests
  fr-elements.ts           # FR XML element classification (~92 elements) + FrDocumentType
  fr-frontmatter.ts        # Build FrontmatterData from FR context + API JSON
  fr-frontmatter.test.ts   # 27 unit tests
  fr-path.ts               # Date-based output path builder
  fr-path.test.ts          # 8 unit tests
  downloader.ts            # FederalRegister.gov API client
```

## Public API

| Export | Type | Purpose |
|--------|------|---------|
| `convertFrDocuments(options)` | Function | Convert FR XML files to Markdown |
| `downloadFrDocuments(options)` | Function | Download FR documents by date range |
| `downloadSingleFrDocument(number, output)` | Function | Download a single document by number |
| `buildFrApiListUrl(from, to, page, types?)` | Function | Build API listing URL |
| `buildFrFrontmatter(node, ctx, xmlMeta, jsonMeta?)` | Function | Build frontmatter from AST + metadata |
| `buildFrOutputPath(number, date, root)` | Function | Build output file path |
| `buildFrDownloadXmlPath(number, date, root)` | Function | Build download XML file path |
| `buildFrDownloadJsonPath(number, date, root)` | Function | Build download JSON file path |
| `FrASTBuilder` | Class | SAX-to-AST builder for FR GPO/SGML XML |

## Key Design Differences from Other Sources

The Federal Register is fundamentally different from the U.S. Code and eCFR:

1. **Document-centric, not hierarchical.** Each FR document (rule, notice, proposed rule, presidential document) is self-contained with a preamble, body, and signature. There is no title/chapter/section hierarchy within documents.

2. **Temporal corpus.** The FR is an ever-growing historical record, not a current-state snapshot like the U.S. Code or CFR. Output is organized by date (`output/fr/{YYYY}/{MM}/`) rather than by title.

3. **Dual ingestion.** The FederalRegister.gov API provides both structured JSON metadata (40+ fields including agencies, CFR references, docket IDs, effective dates) and XML full text per document. The converter reads both to produce enriched Markdown with comprehensive frontmatter.

4. **No granularity options.** FR documents are already atomic -- one file per document. No `--granularity` flag is needed.

5. **Date-based download.** Uses `--from`/`--to` date range flags instead of `--titles`/`--all`.

## AST Builder Architecture

The `FrASTBuilder` uses the same stack-based SAX pattern as `EcfrASTBuilder` but adapted for FR's flat structure:

- Each document element (`RULE`, `NOTICE`, `PRORULE`, `PRESDOCU`) pushes a `"document"` frame and emits a single `LevelNode(levelType: "section")` when closed.
- Preamble metadata (`AGENCY`, `SUBAGY`, `CFR`, `SUBJECT`, `RIN`) is extracted into `FrDocumentXmlMeta` during parsing.
- Preamble sections (`AGY`, `ACT`, `SUM`, `DATES`, `ADD`, `FURINF`) render as bold-labeled content nodes.
- `SUPLINF` content (headings, paragraphs) becomes the document body.
- `REGTEXT` blocks render as labeled content with amendment instructions.
- `SIG` blocks render as signature note nodes.
- `FRDOC` text is parsed to extract the document number (e.g., `[FR Doc. 2026-06029 ...]` --> `2026-06029`).
- GPOTABLE elements (`BOXHD`/`CHED`/`ROW`/`ENT`) are collected into `TableNode` objects.

## Download Architecture

The downloader queries the FederalRegister.gov API (`/documents.json`) with date range and optional type filters. Key behaviors:

- **Month chunking.** The API caps results at 10,000 per query. The downloader automatically breaks large date ranges into month-sized chunks to stay under this limit.
- **Dual file output.** Each document produces both a `.json` metadata sidecar and a `.xml` full text file in the download directory.
- **Retry with backoff.** Transient errors (429, 503, 504) are retried with exponential backoff.
- **Pre-2000 handling.** Documents before January 2000 have JSON metadata but no XML full text. These are skipped during download with a count reported in the result.

## Frontmatter Fields

FR documents produce these fields in addition to standard LexBuild frontmatter:

| Field | Source | Description |
|-------|--------|-------------|
| `document_number` | XML/JSON | FR document number (e.g., `"2026-06029"`) |
| `document_type` | XML/JSON | `rule`, `proposed_rule`, `notice`, `presidential_document` |
| `fr_citation` | JSON | Full citation (e.g., `"91 FR 15619"`) |
| `fr_volume` | JSON | Volume number |
| `publication_date` | JSON | Publication date (YYYY-MM-DD) |
| `agencies` | XML/JSON | List of agency names |
| `cfr_references` | XML/JSON | Affected CFR titles/parts |
| `docket_ids` | JSON | Docket identifiers |
| `rin` | XML/JSON | Regulation Identifier Number |
| `effective_date` | JSON | When the rule takes effect |
| `comments_close_date` | JSON | Comment period end date |
| `fr_action` | JSON | Action description (e.g., `"Final rule."`) |

Standard fields use FR-specific conventions: `title_number: 0`, `title_name: "Federal Register"`, `section_number` = document number, `positive_law: false`, `legal_status: "authoritative_unofficial"`.

## Output Structure

```
output/fr/
  2026/
    01/
      2026-00123.md
    03/
      2026-06029.md
      2026-06048.md
```

## Data Source

| Field | Detail |
|-------|--------|
| API | `federalregister.gov/api/v1/` |
| Authentication | None required |
| Rate limits | No documented limits |
| Coverage | JSON from 1994, XML from 2000 |
| Update cadence | Daily (business days) |
| Volume | ~28,000--31,000 documents/year |
| Legal status | Unofficial -- only authenticated PDF has legal standing |

## Dependencies

Imports from `@lexbuild/core`: `XMLParser`, `LevelNode`, `EmitContext`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, `renderDocument`, `createLinkResolver`, `writeFile`, `mkdir`.

Does not import from `@lexbuild/usc` or `@lexbuild/ecfr`. Element classification (emphasis maps, inline elements) is duplicated per package boundary rules enforced by ESLint `no-restricted-imports`.
