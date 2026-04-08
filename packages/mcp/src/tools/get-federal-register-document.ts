/**
 * get_federal_register_document tool — fetch an FR document by document number.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { enforceResponseBudget } from "./guards.js";
import { wrapUntrustedContent } from "./sanitize.js";
import { withErrorHandling } from "./with-error-handling.js";

const InputSchema = {
  document_number: z.string().min(1).describe("Federal Register document number. Example: '2026-06029'."),
};

/** Registers the get_federal_register_document tool. */
export function registerGetFrDocumentTool(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    "get_federal_register_document",
    {
      title: "Get Federal Register Document",
      description:
        "Fetch a Federal Register document by its document number. " +
        "Returns the full markdown text with metadata including publication date, " +
        "agencies, document type, and CFR references.",
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("get_federal_register_document", deps.logger, async (input) => {
      deps.logger.debug("get_federal_register_document invoked", {
        document_number: input.document_number,
      });

      const result = await deps.api.getDocument("fr", input.document_number);

      const output = {
        identifier: result.data.identifier,
        source: "fr",
        metadata: result.data.metadata,
        body: result.data.body ? wrapUntrustedContent(result.data.body) : undefined,
        url: `https://lexbuild.dev${result.data.identifier}`,
      };

      const checked = enforceResponseBudget(output, deps.config.LEXBUILD_MCP_MAX_RESPONSE_BYTES);

      return { content: [{ type: "text" as const, text: JSON.stringify(checked, null, 2) }] };
    }),
  );
}
