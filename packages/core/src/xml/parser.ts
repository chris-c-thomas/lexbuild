/**
 * Streaming XML parser wrapping saxes with typed events and namespace normalization.
 */

import { SaxesParser } from "saxes";
import type { SaxesAttributeNS, SaxesOptions } from "saxes";
import type { Readable } from "node:stream";
import { USLM_NS, NAMESPACE_PREFIXES } from "./uslm-elements.js";

/** saxes options type for namespace-aware parsing */
type NSParserOptions = SaxesOptions & { xmlns: true };

/** Normalized attributes: a flat record of name → value */
export type Attributes = Record<string, string>;

/** Events emitted by the XML parser */
export interface ParserEvents {
  /** An element was opened */
  openElement: (name: string, attrs: Attributes, ns: string) => void;
  /** An element was closed */
  closeElement: (name: string, ns: string) => void;
  /** Text content was encountered */
  text: (content: string) => void;
  /** An error occurred during parsing */
  error: (err: Error) => void;
  /** Parsing is complete */
  end: () => void;
}

/** Configuration for the XML parser */
export interface XMLParserOptions {
  /** Namespace URI to treat as default (elements in this NS emit bare names) */
  defaultNamespace?: string | undefined;
  /** Additional namespace prefix mappings beyond the built-in ones */
  namespacePrefixes?: Readonly<Record<string, string>> | undefined;
}

type EventName = keyof ParserEvents;
type EventHandler<K extends EventName> = ParserEvents[K];

/**
 * Streaming XML parser that normalizes namespace-prefixed element names.
 *
 * Elements in the default namespace emit bare names (e.g., "section").
 * Elements in other recognized namespaces emit prefixed names (e.g., "xhtml:table").
 * Elements in unrecognized namespaces emit the full URI-prefixed name.
 */
export class XMLParser {
  private readonly saxParser: SaxesParser<NSParserOptions>;
  private readonly defaultNs: string;
  private readonly prefixMap: Readonly<Record<string, string>>;
  private readonly listeners: Map<EventName, Array<(...args: unknown[]) => void>> = new Map();

  constructor(options?: XMLParserOptions) {
    this.defaultNs = options?.defaultNamespace ?? USLM_NS;
    this.prefixMap = {
      ...NAMESPACE_PREFIXES,
      ...options?.namespacePrefixes,
    };

    this.saxParser = new SaxesParser<NSParserOptions>({ xmlns: true, position: true });

    this.saxParser.on("opentag", (node) => {
      const ns = node.uri;
      const localName = node.local;
      const normalizedName = this.normalizeName(localName, ns);
      const attrs = this.normalizeAttributes(node.attributes as Record<string, SaxesAttributeNS>);
      this.emit("openElement", normalizedName, attrs, ns);
    });

    this.saxParser.on("closetag", (node) => {
      const ns = node.uri;
      const localName = node.local;
      const normalizedName = this.normalizeName(localName, ns);
      this.emit("closeElement", normalizedName, ns);
    });

    this.saxParser.on("text", (text) => {
      this.emit("text", text);
    });

    this.saxParser.on("error", (err) => {
      this.emit("error", err);
    });

    this.saxParser.on("end", () => {
      this.emit("end");
    });
  }

  /**
   * Register an event listener.
   */
  on<K extends EventName>(event: K, handler: EventHandler<K>): this {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = [];
      this.listeners.set(event, handlers);
    }
    handlers.push(handler as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Parse a complete XML string.
   */
  parseString(xml: string): void {
    this.saxParser.write(xml);
    this.saxParser.close();
  }

  /**
   * Parse from a readable stream (e.g., fs.createReadStream).
   * Returns a promise that resolves when parsing is complete.
   */
  parseStream(stream: Readable): Promise<void> {
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk: Buffer | string) => {
        try {
          this.saxParser.write(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
        } catch (err) {
          reject(err);
        }
      });

      stream.on("end", () => {
        try {
          this.saxParser.close();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Normalize an element name based on its namespace.
   * Default namespace elements get bare names; others get prefixed.
   */
  private normalizeName(localName: string, ns: string): string {
    if (ns === this.defaultNs || ns === "") {
      return localName;
    }
    const prefix = this.prefixMap[ns];
    if (prefix) {
      return `${prefix}:${localName}`;
    }
    // Unknown namespace: use full URI
    return `{${ns}}${localName}`;
  }

  /**
   * Normalize saxes namespace-aware attributes to a flat record.
   * Strips namespace prefixes from attribute names for simplicity,
   * except for xmlns declarations which are dropped entirely.
   */
  private normalizeAttributes(saxAttrs: Record<string, SaxesAttributeNS>): Attributes {
    const attrs: Attributes = {};
    for (const [, attr] of Object.entries(saxAttrs)) {
      // Skip xmlns declarations
      if (attr.prefix === "xmlns" || attr.local === "xmlns") {
        continue;
      }
      // Use local name for most attributes
      const name = attr.prefix && attr.prefix !== "" ? `${attr.prefix}:${attr.local}` : attr.local;
      attrs[name] = attr.value;
    }
    return attrs;
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit(event: EventName, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }
}
