# Debugging

LexBuild processes large, complex XML through a multi-stage pipeline. When something goes wrong, the problem could originate in SAX parsing, AST construction, Markdown rendering, or file writing. This guide covers systematic approaches for diagnosing issues at each stage.

## Build Issues

### Stale Builds

**Symptom**: type errors referencing definitions that have already been changed, or runtime behavior that does not match the current source.

**Fix**: rebuild all packages from the monorepo root:

```bash
pnpm turbo build
```

If errors persist, clear compiled output and rebuild:

```bash
rm -rf packages/*/dist
pnpm turbo build
```

### Stale Type Declarations

TypeScript `.d.ts` files cached from previous builds can cause spurious type errors in downstream packages. The fix is the same -- rebuild all packages so declaration files are regenerated.

### Workspace Resolution Failures

If a package cannot resolve an internal dependency:

1. Verify the package name in `package.json` matches the import exactly (e.g., `@lexbuild/core`)
2. Confirm the package directory is covered by the `pnpm-workspace.yaml` glob (`packages/*`)
3. Run `pnpm install` from the monorepo root to regenerate the lockfile

## XML Parsing

### Isolating Problematic Elements

When a specific section or element produces incorrect output:

1. Locate the section in the source XML file (search by identifier or section number)
2. Extract a minimal fragment and wrap it in the appropriate document structure
3. Save as a fixture and run a focused test

**USLM fragment template** (USC):

```xml
<uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0"
        identifier="/us/usc/t1">
  <meta>
    <docNumber>1</docNumber>
  </meta>
  <main>
    <title identifier="/us/usc/t1">
      <num value="1">Title 1</num>
      <heading>Test Title</heading>
      <chapter identifier="/us/usc/t1/ch1">
        <num value="1">CHAPTER 1</num>
        <heading>Test Chapter</heading>
        <!-- paste section element here -->
      </chapter>
    </title>
  </main>
</uscDoc>
```

**eCFR fragment template**:

```xml
<ECFR>
  <DIV1 N="1" TYPE="TITLE">
    <HEAD>TITLE 1—TEST</HEAD>
    <DIV3 N="I" TYPE="CHAPTER">
      <HEAD>CHAPTER I—TEST AGENCY</HEAD>
      <DIV5 N="1" TYPE="PART">
        <HEAD>PART 1—TEST PART</HEAD>
        <!-- paste section DIV8 element here -->
      </DIV5>
    </DIV3>
  </DIV1>
</ECFR>
```

### Tracing SAX Events

To see the raw SAX event stream, temporarily add logging to the builder's event handlers. For the USLM builder in core:

```typescript
// In ASTBuilder.openElement():
console.log(`OPEN: ${name}`, JSON.stringify(attrs));

// In ASTBuilder.closeElement():
console.log(`CLOSE: ${name}`);

// In ASTBuilder.onText():
console.log(`TEXT: "${text.slice(0, 80)}"`);
```

For the eCFR builder, the same approach applies to `EcfrASTBuilder`'s handlers. Remove all logging before committing.

### Namespace Issues

USLM XML uses multiple namespaces. The SAX parser normalizes element names with namespace prefixes:

- USLM elements: bare names (`section`, `heading`, `content`)
- XHTML tables: prefixed as `xhtml:table`, `xhtml:tr`, `xhtml:td`
- Dublin Core metadata: prefixed as `dc:title`, `dc:type`

A common mistake is checking for `table` when the actual element name is `xhtml:table`. Always check the namespace-qualified name.

eCFR XML uses no namespaces. All elements are bare names (`DIV1`, `HEAD`, `P`).

## AST Inspection

When SAX events look correct but the Markdown output is wrong, the issue is in AST construction. Log the emitted AST node to inspect the tree structure:

```typescript
const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => {
    console.log(JSON.stringify(node, null, 2));
    collected.push({ node, context });
  },
});
```

Check for:

- Missing children (element not added to parent)
- Wrong node types (e.g., content node where a level node was expected)
- Empty text on inline nodes (text not bubbled up correctly)
- Missing `numValue` or `heading` on level nodes

## Snapshot Test Failures

### Understanding the Diff

Vitest shows added lines (new output) and removed lines (expected output). Compare carefully:

- Added lines with no corresponding removal: new content being generated that was not expected
- Removed lines with no corresponding addition: content that should be generated but is missing
- Changed lines: rendering logic has shifted

### When to Update vs. When to Fix

**Update the snapshot** when the output change is intentional -- for example, after modifying heading formatting or frontmatter field order. Update deliberately:

```bash
pnpm turbo test --filter=@lexbuild/usc -- --update
```

**Fix the code** when the change is unexpected. An unintentional snapshot diff usually indicates a side effect from a change in a different part of the pipeline. Trace the rendering path to find the source.

## Memory Profiling

### Dry Run Mode

Use the `--dry-run` flag to parse XML and report structure without writing files. This isolates parsing and AST construction from file I/O:

```bash
node packages/cli/dist/index.js convert-usc --titles 42 --dry-run
```

### Title Granularity Memory

Title granularity holds the entire AST in memory. Large titles can require significant heap:

| Title | XML Size | Approximate RSS |
|-------|----------|-----------------|
| Title 42 | ~107 MB | ~660 MB |
| Title 26 | ~100 MB | ~600 MB |

Increase the heap limit for large titles:

```bash
NODE_OPTIONS="--max-old-space-size=4096" node packages/cli/dist/index.js convert-usc --titles 42 -g title
```

Section and chapter granularity stream nodes and release them after writing, keeping memory bounded regardless of title size.

### Node.js Heap Snapshots

For deeper memory analysis, use Node.js heap snapshots:

```bash
# Start the process with heap snapshot signal enabled
node --heapsnapshot-signal=SIGUSR2 packages/cli/dist/index.js convert-usc --titles 42

# In another terminal, trigger a snapshot
kill -SIGUSR2 <pid>
```

The `.heapsnapshot` file can be opened in Chrome DevTools (Memory tab) to inspect object retention.

## Common Pitfalls by Source

### USLM (U.S. Code)

- **XHTML namespace tables**: Tables in USC XML use the XHTML namespace. The SAX parser reports them as `xhtml:table`, not `table`. Element handlers must check the namespace-qualified name.
- **Anomalous nesting**: Some sections have non-standard hierarchy, such as `<paragraph>` directly under `<section>` without an intervening `<subsection>`. Handlers should not assume strict hierarchy.
- **Empty and repealed sections**: Sections containing only a `<note>` with status information (e.g., "Repealed" or "Transferred") still produce output files with appropriate frontmatter and status fields.
- **Multiple `<p>` elements in content**: A single `<content>` element may contain multiple `<p>` elements. The builder injects `"\n\n"` separators between them.
- **`<continuation>` positioning**: Can appear between sibling elements at any position, not just after sub-levels. Handle as a text block wherever it appears.
- **Quoted content depth**: `<section>` elements inside `<quotedContent>` (quoted bills in statutory notes) must not be emitted as standalone files. The builder tracks `quotedContentDepth` to suppress emission.
- **Inline XHTML in content**: `<b>`, `<i>`, `<sub>`, `<sup>` elements are in the USLM namespace, not the XHTML namespace. They appear inline within text content.
- **Element versioning**: Elements can carry `@startPeriod`/`@endPeriod`/`@status` for point-in-time variants. Multiple versions of the same element may coexist in the document.
- **Duplicate section numbers**: Some titles have multiple sections with the same number within a chapter. The converter disambiguates output files with `-2`, `-3` suffixes.

### eCFR (Code of Federal Regulations)

- **Flat paragraph numbering**: Unlike USLM's nested `<subsection>`/`<paragraph>`/`<clause>` elements, eCFR uses flat `<P>` elements with numbering prefixes like `(a)`, `(1)`, `(i)`. The builder does not reconstruct nesting from these prefixes.
- **NODE attribute**: Described by GPO as "for internal use and may be changed at any time." Do not use NODE as a stable identifier. The builder constructs `/us/cfr/` identifiers from the `N` attribute and ancestor context instead.
- **Part-level authority and source notes**: `AUTH` and `SOURCE` elements appear on `DIV5` (part level), not on `DIV8` (section level). The builder captures these in a `partNotes` map keyed by part identifier; the converter enriches section frontmatter from this map.
- **Reserved Title 35**: Title 35 (Panama Canal) is reserved. Both the eCFR API and govinfo return 404 for this title. Downloaders silently skip it during `--all` downloads.
- **Roman numeral chapter directories**: Chapter directories use Roman numerals (`chapter-I`, `chapter-IV`), not zero-padded integers.
- **Multi-volume titles**: Large titles like Title 17 have multiple `DIV1` elements, one per volume. The `N` attribute on `DIV1` is the volume number, not the title number. The builder extracts the title number from the `NODE` attribute prefix.

## Debugging Checklist

When investigating an output issue, work through these steps in order:

1. **Reproduce** with a minimal XML fixture (extract the problematic element and wrap it)
2. **Check SAX events** by adding temporary logging to the builder's open/close/text handlers
3. **Inspect the AST node** by logging the emitted node in the `onEmit` callback
4. **Check rendered Markdown** -- if the AST is correct, the issue is in the renderer
5. **Verify namespace handling** for elements that cross namespace boundaries (especially tables)
6. **Rebuild all packages** to rule out stale build artifacts: `pnpm turbo build`
