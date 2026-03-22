# Performance

LexBuild converts the entire federal legal corpus -- over 287,000 sections across approximately 1.5 GB of XML -- in under two minutes. Performance comes from SAX streaming, which processes XML as a sequence of events rather than loading entire documents into memory.

## Benchmarks

All benchmarks measured on a single machine with Node.js 22 LTS, using section-level granularity (the default). Timings exclude downloads and reflect conversion only.

### U.S. Code

| Metric | Value |
|--------|-------|
| Total titles | 54 |
| Total sections | ~60,000 |
| Total XML size | ~650 MB |
| Estimated tokens | ~85M |
| Conversion time | 20--30 seconds |

Individual title examples showing the range from small to large:

| Title | XML Size | Sections | ~Tokens | Duration |
|-------|----------|----------|---------|----------|
| Title 1 (General Provisions) | 0.3 MB | 39 | 35K | <1s |
| Title 10 (Armed Forces) | 50.7 MB | 3,847 | 6.0M | ~1.4s |
| Title 26 (Internal Revenue Code) | 53.2 MB | 2,160 | 6.4M | ~1.1s |
| Title 42 (Public Health) | 107.3 MB | 8,460 | 14.7M | ~2.7s |

Title 42 is the largest by both XML size and section count. Even at 107 MB of input XML, section-level conversion completes in under three seconds because only one section's AST is held in memory at a time.

### eCFR (Code of Federal Regulations)

| Metric | Value |
|--------|-------|
| Total titles | 49 (Title 35 reserved) |
| Total sections | ~227,000 |
| Total XML size | ~830 MB |
| Estimated tokens | ~350M |
| Conversion time | 60--90 seconds |

The eCFR corpus is larger than the U.S. Code in every dimension -- more titles with content, nearly four times as many sections, and roughly four times the token count. Conversion takes proportionally longer but remains under 90 seconds for the full corpus.

### Combined

| Metric | Value |
|--------|-------|
| Total sections | ~287,000 |
| Total XML | ~1.5 GB |
| Estimated tokens | ~435M |
| Total conversion time | < 2 minutes |

## Why SAX Streaming

LexBuild uses SAX (Simple API for XML) parsing exclusively. DOM parsing is not used anywhere in the pipeline. Three properties of SAX streaming make it the right fit:

**Memory bounded by single section, not document size.** The SAX parser fires events as XML chunks arrive from the file stream. The [AST builder](./conversion-pipeline.md#stage-2-ast-construction) consumes these events through a stack-based state machine and emits completed subtrees (sections) via a callback. Once a section is emitted, its AST is detached and eligible for garbage collection. The parser never holds the full document tree -- memory usage is proportional to the deepest nesting within a single section, not the total document size.

**Minimal startup latency.** A DOM parser must read and parse the entire document before any processing can begin. For a 107 MB XML file, that means allocating and linking millions of DOM nodes before the first section can be rendered. SAX begins producing events immediately as the first bytes arrive from `fs.createReadStream`.

**Linear throughput scaling.** Processing time scales linearly with input size. Each XML element is visited exactly once: opened, processed, and closed. There is no tree traversal, no XPath evaluation, and no random access. Doubling the input size doubles the processing time.

## Memory Profile

Components held in memory during section-level conversion of a single title:

| Component | Typical Size | Notes |
|-----------|-------------|-------|
| SAX parser buffer | ~64 KB | saxes internal chunk buffer |
| AST builder stack | ~5 KB | `StackFrame` objects for open elements |
| Current section AST | up to ~500 KB | Largest sections (tax code definitions) |
| Document metadata | ~2 KB | `DocumentMeta` object from `<meta>` block |
| Link resolver registry | ~100 bytes x N | One entry per section (identifier + file path) |
| File write buffer | ~64 KB | Node.js `fs` write buffer |
| **Worst case total** | **< 10 MB** | Per title, excluding the collected sections array |

The `collected[]` array holds all emitted `{ node, context }` pairs between parse completion and write completion. For large titles with thousands of sections, this array is the primary memory consumer during that window. See the [collect-then-write pattern](./conversion-pipeline.md#the-collect-then-write-pattern) for why this buffering is necessary.

## Granularity and Memory

The `emitAt` level determines where the [emit-at-level pattern](./conversion-pipeline.md#the-emit-at-level-pattern) releases completed subtrees:

| Granularity | Memory Behavior | Peak RSS |
|-------------|----------------|----------|
| Section (default) | Bounded -- one section AST at a time | < 10 MB per title |
| Chapter / Part | Bounded -- one chapter or part AST at a time | Proportional to largest chapter/part |
| Title | **Unbounded** -- entire title AST held in memory | 500 MB+ for large titles (26, 42) |

Section granularity is recommended for most use cases. Title granularity should be used only when a single-file-per-title output is specifically required, and only on machines with sufficient memory for the largest titles.

## Token Estimation

LexBuild estimates token counts using a character-divided-by-four heuristic:

```
tokens = Math.ceil(characterCount / 4)
```

This provides a reasonable approximation for English legal text without adding a tokenizer dependency. The estimate is used in `_meta.json` sidecar files and frontmatter metadata. It is not used for any processing decisions.

## Resilient File I/O

When writing 60,000+ files in rapid succession, file descriptor exhaustion (`ENFILE`/`EMFILE`) can occur. External processes -- Spotlight indexing, editor file watchers, cloud sync agents -- react to newly created files and open their own file descriptors, competing with the converter for the system's file descriptor table.

`@lexbuild/core` exports `writeFile` and `mkdir` wrappers (in `packages/core/src/fs.ts`) that retry on these transient errors with exponential backoff:

- Initial delay: 50ms
- Backoff multiplier: 2x per retry
- Maximum delay: 5,000ms
- Maximum retries: 10

Both the USC and eCFR converters use these wrappers instead of `node:fs/promises` directly. The retry logic is transparent to callers -- the wrappers have the same signature as their `node:fs/promises` counterparts.
