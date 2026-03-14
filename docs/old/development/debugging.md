# Debugging

LexBuild processes large, complex XML documents through a multi-stage pipeline. When something goes wrong -- unexpected output, test failures, memory issues -- the problem could originate in SAX parsing, AST construction, Markdown rendering, or file writing. This guide covers systematic approaches to diagnosing common issues, along with specific techniques for XML debugging, memory profiling, and resolving the pitfalls that frequently trip up contributors.

## Build Issues

### Stale Builds

The most common build issue is stale output from an upstream package. Because `@lexbuild/usc` depends on `@lexbuild/core`, and `@lexbuild/cli` depends on both, changes to core are not reflected downstream until core is rebuilt.

**Symptom**: Type errors that reference definitions you have already changed, or runtime behavior that does not match your latest code edits.

**Fix**: Rebuild from the root to ensure all packages are rebuilt in dependency order:

```bash
pnpm turbo build
```

If you want to be thorough, clean the build output first:

```bash
rm -rf packages/core/dist packages/usc/dist packages/cli/dist
pnpm turbo build
```

### Stale Type Declarations

TypeScript caches type information in `.d.ts` files in each package's `dist/` directory. If you change a type in core but only rebuild usc, the stale `.d.ts` from core's previous build may cause confusing type errors.

**Fix**: Same as above -- rebuild all packages from root, or delete the `dist/` directories and rebuild.

### Workspace Resolution Failures

If `pnpm install` reports resolution errors for `workspace:*` dependencies, verify that:

1. The package name in `package.json` matches exactly (e.g., `@lexbuild/core`, not `lexbuild-core`).
2. The package directory is covered by the glob in `pnpm-workspace.yaml`.
3. You have run `pnpm install` from the repository root after adding a new package.

## XML Parsing and Debugging

### Isolating Problematic Elements

When the converter produces incorrect output for a specific section or element, isolate the problem by extracting a minimal XML fragment:

1. **Find the section** in the source XML file. Look for the `<section identifier="...">` element that produces incorrect output.

2. **Extract a fragment** containing just that section, wrapped in the minimum required document structure:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0"
            xmlns:dc="http://purl.org/dc/elements/1.1/"
            identifier="/us/usc/tNN">
     <meta>
       <dc:title>Test Title</dc:title>
       <docNumber>NN</docNumber>
     </meta>
     <main>
       <title identifier="/us/usc/tNN">
         <num value="NN">Title NN</num>
         <heading>Test</heading>
         <chapter identifier="/us/usc/tNN/ch1">
           <num value="1">CHAPTER 1</num>
           <heading>Test Chapter</heading>
           <!-- Paste the problematic section here -->
         </chapter>
       </title>
     </main>
   </uscDoc>
   ```

3. **Save it as a fixture** in `fixtures/fragments/` and write a focused test that converts it and checks the output.

4. **Run the single test** for fast iteration:

   ```bash
   cd packages/usc
   pnpm exec vitest run src/converter.test.ts -t "your test name"
   ```

This approach narrows the problem from a 100 MB XML file to a 1 KB fragment, making it much easier to inspect the SAX events, AST nodes, and rendered output at each stage.

### Tracing SAX Events

To see the raw events flowing through the parser, you can temporarily add logging to the `ASTBuilder`:

```typescript
// In ast/builder.ts, temporarily add to openElement():
console.log(`OPEN: ${name}`, JSON.stringify(attributes));

// And to closeElement():
console.log(`CLOSE: ${name}`);

// And to onText():
console.log(`TEXT: "${text.substring(0, 80)}..."`);
```

This shows the exact sequence of elements and text nodes the builder receives. Useful for diagnosing namespace issues (e.g., XHTML `table` vs. USLM `layout`) or unexpected element nesting.

Remember to remove the logging before committing.

### Namespace Issues

A common source of parsing bugs is namespace confusion. The SAX parser normalizes namespaces: elements in the default USLM namespace emit bare names (`section`, `heading`), while elements in other namespaces emit prefixed names (`xhtml:table`, `dc:title`).

If an XHTML `<table>` is being mishandled, verify that the parser is emitting `xhtml:table`, not `table`. The `ASTBuilder` has separate handling paths for namespace-prefixed vs. bare element names.

## Snapshot Test Failures

### Understanding the Diff

When a snapshot test fails, Vitest shows a diff between the expected file (in `fixtures/expected/`) and the actual output. Read the diff carefully:

- **Added lines** (green/+) indicate new content in the output that was not in the expected file.
- **Removed lines** (red/-) indicate content that was in the expected file but is missing from the output.
- **Changed lines** show both the old and new versions.

### When to Update vs. When to Fix

**Update the snapshot** when you have intentionally changed the rendering. For example, if you modified how headings are formatted, the heading-related snapshots should change. Verify that only the expected snapshots changed:

```bash
cd packages/usc
pnpm exec vitest run --update
git diff fixtures/expected/
```

Review every changed file. If unrelated snapshots changed, your code change has an unintended side effect.

**Fix the code** when a snapshot changes unexpectedly. If you modified how notes are filtered and a table snapshot also changed, the table rendering logic was likely affected by your change in a way you did not intend. Investigate and fix the root cause.

See [Testing](testing.md) for the full snapshot workflow.

## Memory Profiling

### Dry Run for Stats

Use `--dry-run` to parse and analyze XML without writing any files. This reports structure information (section counts, chapter counts) and is useful for understanding the shape of a title before committing to a full conversion:

```bash
node packages/cli/dist/index.js convert --titles 42 --dry-run
```

### Title-Level Granularity and Memory

Title granularity holds the entire AST and rendered Markdown in memory simultaneously. For large titles, this can require significant memory:

| Title | XML Size | Approximate RSS |
|-------|----------|-----------------|
| Title 26 (Internal Revenue Code) | ~95 MB | ~500 MB |
| Title 42 (Public Health) | ~107 MB | ~660 MB |

If Node.js runs out of memory during title-level conversion, increase the heap limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" node packages/cli/dist/index.js convert --titles 42 -g title -o ./output
```

Section and chapter granularity modes stream and release nodes, keeping memory bounded at less than 10 MB per title regardless of XML size.

### Node.js Heap Profiling

For deeper memory analysis, use Node.js built-in profiling:

```bash
# Generate a heap snapshot
node --heapsnapshot-signal=SIGUSR2 packages/cli/dist/index.js convert --titles 26 -g title -o ./output

# In another terminal, send the signal to trigger a snapshot
kill -SIGUSR2 <pid>
```

Open the resulting `.heapsnapshot` file in Chrome DevTools (Memory tab) to inspect object retention.

## Useful CLI Flags

| Flag | Purpose |
|------|---------|
| `--dry-run` | Parse XML and report structure without writing files. Useful for verifying parsing works and estimating output size. |
| `-v, --verbose` | Enable detailed logging during conversion. Shows per-file output paths and timing. |
| `-g title` | Title-level granularity. Produces a single file per title. Warning: requires significantly more memory for large titles. |
| `--link-style relative` | Generate relative Markdown links for cross-references (default is `plaintext`). |
| `--include-editorial-notes` | Include only editorial notes (excludes statutory notes and amendments). |
| `--include-statutory-notes` | Include only statutory notes. |
| `--include-amendments` | Include only amendment history notes. |

Selective note flags override the broad `--include-notes` flag. If any selective flag is set, `--include-notes` is automatically disabled.

## Common Pitfalls

These issues come up repeatedly when working with USLM XML. Understanding them saves significant debugging time.

### XHTML Namespace Tables

`<table>` elements in U.S. Code XML are in the XHTML namespace (`http://www.w3.org/1999/xhtml`), not the USLM namespace. After SAX namespace normalization, they appear as `xhtml:table`. The `ASTBuilder` has dedicated table collector logic that activates only for `xhtml:table`. If you see table content being dropped or mishandled, check that the element name includes the `xhtml:` prefix.

USLM `<layout>` elements (column-based tabular display) are in the default USLM namespace and use a separate collector.

### Anomalous Structures

The USLM schema intentionally does not enforce strict hierarchy. Any `<level>` can nest inside any `<level>`. In practice, this means you will encounter `<paragraph>` directly under `<section>` without an intervening `<subsection>`, or other non-standard nesting. Element handlers must not assume a strict parent-child sequence.

### Empty and Repealed Sections

Some sections contain only a `<note>` with status information (e.g., "Repealed", "Transferred", "Reserved") and no substantive content. These still produce an output file with appropriate frontmatter including the `status` field. Do not skip them -- downstream consumers may need to know that a section exists but is no longer in force.

### Multiple `<p>` Elements in Content

A single `<content>` or `<note>` element may contain multiple `<p>` elements. Each `<p>` should become a separate paragraph in the Markdown output. The `ASTBuilder` handles this by injecting `"\n\n"` separators via `handlePClose()` rather than creating separate AST nodes for each `<p>`.

### `<continuation>` Positioning

`<continuation>` elements are not just "text after sub-levels." They can appear between sibling elements at the same level -- for example, between two `<paragraph>` elements within a `<subsection>`. Handle them as text blocks wherever they appear in the document structure.

### Quoted Content Depth

`<section>` elements inside `<quotedContent>` (quoted bills in statutory notes) must not be emitted as standalone files. The `ASTBuilder` tracks `quotedContentDepth` to suppress emission when inside quoted content. If you see phantom sections appearing in the output, check that `quotedContentDepth` is being incremented and decremented correctly.

### Inline XHTML in Content

`<b>`, `<i>`, `<sub>`, `<sup>` elements appear inline within text content. Despite being HTML-like, these are in the USLM namespace, not the XHTML namespace. They map to `InlineNode` types: `"bold"`, `"italic"`, `"sup"`, `"sub"`.

### Element Versioning

Elements can carry `@startPeriod`/`@endPeriod`/`@status` attributes for point-in-time variants. Multiple versions of the same element may coexist in the document. The current converter processes all versions without filtering by date.

### Duplicate Section Numbers

Some titles have multiple sections with the same number within a chapter (e.g., Title 5 has two sections numbered 3598). The converter disambiguates with `-2`, `-3` suffixes on the output filename and registers both the canonical and suffixed identifiers in the link resolver. See `converter.ts` for the two-pass duplicate detection logic.

## Debugging Checklist

When investigating an issue, work through this checklist:

1. **Reproduce with a minimal fixture.** Extract the relevant XML fragment and create a focused test.
2. **Check the SAX events.** Add temporary logging to `ASTBuilder` to verify the parser is emitting the expected element sequence.
3. **Inspect the AST node.** Log the emitted `LevelNode` in the `onEmit` callback to verify the tree structure is correct.
4. **Check the rendered Markdown.** If the AST is correct but the output is wrong, the issue is in the renderer.
5. **Verify namespace handling.** XHTML tables, Dublin Core metadata, and inline formatting elements all use different namespace handling.
6. **Rebuild all packages.** Stale builds cause many confusing issues. When in doubt, `pnpm turbo build` from the root.
