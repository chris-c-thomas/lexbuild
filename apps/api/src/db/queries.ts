import type Database from "better-sqlite3";

/** Options for building a filtered, sorted, paginated query. */
export interface QueryOptions {
  source: string;
  filters: Record<string, unknown>;
  sort: string;
  limit: number;
  offset: number;
  cursor?: string | undefined;
}

/** Result from a paginated query. */
export interface QueryResult {
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Columns allowed in WHERE clauses — prevents SQL injection via column names. */
const FILTERABLE_COLUMNS = new Set([
  "title_number",
  "chapter_number",
  "part_number",
  "status",
  "legal_status",
  "positive_law",
  "document_type",
  "agency",
  "publication_date",
  "effective_date",
]);

/** Columns allowed in ORDER BY clauses. */
const SORTABLE_COLUMNS = new Set([
  "identifier",
  "title_number",
  "section_number",
  "last_updated",
  "publication_date",
  "document_number",
]);

/** Default columns returned in listing queries (no body content). */
const LISTING_COLUMNS =
  "id, identifier, source, display_title, title_number, title_name, " +
  "section_number, section_name, chapter_number, chapter_name, " +
  "part_number, part_name, legal_status, positive_law, status, " +
  "currency, last_updated, document_number, document_type, " +
  "publication_date, agency, content_hash, format_version";

/**
 * Parse a sort string (e.g., "-publication_date") into a validated ORDER BY clause.
 * Falls back to "identifier ASC" for invalid sort fields.
 */
function parseSortParam(sort: string): string {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;

  if (!SORTABLE_COLUMNS.has(field)) {
    return "identifier ASC";
  }

  return `${field} ${descending ? "DESC" : "ASC"}`;
}

/**
 * Build and execute a filtered, sorted, paginated query.
 *
 * All filter values are parameterized — no string interpolation into SQL.
 * Column names are validated against allowlists.
 */
export function queryDocuments(db: Database.Database, options: QueryOptions): QueryResult {
  const { source, filters, sort, limit, offset } = options;
  const conditions: string[] = ["source = @source"];
  const params: Record<string, unknown> = { source };

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (key === "date_from") {
      conditions.push("publication_date >= @date_from");
      params.date_from = value;
    } else if (key === "date_to") {
      conditions.push("publication_date <= @date_to");
      params.date_to = value;
    } else if (key === "effective_date_from") {
      conditions.push("effective_date >= @effective_date_from");
      params.effective_date_from = value;
    } else if (key === "effective_date_to") {
      conditions.push("effective_date <= @effective_date_to");
      params.effective_date_to = value;
    } else if (key === "positive_law") {
      conditions.push("positive_law = @positive_law");
      params.positive_law = value ? 1 : 0;
    } else {
      if (!FILTERABLE_COLUMNS.has(key)) continue;
      conditions.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  const whereClause = conditions.join(" AND ");
  const orderClause = parseSortParam(sort);

  // Cursor pagination: skip past the last-seen sort key
  if (options.cursor) {
    const descending = sort.startsWith("-");
    const field = descending ? sort.slice(1) : sort;
    if (SORTABLE_COLUMNS.has(field)) {
      const op = descending ? "<" : ">";
      conditions.push(`${field} ${op} @cursor`);
      params.cursor = options.cursor;
    }
  }

  const cursorWhereClause = conditions.join(" AND ");

  // Total uses base filters, not cursor — cursor only affects the data page
  const countSql = `SELECT count(*) as total FROM documents WHERE ${whereClause}`;
  const { total } = db.prepare(countSql).get(params) as { total: number };

  const useCursor = options.cursor && SORTABLE_COLUMNS.has(sort.startsWith("-") ? sort.slice(1) : sort);
  const dataSql = useCursor
    ? `SELECT ${LISTING_COLUMNS} FROM documents WHERE ${cursorWhereClause} ORDER BY ${orderClause} LIMIT @limit`
    : `SELECT ${LISTING_COLUMNS} FROM documents WHERE ${whereClause} ORDER BY ${orderClause} LIMIT @limit OFFSET @offset`;

  const queryParams = useCursor ? { ...params, limit } : { ...params, limit, offset };

  const rows = db.prepare(dataSql).all(queryParams) as Record<string, unknown>[];

  return {
    rows,
    total,
    limit,
    offset: useCursor ? 0 : offset,
    hasMore: useCursor ? rows.length === limit : offset + rows.length < total,
  };
}
