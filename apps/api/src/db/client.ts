import Database from "better-sqlite3";
import { SCHEMA_VERSION } from "@lexbuild/core";

let _db: Database.Database | null = null;

/**
 * Open (or return existing) read-only database connection.
 * Validates schema version on first connection.
 */
export function createDatabase(dbPath: string): Database.Database {
  if (_db) return _db;

  const db = new Database(dbPath, { readonly: true });

  // Performance pragmas for read-heavy workload
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000"); // 64MB
  db.pragma("mmap_size = 268435456"); // 256MB memory-mapped I/O

  // Validate schema version
  const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  if (!row) {
    throw new Error(`Database at ${dbPath} has no schema_meta table. Run 'lexbuild ingest' first.`);
  }

  const dbVersion = parseInt(row.value, 10);
  if (dbVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Schema version mismatch: database is v${dbVersion}, API expects v${SCHEMA_VERSION}. ` +
        `Re-run 'lexbuild ingest' to update the database.`,
    );
  }

  _db = db;
  return db;
}

/** Close the database connection (for graceful shutdown). */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
