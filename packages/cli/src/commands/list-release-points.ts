/**
 * `lexbuild list-release-points` command — lists available OLRC release points.
 *
 * Fetches the current release point from the OLRC download page and the full
 * history from the prior release points page, then displays them in a table.
 */

import { Command } from "commander";
import { detectLatestReleasePoint, fetchReleasePointHistory, FALLBACK_RELEASE_POINT } from "@lexbuild/usc";
import { createSpinner, summaryBlock, dataTable, error } from "../ui.js";

/** Parsed options from the list-release-points command */
interface ListReleasePointsOptions {
  limit: string;
}

export const listReleasePointsCommand = new Command("list-release-points")
  .description("List available OLRC release points for the U.S. Code")
  .option("-n, --limit <count>", "Maximum number of release points to show", "20")
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild list-release-points                Show the 20 most recent release points
  $ lexbuild list-release-points -n 5           Show the 5 most recent
  $ lexbuild list-release-points -n 0           Show all available release points

Use --release-point <id> with download-usc to pin a specific release.
Source: https://uscode.house.gov/download/priorreleasepoints.htm`,
  )
  .action(async (options: ListReleasePointsOptions) => {
    const limit = parseInt(options.limit, 10);
    if (Number.isNaN(limit) || limit < 0) {
      console.error(error("--limit must be a non-negative integer"));
      process.exit(1);
    }

    const spinner = createSpinner("Fetching release points from OLRC...");
    spinner.start();

    // Fetch current and history in parallel
    const [current, history] = await Promise.all([detectLatestReleasePoint(), fetchReleasePointHistory()]);

    spinner.stop();

    // Current release point summary
    const currentRp = current?.releasePoint ?? FALLBACK_RELEASE_POINT;
    const currentDesc = current?.description ?? "(detection failed — showing fallback)";

    const output = summaryBlock({
      title: "lexbuild — OLRC Release Points",
      rows: [
        ["Latest", `${currentRp}  ${currentDesc}`],
        ["Prior releases", `${history.length} available`],
      ],
    });
    process.stdout.write(output);

    if (history.length === 0) {
      console.log("  No prior release points found.\n");
      return;
    }

    // Apply limit (0 = show all)
    const displayed = limit > 0 ? history.slice(0, limit) : history;

    // Build table rows: Release Point, Date, Affected Titles
    const rows = displayed.map((rp) => [
      rp.releasePoint,
      rp.date,
      rp.affectedTitles.length > 0 ? rp.affectedTitles.join(", ") : "—",
    ]);

    console.log(dataTable(["Release Point", "Date", "Affected Titles"], rows));

    if (limit > 0 && history.length > limit) {
      console.log(`  Showing ${limit} of ${history.length} — use -n 0 to show all.\n`);
    }

    console.log("  Use with: lexbuild download-usc --all --release-point <id>\n");
  });
