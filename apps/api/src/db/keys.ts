import Database from "better-sqlite3";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

// PBKDF2 configuration for API key hashing
const API_KEY_PBKDF2_ITERATIONS = 100_000;
const API_KEY_PBKDF2_KEYLEN = 32; // 256-bit output
const API_KEY_PBKDF2_DIGEST = "sha256";
const API_KEY_PBKDF2_SALT = "lxb_api_key_pbkdf2_salt_v1";

/** SQL to create the api_keys table. */
const API_KEYS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      TEXT NOT NULL,
  label           TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'standard',
  rate_limit      INTEGER NOT NULL DEFAULT 1000,
  rate_window     INTEGER NOT NULL DEFAULT 60,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,
  revoked_at      TEXT,
  last_used       TEXT,
  total_requests  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_keys_prefix ON api_keys(key_prefix);
`;

let _keysDb: Database.Database | null = null;

/** Open (or return existing) keys database connection. Auto-creates schema. */
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

/** Derive a PBKDF2 hash from an API key. Synchronous for use in request-path validation. */
function deriveApiKeyHash(key: string): string {
  const derived = pbkdf2Sync(
    key,
    API_KEY_PBKDF2_SALT,
    API_KEY_PBKDF2_ITERATIONS,
    API_KEY_PBKDF2_KEYLEN,
    API_KEY_PBKDF2_DIGEST,
  );
  return derived.toString("hex");
}

/** Generate a new API key. Returns the plaintext key (shown once), its hash, and prefix. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(20).toString("hex"); // 40 hex chars
  const key = `lxb_${raw}`;
  const hash = deriveApiKeyHash(key);
  const prefix = key.slice(0, 12); // "lxb_a1b2c3d4"
  return { key, hash, prefix };
}

/** Hash an API key for lookup. */
export function hashApiKey(key: string): string {
  return deriveApiKeyHash(key);
}

/** Data returned when validating an API key. */
export interface ApiKeyData {
  id: string;
  tier: string;
  rate_limit: number;
  rate_window: number;
}

/** Validate an API key against the database. Returns key data or null if invalid/expired/revoked. */
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

/** Increment request count and update last_used timestamp for a key. */
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

/** Default rate limits per tier. */
export const TIER_DEFAULTS: Record<string, { rate_limit: number; rate_window: number }> = {
  standard: { rate_limit: 1000, rate_window: 60 },
  elevated: { rate_limit: 5000, rate_window: 60 },
  unlimited: { rate_limit: 0, rate_window: 0 },
};

/** Insert a new API key into the database. Returns the generated UUID. */
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
