# Extending law2md

This guide explains how to add support for new legal source types beyond the U.S. Code.

---

## Planned Source Types

| Source | XML Format | Provider | Package |
|--------|-----------|----------|---------|
| U.S. Code | USLM 1.0 | OLRC (uscode.house.gov) | `@law2md/usc` (MVP) |
| Code of Federal Regulations | USLM 2.x | GPO (govinfo.gov) | `@law2md/cfr` |
| Federal Register | USLM 2.x | GPO (govinfo.gov) | `@law2md/fr` |
| State statutes (IL example) | Custom HTML/XML | State legislature sites | `@law2md/state-il` |

---

## Step-by-Step: Adding a New Source

### 1. Create the Package

```bash
mkdir -p packages/{source}/src/elements
```

Create `packages/{source}/package.json`:

```json
{
  "name": "@law2md/{source}",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@law2md/core": "workspace:*"
  }
}
```

### 2. Implement the Converter

Create `packages/{source}/src/converter.ts` implementing the `SourceConverter` interface from core:

```typescript
import type { SourceConverter, ConvertOptions, ConvertResult } from "@law2md/core";

export class CFRConverter implements SourceConverter {
  async convert(options: ConvertOptions): Promise<ConvertResult> {
    // 1. Create read stream for input XML
    // 2. Configure SAX parser (may need different namespace)
    // 3. Configure AST builder with appropriate emit level
    // 4. Register element handlers
    // 5. Process stream
    // 6. Generate metadata indexes
  }
}
```

### 3. Implement Element Handlers

The core package provides the AST node types. Your source package maps source-specific XML elements to these shared AST types.

For example, CFR uses different element names than USC:

```typescript
// packages/cfr/src/elements/part.ts
import type { LevelNode, HandlerContext } from "@law2md/core";

export function handleCFRPart(node: LevelNode, ctx: HandlerContext): string {
  // CFR parts are analogous to USC chapters
  // Render heading, then delegate children to core renderer
}
```

### 4. Implement the Downloader (Optional)

If the source has a bulk download endpoint:

```typescript
// packages/cfr/src/downloader.ts
export async function downloadCFR(options: CFRDownloadOptions): Promise<DownloadResult> {
  // CFR XML is available at:
  // https://www.govinfo.gov/bulkdata/CFR/{year}/title-{N}/CFR-{year}-title{N}.xml
}
```

### 5. Register with the CLI

In `packages/cli/src/commands/convert.ts`, add the new source type:

```typescript
import { CFRConverter } from "@law2md/cfr";

const converters: Record<string, () => SourceConverter> = {
  usc: () => new USCConverter(),
  cfr: () => new CFRConverter(),
};
```

### 6. Document the Source Schema

Create `packages/{source}/README.md` documenting:

- The XML schema used (link to official documentation)
- Element hierarchy specific to this source
- Download URL patterns
- Any source-specific CLI options
- Known anomalies or edge cases

---

## Core Interfaces to Implement

The `@law2md/core` package exports these interfaces that source packages must implement:

```typescript
/** Main converter interface */
interface SourceConverter {
  convert(options: ConvertOptions): Promise<ConvertResult>;
}

/** Optional: downloader interface */
interface SourceDownloader {
  download(options: DownloadOptions): Promise<DownloadResult>;
  getCurrentReleasePoint(): Promise<string>;
}

/** Element handler registration */
interface ElementHandlerRegistry {
  register(elementName: string, handler: ElementHandler): void;
  get(elementName: string): ElementHandler | undefined;
}
```

---

## CFR-Specific Notes

The Code of Federal Regulations has a different hierarchy than the U.S. Code:

```
Title > Subtitle > Chapter > Subchapter > Part > Subpart > Section
```

CFR titles are numbered 1-50. The XML is available from GPO's govinfo bulk data repository in USLM 2.x format. Key differences from USLM 1.0:

- USLM 2.x uses a different namespace URI
- CFR has `<authority>` and `<source>` elements not present in USC
- CFR sections are numbered differently (e.g., `§ 1.1`, `§ 240.10b-5`)
- CFR has an annual revision cycle (titles are revised on a rolling quarterly basis)

---

## State Statute Notes

State statutes are the most heterogeneous source. There is no universal XML schema. Common approaches:

- **Illinois (ILCS)**: Available as HTML from ilga.gov. Requires HTML-to-AST parsing rather than XML-to-AST. The core Markdown renderer and frontmatter generator still apply.
- **California**: Available in XML from leginfo.legislature.ca.gov, but uses a custom schema.
- **Uniform Law Commission**: Model acts are available in USLM-like XML.

For HTML sources, consider creating a shared `@law2md/html-parser` package that converts legal HTML to the core AST, then letting source-specific packages handle the semantic interpretation.
