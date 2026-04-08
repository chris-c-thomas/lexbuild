/**
 * search_laws tool — full-text search across U.S. Code, CFR, and Federal Register.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { enforceResponseBudget } from "./guards.js";
import { withErrorHandling } from "./with-error-handling.js";

const InputSchema = {
  query: z.string().min(2).max(256).describe("Natural language or keyword query. Supports quoted phrases."),
  source: z
    .enum(["usc", "cfr", "fr"])
    .optional()
    .describe("Restrict search to a specific source. Omit to search all."),
  title: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Restrict to a specific title number. Only meaningful with a single source."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Maximum results to return. Hard capped at 25 to protect context."),
  offset: z.number().int().min(0).default(0).describe("Pagination offset for cursoring through additional results."),
};

/** Registers the search_laws tool. */
export function registerSearchLawsTool(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    "search_laws",
    {
      title: "Search U.S. Legal Sources",
      description:
        "Full-text search across the U.S. Code, Code of Federal Regulations, and Federal Register. " +
        "Returns ranked results with snippets and canonical identifiers. " +
        "Use get_section to fetch full text of any result. " +
        "Prefer specific sources and titles when known to reduce noise.",
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("search_laws", deps.logger, async (input) => {
      deps.logger.debug("search_laws invoked", { query: input.query });

      const result = await deps.api.search({
        q: input.query,
        source: input.source,
        title_number: input.title,
        limit: input.limit,
        offset: input.offset,
      });

      const output = {
        hits: result.data.hits.map((h) => ({
          identifier: h.identifier,
          source: h.source,
          heading: h.heading,
          snippet: h.highlights?.body ?? "",
          hierarchy: h.hierarchy,
          url: `https://lexbuild.dev${h.identifier}`,
        })),
        total: result.pagination.total,
        offset: input.offset,
        limit: input.limit,
        has_more: result.pagination.has_more,
      };

      const checked = enforceResponseBudget(output, deps.config.LEXBUILD_MCP_MAX_RESPONSE_BYTES);

      return { content: [{ type: "text" as const, text: JSON.stringify(checked, null, 2) }] };
    }),
  );
}
