/**
 * Registers MCP resource templates for legal sections.
 */
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { parseLexbuildUri } from "./uri.js";
import { wrapUntrustedContent } from "../tools/sanitize.js";
import { McpServerError } from "../server/errors.js";

/** Fetches a resource by URI, with error handling. */
async function fetchResource(
  uri: URL,
  deps: ServerDeps,
): Promise<{ contents: [{ uri: string; mimeType: "text/markdown"; text: string }] }> {
  try {
    const parsed = parseLexbuildUri(uri.href);
    const doc = await deps.api.getDocument(parsed.apiSource, parsed.identifier);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown" as const,
          text: doc.data.body ? wrapUntrustedContent(doc.data.body) : "",
        },
      ],
    };
  } catch (err) {
    deps.logger.error("Resource read failed", {
      uri: uri.href,
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof McpServerError) throw err;
    throw new McpServerError("validation_error", `Invalid resource URI: ${uri.href}`, {
      cause: err,
    });
  }
}

/** Registers all v1 resource templates on the MCP server. */
export function registerResources(server: McpServer, deps: ServerDeps): void {
  // USC sections
  server.registerResource(
    "usc_section",
    new ResourceTemplate("lexbuild://us/usc/t{title}/s{section}", { list: undefined }),
    {
      description: "A single section of the United States Code, returned as Markdown.",
      mimeType: "text/markdown",
    },
    async (uri) => fetchResource(uri, deps),
  );

  // CFR sections
  server.registerResource(
    "cfr_section",
    new ResourceTemplate("lexbuild://us/cfr/t{title}/s{section}", { list: undefined }),
    {
      description:
        "A single section of the Code of Federal Regulations, returned as Markdown.",
      mimeType: "text/markdown",
    },
    async (uri) => fetchResource(uri, deps),
  );

  // FR documents
  server.registerResource(
    "fr_document",
    new ResourceTemplate("lexbuild://us/fr/{document_number}", { list: undefined }),
    {
      description: "A single Federal Register document, returned as Markdown.",
      mimeType: "text/markdown",
    },
    async (uri) => fetchResource(uri, deps),
  );

  deps.logger.debug("Registered 3 MCP resource templates");
}
