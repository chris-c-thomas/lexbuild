# @lexbuild/core

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcore?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/core)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild)

This package is part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo, a tool that converts U.S. legal XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. See the monorepo for full documentation, architecture details, and contribution guidelines.

It provides the foundational building blocks for XML parsing infrastructure, AST definitions, and Markdown rendering for use by all source packages ([`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc), [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr)) and [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli).

## Install

```bash
npm install @lexbuild/core
```

## What's Included

### XML Parser

Streaming SAX parser with namespace normalization. Supports USLM (U.S. Code) and namespace-free XML (eCFR) via the `defaultNamespace` option.

```ts
import { XMLParser } from "@lexbuild/core";

const parser = new XMLParser();
parser.on("openElement", (name, attrs) => { /* ... */ });
parser.on("closeElement", (name) => { /* ... */ });
parser.on("text", (text) => { /* ... */ });

await parser.parseStream(readableStream);
```

### USLM AST Builder

Stack-based XML-to-AST construction with a section-emit pattern for bounded memory usage. This builder handles USLM 1.0 XML (U.S. Code). Source packages for other formats (e.g., `@lexbuild/ecfr`) provide their own builders.

```ts
import { ASTBuilder } from "@lexbuild/core";

const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => {
    // Called with each completed section subtree
  },
});
```

### Markdown Renderer

Stateless AST-to-Markdown conversion with YAML frontmatter, cross-reference link resolution, and notes filtering.

```ts
import { renderDocument, generateFrontmatter, createLinkResolver } from "@lexbuild/core";

const markdown = renderDocument(sectionNode, frontmatterData, {
  linkStyle: "relative",
  resolveLink: resolver.resolve,
});
```

### AST Node Types

Full type definitions for the legal document AST: `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, `SourceType`, `LegalStatus`, and more.

```ts
import type { ASTNode, LevelNode, FrontmatterData, SourceType, LegalStatus } from "@lexbuild/core";
```

### Namespace Constants

USLM, XHTML, Dublin Core namespace URIs and element classification sets.

```ts
import { USLM_NS, XHTML_NS, LEVEL_ELEMENTS, CONTENT_ELEMENTS } from "@lexbuild/core";
```

## API Reference

| Export | Description |
|--------|-------------|
| `XMLParser` | Streaming SAX parser with namespace normalization |
| `ASTBuilder` / `UslmASTBuilder` | USLM XML events to AST with section-emit pattern |
| `renderDocument()` | Render a section node with frontmatter to Markdown |
| `renderSection()` | Render a section-level node to Markdown |
| `renderNode()` | Render any AST node to Markdown |
| `generateFrontmatter()` | Generate YAML frontmatter block |
| `createLinkResolver()` | Create a cross-reference link resolver |
| `parseIdentifier()` | Parse a USC or CFR identifier into components |
| `FORMAT_VERSION` | Output format version (`"1.1.0"`) |
| `GENERATOR` | Generator string for frontmatter |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
