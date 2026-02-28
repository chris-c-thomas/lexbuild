# Phase 1 Handoff — Scaffold Complete, Feature Work Next

**Date**: 2026-02-27
**Branch**: `dev`
**Last commit**: `9f55906 feat: scaffold monorepo with pnpm workspaces, turborepo, and tooling`

---

## What's Done

### Scaffold (100% complete)

The monorepo is fully set up and all tooling passes cleanly:

```
pnpm install         # 124 packages
pnpm turbo build     # 3/3 packages (core → usc → cli)
pnpm turbo test      # 5 tests passing
pnpm turbo lint      # 3/3 clean
pnpm turbo typecheck # 3/3 clean
pnpm format:check    # All formatted
```

### Files created

```
Root configs:
  package.json           # pnpm workspaces, turbo scripts
  pnpm-workspace.yaml    # packages/*
  turbo.json             # build/test/lint/typecheck/dev pipeline
  tsconfig.base.json     # Strict TS, ESM, Node16 module resolution
  eslint.config.js       # Flat config, typescript-eslint strict + prettier
  .prettierrc            # printWidth 100, double quotes, trailing commas
  .prettierignore        # Ignores dist, node_modules, md, reference docs, fixtures/xml

Packages (each has package.json, tsconfig.json, tsup.config.ts, vitest.config.ts):
  packages/core/src/index.ts       # Exports USLM/XHTML/DC namespace constants
  packages/core/src/index.test.ts  # 3 smoke tests for namespace exports
  packages/usc/src/index.ts        # Re-exports USLM_NAMESPACE from core
  packages/usc/src/index.test.ts   # 1 smoke test
  packages/cli/src/index.ts        # Placeholder: prints version + namespace
  packages/cli/src/index.test.ts   # 1 placeholder test

Fixture dirs:
  fixtures/xml/          # Gitignored — user places USC XML files here (usc01.xml, etc.)
  fixtures/fragments/    # For synthetic XML snippets in unit tests
  fixtures/expected/     # For snapshot expected output
```

### Docs updated during this session

- **CLAUDE.md**: Added reference materials section, pnpm usage, tiktoken/ESLint/Prettier to tech stack, decisions 7-10 (footnotes, appendix dirs, token estimation, table of disposition), additional elements from schema (article, subarticle, preliminary), status values, expanded notes taxonomy with concrete subtypes, 4 new common pitfalls
- **DEVELOPMENT_PLAN.md**: Replaced "Open Questions" with "Resolved Decisions"
- **OUTPUT_FORMAT.md**: Updated token estimation to tiktoken, added appendix directory convention
- **XML_ELEMENT_REFERENCE.md**: Added root element variants, metadata corrections, ref prefixes, content element base types, concrete note subtypes (statutoryNote, editorialNote, changeNote), universal attributes section, missing special elements
- **.gitignore**: Added `fixtures/xml/`, pnpm-lock.yaml un-ignored, package-lock.json ignored

### Reference materials reviewed

- `docs/reference/uslm/uslm-user-guide.pdf` — OLRC user guide v0.1.4 (50 pages, fully extracted and summarized)
- `docs/reference/uslm/uslm-schema-and-css/USLM-1.0.xsd` — Original schema
- `docs/reference/uslm/uslm-schema-and-css/USLM-1.0.15.xsd` — Patched schema (minor, better namespace resolution)
- `docs/reference/uslm/uslm-schema-and-css/usctitle.css` — Browser rendering stylesheet (fully analyzed)
- Supporting schemas: dc.xsd, dcterms.xsd, dcmitype.xsd, xhtml-1.0.xsd, xml.xsd

---

## What's Next — Phase 1 Feature Implementation

Per `docs/DEVELOPMENT_PLAN.md` Phase 1, the remaining work is:

1. **SAX-based XML parser** in `@law2md/core` (`packages/core/src/xml/parser.ts`)
   - Wrap `saxes` with typed event emitter
   - Normalize namespace-prefixed element names
   - See ARCHITECTURE.md `ParserEvents` and `XMLParserOptions` interfaces

2. **USLM namespace constants and element type enums** (`packages/core/src/xml/namespace.ts`, `types.ts`)

3. **AST node types** (`packages/core/src/ast/types.ts`)
   - LevelNode, ContentNode, InlineNode, NoteNode, SourceCreditNode, TableNode, TOCNode
   - See ARCHITECTURE.md for full type definitions

4. **AST builder** (`packages/core/src/ast/builder.ts`)
   - XML events → AST tree via stack-based construction
   - Section-emit pattern: emit completed section nodes via callback, release from memory
   - See ARCHITECTURE.md `ASTBuilderOptions` and `EmitContext`

5. **Basic Markdown renderer** (`packages/core/src/markdown/renderer.ts`)
   - AST → Markdown string, stateless and pure
   - See ARCHITECTURE.md `RenderOptions`, DEVELOPMENT_PLAN.md element mapping table

6. **YAML frontmatter generation** (`packages/core/src/markdown/frontmatter.ts`)
   - See ARCHITECTURE.md `FrontmatterData` interface

7. **Section-level file writer** — write .md files to output dir as sections are emitted

8. **`law2md convert` command** in CLI (`packages/cli/src/commands/convert.ts`)
   - Local file input only for Phase 1
   - Wire up: XML file → SAX parser → AST builder → renderer → file writer

9. **Test with `usc01.xml`** — verify section output matches expected for all of Title 1

### Phase 1 Exit Criteria

`law2md convert fixtures/xml/usc01.xml -o ./test-output` produces correct section-level Markdown for all of Title 1 with frontmatter.

---

## Resolved Design Decisions

These were discussed and decided with the user. All are documented in CLAUDE.md and DEVELOPMENT_PLAN.md:

| Decision | Resolution |
|----------|-----------|
| Footnotes | Markdown `[^N]` style |
| Appendix titles | Separate directories (`title-05-appendix/`) |
| Token estimation | `tiktoken` with `cl100k_base` encoding |
| Table of Disposition | Exclude from section output, include in title README |
| Linting | ESLint + Prettier from the start |
| Package manager | pnpm (not npm) |

---

## Key Schema Findings to Remember

From reviewing the XSD and user guide (details in MEMORY.md and updated docs):

- Schema is intentionally permissive: any `<level>` inside any `<level>`, `<content>` allows `##any` namespace
- `<continuation>` is interstitial (between same-level siblings), not just "after sub-levels"
- Additional elements: `<article>`, `<subarticle>`, `<preliminary>`, `<statutoryNote>`, `<editorialNote>`, `<changeNote>`, `<shortTitle>`, `<checkBox>`
- StatusEnum has 18 values (repealed, transferred, omitted, reserved, etc.)
- Elements support point-in-time versioning via `@startPeriod`/`@endPeriod`
- `@portion` on `<ref>` is composable with `@idref` for recursive references
- CSS uses 12pt indent per hierarchy level; `<term>` renders as small-caps (we use bold)

---

## Technical Notes

- **pnpm 10.30.3** is the package manager. Root `package.json` has `"packageManager": "pnpm@10.30.3"`
- **pnpm.onlyBuiltDependencies**: `["esbuild"]` must be in root package.json (pnpm requires explicit approval for build scripts)
- **No TS project references** — tsup handles cross-package resolution via pnpm workspace protocol (`workspace:*`). Removed `references` from tsconfig.json files because they required `composite: true` which conflicts with tsup's DTS generation
- **@types/node** is installed in both root and each package devDependencies (needed for tsup DTS build to find `console`, `process`, etc.)
- **Prettier ignores**: `docs/reference/` (vendor files), `*.md` (markdown formatting is manual), `fixtures/xml/` (user-provided XML)

---

## User Preferences

- Prefers checking in before starting major work phases
- Wants scaffold verified before feature implementation
- Uses pnpm, not npm
- Full transcript available at `docs/transcripts/claude-transcript-2026-02-27-230905.txt` (large, use only if needed)
