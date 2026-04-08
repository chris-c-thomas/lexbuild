/**
 * summarize_section prompt — plain-language summary of a legal section.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { wrapUntrustedContent } from "../tools/sanitize.js";

const ArgsSchema = {
  source: z.enum(["usc", "cfr", "fr"]).describe("Legal source."),
  identifier: z.string().min(1).describe("Section identifier or FR document number."),
  audience: z.enum(["general", "legal", "technical"]).default("general").describe("Target audience for the summary."),
};

/** Registers the summarize_section prompt. */
export function registerSummarizeSectionPrompt(server: McpServer, deps: ServerDeps): void {
  server.registerPrompt(
    "summarize_section",
    {
      title: "Summarize Legal Section",
      description: "Generate a plain-language summary of a legal section with key definitions and provisions.",
      argsSchema: ArgsSchema,
    },
    async (args) => {
      deps.logger.debug("summarize_section prompt invoked", {
        source: args.source,
        identifier: args.identifier,
      });

      const doc = await deps.api.getDocument(args.source, args.identifier);
      const body = doc.data.body ?? "";

      const audienceInstructions: Record<string, string> = {
        general:
          "Write for a general audience with no legal background. Avoid jargon. Explain legal terms in plain English.",
        legal:
          "Write for a legal professional. Use standard legal terminology. Focus on operative provisions and exceptions.",
        technical:
          "Write for a technical/compliance audience. Focus on specific requirements, deadlines, and actionable obligations.",
      };

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Provide a clear, accurate summary of the following legal section.\n\n` +
                `${audienceInstructions[args.audience]}\n\n` +
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
    },
  );
}
