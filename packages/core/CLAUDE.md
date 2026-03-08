# CLAUDE.md — @lexbuild/core

## Package Overview

`@lexbuild/core` is the foundational package of the LexBuild monorepo. It provides XML parsing, AST types/builder, Markdown rendering, frontmatter generation, and cross-reference link resolution. All source-specific packages (`@lexbuild/usc`, future `@lexbuild/cfr`) depend on core.

## Module Structure

```
src/
├── index.ts                     # Barrel exports
├── xml/
│   ├── namespace.ts             # USLM/XHTML namespace constants & element classification sets
│   └── parser.ts                # Streaming SAX parser wrapping saxes
├── ast/
│   ├── types.ts                 # AST node type definitions (LevelNode, ContentNode, InlineNode, etc.)
│   └── builder.ts               # XML SAX events → AST conversion (~1,180 lines, core state machine)
└── markdown/
    ├── renderer.ts              # AST → Markdown conversion (~585 lines)
    ├── frontmatter.ts           # YAML frontmatter generation
    └── links.ts                 # Cross-reference link resolution & OLRC fallback URLs
```

## Data Flow

```
USLM XML → [XMLParser] → SAX events → [ASTBuilder] → AST nodes → [renderer] → Markdown + YAML frontmatter
```

The pipeline is streaming: SAX events feed the ASTBuilder, which emits completed subtrees (e.g., sections) via a callback. Emitted nodes are immediately released to keep memory bounded for large titles (100MB+ XML).

## Key Architectural Patterns

### Emit-at-Level Streaming

The `ASTBuilder` accepts an `emitAt` level (section, chapter, or title). When that level's closing tag is processed, the `onEmit` callback fires with the completed AST node and an `EmitContext` containing ancestor breadcrumbs and document metadata. The subtree is then released from memory.

```typescript
const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => { /* write file */ },
});
```

### Stack-Based SAX Processing

The builder maintains a stack of `StackFrame` objects, each representing an in-progress element. Frames track their kind (`level`, `content`, `inline`, `note`, `ignore`, etc.), the AST node being built, and a text buffer. On element close, the frame pops and its node is added to the parent frame.

### Collector Zones

XHTML tables (`<xhtml:table>`) and USLM layout tables (`<layout>`) use dedicated collector state machines, checked before normal element handlers. This keeps complex table-building logic separate from the main stack.

### Text Bubbling

Text inside nested inline elements (e.g., `<heading><b>Editorial Notes</b></heading>`) is bubbled up via `bubbleTextToCollector()` so it accumulates in the heading frame's text buffer.

## AST Node Types

| Type | Purpose |
|------|---------|
| `LevelNode` | Hierarchical level (title, chapter, section, subsection, ..., subsubitem) |
| `ContentNode` | Text block — variant: `content`, `chapeau`, `continuation`, `proviso` |
| `InlineNode` | Inline text/formatting — type: `text`, `bold`, `italic`, `ref`, `footnoteRef`, `date`, `term`, `sup`, `sub`, `quoted` |
| `NoteNode` | Editorial/statutory note with topic and role |
| `SourceCreditNode` | Enactment source citation |
| `TableNode` | XHTML or USLM layout table (variant flag distinguishes) |
| `TOCNode` | Table of contents (skipped in Markdown output) |
| `NotesContainerNode` | Wraps `<notes type="uscNote">` |
| `QuotedContentNode` | Quoted legal text (rendered as blockquote) |

Level hierarchy: `BIG_LEVELS` (17 types above section) and `SMALL_LEVELS` (8 types below section) are exported as Sets.

## Namespace Classification

Defined in `xml/namespace.ts`:

- `LEVEL_ELEMENTS` — 20 hierarchical element types
- `CONTENT_ELEMENTS` — content, chapeau, continuation, proviso
- `INLINE_ELEMENTS` — b, i, ref, date, term, sup, sub, del, ins, shortTitle
- `NOTE_ELEMENTS` — note, notes, sourceCredit, statutoryNote, editorialNote, changeNote
- `APPENDIX_LEVEL_ELEMENTS` — compiledAct, courtRules, reorganizationPlan
- `META_ELEMENTS` — meta, docNumber, docReleasePoint, property
- `CONTAINER_ELEMENTS` — uscDoc, main, toc, layout, row, column (structural only)

## Rendering

`renderer.ts` exports three functions:

- `renderDocument(sectionNode, frontmatter, options)` — full document with YAML frontmatter
- `renderSection(node, options)` — section heading + body
- `renderNode(node, options)` — dispatches by node type

`RenderOptions` controls heading offset, link style (`relative`/`canonical`/`plaintext`), custom link resolver, and notes filtering (editorial/statutory/amendments toggles).

### Notes Filtering

Cross-heading notes (`<note role="crossHeading">`) act as category markers inside `<notes>` containers. The `NotesFilter` selectively includes/excludes editorial, statutory, and amendment notes at render time without modifying the AST.

### Link Resolution

`links.ts` provides a `LinkResolver` with register/resolve/fallback:
1. Exact identifier match in registry → relative path
2. Strip subsection path, try section-level → relative path
3. Not found → OLRC fallback URL (`uscode.house.gov/view.xhtml?req=granuleid:...`)
4. Non-USC refs (stat, pl, act) → always plaintext

## Frontmatter

`frontmatter.ts` generates ordered YAML using the `yaml` package. Field order is controlled manually. `FORMAT_VERSION` and `GENERATOR` (read from package.json) are exported constants.

## Implementation Details

- **`<p>` elements** are absorbed into parent content's inline children (no AST node). Multiple `<p>` elements inject `"\n\n"` separators via `handlePClose()`.
- **`<num>` has dual data**: `@value` attribute (normalized) set in `openElement`, display text set via `onText`. Both stored on parent `LevelNode`.
- **`quotedContentDepth`** counter suppresses section emission inside `<quotedContent>` (quoted bills in statutory notes).
- **Inline type mapping**: `"b"` → `"bold"`, `"i"` → `"italic"`, `"ref"` → `"ref"`. Elements like `"inline"`, `"shortTitle"`, `"del"`, `"ins"` map to `"text"` (pass-through).
- **Footnote refs**: `<ref class="footnoteRef" idref="fn1">` → `InlineNode(inlineType: "footnoteRef")` → rendered as `[^fn1]`.
- **Table rendering**: Markdown pipe syntax. Tables with colspan/rowspan are skipped with a comment. Cell pipes are escaped.
- **Heading cap**: Big-level headings beyond H5 render as bold text (H6 reserved for sections).
