import { z } from "@hono/zod-openapi";

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500).openapi({
    description: "Search query text",
    example: "environmental protection",
  }),
  source: z.enum(["usc", "ecfr", "fr"]).optional().openapi({
    description: "Filter results to a specific source",
  }),
  title_number: z.coerce.number().int().optional(),
  document_type: z.enum(["rule", "proposed_rule", "notice", "presidential_document"]).optional(),
  agency: z.string().optional(),
  status: z.string().optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional()
    .openapi({ description: "Publication date range start (YYYY-MM-DD, FR only)" }),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional()
    .openapi({ description: "Publication date range end (YYYY-MM-DD, FR only)" }),
  sort: z.string().optional().openapi({
    description:
      "Sort field. Options: relevance (default), publication_date, -publication_date, title_number, identifier",
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  facets: z.string().optional().openapi({
    description:
      "Comma-separated list of facets to include in response. Options: source, title_number, document_type, agency, status, publication_date",
  }),
  highlight: z.coerce.boolean().optional().default(true).openapi({
    description: "Include highlighted snippets in results",
  }),
});

export const searchResultSchema = z.object({
  data: z.object({
    hits: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        identifier: z.string(),
        heading: z.string(),
        title_number: z.number().nullable(),
        title_name: z.string().nullable(),
        status: z.string(),
        url: z.string(),
        document_type: z.string().optional(),
        publication_date: z.string().optional(),
        hierarchy: z.array(z.string()),
        highlights: z
          .object({
            heading: z.string().optional(),
            identifier: z.string().optional(),
            body: z.string().optional(),
          })
          .optional(),
      }),
    ),
    query: z.string(),
    processing_time_ms: z.number(),
    estimated_total_hits: z.number(),
  }),
  facets: z.record(z.string(), z.record(z.string(), z.number())).optional().openapi({
    description: "Facet distribution counts. Keys are facet names, values are maps of facet value to count.",
  }),
  meta: z.object({
    api_version: z.string(),
    timestamp: z.string(),
  }),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
  }),
});
