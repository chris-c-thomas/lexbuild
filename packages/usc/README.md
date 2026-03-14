# @lexbuild/usc

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fusc?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/usc)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild)

This package is part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo, a tool that converts U.S. legal XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. See the monorepo for full documentation, architecture details, and contribution guidelines.

It converts official [USLM XML](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) from the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) into structured Markdown and is built on [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) for shared parsing and rendering infrastructure. It also provides a downloader for fetching the XML directly from OLRC. End users typically interact with this package through [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli).

## Install

```bash
npm install @lexbuild/usc
```

## Usage

### Convert a Title

```ts
import { convertTitle } from "@lexbuild/usc";

const result = await convertTitle({
  input: "./downloads/usc/xml/usc01.xml",
  output: "./output",
  granularity: "section", // or "chapter" or "title"
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
  dryRun: false,
});

console.log(`Wrote ${result.sectionsWritten} sections`);
console.log(`Chapters: ${result.chapterCount}`);
console.log(`Estimated tokens: ${result.totalTokenEstimate}`);
```

### Download Titles from OLRC

```ts
import { downloadTitles } from "@lexbuild/usc";

// Download specific titles
const result = await downloadTitles({
  outputDir: "./downloads/usc/xml",
  titles: [1, 5, 26],
});

// Download all 54 titles (uses a single bulk zip)
const all = await downloadTitles({
  outputDir: "./downloads/usc/xml",
});

console.log(`Downloaded ${result.files.length} files`);
console.log(`Release point: ${result.releasePoint}`);
```

## API Reference

### Functions

| Export | Description |
|--------|-------------|
| `convertTitle(options)` | Convert a USC XML file to section-level Markdown |
| `downloadTitles(options)` | Download USC XML from OLRC |
| `buildDownloadUrl(titleNumber, releasePoint)` | Build URL for a single title zip |
| `buildAllTitlesUrl(releasePoint)` | Build URL for the bulk zip |
| `releasePointToPath(releasePoint)` | Convert release point to URL path segment |
| `isAllTitles(titles)` | Check if a title list covers all 54 titles |

### Types

| Export | Description |
|--------|-------------|
| `ConvertOptions` | Options for `convertTitle()` |
| `ConvertResult` | Result of a conversion (sections, chapters, tokens, files) |
| `DownloadOptions` | Options for `downloadTitles()` |
| `DownloadResult` | Result of a download (files, errors, release point) |
| `DownloadedFile` | Info about a downloaded file (title, path, size) |
| `DownloadError` | Info about a failed download |

### Constants

| Export | Description |
|--------|-------------|
| `CURRENT_RELEASE_POINT` | Current OLRC release point (e.g., `"119-73not60"`) |
| `USC_TITLE_NUMBERS` | Array of valid title numbers (1-54) |

## Output

Each title produces Markdown files with YAML frontmatter. The output structure depends on the granularity setting:

| Granularity | Output | Metadata |
|---|---|---|
| `section` (default) | `title-NN/chapter-NN/section-N.md` | `_meta.json` per chapter + title, `README.md` per title |
| `chapter` | `title-NN/chapter-NN/chapter-NN.md` | `_meta.json` per title, `README.md` per title |
| `title` | `title-NN.md` | Enriched frontmatter only (no sidecar files) |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
