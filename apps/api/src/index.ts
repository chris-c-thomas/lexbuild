import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeDatabase } from "./db/client.js";
import { closeKeysDatabase } from "./db/keys.js";

/** Walk up from the current file to find the monorepo root (contains pnpm-workspace.yaml). */
function findMonorepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

const monorepoRoot = findMonorepoRoot();
const port = parseInt(process.env.API_PORT ?? "4322", 10);
const dbPath = process.env.LEXBUILD_DB_PATH ?? resolve(monorepoRoot, "lexbuild.db");
const keysDbPath = process.env.LEXBUILD_KEYS_DB_PATH ?? resolve(monorepoRoot, "lexbuild-keys.db");
const meiliUrl = process.env.MEILI_URL ?? "http://127.0.0.1:7700";
const meiliKey = process.env.MEILI_SEARCH_KEY ?? process.env.MEILI_MASTER_KEY ?? "";
if (!meiliKey) {
  console.log("No Meilisearch key configured. Search endpoint will return 503.");
}

const app = createApp({ dbPath, keysDbPath, meiliUrl, meiliKey });

console.log(`LexBuild API starting on port ${port}`);
console.log(`  Database: ${dbPath}`);
console.log(`  Keys DB: ${keysDbPath}`);
console.log(`  Meilisearch: ${meiliUrl}`);
console.log(`  OpenAPI spec: http://localhost:${port}/api/openapi.json`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`LexBuild API listening on port ${info.port}`);
});

function shutdown(): void {
  closeDatabase();
  closeKeysDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  shutdown();
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down");
  shutdown();
});
