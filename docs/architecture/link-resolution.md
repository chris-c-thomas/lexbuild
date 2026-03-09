# Link Resolution

LexBuild resolves cross-references embedded in legislative XML into Markdown links. The system parses USLM identifier URIs, registers file paths during conversion, and resolves references using a priority chain that falls back to external URLs when a target has not been converted locally. The link resolver is implemented in `@lexbuild/core` and is source-agnostic by design.

## USLM Identifier Format

Every structural element in USLM XML carries an `identifier` attribute containing a canonical URI path. These identifiers follow a hierarchical scheme rooted in the jurisdiction and code:

```
/us/usc/t1/s201/a/2
  |    |   |  |   | +-- paragraph "2"
  |    |   |  |   +---- subsection "a"
  |    |   |  +-------- section "201"
  |    |   +----------- title "1"
  |    +--------------- code "usc" (United States Code)
  +-------------------- jurisdiction "us"
```

The URI is split into segments, each identifying a level in the legislative hierarchy. The first two segments (`/us/usc`) establish the jurisdiction and code. Everything after that uses prefix-based notation for "big" levels and bare values for "small" levels.

## Identifier Prefixes

### Big Levels (above section)

Structural containers above the section level use single-letter or short prefixes:

| Prefix | Level |
|--------|-------|
| `t` | Title |
| `st` | Subtitle |
| `ch` | Chapter |
| `sch` | Subchapter |
| `art` | Article |
| `p` | Part |
| `sp` | Subpart |
| `d` | Division |
| `sd` | Subdivision |
| `s` | Section |

Example: `/us/usc/t5/ptIII/stG/ch89/s8901` refers to Title 5, Part III, Subtitle G, Chapter 89, Section 8901.

### Small Levels (below section)

Levels below section (subsection, paragraph, subparagraph, clause, subclause, item, subitem, subsubitem) use their number directly with no prefix:

```
/us/usc/t1/s1/a       -- subsection (a)
/us/usc/t1/s1/a/2     -- paragraph (2)
/us/usc/t1/s1/a/2/A   -- subparagraph (A)
/us/usc/t1/s1/a/2/A/i -- clause (i)
```

## Full Reference URL Structure

The USLM schema defines a composable reference format used in `<ref>` element `href` attributes:

```
[item][work][!lang][/portion][@temporal][.manifestation]
```

| Component | Example | Description |
|-----------|---------|-------------|
| `item` | `/us/usc` | Jurisdiction and code |
| `work` | `/t1/s201` | Specific structural target |
| `!lang` | `!en` | Language (rarely used) |
| `/portion` | `/a/2` | Sub-section path |
| `@temporal` | `@2024-01-01` | Point-in-time reference |
| `.manifestation` | `.xml` | Format specifier |

In practice, most references in U.S. Code XML use the simple form `/us/usc/t{N}/s{N}` with optional sub-section portions. The `@portion` attribute on `<ref>` elements can extend a base reference established via `@idref`, making references composable across multiple elements.

## Single-Pass Registration

The link resolver uses a single-pass registration strategy during conversion. As each section is rendered and written to disk, its identifier and file path are registered with the resolver:

```
1. SAX parser encounters <section identifier="/us/usc/t1/s1">
2. AST builder emits the completed section node
3. Renderer converts to Markdown, writer saves to title-01/chapter-01/section-1.md
4. Resolver registers: "/us/usc/t1/s1" -> "title-01/chapter-01/section-1.md"
```

When a subsequent section contains a `<ref href="/us/usc/t1/s1">`, the resolver looks up the registered path and produces a relative Markdown link.

## Resolution Priority

The resolver follows a three-tier priority chain:

### 1. Same Title (always resolves)

Cross-references within the same title always resolve because all sections of a title are processed in a single conversion run. By the time the file is written, all sections from that title have been registered.

### 2. Other Converted Titles

When converting multiple titles in a single invocation (e.g., `lexbuild convert --all`), cross-references between titles resolve if the target title has already been processed. The link resolver accumulates registrations across titles within a single CLI run.

### 3. OLRC Fallback URL

References that cannot be resolved locally fall back to the OLRC website:

```
https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title1-section1
```

This ensures no reference is silently dropped. Consumers always get either a relative file link or a valid web URL.

## Reference Type Filtering

Not all USLM references become Markdown links. The resolver distinguishes between reference types based on the URI prefix:

| URI Prefix | Treatment | Example |
|------------|-----------|---------|
| `/us/usc/...` | Resolved as Markdown link (relative or fallback URL) | `[42 USC 1983](../title-42/chapter-21/section-1983.md)` |
| `/us/stat/...` | Rendered as plain text citation | `(Aug. 14, 1935, ch. 531, title IV, 49 Stat. 627)` |
| `/us/pl/...` | Rendered as plain text citation | `Pub. L. 104-199` |

Statutes at Large and Public Law references remain as plain text because there is no corresponding converted corpus to link into. This is a deliberate design choice -- converting those corpora would be the domain of future source packages.

## Link Styles

The `--link-style` CLI option controls how resolved references are rendered:

| Style | Output | Use Case |
|-------|--------|----------|
| `plaintext` (default) | No links, reference text only | RAG pipelines that don't benefit from links |
| `relative` | Relative file path links | Local browsing, documentation sites |
| `canonical` | OLRC website URLs | External publication, guaranteed-valid links |

## Cross-Source Linking

The resolver architecture is designed to extend beyond a single legal code. The identifier parsing and registration mechanism is generic -- it operates on URI strings without assuming U.S. Code structure. Future source packages (CFR, state statutes) can register their own identifier patterns and file paths with the same resolver.

Cross-source linking (e.g., a U.S. Code section referencing a CFR regulation) would require:

1. A shared resolver instance across source packages within a single CLI run
2. Source-specific fallback URL generators (OLRC for USC, govinfo for CFR)
3. Identifier prefix routing (`/us/usc/...` vs. `/us/cfr/...`)

The current resolver interface (`register`, `resolve`, `fallbackUrl`) supports all three without modification.
