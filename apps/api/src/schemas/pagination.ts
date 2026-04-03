import { z } from "@hono/zod-openapi";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    description: "Number of results to return (1-100)",
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of results to skip",
  }),
  cursor: z.string().optional().openapi({
    description: "Cursor for keyset pagination (alternative to offset). Value is the last document's sort key.",
  }),
});

export const collectionResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      identifier: z.string(),
      source: z.string(),
      metadata: z.record(z.unknown()),
    }),
  ),
  meta: z.object({
    api_version: z.string(),
    format_version: z.string(),
    timestamp: z.string(),
  }),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
    next: z.string().nullable(),
  }),
});
