# Performance

LexBuild converts the entire U.S. Code -- over 60,000 sections across 650 MB of XML -- in under 20 seconds. This performance comes from SAX streaming, which processes XML as a sequence of events rather than loading entire documents into memory. This page documents benchmark results, memory characteristics, and the tradeoffs between output granularity modes.

## Benchmarks

Measured on a modern machine with NVMe storage. Timings include XML parsing, AST construction, Markdown rendering, frontmatter generation, and file I/O for section-level granularity output.

| Title | XML Size | Sections | ~Tokens | Duration |
|-------|----------|----------|---------|----------|
| Title 1 - General Provisions | 0.3 MB | 39 | 35K | 0.04s |
| Title 10 - Armed Forces | 50.7 MB | 3,847 | 6.0M | 1.4s |
| Title 26 - Internal Revenue Code | 53.2 MB | 2,160 | 6.4M | 1.1s |
| Title 42 - Public Health | 107.3 MB | 8,460 | 14.7M | 2.7s |
| **All 54 titles** | **~650 MB** | **60,215** | **~85M** | **~18s** |

Title 42 (Public Health) is the largest by both XML size and section count. Title 26 (Internal Revenue Code) has fewer sections but comparable XML size due to longer individual sections with dense cross-references.

## Memory Profile

At any point during section-level conversion, the following components are in memory:

| Component | Memory | Notes |
|-----------|--------|-------|
| SAX parser internal buffer | ~64 KB | Fixed-size streaming buffer |
| AST builder stack (ancestors only) | ~5 KB | ~1 KB per level x ~5 levels deep |
| Current section AST | Up to ~500 KB | Largest sections in Title 26 |
| Document metadata | ~2 KB | Extracted from `<meta>` block, held for entire run |
| Link resolver registry | ~100 bytes x N | Grows with number of sections converted |
| File write buffer | ~64 KB | OS-level I/O buffer |
| **Worst case total** | **< 10 MB per title** | Section-level granularity |

The key insight is that only one section's AST exists in memory at a time. When the AST builder encounters a `</section>` close tag, the completed subtree is emitted via callback, rendered to Markdown, written to disk, and then released. The builder stack retains only ancestor metadata (title, chapter, subchapter names and identifiers) -- not their full subtrees.

## Why SAX Streaming

U.S. Code XML files range from 0.3 MB (Title 1) to 107 MB (Title 42). A DOM-based parser would need to hold the entire document tree in memory, consuming hundreds of megabytes for a single large title and making it impractical to process all 54 titles in sequence.

SAX (Simple API for XML) processes the document as a stream of events -- `openElement`, `closeElement`, `text` -- without building a complete tree. LexBuild's `XMLParser` wraps the `saxes` library with namespace normalization and a typed event emitter. The `ASTBuilder` consumes these events using a stack, constructing and emitting subtrees incrementally.

This architecture means:

- **Memory is bounded** by the size of the largest single section, not the largest document
- **Startup latency is minimal** -- processing begins immediately, no upfront parsing phase
- **Throughput scales linearly** with document size rather than quadratically (no tree traversal overhead)

## Granularity and Memory

The `emitAt` setting on the AST builder controls when subtrees are flushed from memory. Each granularity mode has different memory characteristics:

### Section Granularity (default)

```
emitAt: "section"
```

- The AST builder emits each section as it completes
- Only one section's AST is in memory at any time
- Memory usage stays under 10 MB regardless of title size
- Produces the most files (60,000+ across all titles)

### Chapter Granularity

```
emitAt: "chapter"
```

- The AST builder emits each chapter as it completes
- All sections within the current chapter are held in memory simultaneously
- Memory scales with the largest chapter in the title
- Most chapters are modest, but some large chapters (e.g., in Title 42) contain hundreds of sections

### Title Granularity

```
emitAt: "title"
```

- The entire title's AST is held in memory until the document ends
- For large titles, this can require significant memory:
  - Title 42 (107 MB XML, 8,460 sections): may need 500 MB+ RSS
  - Title 26 (53 MB XML, 2,160 sections): may need 300 MB+ RSS
- Produces a single file per title with the full heading hierarchy
- Use this mode only when a single-file-per-title output is specifically needed

The default section granularity is recommended for most use cases. It produces output sized for typical embedding model context windows while keeping memory usage minimal.

## Token Estimation

Token counts reported in `_meta.json` sidecar files and CLI output use a character/4 heuristic:

```
token_estimate = Math.ceil(characterCount / 4)
```

This provides a reasonable approximation for English legal text with common tokenizers (GPT-3.5/4, Claude). The heuristic avoids adding a tokenizer dependency (e.g., `tiktoken`) to the runtime, keeping the package lightweight.

Precise token counting with configurable tokenizer support is a planned enhancement.
