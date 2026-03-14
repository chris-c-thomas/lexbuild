/**
 * Cross-reference link resolver.
 *
 * Resolves USLM identifier URIs to relative Markdown file paths within
 * the output tree, or falls back to OLRC website URLs.
 */

import { relative, dirname } from "node:path";

/** Parsed components of a USLM identifier */
export interface ParsedIdentifier {
  /** Jurisdiction (e.g., "us") */
  jurisdiction: string;
  /** Code (e.g., "usc") */
  code: string;
  /** Title number (e.g., "1", "26") */
  titleNum?: string | undefined;
  /** Section number (e.g., "1", "7801", "106a") */
  sectionNum?: string | undefined;
  /** Subsection path (e.g., "a/2") */
  subPath?: string | undefined;
}

/**
 * Parse an identifier into its components.
 *
 * Handles:
 * - USC: /us/usc/t{N}, /us/usc/t{N}/s{N}, /us/usc/t{N}/s{N}/{sub}
 * - CFR: /us/cfr/t{N}, /us/cfr/t{N}/s{N}
 *
 * Returns null for non-USC/CFR identifiers (stat, pl, act).
 */
export function parseIdentifier(identifier: string): ParsedIdentifier | null {
  // Match: /us/{code}/t{title}[/s{section}[/subpath]]
  const match = /^\/(\w+)\/(\w+)\/t(\w+)(?:\/s([^/]+)(?:\/(.+))?)?$/.exec(identifier);
  if (!match) return null;

  const code = match[2] ?? "";
  if (code !== "usc" && code !== "cfr") return null;

  return {
    jurisdiction: match[1] ?? "",
    code,
    titleNum: match[3],
    sectionNum: match[4],
    subPath: match[5],
  };
}

/**
 * Resolve a USLM identifier to an expected output file path.
 *
 * Given a section identifier like "/us/usc/t2/s285b", returns a path like
 * "usc/title-02/section-285b.md". The chapter is unknown without a registry,
 * so this returns null unless the identifier is registered.
 */
export interface LinkResolver {
  /**
   * Given a USLM identifier and the current file's path in the output tree,
   * return a relative Markdown link path or null if unresolvable.
   */
  resolve(identifier: string, fromFile: string): string | null;

  /**
   * Register a converted file so future cross-references can resolve to it.
   */
  register(identifier: string, filePath: string): void;

  /**
   * Build the fallback OLRC website URL for identifiers not in the output corpus.
   */
  fallbackUrl(identifier: string): string | null;
}

/**
 * Create a new LinkResolver instance.
 */
export function createLinkResolver(): LinkResolver {
  /** Map of USLM identifier → output file path (relative to output root) */
  const registry = new Map<string, string>();

  return {
    register(identifier: string, filePath: string): void {
      registry.set(identifier, filePath);
    },

    resolve(identifier: string, fromFile: string): string | null {
      const targetPath = registry.get(identifier);
      if (!targetPath) {
        // Try resolving just the section (strip subsection path)
        const parsed = parseIdentifier(identifier);
        if (parsed?.sectionNum && parsed.titleNum) {
          const sectionId = `/us/${parsed.code}/t${parsed.titleNum}/s${parsed.sectionNum}`;
          const sectionPath = registry.get(sectionId);
          if (sectionPath) {
            return relative(dirname(fromFile), sectionPath);
          }
        }
        return null;
      }
      return relative(dirname(fromFile), targetPath);
    },

    fallbackUrl(identifier: string): string | null {
      const parsed = parseIdentifier(identifier);
      if (!parsed) return null;

      // USC: link to uscode.house.gov
      if (parsed.code === "usc") {
        if (parsed.sectionNum) {
          return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${parsed.titleNum}-section${parsed.sectionNum}`;
        }
        if (parsed.titleNum) {
          return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${parsed.titleNum}`;
        }
      }

      // CFR (eCFR and annual): link to ecfr.gov
      if (parsed.code === "cfr") {
        if (parsed.sectionNum) {
          return `https://www.ecfr.gov/current/title-${parsed.titleNum}/section-${parsed.sectionNum}`;
        }
        if (parsed.titleNum) {
          return `https://www.ecfr.gov/current/title-${parsed.titleNum}`;
        }
      }

      return null;
    },
  };
}
