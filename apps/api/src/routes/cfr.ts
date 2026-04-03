import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import type { DocumentRow } from "@lexbuild/core";
import { documentResponseSchema, documentQuerySchema } from "../schemas/documents.js";
import { errorResponseSchema } from "../schemas/errors.js";
import { URL_TO_DB_SOURCE } from "../lib/source-registry.js";
import { resolveIdentifier, renderDocumentResponse } from "../lib/documents.js";
import { cacheHeaders } from "../middleware/cache-headers.js";

const getDocumentRoute = createRoute({
  method: "get",
  path: "/cfr/documents/{identifier}",
  tags: ["Code of Federal Regulations"],
  summary: "Get a CFR section",
  description:
    "Retrieve a single Code of Federal Regulations section by its canonical identifier. " +
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

/** Register Code of Federal Regulations document endpoints. */
export function registerCfrRoutes(app: OpenAPIHono, db: Database.Database): void {
  // URL uses /cfr/ but database stores source as "ecfr"
  const dbSource = URL_TO_DB_SOURCE["cfr"];
  const findByIdentifier = db.prepare("SELECT * FROM documents WHERE identifier = ? AND source = ?");

  // eCFR updates daily but individual sections change less often
  app.use("/cfr/*", cacheHeaders({ maxAge: 3600, sMaxAge: 43200, staleWhileRevalidate: 604800 }));

  app.openapi(getDocumentRoute, (c) => {
    const rawIdentifier = c.req.param("identifier");
    const identifier = resolveIdentifier("cfr", rawIdentifier);

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
