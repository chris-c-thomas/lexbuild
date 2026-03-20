# @lexbuild/usc

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

## 1.8.0

### Minor Changes

- [#37](https://github.com/chris-c-thomas/LexBuild/pull/37) [`f1fc762`](https://github.com/chris-c-thomas/LexBuild/commit/f1fc762b0bea2a15fc6de8e88c67ed5b59612825) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Bump v1.8.0

### Patch Changes

- Updated dependencies [[`f1fc762`](https://github.com/chris-c-thomas/LexBuild/commit/f1fc762b0bea2a15fc6de8e88c67ed5b59612825)]:
  - @lexbuild/core@1.8.0

## 1.7.0

### Minor Changes

- [#35](https://github.com/chris-c-thomas/LexBuild/pull/35) [`9e4a623`](https://github.com/chris-c-thomas/LexBuild/commit/9e4a623556cb90b45a739c7a4be9133298a3e18f) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Update for LexBuild deployment

### Patch Changes

- Updated dependencies [[`9e4a623`](https://github.com/chris-c-thomas/LexBuild/commit/9e4a623556cb90b45a739c7a4be9133298a3e18f)]:
  - @lexbuild/core@1.7.0

## 1.6.0

### Minor Changes

- [#33](https://github.com/chris-c-thomas/LexBuild/pull/33) [`69b95ea`](https://github.com/chris-c-thomas/LexBuild/commit/69b95ea59ea434607fca80671f96559da5789462) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Change GitHub Actions to drop Node 20, keep 22, and add 24; Update documentation files to reflect those changes.

### Patch Changes

- Updated dependencies [[`69b95ea`](https://github.com/chris-c-thomas/LexBuild/commit/69b95ea59ea434607fca80671f96559da5789462)]:
  - @lexbuild/core@1.6.0

## 1.5.1

### Patch Changes

- [`874a2de`](https://github.com/chris-c-thomas/LexBuild/commit/874a2de4cec9e9593fbec742f5ee033fc2cf9878) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - fix: resolve workspace:\* dependencies to actual versions in published packages

- Updated dependencies [[`874a2de`](https://github.com/chris-c-thomas/LexBuild/commit/874a2de4cec9e9593fbec742f5ee033fc2cf9878)]:
  - @lexbuild/core@1.5.1

## 1.5.0

### Minor Changes

- [#29](https://github.com/chris-c-thomas/LexBuild/pull/29) [`ccae93b`](https://github.com/chris-c-thomas/LexBuild/commit/ccae93bd42f98cadc5c09f2cffaebe1ab353385c) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Refactor and enhance documentation

### Patch Changes

- Updated dependencies [[`ccae93b`](https://github.com/chris-c-thomas/LexBuild/commit/ccae93bd42f98cadc5c09f2cffaebe1ab353385c)]:
  - @lexbuild/core@1.5.0

## 1.4.2

### Patch Changes

- [`a0b59f6`](https://github.com/chris-c-thomas/LexBuild/commit/a0b59f618f2fb1fd225ac4b09f0b113455cb7af9) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Update additional references of lexbuild to LexBuild where appropriate

- Updated dependencies [[`a0b59f6`](https://github.com/chris-c-thomas/LexBuild/commit/a0b59f618f2fb1fd225ac4b09f0b113455cb7af9)]:
  - @lexbuild/core@1.4.2

## 1.4.1

### Patch Changes

- [`265bc0f`](https://github.com/chris-c-thomas/lexbuild/commit/265bc0f773da61e65736749d2dd462aa767f4b25) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Update README.md files

- Updated dependencies [[`265bc0f`](https://github.com/chris-c-thomas/lexbuild/commit/265bc0f773da61e65736749d2dd462aa767f4b25)]:
  - @lexbuild/core@1.4.1

## 1.4.0

### Minor Changes

- [#25](https://github.com/chris-c-thomas/lexbuild/pull/25) [`8c294fb`](https://github.com/chris-c-thomas/lexbuild/commit/8c294fba20996fe6436dd08df10afec64a2a3480) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Version bump v1.4.0

### Patch Changes

- Updated dependencies [[`8c294fb`](https://github.com/chris-c-thomas/lexbuild/commit/8c294fba20996fe6436dd08df10afec64a2a3480)]:
  - @lexbuild/core@1.4.0

## 1.3.0

### Minor Changes

- [#23](https://github.com/chris-c-thomas/lexbuild/pull/23) [`6ed94e2`](https://github.com/chris-c-thomas/lexbuild/commit/6ed94e2714b7855a11e7234f72466ce7f8eaca7d) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix incorrect output structure for chapter conversions, update web app, and modify convert command's summary stats.

### Patch Changes

- Updated dependencies [[`6ed94e2`](https://github.com/chris-c-thomas/lexbuild/commit/6ed94e2714b7855a11e7234f72466ce7f8eaca7d)]:
  - @lexbuild/core@1.3.0

## 1.2.0

### Minor Changes

- [#21](https://github.com/chris-c-thomas/lexbuild/pull/21) [`e42b53b`](https://github.com/chris-c-thomas/lexbuild/commit/e42b53b29cace56c4631a929ca0102828ca02229) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Bump to v1.2.0

### Patch Changes

- Updated dependencies [[`e42b53b`](https://github.com/chris-c-thomas/lexbuild/commit/e42b53b29cace56c4631a929ca0102828ca02229)]:
  - @lexbuild/core@1.2.0

## 1.1.1

### Patch Changes

- [#18](https://github.com/chris-c-thomas/lexbuild/pull/18) [`e216a97`](https://github.com/chris-c-thomas/lexbuild/commit/e216a972696de25726029e87f5cf6b754180bdd6) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix backslash escaping vulnerability; add permissions to ci.yml

- Updated dependencies [[`e216a97`](https://github.com/chris-c-thomas/lexbuild/commit/e216a972696de25726029e87f5cf6b754180bdd6)]:
  - @lexbuild/core@1.1.1

## 1.1.0

### Minor Changes

- [#15](https://github.com/chris-c-thomas/lexbuild/pull/15) [`b60c8a5`](https://github.com/chris-c-thomas/lexbuild/commit/b60c8a561e7d9d88fd50eec79b214a1d35b6e49a) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Improve CLI help output with usage examples, granularity descriptions, and documentation links

- [#14](https://github.com/chris-c-thomas/lexbuild/pull/14) [`0968b27`](https://github.com/chris-c-thomas/lexbuild/commit/0968b2763db5b9683c98f4c64c7c6304502b0838) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Add "title" output granularity (`-g title`) that produces a single Markdown file per title with recursive heading

### Patch Changes

- [#16](https://github.com/chris-c-thomas/lexbuild/pull/16) [`0672a8b`](https://github.com/chris-c-thomas/lexbuild/commit/0672a8b4205ed3dc50f26f24acb0a49775916b87) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Remove null return type from writeWholeTitle

- [#16](https://github.com/chris-c-thomas/lexbuild/pull/16) [`18578e8`](https://github.com/chris-c-thomas/lexbuild/commit/18578e8f170eef43978db8494eaf6b1e5db252de) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix additional heading collisions, token estimation inconsistencies, and validate granularity commands to prevent invalid options

- [#14](https://github.com/chris-c-thomas/lexbuild/pull/14) [`bd0ac38`](https://github.com/chris-c-thomas/lexbuild/commit/bd0ac38857b8a305e87db75ae4c955b504809ac3) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix heading level issues

- [#16](https://github.com/chris-c-thomas/lexbuild/pull/16) [`1faf32a`](https://github.com/chris-c-thomas/lexbuild/commit/1faf32afc4f267135032b605dd3e72feaf2664c4) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Additional clceanup

- [#14](https://github.com/chris-c-thomas/lexbuild/pull/14) [`6e50a6f`](https://github.com/chris-c-thomas/lexbuild/commit/6e50a6f859a1c877cab731fbe18df888efb1ecbc) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix doc heading format and chapter count inconsistency

- [#14](https://github.com/chris-c-thomas/lexbuild/pull/14) [`45007c1`](https://github.com/chris-c-thomas/lexbuild/commit/45007c1c28499539d16e008984827e6776b9089b) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fixed chapter related output with regard to headings and metadata

- [#14](https://github.com/chris-c-thomas/lexbuild/pull/14) [`e88a24e`](https://github.com/chris-c-thomas/lexbuild/commit/e88a24e8ec60e1f89aebcef45803af0b268e9d5a) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix section heading collision at depth 5

- [#16](https://github.com/chris-c-thomas/lexbuild/pull/16) [`f33a033`](https://github.com/chris-c-thomas/lexbuild/commit/f33a033022d25c2007f884eaeb2faae4bb5153df) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix token estimation for title-level conversions

- [#14](https://github.com/chris-c-thomas/lexbuild/pull/14) [`db9bf75`](https://github.com/chris-c-thomas/lexbuild/commit/db9bf75f36e372dcd30630ca1da898442ab0313a) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Fix appendix naming conflicts

- Updated dependencies [[`0672a8b`](https://github.com/chris-c-thomas/lexbuild/commit/0672a8b4205ed3dc50f26f24acb0a49775916b87), [`18578e8`](https://github.com/chris-c-thomas/lexbuild/commit/18578e8f170eef43978db8494eaf6b1e5db252de), [`bd0ac38`](https://github.com/chris-c-thomas/lexbuild/commit/bd0ac38857b8a305e87db75ae4c955b504809ac3), [`b60c8a5`](https://github.com/chris-c-thomas/lexbuild/commit/b60c8a561e7d9d88fd50eec79b214a1d35b6e49a), [`1faf32a`](https://github.com/chris-c-thomas/lexbuild/commit/1faf32afc4f267135032b605dd3e72feaf2664c4), [`6e50a6f`](https://github.com/chris-c-thomas/lexbuild/commit/6e50a6f859a1c877cab731fbe18df888efb1ecbc), [`0968b27`](https://github.com/chris-c-thomas/lexbuild/commit/0968b2763db5b9683c98f4c64c7c6304502b0838), [`45007c1`](https://github.com/chris-c-thomas/lexbuild/commit/45007c1c28499539d16e008984827e6776b9089b), [`e88a24e`](https://github.com/chris-c-thomas/lexbuild/commit/e88a24e8ec60e1f89aebcef45803af0b268e9d5a), [`f33a033`](https://github.com/chris-c-thomas/lexbuild/commit/f33a033022d25c2007f884eaeb2faae4bb5153df), [`db9bf75`](https://github.com/chris-c-thomas/lexbuild/commit/db9bf75f36e372dcd30630ca1da898442ab0313a)]:
  - @lexbuild/core@1.1.0

## 1.0.6

### Patch Changes

- [#12](https://github.com/chris-c-thomas/lexbuild/pull/12) [`0e49c15`](https://github.com/chris-c-thomas/lexbuild/commit/0e49c159725435057237c00ac77d1c0de24e090a) Thanks [@chris-c-thomas](https://github.com/chris-c-thomas)! - Update files to reference lexbuild as LexBuild as the project name

- Updated dependencies [[`0e49c15`](https://github.com/chris-c-thomas/lexbuild/commit/0e49c159725435057237c00ac77d1c0de24e090a)]:
  - @lexbuild/core@1.0.6

## 1.0.5

### Patch Changes

- f86d74e: Quick fix
- Updated dependencies [f86d74e]
  - @lexbuild/core@1.0.5

## 1.0.4

### Patch Changes

- 2598707: Fix README.md badge
- Updated dependencies [2598707]
  - @lexbuild/core@1.0.4

## 1.0.3

### Patch Changes

- baaeba1: Update READMEs and package.json files
- Updated dependencies [baaeba1]
  - @lexbuild/core@1.0.3

## 1.0.2

### Patch Changes

- 54219a7: Fix links that display on the npm registry
- Updated dependencies [54219a7]
  - @lexbuild/core@1.0.2

## 1.0.1

### Patch Changes

- Add package README.md files
- Updated dependencies
  - @lexbuild/core@1.0.1

## 1.0.0

### Major Changes

- First stable release. Converts all 54 titles of the U.S. Code from USLM XML to structured Markdown optimized for AI, RAG pipelines, and semantic search.

### Patch Changes

- Updated dependencies
  - @lexbuild/core@1.0.0

## 0.8.0

### Minor Changes

- Cleanup repo

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.8.0

## 0.7.0

### Minor Changes

- lexbuild convert --all now scans --input-dir for whatever usc{NN}.xml

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.7.0

## 0.6.2

### Patch Changes

- Cleanup files in project
- Updated dependencies
  - @lexbuild/core@0.6.2

## 0.6.1

### Patch Changes

- Enhance downloader for when all titles are downloaded
- Updated dependencies
  - @lexbuild/core@0.6.1

## 0.6.0

### Minor Changes

- 529f4bf: CLI TUI formatting fixes

### Patch Changes

- Updated dependencies [529f4bf]
  - @lexbuild/core@0.6.0

## 0.5.0

### Minor Changes

- 3a29a8e: Add `--titles` multi-select option to download and convert commands. Supports ranges (`1-5`), comma-separated lists

### Patch Changes

- Updated dependencies [3a29a8e]
  - @lexbuild/core@0.5.0

## 0.4.1

### Patch Changes

- Add chalk, ora, and cli-table3 for polished terminal output with spinners and formatted
- Updated dependencies
  - @lexbuild/core@0.4.1

## 0.4.0

### Minor Changes

- Phase 4: Polish and Publish — snapshot tests, title-level README generation, CI/CD, documentation polish

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.4.0

## 0.3.0

### Minor Changes

- Phase 3: Scale & Download
  - feat(usc): OLRC downloader with zip extraction and release point support
  - feat(cli): `lexbuild download` command with `--title`, `--all`, `--release-point`
  - feat(usc,cli): `--dry-run` mode for convert command
  - feat(usc,cli): peak memory and token reporting in convert output
  - feat(core,usc): handle appendix titles with separate output directories
  - feat(usc): disambiguate duplicate section numbers with `-2` suffix
  - feat(usc): status edge cases (repealed, reserved, transferred) in frontmatter and `_meta.json`

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.3.0

## 0.2.0

### Minor Changes

- abf4e13: Phase 2: Content Fidelity
  - Fix extra blank lines in multi-paragraph content blocks
  - Cross-reference link resolver with register/resolve/fallback and two-pass wiring
  - XHTML table conversion to Markdown pipe tables
  - USLM layout table conversion for TOC structures and tabular notes
  - Notes filtering with --no-include-notes, --include-editorial-notes, --include-statutory-notes, --include-amendments
  - \_meta.json sidecar index generation at title and chapter levels
  - Chapter-level granularity mode (--granularity chapter)
  - Fix collector zone ordering bug (table/layout/toc checked before normal handlers)
  - E2E verified against Title 1 (39 sections) and Title 5 (1162 sections)

### Patch Changes

- Updated dependencies [abf4e13]
  - @lexbuild/core@0.2.0

## 0.1.0

### Minor Changes

- Phase 1: Foundation — initial implementation
  - SAX streaming XML parser with namespace normalization
  - AST node types and stack-based builder with section-emit pattern
  - Markdown renderer with bold inline numbering, cross-reference link modes, notes, and blockquotes
  - YAML frontmatter generator with format versioning
  - USC converter pipeline: XML → parse → build → render → write section files
  - CLI `convert` command with output directory, link style, and source credit options
  - E2E verified against Title 1 (39 sections, 3 chapters)

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.1.0
