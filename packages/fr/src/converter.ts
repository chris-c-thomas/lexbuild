/**
 * Federal Register conversion orchestrator.
 *
 * Discovers downloaded FR XML files, parses them with FrASTBuilder,
 * enriches frontmatter with JSON sidecar metadata, renders via core's
 * renderDocument, and writes structured Markdown output.
 *
 * Processes FR documents in two passes: (1) parse all files and register
 * identifiers for link resolution, (2) render and write output files.
 */

import { createReadStream, existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  XMLParser,
  renderDocument,
  createLinkResolver,
  writeFile,
  mkdir,
} from "@lexbuild/core";
import type { LevelNode, EmitContext } from "@lexbuild/core";
import { FrASTBuilder } from "./fr-builder.js";
import type { FrDocumentXmlMeta } from "./fr-builder.js";
import { buildFrFrontmatter } from "./fr-frontmatter.js";
import type { FrDocumentJsonMeta } from "./fr-frontmatter.js";
import { buildFrOutputPath } from "./fr-path.js";
import { FR_DOCUMENT_TYPE_KEYS } from "./fr-elements.js";
import type { FrDocumentType } from "./fr-elements.js";

// ── Public types ──

/** Options for converting FR documents */
export interface FrConvertOptions {
  /** Path to input file or directory containing .xml/.json files */
  input: string;
  /** Output root directory */
  output: string;
  /** Link style for cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Parse only, don't write files */
  dryRun: boolean;
  /** Filter: start date (YYYY-MM-DD) */
  from?: string | undefined;
  /** Filter: end date (YYYY-MM-DD) */
  to?: string | undefined;
  /** Filter: document types */
  types?: FrDocumentType[] | undefined;
}

/** Result of a conversion operation */
export interface FrConvertResult {
  /** Number of documents converted */
  documentsConverted: number;
  /** Paths of written files */
  files: string[];
  /** Total estimated tokens */
  totalTokenEstimate: number;
  /** Peak RSS in bytes */
  peakMemoryBytes: number;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/** Collected document info during parsing */
interface CollectedDoc {
  node: LevelNode;
  context: EmitContext;
  xmlMeta: FrDocumentXmlMeta;
  jsonMeta?: FrDocumentJsonMeta;
  publicationDate: string;
  documentNumber: string;
}

/** Set of valid FR document type element names for filtering */
const FR_DOC_TYPE_SET = new Set<string>(FR_DOCUMENT_TYPE_KEYS);

// ── Public function ──

/**
 * Convert FR XML documents to Markdown.
 *
 * Supports both single-file mode (input is a .xml path) and batch mode
 * (input is a directory containing year/month/doc.xml structure).
 */
export async function convertFrDocuments(options: FrConvertOptions): Promise<FrConvertResult> {
  const xmlFiles = await discoverXmlFiles(options.input, options.from, options.to);

  const files: string[] = [];
  let totalTokenEstimate = 0;
  let peakMemoryBytes = 0;

  const linkResolver = createLinkResolver();

  // Parse all files once and cache results
  const parsedFiles = new Map<string, CollectedDoc[]>();
  for (const xmlPath of xmlFiles) {
    try {
      const collected = await parseXmlFile(xmlPath);
      parsedFiles.set(xmlPath, collected);
    } catch (err) {
      console.warn(
        `Warning: Failed to parse ${xmlPath}: ${err instanceof Error ? err.message : String(err)}. Skipping.`,
      );
    }
  }

  // Register identifiers for link resolution using cached results
  for (const [, collected] of parsedFiles) {
    for (const doc of collected) {
      if (options.types && options.types.length > 0) {
        if (!FR_DOC_TYPE_SET.has(doc.xmlMeta.documentType) || !options.types.includes(doc.xmlMeta.documentType as FrDocumentType)) {
          continue;
        }
      }

      if (doc.node.identifier) {
        const outputPath = buildFrOutputPath(
          doc.documentNumber,
          doc.publicationDate,
          options.output,
        );
        linkResolver.register(doc.node.identifier, outputPath);
      }
    }
  }

  if (options.dryRun) {
    let count = 0;
    for (const [, collected] of parsedFiles) {
      for (const doc of collected) {
        if (options.types && options.types.length > 0) {
          if (!FR_DOC_TYPE_SET.has(doc.xmlMeta.documentType) || !options.types.includes(doc.xmlMeta.documentType as FrDocumentType)) {
            continue;
          }
        }
        count++;
      }
    }
    return {
      documentsConverted: count,
      files: [],
      totalTokenEstimate: 0,
      peakMemoryBytes: 0,
      dryRun: true,
    };
  }

  // Render and write using cached results
  for (const [, collected] of parsedFiles) {
    for (const doc of collected) {
      // Apply type filter
      if (options.types && options.types.length > 0) {
        if (!FR_DOC_TYPE_SET.has(doc.xmlMeta.documentType) || !options.types.includes(doc.xmlMeta.documentType as FrDocumentType)) {
          continue;
        }
      }

      const outputPath = buildFrOutputPath(
        doc.documentNumber,
        doc.publicationDate,
        options.output,
      );

      const frontmatter = buildFrFrontmatter(doc.node, doc.context, doc.xmlMeta, doc.jsonMeta);

      const markdown = renderDocument(doc.node, frontmatter, {
        headingOffset: 0,
        linkStyle: options.linkStyle,
        resolveLink: options.linkStyle === "relative"
          ? (id) => linkResolver.resolve(id, outputPath)
          : undefined,
      });

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, markdown, "utf-8");

      files.push(outputPath);

      // Estimate tokens (character/4 heuristic)
      const tokenEstimate = Math.round(markdown.length / 4);
      totalTokenEstimate += tokenEstimate;

      // Track memory
      const mem = process.memoryUsage().rss;
      if (mem > peakMemoryBytes) {
        peakMemoryBytes = mem;
      }
    }
  }

  return {
    documentsConverted: files.length,
    files,
    totalTokenEstimate,
    peakMemoryBytes,
    dryRun: false,
  };
}

// ── Private helpers ──

/**
 * Parse a single XML file and collect document nodes + metadata.
 */
async function parseXmlFile(xmlPath: string): Promise<CollectedDoc[]> {
  const collected: CollectedDoc[] = [];

  const builder = new FrASTBuilder({
    onEmit: (node, context) => {
      // Snapshot metas at emit time
      const currentMetas = builder.getDocumentMetas();
      const meta = currentMetas[currentMetas.length - 1];
      if (!meta) {
        console.warn(
          `Warning: No XML metadata extracted for emitted document in ${xmlPath}. ` +
            `Frontmatter will have empty document_type and document_number.`,
        );
      }
      collected.push({
        node,
        context,
        xmlMeta: meta ?? { documentType: "", documentTypeNormalized: "" },
        publicationDate: "",
        documentNumber: meta?.documentNumber ?? "",
      });
    },
  });

  const parser = new XMLParser({ defaultNamespace: "" });
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  const stream = createReadStream(xmlPath, "utf-8");
  await parser.parseStream(stream);

  // Try to load JSON sidecar
  const jsonPath = xmlPath.replace(/\.xml$/, ".json");
  let jsonMeta: FrDocumentJsonMeta | undefined;
  if (existsSync(jsonPath)) {
    try {
      const raw = await readFile(jsonPath, "utf-8");
      jsonMeta = JSON.parse(raw) as FrDocumentJsonMeta;
    } catch (err) {
      console.warn(
        `Warning: Failed to parse JSON sidecar ${jsonPath}: ${err instanceof Error ? err.message : String(err)}. Continuing without enriched metadata.`,
      );
    }
  }

  // Enrich collected docs with JSON metadata and publication date
  for (const doc of collected) {
    if (jsonMeta && jsonMeta.document_number === doc.documentNumber) {
      doc.jsonMeta = jsonMeta;
      doc.publicationDate = jsonMeta.publication_date;
    } else {
      // Infer date from file path (downloads/fr/YYYY/MM/doc.xml)
      const inferredDate = inferDateFromPath(xmlPath);
      if (!inferredDate) {
        console.warn(
          `Warning: No publication date for document ${doc.documentNumber || "(unknown)"} — ` +
            `no JSON sidecar and path ${xmlPath} has no YYYY/MM/ pattern. Output will be in 0000/00/.`,
        );
      }
      doc.publicationDate = inferredDate;
    }
  }

  return collected;
}

/**
 * Discover XML files in a directory or return the single file path.
 */
async function discoverXmlFiles(
  input: string,
  from?: string,
  to?: string,
): Promise<string[]> {
  let inputStat;
  try {
    inputStat = await stat(input);
  } catch (err) {
    throw new Error(
      `Cannot access input path "${input}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  if (inputStat.isFile()) {
    return [input];
  }

  if (!inputStat.isDirectory()) {
    throw new Error(`Input path "${input}" is not a file or directory`);
  }

  // Recursively find all .xml files
  const xmlFiles: string[] = [];
  await walkDir(input, xmlFiles);

  // Apply date range filter based on file path structure (YYYY/MM/)
  let filtered = xmlFiles;
  if (from || to) {
    filtered = xmlFiles.filter((f) => {
      const date = inferDateFromPath(f);
      if (!date) return true; // Can't filter if no date in path
      if (from && date < from) return false;
      if (to && date > to + "-32") return false; // Month-level comparison
      return true;
    });
  }

  return filtered.sort();
}

/** Recursively walk a directory collecting .xml files */
async function walkDir(dir: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith(".xml")) {
      results.push(fullPath);
    }
  }
}

/**
 * Infer a date string from the file path. Used when no JSON sidecar is available.
 *
 * Supports two patterns:
 *   - Per-document: "downloads/fr/2026/03/doc.xml" → "2026-03-01"
 *   - Govinfo bulk: "downloads/fr/bulk/2026/FR-2026-03-02.xml" → "2026-03-02"
 */
function inferDateFromPath(filePath: string): string {
  // Govinfo bulk: FR-YYYY-MM-DD.xml
  const bulkMatch = /FR-(\d{4})-(\d{2})-(\d{2})\.xml$/.exec(filePath);
  if (bulkMatch) {
    return `${bulkMatch[1]}-${bulkMatch[2]}-${bulkMatch[3]}`;
  }

  // Per-document: YYYY/MM/doc.xml
  const perDocMatch = /(\d{4})\/(\d{2})\/[^/]+\.xml$/.exec(filePath);
  if (perDocMatch) {
    return `${perDocMatch[1]}-${perDocMatch[2]}-01`;
  }

  return "";
}
