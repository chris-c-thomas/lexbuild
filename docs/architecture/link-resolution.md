# Link Resolution

LexBuild resolves cross-references embedded in legislative XML into Markdown links. The system handles USC (`/us/usc/`), CFR (`/us/cfr/`), and FR (`/us/fr/`) identifier schemes with a priority chain that falls back to external URLs when a target has not been converted locally.

The implementation lives in `packages/core/src/markdown/links.ts` and is used by the USC, eCFR, and FR converters during the write phase of the [conversion pipeline](./conversion-pipeline.md).

## Identifier Formats

### USC Identifiers (from USLM)

USC identifiers come directly from the `identifier` attribute on USLM XML elements. The format uses path segments with prefixed level codes:

```
/us/usc/t{title}/s{section}/{subsection}/{paragraph}
```

For example, `/us/usc/t1/s201/a/2` breaks down as jurisdiction `us`, code `usc`, title `1`, section `201`, subsection `a`, paragraph `2`.

Big levels (title through section) use a prefix to indicate their level:

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

Small levels (subsection and below) use their value directly without a prefix: `/us/usc/t1/s1/a`, `/us/usc/t1/s1/a/2/A/i`.

### CFR Identifiers (constructed by eCFR builder)

CFR identifiers are constructed by the eCFR builder from `NODE` and `N` attributes in the GPO/SGML XML. The format mirrors the USC scheme:

```
/us/cfr/t{title}/s{section}
```

Examples:

- `/us/cfr/t17` -- Title 17
- `/us/cfr/t17/ch1` -- Chapter I of Title 17
- `/us/cfr/t17/pt240` -- Part 240 of Title 17
- `/us/cfr/t17/s240.10b-5` -- Section 240.10b-5

Identifiers use `/us/cfr/` (content type), not `/us/ecfr/` (data source). Both eCFR and future annual CFR share the same identifier space since they represent the same regulatory content.

### FR Identifiers (from FederalRegister.gov API)

FR identifiers use document numbers (unique, stable, API primary key):

```
/us/fr/{document_number}
```

Examples:

- `/us/fr/2026-06029` -- FR document 2026-06029
- `/us/fr/2026-06086` -- FR document 2026-06086

FR identifiers use document numbers rather than FR citations (`91 FR 14523`) because citations are human-readable but not reliably unique.

### Non-Resolvable References

Some identifier schemes cannot be resolved to files or URLs. These are always rendered as plain text:

| URI Prefix | Treatment |
|------------|-----------|
| `/us/stat/...` | Plain text citation (Statutes at Large) |
| `/us/pl/...` | Plain text citation (Public Laws) |
| `/us/act/...` | Plain text citation (Acts) |

The `parseIdentifier()` function returns `null` for these schemes, signaling the renderer to output the reference text without a link.

## Resolution Priority

When converting with `linkStyle: "relative"`, the resolver uses a three-tier priority chain:

1. **Exact match** -- The identifier is found in the link registry. This always works for same-title references and for cross-title references when the target title has already been converted. Returns a relative file path.

2. **Section-level fallback** -- If the exact identifier is not registered (common for subsection-level references like `/us/usc/t1/s1/a/2`), the resolver strips the subsection path and tries the parent section identifier (`/us/usc/t1/s1`). If found, returns a relative path to the section file.

3. **External URL fallback** -- If neither exact nor section-level lookup succeeds, the resolver generates a fallback URL for USC identifiers, or returns `null` for all other identifier types.

## Fallback URLs

When a USC cross-reference cannot be resolved within the converted corpus, the resolver produces a URL to the OLRC website:

| Identifier Scheme | Fallback URL Pattern |
|-------------------|---------------------|
| `/us/usc/t{N}/s{N}` | `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{N}-section{N}` |
| `/us/usc/t{N}` | `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{N}` |
| `/us/fr/{doc_number}` | `https://www.federalregister.gov/d/{doc_number}` |

Unresolved CFR references (`/us/cfr/`) are currently rendered as plain text — no automatic ecfr.gov fallback URLs are generated. Statutes at Large (`/us/stat/`) and Public Law (`/us/pl/`) references are always rendered as plain text.

## Link Styles

The `linkStyle` option on `RenderOptions` controls how cross-references render in the output Markdown:

| Style | Output | Use Case |
|-------|--------|----------|
| `plaintext` (default) | Reference text only, no link | RAG pipelines where links add noise |
| `relative` | `[text](../chapter-03/section-201.md)` | Local browsing, documentation sites |
| `canonical` | `[text](https://uscode.house.gov/...)` | External publication, standalone documents |

In `relative` mode, the resolver computes paths relative to the current file using `node:path`'s `relative()` function. Same-chapter references produce bare filenames (`section-7.md`), cross-chapter references produce parent traversals (`../chapter-03/section-201.md`), and cross-title references traverse further (`../../title-02/chapter-05/section-100.md`).

In `canonical` mode, all resolvable USC references link to OLRC URLs regardless of whether the target has been converted locally. Non-USC/CFR references render as plain text.

## The Resolver Interface

The `LinkResolver` interface defines three operations:

```typescript
interface LinkResolver {
  resolve(identifier: string, fromFile: string): string | null;
  register(identifier: string, filePath: string): void;
  fallbackUrl(identifier: string): string | null;
}
```

`createLinkResolver()` returns an instance backed by an internal `Map<string, string>` that maps identifiers to output file paths.

### Registration

Registration happens during the write phase's first pass, before any rendering occurs. As the converter computes output paths for each section, it registers the section's identifier and file path with the resolver:

```typescript
const linkResolver = createLinkResolver();
for (const { node, context } of collected) {
  linkResolver.register(node.identifier, outputPath);
}
```

For duplicate sections (same section number within a chapter), both the canonical identifier and a disambiguated identifier (with `#-2` suffix) are registered. The canonical identifier always maps to the first occurrence.

### Resolution Flow

When the renderer encounters a `<ref>` element with an `href` attribute, resolution follows this sequence:

1. Check the registry for an exact identifier match. If found, compute the relative path from the current file to the target file.
2. Parse the identifier and strip the subsection path. Check the registry for the section-level identifier. If found, compute the relative path.
3. Return `null`. The renderer then calls `fallbackUrl()` to generate an external URL, or renders the reference as plain text if no fallback is available.

### Integration with the Renderer

The converter bridges the `LinkResolver` and the renderer through the `resolveLink` function in `RenderOptions`:

```typescript
const renderOpts: RenderOptions = {
  headingOffset: 0,
  linkStyle: options.linkStyle,
  resolveLink: (identifier: string) => linkResolver.resolve(identifier, filePath),
};
```

This closure captures the current file path, allowing the resolver to compute correct relative paths for each output file independently.

## Two-Pass Requirement

Link resolution requires that all section identifiers and output paths are known before rendering begins. Both forward references (section A cites section B, which appears later in the title) and backward references must resolve correctly.

This is one of the three constraints that drive the [collect-then-write pattern](./conversion-pipeline.md#the-collect-then-write-pattern):

1. Parse phase -- SAX events fire synchronously, collecting all sections into an array.
2. Write phase, pass 1 -- Compute output paths, detect duplicates, register all identifiers with the link resolver.
3. Write phase, pass 2 -- Render Markdown and write files. All cross-references can now resolve.
