# @lexbuild/usc

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fusc?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/usc)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)

Converts official [USLM XML](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) from the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) into structured Markdown optimized for AI, RAG pipelines, and semantic search. Includes a downloader that auto-detects the latest OLRC release point.

> **Tip:** For command-line usage, install [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) instead. This package is the programmatic API.

## Install

```bash
npm install @lexbuild/usc
# or
pnpm add @lexbuild/usc
```

**Peer dependency:** [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) (installed automatically via workspace protocol in the monorepo).

## Quick Start

### Download and Convert

```ts
import { downloadTitles, convertTitle } from "@lexbuild/usc";

// Download Title 1 (auto-detects latest OLRC release point)
const download = await downloadTitles({
  outputDir: "./downloads/usc/xml",
  titles: [1],
});
console.log(`Release point: ${download.releasePoint}`);

// Convert to section-level Markdown
const result = await convertTitle({
  input: "./downloads/usc/xml/usc01.xml",
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

### Release Point Detection

```ts
import { detectLatestReleasePoint } from "@lexbuild/usc";

const info = await detectLatestReleasePoint();
if (info) {
  console.log(`Latest: ${info.releasePoint}`); // e.g., "119-80"
  console.log(`Description: ${info.description}`); // e.g., "Public Law 119-80 (03/15/2026)"
}
```

### Pin a Specific Release Point

```ts
const result = await downloadTitles({
  outputDir: "./downloads/usc/xml",
  releasePoint: "119-73not60", // Override auto-detection
});
```

## API Reference

### Functions

| Export | Description |
|--------|-------------|
| `convertTitle(options)` | Convert a USC XML file to Markdown at any granularity |
| `downloadTitles(options)` | Download USC XML from OLRC (auto-detects latest release point) |
| `detectLatestReleasePoint()` | Scrape the OLRC download page for the current release point |
| `buildDownloadUrl(titleNumber, releasePoint)` | Build download URL for a single title zip |
| `buildAllTitlesUrl(releasePoint)` | Build download URL for the bulk all-titles zip |
| `releasePointToPath(releasePoint)` | Convert `"119-73not60"` → `"119/73not60"` |
| `isAllTitles(titles)` | Check if a title list covers all 54 USC titles |

### Types

| Export | Description |
|--------|-------------|
| `ConvertOptions` | Options for `convertTitle()` — input, output, granularity, link style, note filters |
| `ConvertResult` | Conversion result — sections written, chapters, files, token estimate, memory |
| `DownloadOptions` | Options for `downloadTitles()` — output dir, titles, optional release point |
| `DownloadResult` | Download result — release point used, files, errors |
| `DownloadedFile` | Single downloaded file metadata (title number, path, size) |
| `DownloadError` | Failed download metadata (title number, error message) |
| `ReleasePointInfo` | Detected release point with human-readable description |

### Constants

| Export | Description |
|--------|-------------|
| `FALLBACK_RELEASE_POINT` | Hardcoded fallback used when auto-detection fails |
| `USC_TITLE_NUMBERS` | Array of valid title numbers `[1, 2, ..., 54]` |

## Output

Each title produces Markdown files with YAML frontmatter. The structure depends on granularity:

| Granularity | Output Path | Sidecar Files |
|---|---|---|
| `section` (default) | `usc/title-01/chapter-01/section-1.md` | `_meta.json` per chapter + title, `README.md` per title |
| `chapter` | `usc/title-01/chapter-01/chapter-01.md` | `_meta.json` per title, `README.md` per title |
| `title` | `usc/title-01.md` | Enriched frontmatter only |

## Data Source

XML is downloaded from the OLRC at [uscode.house.gov](https://uscode.house.gov/download/download.shtml). Release points are published multiple times per month as new public laws are enacted. The downloader auto-detects the latest release point from the OLRC download page; use `--release-point` (CLI) or `releasePoint` (API) to pin a specific version.

## Compatibility

- **Node.js** >= 22
- **ESM only** — no CommonJS build
- **TypeScript** — ships `.d.ts` type declarations

## Monorepo Context

Part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo. Depends on `@lexbuild/core` for XML parsing, AST types, and Markdown rendering.

```bash
pnpm turbo build --filter=@lexbuild/usc
pnpm turbo test --filter=@lexbuild/usc
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) | CLI tool — the easiest way to use LexBuild |
| [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) | Shared parsing, AST, and rendering infrastructure |
| [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr) | eCFR (Code of Federal Regulations) converter |
| [`@lexbuild/fr`](https://www.npmjs.com/package/@lexbuild/fr) | Federal Register converter |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
