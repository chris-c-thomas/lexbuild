import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import type { FrMonthAggregate, FrYearAggregate } from "@lexbuild/core";
import { HTTPException } from "hono/http-exception";
import { errorResponseSchema } from "../schemas/errors.js";
import { readApiAggregates } from "../lib/api-aggregates.js";
import { toDbSource } from "../lib/source-registry.js";
import { memoizeForTtl } from "../lib/ttl-cache.js";

const FR_HIERARCHY_CACHE_TTL_MS = 300_000;

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

function createTitleRoutes(tag: string, urlPrefix: string) {
  const listTitlesRoute = createRoute({
    method: "get",
    path: `/${urlPrefix}/titles`,
    tags: [tag],
    summary: "List Titles",
    description: `Returns all ${tag} titles with document and chapter counts.`,
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
    summary: "Get Title",
    description: `Returns title metadata and chapter listing for the specified title.`,
    request: {
      params: z.object({
        number: z.coerce.number().int().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: titleDetailResponseSchema } },
        description: "Title metadata with chapters",
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
  const dbSource = toDbSource("usc");
  const { listTitlesRoute, getTitleRoute } = createTitleRoutes("U.S. Code", "usc");

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

/** Register eCFR hierarchy browsing endpoints. */
export function registerEcfrHierarchyRoutes(app: OpenAPIHono, db: Database.Database): void {
  const dbSource = toDbSource("ecfr");
  const { listTitlesRoute, getTitleRoute } = createTitleRoutes("eCFR", "ecfr");

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
          url: `/api/ecfr/titles/${r.title_number}`,
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
      throw new HTTPException(404, { message: `No eCFR title ${titleNumber} found` });
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
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
    next: z.string().nullable(),
  }),
});

const listYearsRoute = createRoute({
  method: "get",
  path: "/fr/years",
  tags: ["Federal Register"],
  summary: "List Years",
  description: "Returns all Federal Register publication years with document counts.",
  responses: {
    200: {
      content: { "application/json": { schema: yearsResponseSchema } },
      description: "Yearly Listing",
    },
  },
});

const getYearRoute = createRoute({
  method: "get",
  path: "/fr/years/{year}",
  tags: ["Federal Register"],
  summary: "Get Year",
  description: "Returns monthly breakdown for the specified year.",
  request: {
    params: z.object({ year: z.coerce.number().int().openapi({ example: 2026 }) }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: yearDetailResponseSchema } },
      description: "Yearly metadata per month",
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
  summary: "Get Month",
  description:
    "Returns a paginated list of Federal Register documents published in the specified month. " +
    "The document_count field reflects the total for the month, not the number returned in this page.",
  request: {
    params: z.object({
      year: z.coerce.number().int().openapi({ example: 2026 }),
      month: z.coerce.number().int().min(1).max(12).openapi({ example: 3 }),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100).openapi({
        description: "Number of documents to return (1-500)",
      }),
      offset: z.coerce.number().int().min(0).default(0).openapi({
        description: "Number of documents to skip",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: monthDetailResponseSchema } },
      description: "Monthly Listing",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "No documents found for this month",
    },
  },
});

function buildFrYearStart(year: number): string {
  return `${year}-01-01`;
}

function buildFrMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function buildFrNextYearStart(year: number): string {
  return `${year + 1}-01-01`;
}

function buildFrNextMonthStart(year: number, month: number): string {
  if (month === 12) {
    return buildFrYearStart(year + 1);
  }

  return buildFrMonthStart(year, month + 1);
}

/** Register Federal Register hierarchy browsing endpoints. */
export function registerFrHierarchyRoutes(app: OpenAPIHono, db: Database.Database): void {
  const getApiAggregates = memoizeForTtl(FR_HIERARCHY_CACHE_TTL_MS, () => readApiAggregates(db));
  const frDateRange = db.prepare(
    "SELECT min(publication_date) as earliest, max(publication_date) as latest " +
      "FROM documents WHERE source = 'fr' AND publication_date IS NOT NULL",
  );

  const yearCount = db.prepare(
    "SELECT count(*) as total FROM documents " +
      "WHERE source = 'fr' AND publication_date >= ? AND publication_date < ?",
  );

  const yearTotal = db.prepare(
    "SELECT count(*) as total FROM documents " +
      "WHERE source = 'fr' AND publication_date >= ? AND publication_date < ?",
  );

  const monthDocumentsPaged = db.prepare(
    "SELECT id, identifier, document_number, display_title, document_type, publication_date, agency " +
      "FROM documents WHERE source = 'fr' AND publication_date >= ? AND publication_date < ? " +
      "ORDER BY publication_date ASC, document_number ASC LIMIT ? OFFSET ?",
  );

  const monthTotal = db.prepare(
    "SELECT count(*) as total FROM documents " +
      "WHERE source = 'fr' AND publication_date >= ? AND publication_date < ?",
  );

  app.openapi(getMonthRoute, (c) => {
    const { year, month } = c.req.valid("param");
    const { limit, offset } = c.req.valid("query");
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const monthStart = buildFrMonthStart(year, month);
    const nextMonthStart = buildFrNextMonthStart(year, month);
    const aggregates = getApiAggregates();
    const totalFromSummary = aggregates?.sources.fr.years
      .find((entry: FrYearAggregate) => entry.year === year)
      ?.months.find((entry: FrMonthAggregate) => entry.month === month)?.document_count;

    const total = totalFromSummary ?? (monthTotal.get(monthStart, nextMonthStart) as { total: number }).total;
    if (total === 0) {
      throw new HTTPException(404, { message: `No FR documents found for ${monthStr}` });
    }

    const docs = monthDocumentsPaged.all(monthStart, nextMonthStart, limit, offset) as Array<{
      id: string;
      identifier: string;
      document_number: string | null;
      display_title: string;
      document_type: string | null;
      publication_date: string | null;
      agency: string | null;
    }>;

    return c.json(
      {
        data: {
          year,
          month,
          document_count: total,
          documents: docs,
        },
        meta: { api_version: "v1", timestamp: new Date().toISOString() },
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + docs.length < total,
          next:
            offset + docs.length < total
              ? `/api/fr/years/${year}/${String(month).padStart(2, "0")}?limit=${limit}&offset=${offset + docs.length}`
              : null,
        },
      },
      200,
    );
  });

  app.openapi(getYearRoute, (c) => {
    const year = c.req.valid("param").year;
    const yearStart = buildFrYearStart(year);
    const nextYearStart = buildFrNextYearStart(year);

    const aggregates = getApiAggregates();
    const yearSummary = aggregates?.sources.fr.years.find((entry: FrYearAggregate) => entry.year === year);
    const total = yearSummary?.document_count ?? (yearTotal.get(yearStart, nextYearStart) as { total: number }).total;
    if (total === 0) {
      throw new HTTPException(404, { message: `No FR documents found for year ${year}` });
    }

    const months: Array<{ month: number; document_count: number }> =
      yearSummary?.months ??
      (() => {
        const fallbackMonths: Array<{ month: number; document_count: number }> = [];
        for (let month = 1; month <= 12; month++) {
          const monthStart = buildFrMonthStart(year, month);
          const nextMonthStart = buildFrNextMonthStart(year, month);
          const monthCount = yearCount.get(monthStart, nextMonthStart) as { total: number };

          if (monthCount.total > 0) {
            fallbackMonths.push({ month, document_count: monthCount.total });
          }
        }
        return fallbackMonths;
      })();

    return c.json(
      {
        data: {
          year,
          document_count: total,
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

  app.openapi(listYearsRoute, (c) => {
    const aggregates = getApiAggregates();
    const rows: Array<{ year: number; document_count: number }> =
      aggregates?.sources.fr.years.map((entry: FrYearAggregate) => ({
        year: entry.year,
        document_count: entry.document_count,
      })) ??
      (() => {
        const range = frDateRange.get() as { earliest: string | null; latest: string | null };
        const fallbackRows: Array<{ year: number; document_count: number }> = [];

        if (range.earliest && range.latest) {
          const startYear = Number.parseInt(range.earliest.slice(0, 4), 10);
          const endYear = Number.parseInt(range.latest.slice(0, 4), 10);

          for (let year = endYear; year >= startYear; year--) {
            const yearStart = buildFrYearStart(year);
            const nextYearStart = buildFrNextYearStart(year);
            const total = yearCount.get(yearStart, nextYearStart) as { total: number };

            if (total.total > 0) {
              fallbackRows.push({ year, document_count: total.total });
            }
          }
        }

        return fallbackRows;
      })();

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
}
