/**
 * list_titles tool — enumerate titles for USC/CFR or years for FR.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { withErrorHandling } from "./with-error-handling.js";

const InputSchema = {
  source: z.enum(["usc", "ecfr", "fr"]).describe("Legal source. For usc/ecfr, returns titles. For fr, returns years."),
};

/** Registers the list_titles tool. */
export function registerListTitlesTool(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    "list_titles",
    {
      title: "List Titles or Years",
      description:
        "Enumerate available titles for USC or eCFR, or available years for the Federal Register. " +
        "Returns title/year numbers, names, and document counts. " +
        "Use get_title to drill into a specific title or year.",
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling("list_titles", deps.logger, async (input) => {
      deps.logger.debug("list_titles invoked", { source: input.source });

      if (input.source === "fr") {
        const result = await deps.api.listYears();
        const output = {
          source: "fr",
          years: result.data.map((y) => ({
            year: y.year,
            document_count: y.document_count,
          })),
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
      }

      const result = await deps.api.listTitles(input.source);
      const output = {
        source: input.source,
        titles: result.data.map((t) => ({
          title_number: t.title_number,
          title_name: t.title_name,
          document_count: t.document_count,
          chapter_count: t.chapter_count,
        })),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
    }),
  );
}
