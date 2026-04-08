import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import type { DocumentRow } from "@lexbuild/core";
import { documentResponseSchema, documentQuerySchema } from "../schemas/documents.js";
import { collectionResponseSchema } from "../schemas/pagination.js";
import { ecfrFilterSchema } from "../schemas/filters.js";
import { errorResponseSchema } from "../schemas/errors.js";
import { URL_TO_DB_SOURCE } from "../lib/source-registry.js";
import { resolveIdentifier, renderDocumentResponse } from "../lib/documents.js";
import { buildListingResponse } from "../lib/listings.js";
import { queryDocuments } from "../db/queries.js";
import { cacheHeaders } from "../middleware/cache-headers.js";

const listDocumentsRoute = createRoute({
  method: "get",
  path: "/ecfr/documents",
  tags: ["eCFR"],
  summary: "List Sections",
  description: "Paginated listing of eCFR sections with filtering and sorting.",
  request: { query: ecfrFilterSchema },
  responses: {
    200: {
      content: { "application/json": { schema: collectionResponseSchema } },
      description: "Paginated document list",
    },
  },
});

const getDocumentRoute = createRoute({
  method: "get",
  path: "/ecfr/documents/{identifier}",
  tags: ["eCFR"],
  summary: "Get Section",
  description:
    "Retrieve a single eCFR section by its canonical identifier. " +
    "Supports shorthand (t17/s240.10b-5) or full form (%2Fus%2Fcfr%2Ft17%2Fs240.10b-5).",
  request: {
    params: z.object({
      identifier: z.string().openapi({
        description: "Canonical identifier (e.g., t17/s240.10b-5 or URL-encoded /us/cfr/t17/s240.10b-5)",
        example: "t17/s240.10b-5",
      }),
    }),
    query: documentQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: documentResponseSchema },
        "text/markdown": { schema: z.string() },
        "text/plain": { schema: z.string() },
      },
      description: "Document found",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Document not found",
    },
  },
});

/** Register eCFR document endpoints. */
export function registerEcfrRoutes(app: OpenAPIHono, db: Database.Database): void {
  const dbSource = URL_TO_DB_SOURCE["ecfr"] ?? "ecfr";
  const findByIdentifier = db.prepare("SELECT * FROM documents WHERE identifier = ? AND source = ?");

  // eCFR updates daily but individual sections change less often
  app.use("/ecfr/*", cacheHeaders({ maxAge: 3600, sMaxAge: 43200, staleWhileRevalidate: 604800 }));

  app.openapi(listDocumentsRoute, (c) => {
    const { limit, offset, cursor, sort = "identifier", fields, ...filters } = c.req.valid("query");
    const result = queryDocuments(db, {
      source: dbSource,
      filters,
      sort: sort ?? "identifier",
      limit,
      offset,
      cursor,
    });
    return c.json(buildListingResponse(result, "/api/ecfr/documents", { ...filters, sort, fields }));
  });

  app.openapi(getDocumentRoute, (c) => {
    const rawIdentifier = c.req.param("identifier");
    const identifier = resolveIdentifier("ecfr", rawIdentifier);

    const row = findByIdentifier.get(identifier, dbSource) as DocumentRow | undefined;
    if (!row) {
      return c.json(
        {
          error: {
            status: 404,
            code: "DOCUMENT_NOT_FOUND",
            message: `No document found with identifier ${identifier}`,
          },
        },
        404,
      );
    }

    return renderDocumentResponse(c, row);
  });
}
