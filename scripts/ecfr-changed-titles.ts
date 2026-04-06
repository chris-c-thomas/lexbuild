/**
 * Detect which eCFR titles have changed since the last conversion.
 *
 * Fetches live metadata from the eCFR API and compares `latestAmendedOn`
 * dates against a local checkpoint file. Outputs changed title numbers
 * to stdout for use by update-ecfr.sh.
 *
 * Usage:
 *   npx tsx scripts/ecfr-changed-titles.ts           # Output changed title numbers
 *   npx tsx scripts/ecfr-changed-titles.ts --json     # Output full metadata as JSON
 *   npx tsx scripts/ecfr-changed-titles.ts --save     # Update checkpoint after conversion
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchEcfrTitlesMeta } from "@lexbuild/ecfr";

const CHECKPOINT_PATH = resolve("downloads/ecfr/.ecfr-titles-state.json");

interface TitleState {
  latestAmendedOn: string;
  upToDateAsOf: string;
}

interface Checkpoint {
  lastRun: string;
  titles: Record<string, TitleState>;
}

async function readCheckpoint(): Promise<Checkpoint | null> {
  let raw: string;
  try {
    raw = await readFile(CHECKPOINT_PATH, "utf-8");
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // No checkpoint yet — first run
    }
    throw err;
  }
  try {
    return JSON.parse(raw) as Checkpoint;
  } catch (err) {
    console.error(
      `Warning: Checkpoint file is corrupt (${CHECKPOINT_PATH}). ` +
        `Treating all titles as changed. Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  await writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2) + "\n", "utf-8");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const saveMode = args.includes("--save");
  const jsonMode = args.includes("--json");

  // Fetch live metadata from eCFR API
  const meta = await fetchEcfrTitlesMeta();
  const checkpoint = await readCheckpoint();

  // Build new state from API response
  const newState: Record<string, TitleState> = {};
  for (const title of meta.titles) {
    if (title.reserved) continue;
    newState[String(title.number)] = {
      latestAmendedOn: title.latestAmendedOn,
      upToDateAsOf: title.upToDateAsOf,
    };
  }

  if (saveMode) {
    // Save checkpoint and exit
    const updated: Checkpoint = {
      lastRun: new Date().toISOString(),
      titles: newState,
    };
    await saveCheckpoint(updated);
    console.error(`Checkpoint saved to ${CHECKPOINT_PATH}`);
    return;
  }

  // Compare against checkpoint to find changed titles
  const changedTitles: number[] = [];

  for (const [num, state] of Object.entries(newState)) {
    const stored = checkpoint?.titles[num];
    if (!stored || stored.latestAmendedOn < state.latestAmendedOn) {
      changedTitles.push(parseInt(num, 10));
    }
  }

  changedTitles.sort((a, b) => a - b);

  if (jsonMode) {
    // Mirror the downloader's date logic: when an import is in progress,
    // meta.date is tomorrow's date — use previous day for accurate frontmatter
    const currencyDate = meta.importInProgress
      ? (() => {
          const prev = new Date(meta.date);
          prev.setDate(prev.getDate() - 1);
          return prev.toISOString().slice(0, 10);
        })()
      : meta.date;

    const output = {
      changedTitles,
      currencyDate,
      totalTitles: meta.titles.filter((t) => !t.reserved).length,
      importInProgress: meta.importInProgress,
    };
    console.log(JSON.stringify(output));
  } else {
    // Output comma-separated title numbers (empty string if none changed)
    console.log(changedTitles.join(","));
  }
}

main().catch((err: unknown) => {
  console.error("ecfr-changed-titles failed:", err);
  process.exit(1);
});
