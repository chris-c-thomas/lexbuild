# CLAUDE.md — law2md

## Project Overview

`law2md` converts U.S. legislative XML (USLM schema) into structured Markdown for AI/RAG ingestion. It is a monorepo built with Turborepo, npm workspaces, TypeScript, and Node.js.

## Repository Structure

```
law2md/
├── packages/
│   ├── core/        # @law2md/core — XML parsing, AST, Markdown rendering, shared utilities
│   ├── usc/         # @law2md/usc — U.S. Code-specific element handlers and downloader
│   └── cli/         # law2md — CLI binary (the published npm package users install)
├── fixtures/        # Test XML files and expected output snapshots
├── docs/            # Architecture, output format spec, extension guide
├── turbo.json       # Turborepo pipeline config
└── CLAUDE.md        # This file
```

## Tech Stack

- **Runtime**: Node.js >= 20 LTS (ESM)
- **Language**: TypeScript 5.x, strict mode, no `any` unless explicitly justified
- **XML Parsing**: `saxes` (SAX streaming) + `@xmldom/xmldom` (DOM for fragments)
- **CLI**: `commander`
- **Validation**: `zod`
- **YAML**: `yaml` package
- **Zip**: `yauzl`
- **Logging**: `pino`
- **Testing**: `vitest`
- **Build**: `tsup`
- **Monorepo**: Turborepo + npm workspaces

## Build & Dev Commands

```bash
# Install dependencies (from repo root)
npm install

# Build all packages
npx turbo build

# Build a specific package
npx turbo build --filter=@law2md/core

# Run all tests
npx turbo test

# Run tests for a specific package
npx turbo test --filter=@law2md/usc

# Type check
npx turbo typecheck

# Lint
npx turbo lint

# Dev mode (watch + rebuild)
npx turbo dev

# Run the CLI locally during development
node packages/cli/dist/index.js convert ./fixtures/usc01.xml -o ./test-output
```

## Code Conventions

### TypeScript

- ESM only (`"type": "module"` in all package.json files)
- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Use `import type` for type-only imports
- Prefer `interface` over `type` for object shapes (better error messages, declaration merging)
- All exported functions and types must have JSDoc comments
- Use `unknown` over `any`; if `any` is truly needed, add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why
- Barrel exports via `index.ts` in each package `src/`

### Naming

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

## USLM XML Schema — Key Facts

The XML files use the USLM 1.0 schema. Namespace: `http://xml.house.gov/schemas/uslm/1.0`

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
title > subtitle > chapter > subchapter > part > subpart > division > subdivision
  > section (PRIMARY LEVEL)
    > subsection > paragraph > subparagraph > clause > subclause > item > subitem > subsubitem
```

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
| `<continuation>` | Text after sub-levels | — |
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

USLM uses canonical URI paths as identifiers:

```
/us/usc/t{title}/s{section}/{subsection}/{paragraph}

Examples:
/us/usc/t1          — Title 1
/us/usc/t1/ch1      — Chapter 1 of Title 1
/us/usc/t1/s1       — Section 1 of Title 1
/us/usc/t1/s1/a     — Subsection (a) of Section 1
/us/usc/t1/s1/a/2   — Paragraph (2) of Subsection (a)
```

Reference prefixes: `t` = title, `st` = subtitle, `ch` = chapter, `sch` = subchapter, `p` = part, `sp` = subpart, `d` = division, `sd` = subdivision, `s` = section.

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

Notes appear as `<note>` elements within `<notes type="uscNote">` containers. They are categorized by:

- `@role`: `"crossHeading"` (section divider, e.g., "Editorial Notes", "Statutory Notes and Related Subsidiaries")
- `@topic`: `"amendments"`, `"codification"`, `"changeOfName"`, `"crossReferences"`, `"effectiveDateOfAmendment"`, `"miscellaneous"`, `"repeals"`, `"regulations"`, `"dispositionOfSections"`, `"enacting"`

Cross-headings with `<heading>` containing "Editorial Notes" or "Statutory Notes" act as section dividers. The notes following a cross-heading belong to that category until the next cross-heading.

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

Example (current as of late 2025): `xml_usc01@119-43.zip`

The zip contains a single XML file named like `usc01.xml`.

## Output File Naming

```
output/usc/title-{NN}/chapter-{NN}/section-{N}.md
```

- Title dirs: `title-01` through `title-54` (zero-padded to 2 digits)
- Chapter dirs: `chapter-01`, `chapter-02`, etc. (zero-padded to 2 digits)
- Section files: `section-{N}.md` where N is the section number (NOT zero-padded, since section numbers can be alphanumeric like `section-7801`)
- Subchapter dirs nest inside chapter dirs when present

## Key Design Decisions

1. **SAX over DOM**: Large titles (26, 42) can exceed 100MB XML. SAX streaming keeps memory bounded. DOM is used only for small fragment inspection.

2. **Section as the atomic unit**: A section is the smallest citable legal unit in the U.S. Code. Subsections, paragraphs, etc. are rendered within the section file, not as separate files.

3. **Frontmatter + sidecar index**: Both YAML frontmatter on every .md file AND `_meta.json` per directory. Frontmatter enables file-level RAG ingestion. Sidecar enables index-based retrieval without parsing every file.

4. **Relative cross-reference links**: Cross-refs within the converted corpus use relative markdown links. Refs to unconverted titles fall back to OLRC website URLs.

5. **Notes are opt-in**: By default, only the core statutory text and source credits are included. Notes (editorial, statutory, amendments) require explicit CLI flags. This keeps default output lean for RAG.

6. **Streaming output**: Sections are written to disk as they are parsed. The converter never holds an entire title's worth of AST in memory simultaneously.

## Common Pitfalls

- **XHTML namespace tables**: `<table>` elements in USC XML are in the XHTML namespace, not the USLM namespace. The SAX parser must handle namespace-aware element names.
- **Anomalous structures**: Some sections have non-standard nesting (e.g., `<paragraph>` directly under `<section>` without a `<subsection>`). Handlers must not assume strict hierarchy.
- **Empty/repealed sections**: Some sections contain only a `<note>` with status information (e.g., "Repealed" or "Transferred"). These should still produce an output file with appropriate frontmatter.
- **Roman numeral numbering**: Clauses use lowercase Roman numerals (i, ii, iii), subclauses use uppercase (I, II, III). The `<num>` element's `@value` attribute contains the normalized form.
- **Inline XHTML in content**: `<b>`, `<i>`, `<sub>`, `<sup>` elements appear inline within text content. They are in the USLM namespace, not XHTML.
- **Multiple `<p>` elements in content**: A single `<content>` or `<note>` may contain multiple `<p>` elements. Each should be a separate paragraph in Markdown output.

## When Adding New Source Types (CFR, State Statutes)

1. Create a new package: `packages/cfr/` (or `packages/state-il/`, etc.)
2. Implement source-specific element handlers extending `@law2md/core` interfaces
3. Add a new `--source-type` option value in `packages/cli`
4. Reuse `@law2md/core` for XML parsing, AST, Markdown rendering, and frontmatter
5. Add source-specific download logic if applicable
6. Document the source's XML schema in the package README
