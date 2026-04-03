import { Command } from "commander";
import Database from "better-sqlite3";
import { randomBytes, randomUUID } from "node:crypto";
import chalk from "chalk";
import { deriveApiKeyHash, TIER_DEFAULTS, API_KEYS_TABLE_SQL } from "@lexbuild/core";
import { summaryBlock, dataTable, success, error as errorMsg } from "../ui.js";

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

    const tierDefaults = TIER_DEFAULTS[options.tier as keyof typeof TIER_DEFAULTS] ?? {
      rate_limit: 1000,
      rate_window: 60,
    };
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
        const tierDefaults = TIER_DEFAULTS[options.tier as keyof typeof TIER_DEFAULTS] ?? {
          rate_limit: 1000,
          rate_window: 60,
        };
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
