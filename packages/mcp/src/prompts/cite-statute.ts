/**
 * cite_statute prompt — generates a Bluebook citation for a legal section.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { McpServerError } from "../server/errors.js";

const ArgsSchema = {
  source: z.enum(["usc", "ecfr"]).describe("Legal source: usc (U.S. Code) or ecfr (eCFR / Code of Federal Regulations)."),
  identifier: z.string().min(1).describe("Section identifier. Examples: '/us/usc/t5/s552', 't17/s240.10b-5'."),
};

/** Registers the cite_statute prompt. */
export function registerCiteStatutePrompt(server: McpServer, deps: ServerDeps): void {
  server.registerPrompt(
    "cite_statute",
    {
      title: "Generate Bluebook Citation",
      description: "Generate a properly formatted Bluebook citation for a U.S. Code or CFR section.",
      argsSchema: ArgsSchema,
    },
    async (args) => {
      try {
        deps.logger.debug("cite_statute prompt invoked", {
          source: args.source,
          identifier: args.identifier,
        });

        const doc = await deps.api.getDocument(args.source, args.identifier);
        const meta = doc.data.metadata;

        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  "Generate a properly formatted Bluebook citation for the following legal section. " +
                  "Use the metadata to construct an accurate citation.\n\n" +
                  `Source: ${args.source === "usc" ? "United States Code" : "Code of Federal Regulations"}\n` +
                  `Identifier: ${doc.data.identifier}\n` +
                  `Metadata: ${JSON.stringify(meta, null, 2)}`,
              },
            },
          ],
        };
      } catch (err) {
        deps.logger.error("cite_statute prompt failed", {
          source: args.source,
          identifier: args.identifier,
          error: err instanceof Error ? err.message : String(err),
        });
        if (err instanceof McpServerError) throw err;
        throw new McpServerError("internal_error", "Unexpected error in cite_statute", {
          cause: err,
        });
      }
    },
  );
}
