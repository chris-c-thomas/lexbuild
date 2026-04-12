import type Database from "better-sqlite3";
import { API_AGGREGATES_META_KEY } from "@lexbuild/core";
import type { ApiAggregates } from "@lexbuild/core";

/** Read the precomputed aggregate snapshot from schema_meta when available. */
export function readApiAggregates(db: Database.Database): ApiAggregates | null {
  const row = db.prepare("SELECT value FROM schema_meta WHERE key = ?").get(API_AGGREGATES_META_KEY) as
    | { value: string }
    | undefined;

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.value) as ApiAggregates;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[api-aggregates] Failed to parse aggregate snapshot: ${msg}`);
    return null;
  }
}
