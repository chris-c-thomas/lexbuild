/**
 * Resilient file system utilities that retry on ENFILE/EMFILE errors.
 *
 * When writing thousands of files in rapid succession, external processes (Spotlight,
 * editor file watchers, cloud sync) may react to newly created files and temporarily
 * exhaust the system-wide file descriptor table. These wrappers catch transient
 * ENFILE (system table full) and EMFILE (per-process table full) errors and retry
 * with exponential backoff.
 */

import { writeFile as fsWriteFile, mkdir as fsMkdir } from "node:fs/promises";

/** Error codes that indicate a transient file descriptor exhaustion. */
const RETRIABLE_CODES = new Set(["ENFILE", "EMFILE"]);

/** Maximum number of retry attempts before giving up. */
const MAX_RETRIES = 10;

/** Initial backoff delay in milliseconds (doubles on each retry). */
const INITIAL_DELAY_MS = 50;

/** Maximum backoff delay in milliseconds. */
const MAX_DELAY_MS = 5000;

/**
 * Check whether an error is a retriable file descriptor exhaustion error.
 */
function isRetriable(err: unknown): boolean {
  if (!(err instanceof Error) || !("code" in err)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return typeof code === "string" && RETRIABLE_CODES.has(code);
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry on ENFILE/EMFILE.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let delay = INITIAL_DELAY_MS;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (!isRetriable(err) || attempt === MAX_RETRIES) {
        throw err;
      }
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error("withRetry: exhausted retries");
}

/**
 * Write a file with retry on ENFILE/EMFILE.
 * Drop-in replacement for `fs/promises.writeFile`.
 */
export async function writeFile(path: string, data: string, encoding: BufferEncoding = "utf-8"): Promise<void> {
  await withRetry(() => fsWriteFile(path, data, encoding));
}

/**
 * Create a directory with retry on ENFILE/EMFILE.
 * Drop-in replacement for `fs/promises.mkdir`.
 */
export async function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined> {
  return await withRetry(() => fsMkdir(path, options));
}
