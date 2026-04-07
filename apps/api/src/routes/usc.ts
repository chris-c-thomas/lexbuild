import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import type { DocumentRow } from "@lexbuild/core";
import { documentResponseSchema, documentQuerySchema } from "../schemas/documents.js";
import { collectionResponseSchema } from "../schemas/pagination.js";
import { uscFilterSchema } from "../schemas/filters.js";
import { errorResponseSchema } from "../schemas/errors.js";
import { URL_TO_DB_SOURCE } from "../lib/source-registry.js";
import { resolveIdentifier, renderDocumentResponse } from "../lib/documents.js";
import { buildListingResponse } from "../lib/listings.js";
import { queryDocuments } from "../db/queries.js";
import { cacheHeaders } from "../middleware/cache-headers.js";

const listDocumentsRoute = createRoute({
  method: "get",
  path: "/usc/documents",
  tags: ["U.S. Code"],
  summary: "List Sections",
  description: "Paginated listing of USC sections with filtering and sorting.",
  request: { query: uscFilterSchema },
  responses: {
    200: {
      content: { "application/json": { schema: collectionResponseSchema } },
      description: "Paginated document list",
    },
  },
});

const getDocumentRoute = createRoute({
  method: "get",
  path: "/usc/documents/{identifier}",
  tags: ["U.S. Code"],
  summary: "Get Section",
  description:
    "Retrieve a single U.S. Code section by its canonical identifier. " +
    "Supports shorthand (t1/s1) or full form (%2Fus%2Fusc%2Ft1%2Fs1).",
  request: {
    params: z.object({
      identifier: z.string().openapi({
        description: "Canonical identifier (e.g., t1/s1 or URL-encoded /us/usc/t1/s1)",
        example: "t1/s1",
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

/** Register U.S. Code document endpoints. */
export function registerUscRoutes(app: OpenAPIHono, db: Database.Database): void {
  const dbSource = URL_TO_DB_SOURCE["usc"] ?? "usc";
  const findByIdentifier = db.prepare("SELECT * FROM documents WHERE identifier = ? AND source = ?");

  // USC content updates irregularly per release point
  app.use("/usc/*", cacheHeaders({ maxAge: 3600, sMaxAge: 86400, staleWhileRevalidate: 604800 }));

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
    return c.json(buildListingResponse(result, "/api/usc/documents", { ...filters, sort, fields }));
  });

  app.openapi(getDocumentRoute, (c) => {
    const rawIdentifier = c.req.param("identifier");
    const identifier = resolveIdentifier("usc", rawIdentifier);

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
