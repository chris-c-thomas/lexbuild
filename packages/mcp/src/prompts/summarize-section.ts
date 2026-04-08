/**
 * summarize_section prompt — plain-language summary of a legal section.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { wrapUntrustedContent } from "../tools/sanitize.js";
import { McpServerError } from "../server/errors.js";

const ArgsSchema = {
  source: z.enum(["usc", "cfr", "fr"]).describe("Legal source."),
  identifier: z.string().min(1).describe("Section identifier or FR document number."),
  audience: z
    .enum(["general", "legal", "technical"])
    .default("general")
    .describe("Target audience for the summary."),
};

const AUDIENCE_INSTRUCTIONS: Record<string, string> = {
  general:
    "Write for a general audience with no legal background. Avoid jargon. Explain legal terms in plain English.",
  legal:
    "Write for a legal professional. Use standard legal terminology. Focus on operative provisions and exceptions.",
  technical:
    "Write for a technical/compliance audience. Focus on specific requirements, deadlines, and actionable obligations.",
};

/** Registers the summarize_section prompt. */
export function registerSummarizeSectionPrompt(server: McpServer, deps: ServerDeps): void {
  server.registerPrompt(
    "summarize_section",
    {
      title: "Summarize Legal Section",
      description:
        "Generate a plain-language summary of a legal section with key definitions and provisions.",
      argsSchema: ArgsSchema,
    },
    async (args) => {
      try {
        deps.logger.debug("summarize_section prompt invoked", {
          source: args.source,
          identifier: args.identifier,
        });

        const doc = await deps.api.getDocument(args.source, args.identifier);
        const body = doc.data.body ?? "";
        const instruction = AUDIENCE_INSTRUCTIONS[args.audience] ?? AUDIENCE_INSTRUCTIONS["general"];

        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  `Provide a clear, accurate summary of the following legal section.\n\n` +
                  `${instruction}\n\n` +
                  `Include:\n` +
                  `- A one-paragraph overview\n` +
                  `- Key definitions (if any)\n` +
                  `- Main provisions or requirements\n` +
                  `- Notable exceptions or limitations\n\n` +
                  `Section identifier: ${doc.data.identifier}\n` +
                  `Metadata: ${JSON.stringify(doc.data.metadata, null, 2)}\n\n` +
                  `Full text:\n${wrapUntrustedContent(body)}`,
              },
            },
          ],
        };
      } catch (err) {
        deps.logger.error("summarize_section prompt failed", {
          source: args.source,
          identifier: args.identifier,
          error: err instanceof Error ? err.message : String(err),
        });
        if (err instanceof McpServerError) throw err;
        throw new McpServerError("internal_error", "Unexpected error in summarize_section", {
          cause: err,
        });
      }
    },
  );
}
