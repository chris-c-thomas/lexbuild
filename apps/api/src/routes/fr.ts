import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import type { DocumentRow } from "@lexbuild/core";
import { documentResponseSchema, documentQuerySchema } from "../schemas/documents.js";
import { collectionResponseSchema } from "../schemas/pagination.js";
import { frFilterSchema } from "../schemas/filters.js";
import { errorResponseSchema } from "../schemas/errors.js";
import { URL_TO_DB_SOURCE } from "../lib/source-registry.js";
import { resolveIdentifier, renderDocumentResponse } from "../lib/documents.js";
import { buildListingResponse } from "../lib/listings.js";
import { queryDocuments } from "../db/queries.js";
import { cacheHeaders } from "../middleware/cache-headers.js";

const listDocumentsRoute = createRoute({
  method: "get",
  path: "/fr/documents",
  tags: ["Federal Register"],
  summary: "List documents",
  description: "Paginated listing of FR documents with filtering and sorting.",
  request: { query: frFilterSchema },
  responses: {
    200: {
      content: { "application/json": { schema: collectionResponseSchema } },
      description: "Paginated document list",
    },
  },
});

const getDocumentRoute = createRoute({
  method: "get",
  path: "/fr/documents/{identifier}",
  tags: ["Federal Register"],
  summary: "Get a document",
  description:
    "Retrieve a single Federal Register document by its document number. " +
    "Supports shorthand (2026-06029) or full form (%2Fus%2Ffr%2F2026-06029).",
  request: {
    params: z.object({
      identifier: z.string().openapi({
        description: "Document number (e.g., 2026-06029 or URL-encoded /us/fr/2026-06029)",
        example: "2026-06029",
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

/** Register Federal Register document endpoints. */
export function registerFrRoutes(app: OpenAPIHono, db: Database.Database): void {
  const dbSource = URL_TO_DB_SOURCE["fr"] ?? "fr";
  const findByIdentifier = db.prepare("SELECT * FROM documents WHERE identifier = ? AND source = ?");

  // Published FR documents never change after publication
  app.use("/fr/*", cacheHeaders({ maxAge: 3600, sMaxAge: 86400, staleWhileRevalidate: 2592000 }));

  app.openapi(listDocumentsRoute, (c) => {
    const { limit, offset, cursor, sort = "-publication_date", fields, ...filters } = c.req.valid("query");
    const result = queryDocuments(db, {
      source: dbSource,
      filters,
      sort: sort ?? "-publication_date",
      limit,
      offset,
      cursor,
    });
    return c.json(buildListingResponse(result, "/api/fr/documents", { ...filters, sort, fields }));
  });

  app.openapi(getDocumentRoute, (c) => {
    const rawIdentifier = c.req.param("identifier");
    const identifier = resolveIdentifier("fr", rawIdentifier);

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
