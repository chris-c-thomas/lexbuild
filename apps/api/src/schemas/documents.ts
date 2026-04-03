import { z } from "@hono/zod-openapi";

/** Full document response (metadata + body) wrapped in standard envelope. */
export const documentResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    identifier: z.string(),
    source: z.string(),
    metadata: z.record(z.unknown()),
    body: z.string().optional(),
  }),
  meta: z.object({
    api_version: z.string(),
    format_version: z.string(),
    timestamp: z.string(),
  }),
});

/** Query parameters for document retrieval. */
export const documentQuerySchema = z.object({
  fields: z
    .string()
    .optional()
    .openapi({
      description:
        "Field selection. Use 'metadata' for metadata only, 'body' for body only, or comma-separated field names.",
      example: "metadata",
    }),
  format: z
    .enum(["json", "markdown", "text"])
    .optional()
    .default("json")
    .openapi({
      description: "Response format override. Alternative to Accept header content negotiation.",
    }),
});
