import Database from "better-sqlite3";
import { randomBytes, randomUUID } from "node:crypto";
import { deriveApiKeyHash, API_KEYS_TABLE_SQL } from "@lexbuild/core";
import type { Tier } from "@lexbuild/core";

export type { Tier } from "@lexbuild/core";
export { TIER_DEFAULTS } from "@lexbuild/core";

let _keysDb: Database.Database | null = null;

/** Open (or return existing) keys database connection. Auto-creates schema on first use. */
export function initKeysDatabase(dbPath: string): Database.Database {
  if (_keysDb) return _keysDb;

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(API_KEYS_TABLE_SQL);

  _keysDb = db;
  return db;
}

/** Close the keys database connection. */
export function closeKeysDatabase(): void {
  if (_keysDb) {
    _keysDb.close();
    _keysDb = null;
  }
}

/** Generate a new API key. The plaintext key is returned once and never stored. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(20).toString("hex");
  const key = `lxb_${raw}`;
  const hash = deriveApiKeyHash(key);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

/** Hash an API key for database lookup. */
export function hashApiKey(key: string): string {
  return deriveApiKeyHash(key);
}

/** Data returned when validating an API key. */
export interface ApiKeyData {
  id: string;
  tier: Tier;
  rate_limit: number;
  rate_window: number;
}

/**
 * Validate an API key against the database.
 * @returns Key data if valid and active, null if invalid/expired/revoked.
 */
export function validateApiKey(keysDb: Database.Database, key: string): ApiKeyData | null {
  const hash = hashApiKey(key);

  const row = keysDb
    .prepare(
      `SELECT id, tier, rate_limit, rate_window FROM api_keys
       WHERE key_hash = ? AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    )
    .get(hash) as ApiKeyData | undefined;

  return row ?? null;
}

/** Increment request count and update last_used timestamp. */
export function trackUsage(keysDb: Database.Database, keyId: string): void {
  keysDb
    .prepare(
      `UPDATE api_keys SET
         total_requests = total_requests + 1,
         last_used = datetime('now')
       WHERE id = ?`,
    )
    .run(keyId);
}

/** Insert a new API key record. Returns the generated UUID. */
export function createApiKeyRecord(
  keysDb: Database.Database,
  options: {
    hash: string;
    prefix: string;
    label: string;
    tier: string;
    rateLimit: number;
    rateWindow: number;
    expiresAt?: string | undefined;
  },
): string {
  const id = randomUUID();
  keysDb
    .prepare(
      `INSERT INTO api_keys (id, key_hash, key_prefix, label, tier, rate_limit, rate_window, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      options.hash,
      options.prefix,
      options.label,
      options.tier,
      options.rateLimit,
      options.rateWindow,
      options.expiresAt ?? null,
    );
  return id;
}
