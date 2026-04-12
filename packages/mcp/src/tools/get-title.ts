/**
 * get_title tool — detail of a specific title (USC/CFR) or year (FR).
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { withErrorHandling } from "./with-error-handling.js";

const InputSchema = {
  source: z.enum(["usc", "ecfr", "fr"]).describe("Legal source."),
  number: z
    .number()
    .int()
    .positive()
    .describe("Title number (USC/eCFR) or year (FR). Examples: 5 (USC Title 5), 2026 (FR year)."),
};

/** Registers the get_title tool. */
export function registerGetTitleTool(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    "get_title",
    {
      title: "Get Title or Year Detail",
      description:
        "Get detail for a specific USC/eCFR title (chapters and section counts) " +
        "or a Federal Register year (months and document counts). " +
        "Use list_titles first to see available titles/years.",
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("get_title", deps.logger, async (input) => {
      deps.logger.debug("get_title invoked", { source: input.source, number: input.number });

      if (input.source === "fr") {
        const result = await deps.api.getYearDetail(input.number);
        const output = {
          source: "fr",
          year: result.data.year,
          document_count: result.data.document_count,
          months: result.data.months.map((m) => ({
            month: m.month,
            document_count: m.document_count,
          })),
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
      }

      const result = await deps.api.getTitleDetail(input.source, input.number);
      const output = {
        source: input.source,
        title_number: result.data.title_number,
        title_name: result.data.title_name,
        document_count: result.data.document_count,
        chapters: result.data.chapters.map((c) => ({
          chapter_number: c.chapter_number,
          chapter_name: c.chapter_name,
          document_count: c.document_count,
        })),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
    }),
  );
}
