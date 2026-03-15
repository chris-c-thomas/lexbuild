# CLAUDE.md — LexBuild

## Project Overview

LexBuild converts U.S. legal XML into structured Markdown for AI/RAG ingestion. It supports multiple source formats: U.S. Code (USLM schema) and eCFR (GPO/SGML-derived XML), with an architecture designed for additional sources (annual CFR, Federal Register, state statutes). It is a monorepo built with Turborepo, pnpm workspaces, TypeScript, and Node.js.

## Repository Structure

```
lexbuild/
├── packages/
│   ├── core/        # @lexbuild/core — XML parsing, AST, Markdown rendering, shared utilities
│   ├── usc/         # @lexbuild/usc — U.S. Code-specific element handlers and downloader
│   ├── ecfr/        # @lexbuild/ecfr — eCFR (Code of Federal Regulations) converter and downloader
│   └── cli/         # @lexbuild/cli — CLI binary (the published npm package users install)
├── apps/
│   └── astro/       # LexBuild web app — Astro 6, SSR, browse U.S. Code + eCFR as Markdown
├── downloads/
│   ├── usc/
│   │   └── xml/     # Full USC XML files (usc01.xml ... usc54.xml) — gitignored
│   └── ecfr/
│       └── xml/     # Full eCFR XML files (ECFR-title1.xml ... ECFR-title50.xml) — gitignored
├── fixtures/
│   ├── fragments/   # Small synthetic XML snippets for unit tests
│   └── expected/    # Expected output snapshots for integration tests
├── docs/            # Architecture, output format spec, extension guide
├── turbo.json       # Turborepo pipeline config
└── CLAUDE.md        # This file
```

## Package-Level Documentation

Each package and app has its own `CLAUDE.md` with architecture details, module structure, and package-specific conventions:

- [`packages/core/CLAUDE.md`](packages/core/CLAUDE.md) — XML→AST→Markdown pipeline, emit-at-level streaming, AST node types, rendering, link resolution
- [`packages/usc/CLAUDE.md`](packages/usc/CLAUDE.md) — Collect-then-write pattern, granularity output, edge cases (duplicates, appendices), downloader
- [`packages/ecfr/CLAUDE.md`](packages/ecfr/CLAUDE.md) — eCFR GPO/SGML XML→AST→Markdown, DIV-based hierarchy, element classification, downloader
- [`packages/cli/CLAUDE.md`](packages/cli/CLAUDE.md) — Commands, options, UI module, title parser, build config
- [`apps/astro/CLAUDE.md`](apps/astro/CLAUDE.md) — Astro 6 SSR site, island architecture, multi-source content browser, deployment

## Tech Stack

- **Runtime**: Node.js >= 22 LTS (ESM)
- **Language**: TypeScript 5.x, strict mode, no `any` unless explicitly justified
- **XML Parsing**: `saxes` (SAX streaming)
- **CLI**: `commander`
- **CLI Output**: `chalk`, `ora`, `cli-table3`
- **YAML**: `yaml` package
- **Zip**: `yauzl`
- **Token Counting**: character/4 heuristic
- **Testing**: `vitest`
- **Build**: `tsup`
- **Linting**: ESLint + `@typescript-eslint`
- **Formatting**: Prettier (double quotes, trailing commas, 100 char print width)
- **Monorepo**: Turborepo + pnpm workspaces
- **Versioning**: `@changesets/cli` with lockstep versioning across all packages

## Build & Dev Commands

```bash
# Install dependencies (from repo root)
pnpm install

# Build all packages
pnpm turbo build

# Build a specific package
pnpm turbo build --filter=@lexbuild/core

# Run all tests
pnpm turbo test

# Run tests for a specific package
pnpm turbo test --filter=@lexbuild/usc

# Type check
pnpm turbo typecheck

# Lint
pnpm turbo lint

# Dev mode (watch + rebuild)
pnpm turbo dev

# Run the CLI locally during development
node packages/cli/dist/index.js download-usc --all
node packages/cli/dist/index.js download-usc --titles 1
node packages/cli/dist/index.js convert-usc --all
node packages/cli/dist/index.js convert-usc --titles 1-5 -o ./test-output
node packages/cli/dist/index.js convert-usc ./downloads/usc/xml/usc01.xml -o ./test-output
node packages/cli/dist/index.js convert-usc --titles 1 -g title -o ./test-output

# eCFR commands
node packages/cli/dist/index.js download-ecfr --all
node packages/cli/dist/index.js download-ecfr --titles 1,17
node packages/cli/dist/index.js convert-ecfr --all
node packages/cli/dist/index.js convert-ecfr --titles 1 -o ./test-output
node packages/cli/dist/index.js convert-ecfr ./downloads/ecfr/xml/ECFR-title1.xml -o ./test-output
node packages/cli/dist/index.js convert-ecfr --titles 17 -g part -o ./test-output

# Astro app (apps/astro/) — NOT included in default `pnpm turbo build`
pnpm turbo dev:astro --filter=astro   # Dev server (http://localhost:4321)
pnpm turbo build:astro --filter=astro # Production build
```

### Astro App Notes

The Astro app (`apps/astro/`) is deployed to a self-managed VPS (AWS Lightsail) behind Cloudflare's edge cache. It has **no code dependency** on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`.

Key points:
- **Excluded from `pnpm turbo build`** — no `build` script in its `package.json` (only `build:astro`). This prevents CI failures since the app requires content files that aren't in git.
- **Excluded from changesets** — `"private": true` and listed in `.changeset/config.json` `ignore`.
- **Content is gitignored** — `apps/astro/content/`, `public/nav/`, `public/sitemap.xml` are all generated artifacts.
- **Content served from local filesystem** in production (`fs.readFile` from `/srv/lexbuild/content/`).
- **Production URL**: `https://lexbuild.dev` — served via Cloudflare (orange-cloud proxy) → Caddy → Astro Node server.
- See `apps/astro/CLAUDE.md` for the full architecture spec.

## Code Conventions

### TypeScript

- pnpm workspaces with `workspace:*` protocol for internal deps
- ESM only (`"type": "module"` in all package.json files)
- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Use `import type` for type-only imports
- Prefer `interface` over `type` for object shapes (better error messages, declaration merging)
- All exported functions and types must have JSDoc comments
- Use `unknown` over `any`; if `any` is truly needed, add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why
- Barrel exports via `index.ts` in each package `src/`

### Naming

- Project name: "LexBuild" in prose/descriptions/titles. Lowercase `lexbuild` only for package names (`@lexbuild/*`), CLI commands (`lexbuild convert-usc`), URLs, directory paths, and code identifiers.
- CLI commands follow `{action}-{source}` pattern: `download-usc`, `convert-usc`, `download-ecfr`, `convert-ecfr`. Bare `download`/`convert` commands show a source selection error.
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase` (e.g., `SectionNode`, `ConvertOptions`)
- Functions: `camelCase` (e.g., `parseIdentifier`, `renderSection`)
- Constants: `UPPER_SNAKE_CASE` for true constants (e.g., `USLM_NAMESPACE`)
- Enum-like objects: `PascalCase` keys using `as const` satisfies pattern

### Error Handling

- Use custom error classes extending `Error` with `cause` chaining
- XML parsing errors: warn and continue (log malformed elements, don't crash on anomalous structures)
- File I/O errors: throw with context (file path, operation attempted)
- Never swallow errors silently — at minimum, log at `warn` level

### Testing

- Co-locate test files: `parser.ts` → `parser.test.ts` in same directory
- Use `describe` blocks mirroring the module's exported API
- Snapshot tests for Markdown output stability (update snapshots intentionally, not casually)
- Name test cases descriptively: `it("converts <subsection> with chapeau to indented bold-lettered paragraph")`

## Reference Materials

Official USLM reference documents from OLRC (not committed — download locally if needed):

- [USLM User Guide (PDF)](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) — v0.1.4, Oct 2013. Covers abstract/concrete model, identification, referencing, metadata, versioning, and presentation models.
- [USLM Schema & CSS](https://uscode.house.gov/download/resources/schemaandcss.zip) — USLM-1.0.xsd, USLM-1.0.15.xsd, usctitle.css, Dublin Core schemas, XHTML schema

## USLM XML Schema — Key Facts

The XML files use the USLM 1.0 schema (patch level 1.0.15). Namespace: `http://xml.house.gov/schemas/uslm/1.0`

### Document Structure

```xml
<uscDoc identifier="/us/usc/t1">
  <meta>
    <dc:title>Title 1</dc:title>
    <dc:type>USCTitle</dc:type>
    <docNumber>1</docNumber>
    <property role="is-positive-law">yes</property>
  </meta>
  <main>
    <title identifier="/us/usc/t1">
      <num value="1">Title 1—</num>
      <heading>GENERAL PROVISIONS</heading>
      <chapter identifier="/us/usc/t1/ch1">
        <num value="1">CHAPTER 1—</num>
        <heading>RULES OF CONSTRUCTION</heading>
        <section identifier="/us/usc/t1/s1">
          <num value="1">§ 1.</num>
          <heading>Words denoting number, gender, and so forth</heading>
          <content>...</content>
          <sourceCredit>(...)</sourceCredit>
          <notes type="uscNote">...</notes>
        </section>
      </chapter>
    </title>
  </main>
</uscDoc>
```

### Element Hierarchy (Big → Small)

```
title > subtitle > chapter > subchapter > article > subarticle > part > subpart > division > subdivision
  > section (PRIMARY LEVEL)
    > subsection > paragraph > subparagraph > clause > subclause > item > subitem > subsubitem
```

Additional level elements: `<preliminary>` (outside main hierarchy), `<compiledAct>`, `<courtRules>`/`<courtRule>`, `<reorganizationPlans>`/`<reorganizationPlan>` (title appendices).

**Important**: The schema intentionally does NOT enforce strict hierarchy — any `<level>` can nest inside any `<level>`. This is a deliberate design choice, not a bug.

### Critical Elements

| Element | Purpose | Key Attributes |
|---------|---------|----------------|
| `<uscDoc>` | Document root | `identifier` |
| `<title>` | USC title | `identifier` |
| `<chapter>` | Chapter container | `identifier` |
| `<section>` | Primary legal unit | `identifier` |
| `<num>` | Number designation | `value` (normalized) |
| `<heading>` | Element name/title | — |
| `<content>` | Text content block | — |
| `<chapeau>` | Text before sub-levels | — |
| `<continuation>` | Text after or between sub-levels | — |
| `<proviso>` | "Provided that..." text | — |
| `<ref>` | Cross-reference | `href` (canonical URI) |
| `<date>` | Date | `date` (ISO format) |
| `<sourceCredit>` | Enactment source | — |
| `<note>` | Note (various types) | `topic`, `role` |
| `<notes>` | Note container | `type` (e.g., "uscNote") |
| `<quotedContent>` | Quoted legal text | `origin` |
| `<def>` / `<term>` | Definition / defined term | — |
| `<toc>` / `<tocItem>` | Table of contents | — |
| `<layout>` / `<column>` | Column-oriented display | `leaders`, `colspan` |
| `<table>` (XHTML ns) | HTML table | Standard HTML attrs |

### Identifier / Reference Format

LexBuild uses canonical URI paths as identifiers for all sources:

**USC identifiers** (from USLM `identifier` attributes):

```
/us/usc/t{title}/s{section}/{subsection}/{paragraph}

Examples:
/us/usc/t1          — Title 1
/us/usc/t1/ch1      — Chapter 1 of Title 1
/us/usc/t1/s1       — Section 1 of Title 1
/us/usc/t1/s1/a     — Subsection (a) of Section 1
```

Reference prefixes (big levels): `t` = title, `st` = subtitle, `ch` = chapter, `sch` = subchapter, `art` = article, `p` = part, `sp` = subpart, `d` = division, `sd` = subdivision, `s` = section. Small levels (subsection and below) use their number directly without a prefix.

**CFR identifiers** (constructed by the eCFR builder from `NODE` and `N` attributes):

```
/us/cfr/t{title}/s{section}

Examples:
/us/cfr/t17             — CFR Title 17
/us/cfr/t17/ch1         — Chapter I of Title 17
/us/cfr/t17/pt240       — Part 240 of Title 17
/us/cfr/t17/s240.10b-5  — Section 240.10b-5
```

Note: identifiers use `/us/cfr/` (content type) not `/us/ecfr/` (data source). Both eCFR and future annual CFR use the same identifier space.

**Link resolution**:
- `/us/usc/...` references → relative Markdown links within corpus, or OLRC fallback URLs
- `/us/cfr/...` references → relative Markdown links within corpus, or ecfr.gov fallback URLs
- `/us/stat/...` (Statutes at Large), `/us/pl/...` (Public Law) → plain text citations

### Namespaces in Use

```
Default (USLM):  http://xml.house.gov/schemas/uslm/1.0
Dublin Core:      http://purl.org/dc/elements/1.1/
DC Terms:         http://purl.org/dc/terms/
XHTML:            http://www.w3.org/1999/xhtml
XSI:              http://www.w3.org/2001/XMLSchema-instance
```

Tables use the XHTML namespace. Always check namespace when handling `<table>` elements — USLM `<layout>` uses the default namespace, XHTML `<table>` uses `http://www.w3.org/1999/xhtml`.

### Notes Taxonomy

Notes have two independent classification axes:

- `@type`: placement — `"inline"`, `"footnote"`, `"endnote"`, `"uscNote"` (after sourceCredit)
- `@topic`: semantic category — `"amendments"`, `"codification"`, `"changeOfName"`, `"crossReferences"`, `"effectiveDateOfAmendment"`, `"miscellaneous"`, `"repeals"`, `"regulations"`, `"dispositionOfSections"`, `"enacting"`

The schema also defines concrete note subtypes: `<sourceCredit>`, `<statutoryNote>`, `<editorialNote>`, `<changeNote>` (records non-substantive changes, usually in square brackets).

Within `<notes type="uscNote">` containers, `<note role="crossHeading">` elements with `<heading>` containing "Editorial Notes" or "Statutory Notes" act as section dividers. Notes following a cross-heading belong to that category until the next cross-heading.

### Status Values

Elements can carry `@status` indicating their legal state. The schema defines 18 values: `proposed`, `withdrawn`, `cancelled`, `pending`, `operational`, `suspended`, `renumbered`, `repealed`, `expired`, `terminated`, `hadItsEffect`, `omitted`, `notAdopted`, `transferred`, `redesignated`, `reserved`, `vacant`, `crossReference`, `unknown`.

## OLRC Download URLs

Current release point page: `https://uscode.house.gov/download/download.shtml`

Individual title XML zip:
```
https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{law}/xml_usc{NN}@{congress}-{law}.zip
```

All titles XML zip:
```
https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{law}/xml_uscAll@{congress}-{law}.zip
```

Where `{NN}` is zero-padded title number (01-54), `{congress}` is Congress number, `{law}` is public law number.

Example: `xml_usc01@119-73not60.zip`

Note: Release points can include exclusion suffixes (e.g., `119-73not60` means "through PL 119-73, excluding PL 119-60"). The current release point is hardcoded in `packages/usc/src/downloader.ts` as `CURRENT_RELEASE_POINT`.

The zip contains a single XML file named like `usc01.xml`.

## eCFR Download URLs

Bulk data page: `https://www.govinfo.gov/bulkdata/ECFR`

Individual title XML (no zip — plain XML):
```
https://www.govinfo.gov/bulkdata/ECFR/title-{N}/ECFR-title{N}.xml
```

Where `{N}` is the title number (1-50, not zero-padded). Example: `ECFR-title17.xml`

**Reserved titles**: Title 35 (Panama Canal) is reserved — govinfo does not publish bulk XML for it. The downloader silently skips reserved titles during `--all` downloads. The `RESERVED_TITLES` set in `packages/ecfr/src/downloader.ts` tracks which titles to skip.

50 titles total, 49 with content.

## Output File Naming

### USC Output

**Section granularity** (default): `output/usc/title-{NN}/chapter-{NN}/section-{N}.md`
**Chapter granularity**: `output/usc/title-{NN}/chapter-{NN}/chapter-{NN}.md`
**Title granularity**: `output/usc/title-{NN}.md`

- Title dirs: `title-01` through `title-54` (zero-padded to 2 digits)
- Chapter dirs: `chapter-01`, `chapter-02`, etc. (zero-padded to 2 digits)
- Section files: `section-{N}.md` where N is the section number (NOT zero-padded, since section numbers can be alphanumeric like `section-7801`)
- Subchapter dirs nest inside chapter dirs when present
- Appendix titles: separate directories (e.g., `title-05-appendix/`) for titles 5, 11, 18, 28
- Duplicate sections: disambiguated with `-2`, `-3` suffix (e.g., `section-3598.md`, `section-3598-2.md`)
- Title granularity: flat files with no subdirectories, no `_meta.json` or `README.md` — enriched frontmatter only

### eCFR Output

**Section granularity** (default): `output/ecfr/title-{NN}/chapter-{X}/part-{N}/section-{N.N}.md`
**Part granularity**: `output/ecfr/title-{NN}/chapter-{X}/part-{N}.md`
**Chapter granularity**: `output/ecfr/title-{NN}/chapter-{X}/chapter-{X}.md`
**Title granularity**: `output/ecfr/title-{NN}.md`

- Title dirs: `title-01` through `title-50` (zero-padded to 2 digits)
- Chapter dirs: `chapter-{X}` where X is a Roman numeral (e.g., `chapter-I`, `chapter-IV`)
- Part dirs: `part-{N}` where N is the part number (e.g., `part-240`)
- Section files: `section-{N.N}.md` where N.N is the part-prefixed section number (e.g., `section-240.10b-5.md`)
- Section granularity generates `_meta.json` per part and title, plus `README.md` per title

## Key Design Decisions

1. **SAX over DOM**: Large titles (26, 42) can exceed 100MB XML. SAX streaming keeps memory bounded. DOM is not used.

2. **Section as the atomic unit**: A section is the smallest citable legal unit in both USC and CFR. Subsections, paragraphs, etc. are rendered within the section file, not as separate files.

3. **Frontmatter + sidecar index**: Both YAML frontmatter on every .md file AND `_meta.json` per directory. Frontmatter enables file-level RAG ingestion. Sidecar enables index-based retrieval without parsing every file.

4. **Multi-source frontmatter**: Every file includes `source` (`"usc"` or `"ecfr"`) and `legal_status` (`"official_legal_evidence"`, `"official_prima_facie"`, or `"authoritative_unofficial"`) fields. Source-specific optional fields (e.g., `authority`, `cfr_part`) are included when relevant. The `source` discriminator lets consumers know which fields to expect.

5. **Relative cross-reference links**: Cross-refs within the converted corpus use relative Markdown links. USC refs fall back to OLRC website URLs; CFR refs fall back to ecfr.gov URLs.

6. **Notes included by default**: By default, all notes (editorial, statutory, amendments) are included alongside the core text and source credits. Notes can be disabled with `--no-include-notes` or selectively filtered with `--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`.

7. **Streaming output**: For section and chapter/part granularity, the converter writes output as sections are collected, avoiding holding the full title AST in memory. **Title granularity is the exception** — it holds the entire title AST and rendered Markdown in memory.

8. **Collect-then-write pattern**: Sections are collected during SAX streaming and written after the stream completes, avoiding async issues during SAX event processing.

9. **Source-specific AST builders**: Each XML format gets its own builder (`ASTBuilder` for USLM, `EcfrASTBuilder` for GPO/SGML). Builders are source-specific but produce the same AST node types, so the rendering pipeline is shared. Builders live in their source package, not in core.

10. **Token estimation**: Uses character/4 heuristic for token counts in `_meta.json` and frontmatter.

11. **Footnotes**: Rendered as Markdown footnotes (`[^N]` at reference site, `[^N]: text` at bottom of section file).

12. **Identifier scheme**: USC uses `/us/usc/` identifiers from USLM `identifier` attributes. CFR uses `/us/cfr/` identifiers constructed from the eCFR `NODE` and `N` attributes. Both eCFR and future annual CFR share the `/us/cfr/` space since they represent the same content.

## Common Pitfalls

- **XHTML namespace tables**: `<table>` elements in USC XML are in the XHTML namespace, not the USLM namespace. The SAX parser must handle namespace-aware element names.
- **Anomalous structures**: Some sections have non-standard nesting (e.g., `<paragraph>` directly under `<section>` without a `<subsection>`). Handlers must not assume strict hierarchy.
- **Empty/repealed sections**: Some sections contain only a `<note>` with status information (e.g., "Repealed" or "Transferred"). These should still produce an output file with appropriate frontmatter.
- **Roman numeral numbering**: Clauses use lowercase Roman numerals (i, ii, iii), subclauses use uppercase (I, II, III). The `<num>` element's `@value` attribute contains the normalized form.
- **Inline XHTML in content**: `<b>`, `<i>`, `<sub>`, `<sup>` elements appear inline within text content. They are in the USLM namespace, not XHTML.
- **Multiple `<p>` elements in content**: A single `<content>` or `<note>` may contain multiple `<p>` elements. Each should be a separate paragraph in Markdown output.
- **Permissive content model**: `<content>` uses `processContents="lax"` with `namespace="##any"` — it can contain elements from any namespace, including embedded XHTML. The SAX parser must handle unexpected elements gracefully.
- **`<continuation>` is interstitial**: Not just "after sub-levels" but also between elements of the same level. Handle as a text block in whatever position it appears.
- **Element versioning**: Elements can have `@startPeriod`/`@endPeriod`/`@status` for point-in-time variants. Multiple versions of the same element may coexist in the document.
- **Quoted content sections**: `<section>` elements inside `<quotedContent>` (quoted bills in statutory notes) must not be emitted as standalone files. Track `quotedContentDepth` to suppress emission.
- **Duplicate section numbers**: Some titles have multiple sections with the same number within a chapter (e.g., Title 5). Output files are disambiguated with `-2` suffixes.

## When Adding New Source Types

The multi-source architecture is proven — `@lexbuild/ecfr` validates the pattern with a completely different XML schema. Adding a new source follows the established pattern:

1. Create `packages/{source}/` with a dependency on `@lexbuild/core`
2. Implement a source-specific AST builder (SAX events → LexBuild AST nodes) in the source package
3. Implement a converter function (collect-then-write) analogous to `convertTitle()` or `convertEcfrTitle()`
4. Implement a downloader if the source has bulk data available
5. Add `download-{source}` and `convert-{source}` CLI commands in `packages/cli`
6. Reuse `@lexbuild/core` for XML parsing, AST types, Markdown rendering, frontmatter, and link resolution
7. Add new `SourceType` value to `packages/core/src/ast/types.ts` and any source-specific optional fields to `FrontmatterData`
8. Add the package to the `fixed` array in `.changeset/config.json`
9. Document the source's XML schema in the package's `CLAUDE.md`

Source packages must be independent — they depend only on core, never on each other.
