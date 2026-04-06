# @lexbuild/ecfr

## 1.18.1

### Patch Changes

- bee35c5: Docs update; Version bump
- Updated dependencies [bee35c5]
  - @lexbuild/core@1.18.1

## 1.18.0

### Minor Changes

- 434ecfe: Bump version for docs site version sync

### Patch Changes

- Updated dependencies [434ecfe]
  - @lexbuild/core@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [66af7d2]
  - @lexbuild/core@1.17.3

## 1.17.2

### Patch Changes

- 47a48df: Use PBKDF2 for API key hashing and fix CI test runner
- 0fef14e: Phase 5 of the Data API implementation. Adds full-text search across all three sources with faceted filtering, highlighting, and sort.
- e63fd69: Refactor shared API key schema and hashing to @lexbuild/core
- 92698e7: Phase 4 of the Data API implementation. Adds paginated document listings
- 62e6ad0: Data API Phase 0 implementation
- a94fa11: Phase 7 of the Data API implementation. Adds deploy script modes for API code and database deployment, and updates documentation across the monorepo.
- a63e95e: Data API Phase 1
- 2033419: Phase 3 of the Data API implementation.
- 9b7b181: Phase 6 of the Data API implementation. Adds API key management with SQLite-backed storage, tiered rate limiting, usage tracking, and CLI commands for key lifecycle management.
- Updated dependencies [47a48df]
- Updated dependencies [0fef14e]
- Updated dependencies [e63fd69]
- Updated dependencies [92698e7]
- Updated dependencies [62e6ad0]
- Updated dependencies [a94fa11]
- Updated dependencies [a63e95e]
- Updated dependencies [2033419]
- Updated dependencies [9b7b181]
  - @lexbuild/core@1.17.2

## 1.17.1

### Patch Changes

- 16aae5b: Prettier Formatting
- Updated dependencies [16aae5b]
  - @lexbuild/core@1.17.1

## 1.17.0

### Minor Changes

- 15c21c9: Meilisearch Docker Container

### Patch Changes

- Updated dependencies [15c21c9]
  - @lexbuild/core@1.17.0

## 1.16.1

### Patch Changes

- ae8e01c: Update documentation and CLAUDE.md files
- Updated dependencies [ae8e01c]
  - @lexbuild/core@1.16.1

## 1.16.0

### Minor Changes

- deb4785: Enrich FR with API JSON metadata

### Patch Changes

- Updated dependencies [deb4785]
  - @lexbuild/core@1.16.0

## 1.15.3

### Patch Changes

- 62f5fd3: Prettier Formatting
- 4599ccb: Cleanup and enhance comments throughout monorepo for better consistency
- Updated dependencies [62f5fd3]
- Updated dependencies [4599ccb]
  - @lexbuild/core@1.15.3

## 1.15.2

### Patch Changes

- c59e3a7: Patch Bump
- Updated dependencies [c59e3a7]
  - @lexbuild/core@1.15.2

## 1.15.1

### Patch Changes

- 428aaeb: Package README.md updates
- Updated dependencies [428aaeb]
  - @lexbuild/core@1.15.1

## 1.15.0

### Minor Changes

- 0d01106: Implement Federal Register
- 974392c: Implement bulk xml downloader for federal register

### Patch Changes

- c873f5c: Update packages CLAUDE.md files
- 889a9c1: Fix parser error
- 89a630b: Fix FR conversion
- c3bec41: Implement concurrent downloads for FR
- c612cb6: Fix formatting issues with FR raw and rendered text
- 424d10c: Fix Federal Register downloader progress status; change 100ms request delay to 25ms for 4x faster throughput
- Updated dependencies [c873f5c]
- Updated dependencies [0d01106]
- Updated dependencies [889a9c1]
- Updated dependencies [89a630b]
- Updated dependencies [c3bec41]
- Updated dependencies [c612cb6]
- Updated dependencies [974392c]
- Updated dependencies [424d10c]
  - @lexbuild/core@1.15.0

## 1.14.1

### Patch Changes

- da51df3: bump version
- Updated dependencies [da51df3]
  - @lexbuild/core@1.14.1

## 1.14.0

### Minor Changes

- 9af2c94: @lexbuild/fr
- f2118bd: Phase 1 implementing Federal Register source
- 2a6e3f2: Implement Federal Register source

### Patch Changes

- d2e2520: Fix Claude PR Review Issues
- 9a8a655: Update CLAUDE.md files
- 67049b9: Update documentation for Federal Register source
- c8e6e86: Implement fixes for Claude PR Review issues
- 0c52c73: Fix ESLint errors
- Updated dependencies [d2e2520]
- Updated dependencies [9af2c94]
- Updated dependencies [9a8a655]
- Updated dependencies [f2118bd]
- Updated dependencies [2a6e3f2]
- Updated dependencies [67049b9]
- Updated dependencies [c8e6e86]
- Updated dependencies [0c52c73]
  - @lexbuild/core@1.14.0

## 1.13.3

### Patch Changes

- a8b9cc1: Fix dependabot security vulnerabilities
- Updated dependencies [a8b9cc1]
  - @lexbuild/core@1.13.3

## 1.13.2

### Patch Changes

- cab1c2c: Add download progress indicators
- f6d7281: fix: address PR review findings for download progress
- Updated dependencies [cab1c2c]
- Updated dependencies [f6d7281]
  - @lexbuild/core@1.13.2

## 1.13.1

### Patch Changes

- Updated dependencies [f89a4ee]
  - @lexbuild/core@1.13.1

## 1.13.0

### Minor Changes

- cb27ce5: Astro SEO enhancements, JSON-LD, Twitter card support, and robots.txt

### Patch Changes

- Updated dependencies [cb27ce5]
  - @lexbuild/core@1.13.0

## 1.12.0

### Minor Changes

- 17cf9bf: add list-release-points to CLI command and release point history API

### Patch Changes

- Updated dependencies [17cf9bf]
  - @lexbuild/core@1.12.0

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
