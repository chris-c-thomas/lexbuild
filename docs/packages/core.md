# @lexbuild/core

Format-agnostic foundation of the LexBuild platform. Provides streaming XML parsing, a typed AST, a stateless Markdown renderer, YAML frontmatter generation, cross-reference link resolution, and resilient file I/O. Every source package depends on core. Core itself knows nothing about U.S. Code or eCFR semantics -- it operates on XML structure, AST types, and Markdown conventions.

Exception: the USLM AST builder (`ASTBuilder`, aliased as `UslmASTBuilder`) lives in core because USLM is the foundational schema. The eCFR builder (`EcfrASTBuilder`) lives in `@lexbuild/ecfr`.

## Module Map

```
packages/core/src/
  index.ts                     # Barrel exports
  xml/
    uslm-elements.ts           # USLM/XHTML namespace constants, element classification sets
    parser.ts                  # Streaming SAX parser wrapping saxes
  ast/
    types.ts                   # AST node type definitions, level hierarchy, FrontmatterData
    uslm-builder.ts            # USLM XML SAX -> AST conversion (stack-based state machine)
  markdown/
    renderer.ts                # AST -> Markdown conversion
    frontmatter.ts             # YAML frontmatter generation, FORMAT_VERSION 1.1.0
    links.ts                   # Cross-reference link resolution (USC + CFR fallback URLs)
  fs.ts                        # Resilient file I/O (writeFile, mkdir with retry)
```

## Data Flow

```
XML -> [XMLParser] -> SAX events -> [ASTBuilder] -> AST nodes -> [renderer] -> Markdown + YAML frontmatter
```

The pipeline is streaming. SAX events feed a source-specific builder (USLM `ASTBuilder` for USC, `EcfrASTBuilder` for eCFR), which emits completed subtrees via a callback. Emitted nodes are immediately released from memory to keep the footprint bounded for large titles (100MB+ XML). The renderer operates on AST nodes and is source-agnostic.

## XML Parser

**File**: `xml/parser.ts`

Wraps [saxes](https://github.com/lddubeau/saxes) with namespace normalization and a typed event emitter.

### ParserEvents

| Event | Signature | Description |
|-------|-----------|-------------|
| `openElement` | `(name, attrs, ns)` | An element was opened |
| `closeElement` | `(name, ns)` | An element was closed |
| `text` | `(content)` | Text content encountered |
| `error` | `(err)` | Parse error |
| `end` | `()` | Parsing complete |

### XMLParserOptions

| Option | Default | Description |
|--------|---------|-------------|
| `defaultNamespace` | `USLM_NS` | Namespace URI whose elements emit bare names |
| `namespacePrefixes` | built-in map | Additional namespace prefix mappings |

### Namespace Normalization

The parser normalizes XML namespaces so downstream consumers never deal with raw URIs:

| Namespace | Example XML | Normalized Name |
|-----------|-------------|-----------------|
| USLM (default) | `<section>` | `section` |
| XHTML | `<table>` (in XHTML ns) | `xhtml:table` |
| Dublin Core | `<dc:title>` | `dc:title` |
| Unknown | `<foo>` (unrecognized ns) | `{uri}foo` |

### Parsing Modes

- `parseString(xml)` -- synchronous, used in tests
- `parseStream(stream)` -- returns a Promise, used in production with `fs.createReadStream`

## Element Classification

**File**: `xml/uslm-elements.ts`

Defines Sets that classify USLM elements by role. These Sets drive the AST builder's dispatch logic.

| Set | Count | Members |
|-----|-------|---------|
| `LEVEL_ELEMENTS` | 26 | `title`, `subtitle`, `chapter`, `subchapter`, `article`, `subarticle`, `part`, `subpart`, `division`, `subdivision`, `preliminary`, `section`, `subsection`, `paragraph`, `subparagraph`, `clause`, `subclause`, `item`, `subitem`, `subsubitem`, `appendix`, `compiledAct`, `reorganizationPlans`, `reorganizationPlan`, `courtRules`, `courtRule` |
| `CONTENT_ELEMENTS` | 4 | `content`, `chapeau`, `continuation`, `proviso` |
| `INLINE_ELEMENTS` | 11 | `b`, `i`, `sub`, `sup`, `ref`, `date`, `term`, `inline`, `shortTitle`, `del`, `ins` |
| `NOTE_ELEMENTS` | 6 | `note`, `notes`, `sourceCredit`, `statutoryNote`, `editorialNote`, `changeNote` |
| `APPENDIX_LEVEL_ELEMENTS` | 5 | `compiledAct`, `courtRules`, `courtRule`, `reorganizationPlans`, `reorganizationPlan` |
| `META_ELEMENTS` | 5 | `meta`, `docNumber`, `docPublicationName`, `docReleasePoint`, `property` |
| `CONTAINER_ELEMENTS` | 9 | `uscDoc`, `main`, `meta`, `toc`, `layout`, `header`, `row`, `column`, `tocItem` |

Namespace constants are also exported: `USLM_NS`, `XHTML_NS`, `DC_NS`, `DCTERMS_NS`, `XSI_NS`.

## AST Types

**File**: `ast/types.ts`

Defines 10 node types that form the intermediate representation between XML parsing and Markdown rendering. See the [AST Model](../architecture/ast-model.md) documentation for the full specification.

### Node Types

| Type | Interface | Purpose |
|------|-----------|---------|
| `level` | `LevelNode` | Hierarchical level (title, chapter, section, subsection, ..., subsubitem) |
| `content` | `ContentNode` | Text block with variant: `content`, `chapeau`, `continuation`, `proviso` |
| `inline` | `InlineNode` | Inline text/formatting: `text`, `bold`, `italic`, `ref`, `footnoteRef`, `date`, `term`, `sup`, `sub`, `quoted` |
| `note` | `NoteNode` | Editorial, statutory, or amendment note with `topic` and `role` |
| `sourceCredit` | `SourceCreditNode` | Enactment source citation |
| `table` | `TableNode` | XHTML or USLM layout table (variant flag distinguishes) |
| `toc` | `TOCNode` | Table of contents (skipped during rendering) |
| `tocItem` | `TOCItemNode` | Individual TOC entry |
| `notesContainer` | `NotesContainerNode` | Wraps `<notes type="uscNote">` containers |
| `quotedContent` | `QuotedContentNode` | Quoted legal text (rendered as blockquote) |

The union type `ASTNode` encompasses all 10 node types.

### Level Hierarchy

Levels are divided into two groups by the `BIG_LEVELS` and `SMALL_LEVELS` Sets:

- **Big levels** (17 types, above section): `title`, `appendix`, `subtitle`, `chapter`, `subchapter`, `compiledAct`, `reorganizationPlans`, `reorganizationPlan`, `courtRules`, `courtRule`, `article`, `subarticle`, `part`, `subpart`, `division`, `subdivision`, `preliminary`
- **Small levels** (8 types, below section): `subsection`, `paragraph`, `subparagraph`, `clause`, `subclause`, `item`, `subitem`, `subsubitem`

The `LEVEL_TYPES` array lists all 26 levels in order from biggest to smallest.

### Context Types

- `AncestorInfo` -- breadcrumb entry with `levelType`, `numValue`, `heading`, and `identifier`
- `DocumentMeta` -- document-level metadata from the `<meta>` block (`dcTitle`, `docNumber`, `releasePoint`, `positivelaw`, etc.)
- `EmitContext` -- provided when a subtree is emitted, containing the ancestor chain and document metadata

### Frontmatter Types

- `FrontmatterData` -- all fields for YAML frontmatter generation, including the required `source` (`SourceType`) and `legal_status` (`LegalStatus`) discriminators
- `SourceType` -- `"usc"` or `"ecfr"` (extensible for future sources)
- `LegalStatus` -- `"official_legal_evidence"`, `"official_prima_facie"`, or `"authoritative_unofficial"`

## AST Builder (USLM)

**File**: `ast/uslm-builder.ts`

The largest module in core. Converts USLM XML SAX events into AST nodes using a stack-based state machine.

### ASTBuilderOptions

| Option | Type | Description |
|--------|------|-------------|
| `emitAt` | `LevelType` | Level that triggers emission (typically `section`, `chapter`, or `title`) |
| `onEmit` | `(node, context) => void` | Callback fired with the completed `LevelNode` and its `EmitContext` |

### Stack-Based Construction

The builder maintains a stack of `StackFrame` objects, each representing an in-progress XML element. Frames track their kind (`level`, `content`, `inline`, `note`, `sourceCredit`, `notesContainer`, `quotedContent`, `meta`, `ignore`), the AST node being constructed, and a text buffer. When an element closes, its frame pops and the completed node is added to the parent frame's children.

### Collector Zones

XHTML tables (`xhtml:table`) and USLM layout tables (`layout`) use dedicated `TableCollector` state machines. These are checked before normal element handlers, keeping complex table-building logic separate from the main stack.

### Text Bubbling

Text inside nested inline elements (e.g., `<heading><b>Editorial Notes</b></heading>`) is bubbled up via `bubbleTextToCollector()` so it accumulates in the heading frame's text buffer rather than being lost inside the inline frame.

### Key Behaviors

| Behavior | Details |
|----------|---------|
| `<p>` absorption | `<p>` elements do not create AST nodes. Multiple `<p>` elements inject `"\n\n"` separators. |
| `<num>` dual data | The `@value` attribute stores the normalized value; display text comes from the element's text content. Both are set on the parent `LevelNode`. |
| Quoted content suppression | A `quotedContentDepth` counter prevents emission of sections inside `<quotedContent>` (quoted bills in statutory notes). |
| Inline type mapping | `b` -> `bold`, `i` -> `italic`, `ref` -> `ref`, `date` -> `date`, `term` -> `term`. Elements `inline`, `shortTitle`, `del`, `ins` map to `text` (pass-through). |
| Footnote refs | `<ref class="footnoteRef" idref="fn1">` produces an `InlineNode` with `inlineType: "footnoteRef"`, rendered as `[^fn1]`. |

## Markdown Renderer

**File**: `markdown/renderer.ts`

Stateless, pure-function renderer. No side effects, no file I/O.

### Entry Points

| Function | Input | Output |
|----------|-------|--------|
| `renderDocument(sectionNode, frontmatter, options)` | `LevelNode` + `FrontmatterData` | Full Markdown file with YAML frontmatter |
| `renderSection(node, options)` | `LevelNode` | Section heading + body content |
| `renderNode(node, options)` | `ASTNode` | Dispatches by `node.type` to type-specific renderers |

### RenderOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `headingOffset` | `number` | `0` | Heading level offset (0 = section is H1) |
| `linkStyle` | `string` | `"plaintext"` | `"relative"`, `"canonical"`, or `"plaintext"` |
| `resolveLink` | `function` | `undefined` | Resolves an identifier to a relative file path |
| `notesFilter` | `NotesFilter` | `undefined` | Selective note inclusion (undefined = include all) |

### NotesFilter

Controls which note categories appear in the output:

| Field | Type | Controls |
|-------|------|----------|
| `editorial` | `boolean` | Editorial notes (codification, dispositionOfSections) |
| `statutory` | `boolean` | Statutory notes (changeOfName, regulations, miscellaneous, repeals) |
| `amendments` | `boolean` | Amendment history (amendments, effectiveDateOfAmendment) |

Cross-heading notes (`<note role="crossHeading">`) act as category markers inside `<notes>` containers. The filter selectively includes or excludes notes by category at render time without modifying the AST.

### Rendering Conventions

| Input | Markdown Output |
|-------|-----------------|
| Section heading | `# section-number heading` |
| Small levels (subsection, paragraph, ...) | `**(a)** **Heading.** content text...` (bold inline numbering) |
| Big levels inside section | `**number heading**` (bold text, no Markdown heading) |
| Source credit | `---` + `**Source Credit**: (text)` |
| Note cross-heading | `## heading` |
| Note with heading | `### heading` |
| Quoted content | `> blockquoted lines` |
| Table | Markdown pipe table (`| col1 | col2 |`) |
| TOC | Skipped (empty string) |
| Heading depth cap | H5 maximum -- beyond that, bold text |

## Frontmatter Generator

**File**: `markdown/frontmatter.ts`

### Function

`generateFrontmatter(data: FrontmatterData): string` -- produces a complete YAML block with `---` delimiters. Field order is manually controlled for readability. Uses the `yaml` package with `lineWidth: 0` (no wrapping) and `QUOTE_DOUBLE` default string type.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `FORMAT_VERSION` | `"1.1.0"` | Output format version, included in every file's frontmatter |
| `GENERATOR` | `"lexbuild@{version}"` | Generator identifier, reads version from `package.json` at module load |

### Multi-Source Support

Every frontmatter block includes `source` and `legal_status` fields. Source-specific optional fields (`authority`, `regulatory_source`, `agency`, `cfr_part`, `cfr_subpart`) are included only when defined.

## Link Resolver

**File**: `markdown/links.ts`

### createLinkResolver()

Returns a `LinkResolver` with three methods:

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(identifier, filePath)` | Register a converted file's identifier and output path |
| `resolve` | `(identifier, fromFile) -> string \| null` | Resolve an identifier to a relative path from the current file |
| `fallbackUrl` | `(identifier) -> string \| null` | Build a fallback URL for unresolved identifiers |

### Resolution Strategy

1. Exact match in the registry -- return a relative path from the source file to the target
2. Strip subsection path, try section-level lookup -- return relative path if found
3. USC identifiers not found -- OLRC fallback URL (`uscode.house.gov/view.xhtml?req=granuleid:...`)
4. CFR identifiers not found -- eCFR fallback URL (`ecfr.gov/current/title-N/section-N`)
5. Non-USC/CFR identifiers (`/us/stat/`, `/us/pl/`) -- always rendered as plain text

### parseIdentifier()

Parses `/us/{code}/t{title}/s{section}/{subpath}` identifiers into a `ParsedIdentifier` with `jurisdiction`, `code`, `titleNum`, `sectionNum`, and `subPath` fields. Returns `null` for non-USC/CFR identifiers.

## Resilient File I/O

**File**: `fs.ts`

Drop-in replacements for `node:fs/promises` `writeFile` and `mkdir` that retry on `ENFILE` (system file table full) and `EMFILE` (per-process file table full) errors.

| Parameter | Value |
|-----------|-------|
| Max retries | 10 |
| Initial delay | 50ms |
| Max delay | 5,000ms |
| Backoff | Exponential (doubles each retry) |

These wrappers prevent file descriptor exhaustion when writing 60,000+ files while external processes (Spotlight indexing, editor file watchers, cloud sync) react to newly created files. Both `@lexbuild/usc` and `@lexbuild/ecfr` use these wrappers instead of `node:fs/promises` directly.
