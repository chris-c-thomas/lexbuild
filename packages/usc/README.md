# @lexbuild/usc

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcore?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/core)
[![license](https://img.shields.io/github/license/chris-c-thomas/lexbuild?style=for-the-badge)](https://github.com/chris-c-thomas/lexbuild)

This package is part of the [LexBuild](https://github.com/chris-c-thomas/lexbuild) monorepo, a tool that converts U.S. legislative XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. See the monorepo for full documentation, architecture details, and contribution guidelines.

It converts official [USLM](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) XML from the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) into structured Markdown. It also provides a downloader for fetching the XML directly from OLRC.

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
  granularity: "section",
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

Each title produces a directory tree of Markdown files with YAML frontmatter and JSON metadata indexes:

```
output/usc/title-01/
  README.md
  _meta.json
  chapter-01/
    _meta.json
    section-1.md
    section-2.md
  chapter-02/
    _meta.json
    section-101.md
```

See the [output format specification](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/output-format.md) for details.

## Documentation

- [Monorepo README](https://github.com/chris-c-thomas/lexbuild#readme)
- [Architecture](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/architecture.md)
- [Output Format](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/output-format.md)
- [XML Element Reference](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/xml-element-reference.md)
- [Extending](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/extending.md)

## License

[MIT](https://github.com/chris-c-thomas/lexbuild/blob/main/LICENSE)
