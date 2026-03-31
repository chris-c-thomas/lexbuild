# @lexbuild/ecfr

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fecfr?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/ecfr)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)

Converts [Electronic Code of Federal Regulations](https://www.ecfr.gov/) (eCFR) XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. Supports two download sources: the ecfr.gov API (daily-updated, default) and govinfo.gov bulk data (fallback).

> **Tip:** For command-line usage, install [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) instead. This package is the programmatic API.

## Install

```bash
npm install @lexbuild/ecfr
# or
pnpm add @lexbuild/ecfr
```

**Peer dependency:** [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) (installed automatically via workspace protocol in the monorepo).

## Quick Start

### Download and Convert

```ts
import { downloadEcfrTitlesFromApi, convertEcfrTitle } from "@lexbuild/ecfr";

// Download Title 17 from the eCFR API (daily-updated)
const download = await downloadEcfrTitlesFromApi({
  output: "./downloads/ecfr/xml",
  titles: [17],
});
console.log(`As of: ${download.asOfDate}`);

// Convert to section-level Markdown
const result = await convertEcfrTitle({
  input: "./downloads/ecfr/xml/ECFR-title17.xml",
  output: "./output",
  granularity: "section",
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
  dryRun: false,
});

console.log(`${result.sectionsWritten} sections, ${result.totalTokenEstimate} est. tokens`);
```

### Point-in-Time Downloads

```ts
import { downloadEcfrTitlesFromApi } from "@lexbuild/ecfr";

// Download the CFR as it existed on a specific date
const result = await downloadEcfrTitlesFromApi({
  output: "./downloads/ecfr/xml",
  titles: [17],
  date: "2025-01-01",
});
```

### Title Metadata

```ts
import { fetchEcfrTitlesMeta } from "@lexbuild/ecfr";

const meta = await fetchEcfrTitlesMeta();
console.log(`Data current as of: ${meta.date}`);
for (const title of meta.titles) {
  console.log(`Title ${title.number}: ${title.name} (amended ${title.latestAmendedOn})`);
}
```

### Govinfo Bulk Data (Fallback)

```ts
import { downloadEcfrTitles } from "@lexbuild/ecfr";

const result = await downloadEcfrTitles({
  output: "./downloads/ecfr/xml",
  titles: [1, 17],
});
```

## API Reference

### Functions

| Export | Description |
|--------|-------------|
| `convertEcfrTitle(options)` | Convert an eCFR XML file to Markdown at any granularity |
| `downloadEcfrTitlesFromApi(options)` | Download from ecfr.gov API (daily-updated, point-in-time) |
| `downloadEcfrTitles(options)` | Download from govinfo.gov bulk data (fallback) |
| `fetchEcfrTitlesMeta()` | Fetch title metadata and currency dates from the eCFR API |
| `buildEcfrApiDownloadUrl(titleNumber, date)` | Build ecfr.gov API download URL |
| `buildEcfrDownloadUrl(titleNumber)` | Build govinfo bulk download URL |

### Types

| Export | Description |
|--------|-------------|
| `EcfrConvertOptions` | Options for `convertEcfrTitle()` — input, output, granularity, link style, note filters |
| `EcfrConvertResult` | Conversion result — sections written, parts, files, token estimate |
| `EcfrApiDownloadOptions` | Options for `downloadEcfrTitlesFromApi()` — output, titles, optional date |
| `EcfrApiDownloadResult` | API download result — files, bytes, as-of date |
| `EcfrApiDownloadedFile` | Single API-downloaded file metadata |
| `EcfrDownloadOptions` | Options for `downloadEcfrTitles()` (govinfo) |
| `EcfrDownloadResult` | Govinfo download result |
| `EcfrDownloadedFile` | Single govinfo-downloaded file metadata |
| `EcfrTitleMeta` | Per-title metadata from the eCFR API |
| `EcfrTitlesResponse` | Full response from the titles metadata endpoint |

### Classes

| Export | Description |
|--------|-------------|
| `EcfrASTBuilder` | SAX-to-AST builder for eCFR GPO/SGML XML. Handles both ecfr.gov API and govinfo bulk XML formats transparently. |

### Constants

| Export | Description |
|--------|-------------|
| `ECFR_TITLE_COUNT` | Total number of CFR titles (`50`) |
| `ECFR_TITLE_NUMBERS` | Array of valid title numbers `[1, 2, ..., 50]` |
| `ECFR_TYPE_TO_LEVEL` | Map from DIV `TYPE` attributes to LexBuild level types |
| `ECFR_EMPHASIS_MAP` | Map from `E` element `T` attribute to inline formatting types |

## Output

Each title produces Markdown files with YAML frontmatter. The structure depends on granularity:

| Granularity | Output Path | Sidecar Files |
|---|---|---|
| `section` (default) | `ecfr/title-17/chapter-IV/part-240/section-240.10b-5.md` | `_meta.json` per part + title, `README.md` per title |
| `part` | `ecfr/title-17/chapter-IV/part-240.md` | — |
| `chapter` | `ecfr/title-17/chapter-IV/chapter-IV.md` | — |
| `title` | `ecfr/title-17.md` | — |

### Frontmatter

eCFR sections include source-specific metadata alongside standard LexBuild fields:

```yaml
---
identifier: "/us/cfr/t17/s240.10b-5"
source: "ecfr"
legal_status: "authoritative_unofficial"
title: "17 CFR § 240.10b-5 - Employment of manipulative and deceptive devices"
title_number: 17
section_number: "240.10b-5"
positive_law: false
authority: "15 U.S.C. 78a et seq., ..."
cfr_part: "240"
---
```

## Data Sources

| Source | URL | Update Frequency | Point-in-Time |
|--------|-----|-----------------|---------------|
| **eCFR API** (default) | `ecfr.gov/api/versioner/v1/` | Daily | Yes |
| **govinfo bulk** (fallback) | `govinfo.gov/bulkdata/ECFR/` | Irregular | No |

Both sources produce the same GPO/SGML-derived XML element vocabulary. The builder handles format differences (wrapper elements, attribute variations) transparently — the converter works identically regardless of source.

Title 35 (Panama Canal) is reserved and has no data from either source.

## Compatibility

- **Node.js** >= 22
- **ESM only** — no CommonJS build
- **TypeScript** — ships `.d.ts` type declarations

## Monorepo Context

Part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo. Depends on `@lexbuild/core` for XML parsing, AST types, and Markdown rendering.

```bash
pnpm turbo build --filter=@lexbuild/ecfr
pnpm turbo test --filter=@lexbuild/ecfr
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) | CLI tool — the easiest way to use LexBuild |
| [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) | Shared parsing, AST, and rendering infrastructure |
| [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc) | U.S. Code (USLM XML) converter |
| [`@lexbuild/fr`](https://www.npmjs.com/package/@lexbuild/fr) | Federal Register converter |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
