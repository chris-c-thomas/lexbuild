/**
 * get_section tool — fetch a single atomic section by source and identifier.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { enforceResponseBudget } from "./guards.js";
import { wrapUntrustedContent } from "./sanitize.js";
import { withErrorHandling } from "./with-error-handling.js";

const InputSchema = {
  source: z
    .enum(["usc", "ecfr", "fr"])
    .describe("Legal source: usc (U.S. Code), ecfr (eCFR / Code of Federal Regulations), or fr (Federal Register)."),
  identifier: z
    .string()
    .min(1)
    .describe(
      "Section identifier. Examples: '/us/usc/t5/s552' (USC), '/us/cfr/t17/s240.10b-5' (CFR), " +
        "'2026-06029' (FR document number). Short forms like 't5/s552' are also accepted.",
    ),
};

/** Registers the get_section tool. */
export function registerGetSectionTool(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    "get_section",
    {
      title: "Get Legal Section",
      description:
        "Fetch the full text of a single legal section by its canonical identifier. " +
        "Returns markdown with YAML frontmatter containing metadata. " +
        "Use search_laws first to find identifiers.",
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("get_section", deps.logger, async (input) => {
      deps.logger.debug("get_section invoked", { source: input.source, identifier: input.identifier });

      const result = await deps.api.getDocument(input.source, input.identifier);

      const output = {
        identifier: result.data.identifier,
        source: result.data.source,
        metadata: result.data.metadata,
        body: result.data.body ? wrapUntrustedContent(result.data.body) : undefined,
        url: `https://lexbuild.dev${result.data.identifier}`,
      };

      const checked = enforceResponseBudget(output, deps.config.LEXBUILD_MCP_MAX_RESPONSE_BYTES);

      return { content: [{ type: "text" as const, text: JSON.stringify(checked, null, 2) }] };
    }),
  );
}
