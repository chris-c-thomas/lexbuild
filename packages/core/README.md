# @lexbuild/core

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcore?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/core)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)

Shared infrastructure for the [LexBuild](https://github.com/chris-c-thomas/LexBuild) legal-XML-to-Markdown pipeline. Provides streaming XML parsing, AST definitions, Markdown rendering, YAML frontmatter generation, and cross-reference link resolution used by all source packages.

> **Note:** This is a foundational library. Most users should install [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) for the command-line tool, or a source package ([`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc), [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr), [`@lexbuild/fr`](https://www.npmjs.com/package/@lexbuild/fr)) for programmatic access.

## Install

```bash
npm install @lexbuild/core
# or
pnpm add @lexbuild/core
```

## Quick Start

```ts
import { XMLParser, ASTBuilder, renderDocument, generateFrontmatter, createLinkResolver } from "@lexbuild/core";
import { createReadStream } from "node:fs";

// 1. Parse XML via streaming SAX
const parser = new XMLParser();
const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => {
    // 2. Each completed section is emitted here
    const frontmatter = generateFrontmatter(/* ... */);
    const resolver = createLinkResolver("relative");
    const markdown = renderDocument(node, frontmatter, {
      linkStyle: "relative",
      resolveLink: resolver.resolve,
    });
    // 3. Write markdown to file
  },
});

parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
parser.on("closeElement", (name) => builder.onCloseElement(name));
parser.on("text", (text) => builder.onText(text));

await parser.parseStream(createReadStream("usc01.xml"));
```

## API Reference

### XML Parsing

| Export | Description |
|--------|-------------|
| `XMLParser` | Streaming SAX parser wrapping `saxes` with namespace normalization. Supports USLM (namespaced) and namespace-free XML (eCFR) via the `defaultNamespace` option. |

### AST Builder

| Export | Description |
|--------|-------------|
| `ASTBuilder` | Stack-based USLM XML-to-AST builder with configurable emit-at-level streaming. Handles the full USLM 1.0 element vocabulary. Source packages for other formats provide their own builders. |

### Rendering

| Export | Description |
|--------|-------------|
| `renderDocument()` | Render a section node with frontmatter to a complete Markdown file |
| `renderSection()` | Render a section-level node to Markdown body text |
| `renderNode()` | Render any AST node to Markdown |
| `generateFrontmatter()` | Generate a YAML frontmatter block from `FrontmatterData` |
| `createLinkResolver()` | Create a cross-reference link resolver supporting USC, CFR, and fallback URLs |

### Types

| Export | Description |
|--------|-------------|
| `ASTNode` | Union type for all AST nodes |
| `LevelNode` | Hierarchical structural node (title, chapter, section, etc.) |
| `ContentNode` | Text content block (content, chapeau, continuation, proviso) |
| `InlineNode` | Inline text formatting (bold, italic, ref, footnoteRef, etc.) |
| `NoteNode` | Note block (editorial, statutory, amendment, etc.) |
| `TableNode` | Table with headers and rows |
| `SourceCreditNode` | Enactment source citation |
| `FrontmatterData` | Full frontmatter field definitions |
| `EmitContext` | Context passed with emitted nodes (ancestors, document metadata) |
| `SourceType` | `"usc" \| "ecfr" \| "fr"` |
| `LegalStatus` | `"official_legal_evidence" \| "official_prima_facie" \| "authoritative_unofficial"` |

### Constants

| Export | Description |
|--------|-------------|
| `FORMAT_VERSION` | Output format version (`"1.1.0"`) |
| `GENERATOR` | Generator string for frontmatter metadata |
| `LEVEL_TYPES` | Ordered array of level types (title → subsubitem) |
| `BIG_LEVELS` | Set of structural levels above section |
| `USLM_NS` | USLM namespace URI |
| `XHTML_NS` | XHTML namespace URI |

### File System Utilities

| Export | Description |
|--------|-------------|
| `writeFile()` | Write with ENFILE/EMFILE retry and exponential backoff |
| `writeFileIfChanged()` | Write only if content differs. Returns `true` if written, `false` if skipped (mtime preserved). Used by converters for incremental updates. |
| `mkdir()` | Recursive mkdir with retry |

## Compatibility

- **Node.js** >= 22
- **ESM only** — no CommonJS build
- **TypeScript** — ships `.d.ts` type declarations
- **Zero browser dependencies** — Node.js runtime only

## Monorepo Context

This package is part of the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo, managed with [Turborepo](https://turbo.build/) and [pnpm workspaces](https://pnpm.io/workspaces). All packages use [changesets](https://github.com/changesets/changesets) for lockstep versioning.

```
packages/
├── core/    ← you are here
├── usc/     # depends on core
├── ecfr/    # depends on core
├── fr/      # depends on core
└── cli/     # depends on core, usc, ecfr, fr
```

### Development

```bash
pnpm turbo build --filter=@lexbuild/core   # Build
pnpm turbo test --filter=@lexbuild/core    # Run tests
pnpm turbo typecheck --filter=@lexbuild/core
pnpm turbo lint --filter=@lexbuild/core
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@lexbuild/cli`](https://www.npmjs.com/package/@lexbuild/cli) | CLI tool for downloading and converting legal XML |
| [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc) | U.S. Code (USLM XML) converter and downloader |
| [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr) | eCFR (Code of Federal Regulations) converter and downloader |
| [`@lexbuild/fr`](https://www.npmjs.com/package/@lexbuild/fr) | Federal Register converter and downloader |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
