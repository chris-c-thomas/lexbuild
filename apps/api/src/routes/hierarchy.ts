import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import { HTTPException } from "hono/http-exception";
import { errorResponseSchema } from "../schemas/errors.js";
import { URL_TO_DB_SOURCE } from "../lib/source-registry.js";

const titlesResponseSchema = z.object({
  data: z.array(
    z.object({
      title_number: z.number(),
      title_name: z.string().nullable(),
      document_count: z.number(),
      chapter_count: z.number(),
      positive_law: z.boolean(),
      url: z.string(),
    }),
  ),
  meta: z.object({ api_version: z.string(), timestamp: z.string() }),
});

const titleDetailResponseSchema = z.object({
  data: z.object({
    title_number: z.number(),
    title_name: z.string().nullable(),
    document_count: z.number(),
    positive_law: z.boolean(),
    chapters: z.array(
      z.object({
        chapter_number: z.string().nullable(),
        chapter_name: z.string().nullable(),
        document_count: z.number(),
      }),
    ),
  }),
  meta: z.object({ api_version: z.string(), timestamp: z.string() }),
});

function createTitleRoutes(sourceId: string, tag: string, urlPrefix: string) {
  const listTitlesRoute = createRoute({
    method: "get",
    path: `/${urlPrefix}/titles`,
    tags: [tag],
    summary: "List titles",
    description: `Returns all ${sourceId.toUpperCase()} titles with document and chapter counts.`,
    responses: {
      200: {
        content: { "application/json": { schema: titlesResponseSchema } },
        description: "Title listing",
      },
    },
  });

  const getTitleRoute = createRoute({
    method: "get",
    path: `/${urlPrefix}/titles/{number}`,
    tags: [tag],
    summary: "Get title detail",
    description: `Returns title metadata and chapter listing for the specified title.`,
    request: {
      params: z.object({
        number: z.coerce.number().int().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: titleDetailResponseSchema } },
        description: "Title detail with chapters",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Title not found",
      },
    },
  });

  return { listTitlesRoute, getTitleRoute };
}

/** Register USC hierarchy browsing endpoints. */
export function registerUscHierarchyRoutes(app: OpenAPIHono, db: Database.Database): void {
  const dbSource = URL_TO_DB_SOURCE["usc"];
  const { listTitlesRoute, getTitleRoute } = createTitleRoutes("usc", "U.S. Code", "usc");

  const listTitles = db.prepare(
    "SELECT title_number, title_name, count(*) as document_count, " +
      "count(DISTINCT chapter_number) as chapter_count, max(positive_law) as positive_law " +
      "FROM documents WHERE source = ? AND title_number IS NOT NULL " +
      "GROUP BY title_number, title_name ORDER BY title_number ASC",
  );

  const titleChapters = db.prepare(
    "SELECT chapter_number, chapter_name, count(*) as document_count " +
      "FROM documents WHERE source = ? AND title_number = ? " +
      "GROUP BY chapter_number, chapter_name ORDER BY chapter_number ASC",
  );

  const titleMeta = db.prepare(
    "SELECT title_number, title_name, count(*) as document_count, max(positive_law) as positive_law " +
      "FROM documents WHERE source = ? AND title_number = ? GROUP BY title_number, title_name",
  );

  app.openapi(listTitlesRoute, (c) => {
    const rows = listTitles.all(dbSource) as Array<{
      title_number: number;
      title_name: string | null;
      document_count: number;
      chapter_count: number;
      positive_law: number;
    }>;

    return c.json(
      {
        data: rows.map((r) => ({
          title_number: r.title_number,
          title_name: r.title_name,
          document_count: r.document_count,
          chapter_count: r.chapter_count,
          positive_law: r.positive_law === 1,
          url: `/api/usc/titles/${r.title_number}`,
        })),
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });

  app.openapi(getTitleRoute, (c) => {
    const titleNumber = c.req.valid("param").number;
    const meta = titleMeta.get(dbSource, titleNumber) as
      | { title_number: number; title_name: string | null; document_count: number; positive_law: number }
      | undefined;

    if (!meta) {
      throw new HTTPException(404, { message: `No USC title ${titleNumber} found` });
    }

    const chapters = titleChapters.all(dbSource, titleNumber) as Array<{
      chapter_number: string | null;
      chapter_name: string | null;
      document_count: number;
    }>;

    return c.json(
      {
        data: {
          title_number: meta.title_number,
          title_name: meta.title_name,
          document_count: meta.document_count,
          positive_law: meta.positive_law === 1,
          chapters,
        },
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });
}

/** Register CFR hierarchy browsing endpoints. */
export function registerCfrHierarchyRoutes(app: OpenAPIHono, db: Database.Database): void {
  const dbSource = URL_TO_DB_SOURCE["cfr"];
  const { listTitlesRoute, getTitleRoute } = createTitleRoutes("cfr", "Code of Federal Regulations", "cfr");

  const listTitles = db.prepare(
    "SELECT title_number, title_name, count(*) as document_count, " +
      "count(DISTINCT chapter_number) as chapter_count, max(positive_law) as positive_law " +
      "FROM documents WHERE source = ? AND title_number IS NOT NULL " +
      "GROUP BY title_number, title_name ORDER BY title_number ASC",
  );

  const titleChapters = db.prepare(
    "SELECT chapter_number, chapter_name, count(*) as document_count " +
      "FROM documents WHERE source = ? AND title_number = ? " +
      "GROUP BY chapter_number, chapter_name ORDER BY chapter_number ASC",
  );

  const titleMeta = db.prepare(
    "SELECT title_number, title_name, count(*) as document_count, max(positive_law) as positive_law " +
      "FROM documents WHERE source = ? AND title_number = ? GROUP BY title_number, title_name",
  );

  app.openapi(listTitlesRoute, (c) => {
    const rows = listTitles.all(dbSource) as Array<{
      title_number: number;
      title_name: string | null;
      document_count: number;
      chapter_count: number;
      positive_law: number;
    }>;

    return c.json(
      {
        data: rows.map((r) => ({
          title_number: r.title_number,
          title_name: r.title_name,
          document_count: r.document_count,
          chapter_count: r.chapter_count,
          positive_law: r.positive_law === 1,
          url: `/api/cfr/titles/${r.title_number}`,
        })),
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });

  app.openapi(getTitleRoute, (c) => {
    const titleNumber = c.req.valid("param").number;
    const meta = titleMeta.get(dbSource, titleNumber) as
      | { title_number: number; title_name: string | null; document_count: number; positive_law: number }
      | undefined;

    if (!meta) {
      throw new HTTPException(404, { message: `No CFR title ${titleNumber} found` });
    }

    const chapters = titleChapters.all(dbSource, titleNumber) as Array<{
      chapter_number: string | null;
      chapter_name: string | null;
      document_count: number;
    }>;

    return c.json(
      {
        data: {
          title_number: meta.title_number,
          title_name: meta.title_name,
          document_count: meta.document_count,
          positive_law: meta.positive_law === 1,
          chapters,
        },
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });
}

const yearsResponseSchema = z.object({
  data: z.array(
    z.object({
      year: z.number(),
      document_count: z.number(),
      url: z.string(),
    }),
  ),
  meta: z.object({ api_version: z.string(), timestamp: z.string() }),
});

const yearDetailResponseSchema = z.object({
  data: z.object({
    year: z.number(),
    document_count: z.number(),
    months: z.array(
      z.object({
        month: z.number(),
        document_count: z.number(),
        url: z.string(),
      }),
    ),
  }),
  meta: z.object({ api_version: z.string(), timestamp: z.string() }),
});

const monthDetailResponseSchema = z.object({
  data: z.object({
    year: z.number(),
    month: z.number(),
    document_count: z.number(),
    documents: z.array(
      z.object({
        id: z.string(),
        identifier: z.string(),
        document_number: z.string().nullable(),
        display_title: z.string(),
        document_type: z.string().nullable(),
        publication_date: z.string().nullable(),
        agency: z.string().nullable(),
      }),
    ),
  }),
  meta: z.object({ api_version: z.string(), timestamp: z.string() }),
});

const listYearsRoute = createRoute({
  method: "get",
  path: "/fr/years",
  tags: ["Federal Register"],
  summary: "List years",
  description: "Returns all Federal Register publication years with document counts.",
  responses: {
    200: {
      content: { "application/json": { schema: yearsResponseSchema } },
      description: "Year listing",
    },
  },
});

const getYearRoute = createRoute({
  method: "get",
  path: "/fr/years/{year}",
  tags: ["Federal Register"],
  summary: "Get year detail",
  description: "Returns month breakdown for the specified year.",
  request: {
    params: z.object({ year: z.coerce.number().int().openapi({ example: 2026 }) }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: yearDetailResponseSchema } },
      description: "Year detail with months",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Year not found",
    },
  },
});

const getMonthRoute = createRoute({
  method: "get",
  path: "/fr/years/{year}/{month}",
  tags: ["Federal Register"],
  summary: "Get month documents",
  description: "Returns all Federal Register documents published in the specified month.",
  request: {
    params: z.object({
      year: z.coerce.number().int().openapi({ example: 2026 }),
      month: z.coerce.number().int().min(1).max(12).openapi({ example: 3 }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: monthDetailResponseSchema } },
      description: "Month document listing",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "No documents found for this month",
    },
  },
});

/** Register Federal Register hierarchy browsing endpoints. */
export function registerFrHierarchyRoutes(app: OpenAPIHono, db: Database.Database): void {
  const listYears = db.prepare(
    "SELECT CAST(substr(publication_date, 1, 4) AS INTEGER) as year, count(*) as document_count " +
      "FROM documents WHERE source = 'fr' AND publication_date IS NOT NULL " +
      "GROUP BY substr(publication_date, 1, 4) ORDER BY year DESC",
  );

  const yearMonths = db.prepare(
    "SELECT CAST(substr(publication_date, 6, 2) AS INTEGER) as month, count(*) as document_count " +
      "FROM documents WHERE source = 'fr' AND substr(publication_date, 1, 4) = ? " +
      "GROUP BY substr(publication_date, 6, 2) ORDER BY month ASC",
  );

  const yearTotal = db.prepare(
    "SELECT count(*) as total FROM documents WHERE source = 'fr' AND substr(publication_date, 1, 4) = ?",
  );

  const monthDocuments = db.prepare(
    "SELECT id, identifier, document_number, display_title, document_type, publication_date, agency " +
      "FROM documents WHERE source = 'fr' AND substr(publication_date, 1, 7) = ? " +
      "ORDER BY publication_date ASC, document_number ASC",
  );

  app.openapi(listYearsRoute, (c) => {
    const rows = listYears.all() as Array<{ year: number; document_count: number }>;
    return c.json(
      {
        data: rows.map((r) => ({
          year: r.year,
          document_count: r.document_count,
          url: `/api/fr/years/${r.year}`,
        })),
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });

  app.openapi(getYearRoute, (c) => {
    const year = c.req.valid("param").year;
    const yearStr = String(year);

    const total = yearTotal.get(yearStr) as { total: number };
    if (total.total === 0) {
      throw new HTTPException(404, { message: `No FR documents found for year ${year}` });
    }

    const months = yearMonths.all(yearStr) as Array<{ month: number; document_count: number }>;

    return c.json(
      {
        data: {
          year,
          document_count: total.total,
          months: months.map((m) => ({
            month: m.month,
            document_count: m.document_count,
            url: `/api/fr/years/${year}/${String(m.month).padStart(2, "0")}`,
          })),
        },
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });

  app.openapi(getMonthRoute, (c) => {
    const { year, month } = c.req.valid("param");
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;

    const docs = monthDocuments.all(monthStr) as Array<{
      id: string;
      identifier: string;
      document_number: string | null;
      display_title: string;
      document_type: string | null;
      publication_date: string | null;
      agency: string | null;
    }>;

    if (docs.length === 0) {
      throw new HTTPException(404, { message: `No FR documents found for ${monthStr}` });
    }

    return c.json(
      {
        data: {
          year,
          month,
          document_count: docs.length,
          documents: docs,
        },
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
      },
      200,
    );
  });
}
