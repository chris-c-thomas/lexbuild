/**
 * Parser for the lexbuild:// URI scheme.
 * Maps URIs to Data API source identifiers.
 */
import type { ApiSource } from "../api/client.js";

/** Parsed lexbuild:// URI. */
export interface ParsedUri {
  /** API source for the request path (e.g., "usc", "ecfr", "fr"). */
  apiSource: ApiSource;
  /** Full canonical identifier (e.g., "/us/usc/t5/s552"). */
  identifier: string;
}

/**
 * Parses a lexbuild:// URI into its API source and identifier.
 *
 * Supported patterns:
 * - `lexbuild://us/usc/t{title}/s{section}` → apiSource "usc"
 * - `lexbuild://us/cfr/t{title}/s{section}` → apiSource "ecfr"
 * - `lexbuild://us/fr/{document_number}` → apiSource "fr"
 *
 * @throws {Error} If the URI is malformed or has an unknown source.
 */
export function parseLexbuildUri(uri: string): ParsedUri {
  if (!uri.startsWith("lexbuild://")) {
    throw new Error(`Invalid lexbuild URI: must start with lexbuild:// (got "${uri}")`);
  }

  const path = uri.slice("lexbuild://".length);

  if (path.startsWith("us/usc/")) {
    return { apiSource: "usc", identifier: `/${path}` };
  }

  if (path.startsWith("us/cfr/")) {
    return { apiSource: "ecfr", identifier: `/${path}` };
  }

  if (path.startsWith("us/fr/")) {
    const docNumber = path.slice("us/fr/".length);
    if (!docNumber) {
      throw new Error(`Invalid lexbuild URI: missing document number in "${uri}"`);
    }
    return { apiSource: "fr", identifier: docNumber };
  }

  throw new Error(`Unknown lexbuild URI source: "${uri}"`);
}
