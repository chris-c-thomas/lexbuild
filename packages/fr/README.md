# @lexbuild/fr

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Ffr?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/fr)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)

Converts [Federal Register](https://www.federalregister.gov/) XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. Downloads documents via the FederalRegister.gov API with rich JSON metadata (agencies, CFR references, docket IDs, effective dates) alongside XML full text.

> **Tip:** For command-line usage, install [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) instead. This package is the programmatic API.

## Install

```bash
npm install @lexbuild/fr
# or
pnpm add @lexbuild/fr
```

**Peer dependency:** [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) (installed automatically via workspace protocol in the monorepo).

## Quick Start

### Download and Convert

```ts
import { downloadFrDocuments, convertFrDocuments } from "@lexbuild/fr";

// Download last 30 days of Federal Register documents
const download = await downloadFrDocuments({
  output: "./downloads/fr",
  from: "2026-03-01",
  to: "2026-03-31",
});
console.log(`Downloaded ${download.documentsDownloaded} documents`);

// Convert to Markdown
const result = await convertFrDocuments({
  input: "./downloads/fr",
  output: "./output",
  linkStyle: "plaintext",
  dryRun: false,
});

console.log(`${result.documentsConverted} documents, ${result.totalTokenEstimate} est. tokens`);
```

### Download by Document Type

```ts
import { downloadFrDocuments } from "@lexbuild/fr";

// Download only final rules from Q1 2026
const result = await downloadFrDocuments({
  output: "./downloads/fr",
  from: "2026-01-01",
  to: "2026-03-31",
  types: ["RULE"],
});
```

### Download a Single Document

```ts
import { downloadSingleFrDocument } from "@lexbuild/fr";

const file = await downloadSingleFrDocument("2026-06029", "./downloads/fr");
console.log(`XML: ${file.xmlPath}`);
console.log(`JSON: ${file.jsonPath}`);
```

### Convert with Type Filtering

```ts
import { convertFrDocuments } from "@lexbuild/fr";

const result = await convertFrDocuments({
  input: "./downloads/fr",
  output: "./output",
  linkStyle: "plaintext",
  dryRun: false,
  from: "2026-01-01",
  to: "2026-03-31",
  types: ["RULE", "PRORULE"], // Only rules and proposed rules
});
```

## API Reference

### Functions

| Export | Description |
|--------|-------------|
| `convertFrDocuments(options)` | Convert FR XML files to Markdown |
| `downloadFrDocuments(options)` | Download FR documents by date range from the API |
| `downloadSingleFrDocument(number, output)` | Download a single document by document number |
| `buildFrApiListUrl(from, to, page, types?)` | Build the API listing URL for a date range |
| `buildFrFrontmatter(node, context, xmlMeta, jsonMeta?)` | Build frontmatter from AST node and metadata |
| `buildFrOutputPath(number, date, root)` | Build output file path for a document |
| `buildFrDownloadXmlPath(number, date, root)` | Build download XML file path |
| `buildFrDownloadJsonPath(number, date, root)` | Build download JSON file path |

### Types

| Export | Description |
|--------|-------------|
| `FrConvertOptions` | Options for `convertFrDocuments()` — input, output, link style, date/type filters |
| `FrConvertResult` | Conversion result — documents converted, files, token estimate |
| `FrDownloadOptions` | Options for `downloadFrDocuments()` — output, date range, types, limit |
| `FrDownloadResult` | Download result — documents downloaded, files, bytes, skipped, failed |
| `FrDownloadedFile` | Single downloaded file metadata (XML path, JSON path, size) |
| `FrDownloadFailure` | Failed download metadata (document number, error) |
| `FrDownloadProgress` | Progress info for the download callback |
| `FrDocumentType` | `"RULE" \| "PRORULE" \| "NOTICE" \| "PRESDOCU"` |
| `FrDocumentJsonMeta` | JSON metadata structure from the FederalRegister.gov API |
| `FrDocumentXmlMeta` | Metadata extracted from FR XML during SAX parsing |

### Classes

| Export | Description |
|--------|-------------|
| `FrASTBuilder` | SAX-to-AST builder for FR GPO/SGML XML. Emits one section-level node per document. |

### Constants

| Export | Description |
|--------|-------------|
| `FR_DOCUMENT_ELEMENTS` | Set of document type elements (`RULE`, `NOTICE`, etc.) |
| `FR_DOCUMENT_TYPE_MAP` | Map from element names to normalized type strings |
| `FR_EMPHASIS_MAP` | Map from `E` element `T` attribute to inline formatting types |
| `FR_HD_SOURCE_TO_DEPTH` | Map from `HD` `SOURCE` attribute to heading depth |

## Output

Each document produces one Markdown file organized by publication date:

| Output Path | Description |
|---|---|
| `fr/2026/03/2026-06029.md` | Individual document |

No granularity options — FR documents are already atomic (one file per document).

### Frontmatter

FR documents include source-specific metadata alongside standard LexBuild fields. When a JSON sidecar from the API is available, frontmatter is enriched with structured agency, CFR reference, docket, and date information:

```yaml
---
identifier: "/us/fr/2026-06029"
source: "fr"
legal_status: "authoritative_unofficial"
title: "Meeting of the Advisory Board on Radiation and Worker Health"
title_number: 0
title_name: "Federal Register"
section_number: "2026-06029"
positive_law: false
currency: "2026-03-30"
last_updated: "2026-03-30"
agency: "Health and Human Services Department"
document_number: "2026-06029"
document_type: "notice"
fr_citation: "91 FR 15619"
fr_volume: 91
publication_date: "2026-03-30"
agencies:
  - "Health and Human Services Department"
  - "Centers for Disease Control and Prevention"
fr_action: "Notice of meeting."
---
```

Rules and proposed rules include additional fields:

```yaml
cfr_references:
  - "10 CFR Part 53"
  - "10 CFR Part 50"
docket_ids:
  - "NRC-2019-0062"
rin: "3150-AK31"
effective_date: "2026-04-29"
```

## Data Source

| Field | Detail |
|-------|--------|
| **API** | `federalregister.gov/api/v1/` |
| **Authentication** | None required |
| **Rate limits** | No documented limits |
| **Coverage** | JSON metadata from 1994, XML full text from 2000 |
| **Update cadence** | Daily (each business day) |
| **Volume** | ~28,000-31,000 documents/year |
| **Legal status** | Unofficial — only authenticated PDF has legal standing |

The downloader fetches both JSON metadata (40+ structured fields) and XML full text per document. Large date ranges are automatically chunked by month to stay under the API's 10,000-result cap per query.

## Document Types

| Type | Element | Annual Volume | Description |
|------|---------|---------------|-------------|
| Notice | `NOTICE` | ~22,000-25,000 | Agency announcements, meetings, information collections |
| Rule | `RULE` | ~3,000-3,200 | Final rules and regulations |
| Proposed Rule | `PRORULE` | ~1,700-2,100 | Notices of proposed rulemaking (NPRMs) |
| Presidential Document | `PRESDOCU` | ~300-470 | Executive orders, memoranda, proclamations |

## Compatibility

- **Node.js** >= 22
- **ESM only** — no CommonJS build
- **TypeScript** — ships `.d.ts` type declarations

## Monorepo Context

Part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo. Depends on `@lexbuild/core` for XML parsing, AST types, and Markdown rendering.

```bash
pnpm turbo build --filter=@lexbuild/fr
pnpm turbo test --filter=@lexbuild/fr
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) | CLI tool — the easiest way to use LexBuild |
| [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) | Shared parsing, AST, and rendering infrastructure |
| [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc) | U.S. Code (USLM XML) converter |
| [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr) | eCFR (Code of Federal Regulations) converter |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
