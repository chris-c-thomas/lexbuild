/** lexbuild api-key — Manage API keys for the LexBuild Data API */

import { Command } from "commander";
import Database from "better-sqlite3";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import chalk from "chalk";
import { summaryBlock, dataTable, success, error as errorMsg } from "../ui.js";

// PBKDF2 configuration — must match apps/api/src/db/keys.ts
const API_KEY_PBKDF2_ITERATIONS = 100_000;
const API_KEY_PBKDF2_KEYLEN = 32;
const API_KEY_PBKDF2_DIGEST = "sha256";
const API_KEY_PBKDF2_SALT = "lxb_api_key_pbkdf2_salt_v1";

function deriveApiKeyHash(key: string): string {
  return pbkdf2Sync(
    key,
    API_KEY_PBKDF2_SALT,
    API_KEY_PBKDF2_ITERATIONS,
    API_KEY_PBKDF2_KEYLEN,
    API_KEY_PBKDF2_DIGEST,
  ).toString("hex");
}

/** Default rate limits per tier. */
const TIER_DEFAULTS: Record<string, { rate_limit: number; rate_window: number }> = {
  standard: { rate_limit: 1000, rate_window: 60 },
  elevated: { rate_limit: 5000, rate_window: 60 },
  unlimited: { rate_limit: 0, rate_window: 0 },
};

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

function openKeysDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(API_KEYS_TABLE_SQL);
  return db;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "never";
  const ms = Date.now() - new Date(isoDate + "Z").getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export const apiKeyCommand = new Command("api-key").description("Manage API keys for the LexBuild Data API");

// ----- create -----

apiKeyCommand
  .command("create")
  .description("Create a new API key")
  .requiredOption("--label <label>", "Human-readable label for the key")
  .option("--tier <tier>", "Rate limit tier (standard, elevated, unlimited)", "standard")
  .option("--rate-limit <n>", "Custom rate limit (requests per window)", parseInt)
  .option("--expires <date>", "Expiration date (ISO format, e.g., 2027-01-01)")
  .option("--db <path>", "Keys database path", "./lexbuild-keys.db")
  .action((options: { label: string; tier: string; rateLimit?: number; expires?: string; db: string }) => {
    const validTiers = ["standard", "elevated", "unlimited"];
    if (!validTiers.includes(options.tier)) {
      errorMsg(`Invalid tier "${options.tier}". Must be one of: ${validTiers.join(", ")}`);
      process.exit(1);
    }

    const tierDefaults = TIER_DEFAULTS[options.tier] ?? { rate_limit: 1000, rate_window: 60 };
    const rateLimit = options.rateLimit ?? tierDefaults.rate_limit;
    const rateWindow = tierDefaults.rate_window;

    const raw = randomBytes(20).toString("hex");
    const key = `lxb_${raw}`;
    const hash = deriveApiKeyHash(key);
    const prefix = key.slice(0, 12);
    const id = randomUUID();

    const db = openKeysDb(options.db);
    db.prepare(
      `INSERT INTO api_keys (id, key_hash, key_prefix, label, tier, rate_limit, rate_window, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, hash, prefix, options.label, options.tier, rateLimit, rateWindow, options.expires ?? null);
    db.close();

    const limitDisplay = options.tier === "unlimited" ? "unlimited" : `${formatNumber(rateLimit)} req/min`;

    console.log(
      summaryBlock({
        title: "API Key Created",
        rows: [
          ["Key", key],
          ["Label", options.label],
          ["Tier", options.tier],
          ["Limit", limitDisplay],
          ["Expires", options.expires ?? "never"],
        ],
      }),
    );
    console.log(chalk.yellow("  \u26A0  Save this key now. It cannot be retrieved later.\n"));
  });

// ----- list -----

apiKeyCommand
  .command("list")
  .description("List all API keys")
  .option("--db <path>", "Keys database path", "./lexbuild-keys.db")
  .option("--include-revoked", "Include revoked keys")
  .action((options: { db: string; includeRevoked?: boolean }) => {
    const db = openKeysDb(options.db);

    const whereClause = options.includeRevoked ? "" : "WHERE revoked_at IS NULL";
    const rows = db
      .prepare(
        `SELECT key_prefix, label, tier, total_requests, last_used, revoked_at, expires_at
         FROM api_keys ${whereClause} ORDER BY created_at DESC`,
      )
      .all() as Array<{
      key_prefix: string;
      label: string;
      tier: string;
      total_requests: number;
      last_used: string | null;
      revoked_at: string | null;
      expires_at: string | null;
    }>;

    db.close();

    if (rows.length === 0) {
      console.log(chalk.dim("  No API keys found."));
      return;
    }

    const tableRows = rows.map((r) => {
      let status = chalk.green("active");
      if (r.revoked_at) status = chalk.red("revoked");
      else if (r.expires_at && new Date(r.expires_at + "Z") < new Date()) status = chalk.yellow("expired");

      return [r.key_prefix, r.label, r.tier, formatNumber(r.total_requests), timeAgo(r.last_used), status];
    });

    console.log(dataTable(["Prefix", "Label", "Tier", "Requests", "Last Used", "Status"], tableRows));
  });

// ----- revoke -----

apiKeyCommand
  .command("revoke")
  .description("Revoke an API key")
  .requiredOption("--prefix <prefix>", "Key prefix (e.g., lxb_a1b2c3d4)")
  .option("--db <path>", "Keys database path", "./lexbuild-keys.db")
  .action((options: { prefix: string; db: string }) => {
    const db = openKeysDb(options.db);

    const result = db
      .prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE key_prefix = ? AND revoked_at IS NULL")
      .run(options.prefix);

    db.close();

    if (result.changes === 0) {
      errorMsg(`No active key found with prefix "${options.prefix}"`);
      process.exit(1);
    }

    success(`Key ${options.prefix} revoked`);
  });

// ----- update -----

apiKeyCommand
  .command("update")
  .description("Update an API key's tier or rate limit")
  .requiredOption("--prefix <prefix>", "Key prefix (e.g., lxb_a1b2c3d4)")
  .option("--tier <tier>", "New rate limit tier")
  .option("--rate-limit <n>", "New rate limit (requests per window)", parseInt)
  .option("--db <path>", "Keys database path", "./lexbuild-keys.db")
  .action((options: { prefix: string; tier?: string; rateLimit?: number; db: string }) => {
    if (!options.tier && options.rateLimit === undefined) {
      errorMsg("Provide --tier and/or --rate-limit to update");
      process.exit(1);
    }

    const db = openKeysDb(options.db);
    const updates: string[] = [];
    const params: unknown[] = [];

    if (options.tier) {
      const validTiers = ["standard", "elevated", "unlimited"];
      if (!validTiers.includes(options.tier)) {
        errorMsg(`Invalid tier "${options.tier}". Must be one of: ${validTiers.join(", ")}`);
        db.close();
        process.exit(1);
      }
      updates.push("tier = ?");
      params.push(options.tier);

      // Also update rate limit to tier default unless explicitly overridden
      if (options.rateLimit === undefined) {
        const tierDefaults = TIER_DEFAULTS[options.tier] ?? { rate_limit: 1000, rate_window: 60 };
        updates.push("rate_limit = ?");
        params.push(tierDefaults.rate_limit);
      }
    }

    if (options.rateLimit !== undefined) {
      updates.push("rate_limit = ?");
      params.push(options.rateLimit);
    }

    params.push(options.prefix);
    const result = db
      .prepare(`UPDATE api_keys SET ${updates.join(", ")} WHERE key_prefix = ? AND revoked_at IS NULL`)
      .run(...params);

    db.close();

    if (result.changes === 0) {
      errorMsg(`No active key found with prefix "${options.prefix}"`);
      process.exit(1);
    }

    success(`Key ${options.prefix} updated`);
  });
