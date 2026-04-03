/**
 * Shared API key schema and hashing utilities.
 *
 * Used by both the CLI (key creation) and the Data API (key validation).
 * This module does NOT depend on any SQLite driver.
 */

import { pbkdf2Sync } from "node:crypto";

const API_KEY_PBKDF2_ITERATIONS = 100_000;
const API_KEY_PBKDF2_KEYLEN = 32;
const API_KEY_PBKDF2_DIGEST = "sha256";
// Not a secret — fixed application-level salt for deterministic key derivation
const API_KEY_PBKDF2_SALT = "lexbuild-api-key-derivation-v1";

/** Rate limit tier for API keys. */
export type Tier = "standard" | "elevated" | "unlimited";

/** Derive a PBKDF2 hash from an API key. Synchronous for use in the request-path hot loop. */
export function deriveApiKeyHash(key: string): string {
  const derived = pbkdf2Sync(
    key,
    API_KEY_PBKDF2_SALT,
    API_KEY_PBKDF2_ITERATIONS,
    API_KEY_PBKDF2_KEYLEN,
    API_KEY_PBKDF2_DIGEST,
  );
  return derived.toString("hex");
}

export const TIER_DEFAULTS: Record<Tier, { rate_limit: number; rate_window: number }> = {
  standard: { rate_limit: 1000, rate_window: 60 },
  elevated: { rate_limit: 5000, rate_window: 60 },
  unlimited: { rate_limit: 0, rate_window: 0 },
};

/** SQL to create the api_keys table and indexes. */
export const API_KEYS_TABLE_SQL = `
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
