# @lexbuild/ecfr

## 1.11.0

### Minor Changes

- d22de4d: Bump version

### Patch Changes

- Updated dependencies [d22de4d]
  - @lexbuild/core@1.11.0

## 1.10.1

### Patch Changes

- 59c12a1: feat: per title data resolution and retry logic for eCFR API downloads
- 275f041: Address PR review feedback for download, highlights, and packaging
- c735a6f: Update convert command summary footer for titles, chapters, parts, and sections
- 82fb6cc: Manage Shiki's memory with forked child processes instead of a single process. Each child is 10k files and its memory is released back to the OS once highlighting is complete.
- 7fde270: Implement hierarchical filenames for downloaded .md files (i.e. usc-title-01-chapter-01-section-1.md)
- 95e44f5: eCFR data api fallbacks for when update is in progress; display date info during download
- 0305588: Prettier formatting issue fixes; pnpm format
- Updated dependencies [59c12a1]
- Updated dependencies [275f041]
- Updated dependencies [c735a6f]
- Updated dependencies [82fb6cc]
- Updated dependencies [7fde270]
- Updated dependencies [95e44f5]
- Updated dependencies [0305588]
  - @lexbuild/core@1.10.1

## 1.10.0

### Minor Changes

- 268dc81: Update eCFR downloader to handle govinfo eCFR XML or eCFR.gov API XML

### Patch Changes

- 2abf796: Update monorepo README.md
- af2ea01: Fix eCFR frontmatter panel info
- 791ca5e: Set the eCFR data API as the default eCFR source (govinfo still available if desired)
- 65539ac: Update README.md files
- d71a5d8: Auto detect latest release of the USC and add options to choose previous release points
- Updated dependencies [2abf796]
- Updated dependencies [af2ea01]
- Updated dependencies [791ca5e]
- Updated dependencies [65539ac]
- Updated dependencies [d71a5d8]
- Updated dependencies [268dc81]
  - @lexbuild/core@1.10.0

## 1.9.4

### Patch Changes

- 6a7111a: Add ENFILE/EMFILE retry wrapper for file writes in converters
- Updated dependencies [6a7111a]
  - @lexbuild/core@1.9.4

## 1.9.3

### Patch Changes

- 93b4e78: refactor: remove Next.js web application, add Astro SSR app for browsing converted legal content
- Updated dependencies [93b4e78]
  - @lexbuild/core@1.9.3

## 1.9.2

### Patch Changes

- [#44](https://github.com/chris-c-thomas/LexBuild/pull/44) [`077dad9`](https://github.com/chris-c-thomas/LexBuild/commit/077dad9d95ca141582370e17663b1a9e53900a04) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Update turbo configuations and build scripts to better align with best practices

- Updated dependencies [[`077dad9`](https://github.com/chris-c-thomas/LexBuild/commit/077dad9d95ca141582370e17663b1a9e53900a04)]:
  - @lexbuild/core@1.9.2

## 1.9.1

### Patch Changes

- [`d32b3ed`](https://github.com/chris-c-thomas/LexBuild/commit/d32b3edda8bcb319f64e7b8b444ca943db0103e4) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Publish @lexbuild/ecfr to npm registry

- Updated dependencies []:
  - @lexbuild/core@1.9.1

## 1.9.0

### Minor Changes

- [#40](https://github.com/chris-c-thomas/LexBuild/pull/40) [`3ecddf0`](https://github.com/chris-c-thomas/LexBuild/commit/3ecddf0ea0caa3aa4ab16014b554318b9ba05b6f) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Refactor core packages for multiple source XML; add eCRF source; convert bulk eCRF XML to structured markdown.

- [#40](https://github.com/chris-c-thomas/LexBuild/pull/40) [`e14242c`](https://github.com/chris-c-thomas/LexBuild/commit/e14242c907aa9da81eb757cc6d41caab2f81a2df) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Refactor download/convert commands to be namespaced to their respective sources

- [#40](https://github.com/chris-c-thomas/LexBuild/pull/40) [`2a400d2`](https://github.com/chris-c-thomas/LexBuild/commit/2a400d2a748f5f474c38619364b0e2fc025f1fcc) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Add fourth granularity option to eCFR converter; by chapter

### Patch Changes

- [#40](https://github.com/chris-c-thomas/LexBuild/pull/40) [`13e0db4`](https://github.com/chris-c-thomas/LexBuild/commit/13e0db4f62380bf1dde6fb26974f18c2ea3352dc) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Adjust downloader to gracefully skip reserved titles

- [#40](https://github.com/chris-c-thomas/LexBuild/pull/40) [`bb5b8cf`](https://github.com/chris-c-thomas/LexBuild/commit/bb5b8cf8d98c5075af2c8b4b1a9b7ea322ce72a8) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Update README.md files for core, usc, ecfr, and cli packages

- Updated dependencies [[`13e0db4`](https://github.com/chris-c-thomas/LexBuild/commit/13e0db4f62380bf1dde6fb26974f18c2ea3352dc), [`3ecddf0`](https://github.com/chris-c-thomas/LexBuild/commit/3ecddf0ea0caa3aa4ab16014b554318b9ba05b6f), [`e14242c`](https://github.com/chris-c-thomas/LexBuild/commit/e14242c907aa9da81eb757cc6d41caab2f81a2df), [`2a400d2`](https://github.com/chris-c-thomas/LexBuild/commit/2a400d2a748f5f474c38619364b0e2fc025f1fcc), [`bb5b8cf`](https://github.com/chris-c-thomas/LexBuild/commit/bb5b8cf8d98c5075af2c8b4b1a9b7ea322ce72a8)]:
  - @lexbuild/core@1.9.0
