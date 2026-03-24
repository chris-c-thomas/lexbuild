import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const CONTENT_ROOT = resolve(process.env.CONTENT_DIR ?? "./content");

/** Validate path stays within CONTENT_ROOT. Prevents traversal. */
function safePath(subpath: string): string {
  const resolved = resolve(CONTENT_ROOT, subpath);
  const rel = relative(CONTENT_ROOT, resolved);
  if (rel.startsWith("..") || rel.includes("\0")) {
    throw new Error(`Path traversal blocked: ${subpath}`);
  }
  return resolved;
}

/** Read a content file. Returns null if not found. */
export async function getFile(path: string): Promise<string | null> {
  try {
    return await readFile(safePath(path), "utf-8");
  } catch {
    return null;
  }
}
