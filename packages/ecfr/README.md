# @lexbuild/ecfr

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fecfr?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/ecfr)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild)

This package is part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo, a tool that converts U.S. legal XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. See the monorepo for full documentation, architecture details, and contribution guidelines.

It converts [eCFR](https://www.ecfr.gov/) (Electronic Code of Federal Regulations) bulk XML from [govinfo.gov](https://www.govinfo.gov/bulkdata/ECFR) into structured Markdown and is built on [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) for shared parsing and rendering infrastructure. It also provides a downloader for fetching the XML directly from govinfo. End users typically interact with this package through [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli).

## Install

```bash
npm install @lexbuild/ecfr
```

## Usage

### Convert a Title

```ts
import { convertEcfrTitle } from "@lexbuild/ecfr";

const result = await convertEcfrTitle({
  input: "./downloads/ecfr/xml/ECFR-title17.xml",
  output: "./output",
  granularity: "section", // or "part", "chapter", or "title"
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
  dryRun: false,
});

console.log(`Wrote ${result.sectionsWritten} sections`);
console.log(`Parts: ${result.partCount}`);
console.log(`Estimated tokens: ${result.totalTokenEstimate}`);
```

### Download Titles from govinfo

```ts
import { downloadEcfrTitles } from "@lexbuild/ecfr";

// Download specific titles
const result = await downloadEcfrTitles({
  output: "./downloads/ecfr/xml",
  titles: [1, 17, 26],
});

// Download all 50 titles
const all = await downloadEcfrTitles({
  output: "./downloads/ecfr/xml",
});

console.log(`Downloaded ${result.titlesDownloaded} files`);
console.log(`Total size: ${result.totalBytes} bytes`);
```

## API Reference

### Functions

| Export | Description |
|--------|-------------|
| `convertEcfrTitle(options)` | Convert an eCFR XML file to section-level Markdown |
| `downloadEcfrTitles(options)` | Download eCFR XML from govinfo |
| `buildEcfrDownloadUrl(titleNumber)` | Build URL for a single title XML file |

### Types

| Export | Description |
|--------|-------------|
| `EcfrConvertOptions` | Options for `convertEcfrTitle()` |
| `EcfrConvertResult` | Result of a conversion (sections, parts, tokens, files) |
| `EcfrDownloadOptions` | Options for `downloadEcfrTitles()` |
| `EcfrDownloadResult` | Result of a download (files, bytes) |
| `EcfrDownloadedFile` | Info about a downloaded file (title, path, size) |
| `EcfrDownloadError` | Info about a failed download |

### Classes

| Export | Description |
|--------|-------------|
| `EcfrASTBuilder` | SAX→AST builder for eCFR GPO/SGML XML |

### Constants

| Export | Description |
|--------|-------------|
| `ECFR_TITLE_COUNT` | Total number of eCFR titles (`50`) |
| `ECFR_TITLE_NUMBERS` | Array of valid title numbers (1–50) |
| `ECFR_TYPE_TO_LEVEL` | Map from DIV TYPE attributes to LexBuild level types |
| `ECFR_EMPHASIS_MAP` | Map from E element T attribute to inline types |

## Output

Each title produces Markdown files with YAML frontmatter. The output structure depends on the granularity setting:

| Granularity | Output | Metadata |
|---|---|---|
| `section` (default) | `ecfr/title-NN/chapter-X/part-N/section-N.N.md` | `_meta.json` per part + title, `README.md` per title |
| `part` | `ecfr/title-NN/chapter-X/part-N.md` | — |
| `chapter` | `ecfr/title-NN/chapter-X/chapter-X.md` | — |
| `title` | `ecfr/title-NN.md` | — |

### Frontmatter

eCFR sections include standard LexBuild frontmatter fields plus source-specific metadata:

```yaml
---
identifier: "/us/cfr/t17/s240.10b-5"
source: "ecfr"
legal_status: "authoritative_unofficial"
title: "17 CFR § 240.10b-5 - Employment of manipulative and deceptive devices"
title_number: 17
title_name: "Commodity and Securities Exchanges"
section_number: "240.10b-5"
section_name: "Employment of manipulative and deceptive devices"
part_number: "240"
part_name: "GENERAL RULES AND REGULATIONS, SECURITIES EXCHANGE ACT OF 1934"
positive_law: false
currency: "2025-03-13"
last_updated: "2025-03-13"
format_version: "1.1.0"
generator: "lexbuild@1.8.0"
authority: "15 U.S.C. 78a et seq., ..."
cfr_part: "240"
---
```

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
