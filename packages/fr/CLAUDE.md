# CLAUDE.md — @lexbuild/fr

## Package Overview

`@lexbuild/fr` converts Federal Register XML to structured Markdown. It depends on `@lexbuild/core` for XML parsing, AST types, and Markdown rendering. The FR uses GPO/SGML-derived XML — the same format family as eCFR but with a flat, document-centric structure instead of hierarchical titles/sections.

## Module Structure

```
src/
├── index.ts                 # Barrel exports
├── fr-elements.ts           # FR XML element classification (~92 elements) + FrDocumentType
├── fr-builder.ts            # SAX → AST state machine for FR XML
├── fr-builder.test.ts       # 16 unit tests
├── fr-frontmatter.ts        # Build FrontmatterData from FR context + API JSON
├── fr-frontmatter.test.ts   # 27 unit tests
├── fr-path.ts               # Output path builder (date-based)
├── fr-path.test.ts          # 8 unit tests
├── converter.ts             # Conversion orchestrator
├── converter.test.ts        # 6 integration tests
├── downloader.ts            # FederalRegister.gov API client
└── govinfo-downloader.ts    # Govinfo bulk XML downloader (future backfill)
```

## Public API

Key exports (see `index.ts` for full list):

| Export | Purpose |
|--------|---------|
| `convertFrDocuments()` | Convert FR XML files to Markdown |
| `downloadFrDocuments()` | Download FR documents by date range |
| `downloadSingleFrDocument()` | Download a single document by number |
| `FrASTBuilder` | SAX→AST builder for FR XML |

## FR XML Schema

**Source**: FederalRegister.gov API — `https://www.federalregister.gov/api/v1/`

Per-document XML + rich JSON metadata. No authentication required. ~28k-31k documents/year, ~750K total with XML (2000-present).

**Format**: GPO/SGML-derived XML, no namespace. Schema: `FRMergedXML.xsd`.

### Document Structure

Individual document XML (from API):
```xml
<RULE>
  <PREAMB>
    <AGENCY TYPE="F">SECURITIES AND EXCHANGE COMMISSION</AGENCY>
    <SUBAGY>Division of Trading and Markets</SUBAGY>
    <CFR>17 CFR Part 240</CFR>
    <RIN>RIN 3235-AM00</RIN>
    <SUBJECT>Amendments to Rule 10b-5</SUBJECT>
    <AGY><HD SOURCE="HED">AGENCY:</HD><P>SEC.</P></AGY>
    <ACT><HD SOURCE="HED">ACTION:</HD><P>Final rule.</P></ACT>
    <SUM><HD SOURCE="HED">SUMMARY:</HD><P>...</P></SUM>
    <DATES><HD SOURCE="HED">DATES:</HD><P>...</P></DATES>
    <ADD>...</ADD>
    <FURINF>...</FURINF>
  </PREAMB>
  <SUPLINF>
    <HD SOURCE="HED">SUPPLEMENTARY INFORMATION:</HD>
    <HD SOURCE="HD1">I. Background</HD>
    <P>...</P>
    <REGTEXT TITLE="17" PART="240">
      <AMDPAR>1. Amend § 240.10b-5...</AMDPAR>
    </REGTEXT>
  </SUPLINF>
  <SIG><DATED>...</DATED><NAME>...</NAME><TITLE>...</TITLE></SIG>
  <FRDOC>[FR Doc. 2026-06029 Filed 3-27-26; 8:45 am]</FRDOC>
  <BILCOD>BILLING CODE 8011-01-P</BILCOD>
</RULE>
```

### Document Types

| Element | Type | Annual Volume |
|---------|------|--------------|
| `RULE` | Final rules | ~3,000-3,200 |
| `PRORULE` | Proposed rules | ~1,700-2,100 |
| `NOTICE` | Notices | ~22,000-25,000 |
| `PRESDOCU` | Presidential documents | ~300-470 |

### Key Differences from eCFR

1. **Flat, document-centric** — no DIV hierarchy, each document self-contained
2. **Temporal corpus** — ever-growing historical record, not current-state snapshot
3. **Dual ingestion** — JSON metadata (40+ fields from API) + XML body
4. **GPOTABLE** — FR uses GPOTABLE format (BOXHD/CHED/ROW/ENT), not HTML tables
5. **Shared inline formatting** — same `E T="nn"` emphasis, SU, FTNT as eCFR

## Conversion Pipeline

```
FR XML → [XMLParser(defaultNamespace: "")] → SAX events
  → [FrASTBuilder] → emitted document nodes (one per RULE/NOTICE/etc.)
  → Load JSON sidecar (if present) for rich metadata
  → [buildFrFrontmatter] → FrontmatterData from XML meta + JSON meta
  → [renderDocument] → Markdown + YAML frontmatter
  → Write to output/fr/{YYYY}/{MM}/{document_number}.md
```

## Output Structure

```
output/fr/
├── 2026/
│   ├── 01/
│   │   └── 2026-00123.md
│   └── 03/
│       └── 2026-06029.md
└── 2025/
    └── ...
```

## Download URLs

**FederalRegister.gov API (primary)**:
```
GET /documents.json?conditions[publication_date][gte]=...&conditions[publication_date][lte]=...
GET /documents/{number}.json
GET /documents/{number}/full_text/xml
```

No API key required. Auto-chunks by month for large date ranges (10K result cap).

## Frontmatter Fields

FR documents include all standard fields plus:
- `source: "fr"`
- `legal_status: "authoritative_unofficial"`
- `title_number: 0` (FR documents don't belong to a USC/CFR title)
- `title_name: "Federal Register"`
- `document_number` — FR document number
- `document_type` — rule, proposed_rule, notice, presidential_document
- `fr_citation` — e.g., "91 FR 14523"
- `fr_volume` — volume number
- `publication_date` — YYYY-MM-DD
- `agencies` — list of agency names
- `cfr_references` — affected CFR titles/parts
- `docket_ids` — docket numbers
- `rin` — Regulation Identifier Number
- `effective_date`, `comments_close_date`, `fr_action`

## Common Pitfalls

- **FR document number prefix is NOT the publication year**: Document `2025-24130` can have `publication_date: "2026-01-02"`. The prefix is the fiscal/assignment year. Files are placed by `publication_date`, not document number prefix.
- **Concurrent downloads use a worker pool**: `downloadPool()` in `downloader.ts` uses a shared `nextIndex` counter with `N` async workers. `nextIndex++` is safe across `await` boundaries because JS is single-threaded. The `concurrency` option (default 10) replaces the old `fetchDelayMs` sequential delay.
- **FederalRegister.gov API is slow per-request**: Individual XML fetches average ~10s regardless of file size (~26 KB average). The API's server-side latency is the bottleneck, not bandwidth. Increasing concurrency beyond 10-20 may not help if the API throttles connections.
- **No `_meta.json` files**: Unlike USC/eCFR, the FR converter does not generate sidecar metadata files. The Astro nav generator (`generate-nav.ts`) scans the filesystem and reads frontmatter directly from each `.md` file.
- **FR `E T="03"` maps to italic, not bold**: Unlike eCFR which uses T="03" for general emphasis (bold), FR uses it for legal citations, case names, and publication titles which are conventionally italicized. The `FR_EMPHASIS_MAP` intentionally diverges from `ECFR_EMPHASIS_MAP` on this code.
- **`SU` inside `FTNT` is a footnote marker**: The builder checks `findFrame("note")` to determine context. Inside a footnote → `footnoteRef` type. In body text → `sup` type (unless followed by `FTREF`).
- **`FTREF` converts preceding `sup` to `footnoteRef`**: `FTREF` is an empty signal element in body text. On open, the builder walks backward through the parent content node's children to find the last `sup` inline and converts it to `footnoteRef`.
- **Whitespace normalization in `onText`**: FR XML from the API has generous indentation inside `<P>` elements. The builder normalizes whitespace (`text.replace(/\s+/g, " ")`) for content and inline frames to prevent XML formatting from appearing in output.

