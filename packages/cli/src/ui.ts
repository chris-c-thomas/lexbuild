/**
 * Shared terminal UI utilities — spinners, tables, and formatting helpers.
 */

import chalk from "chalk";
import ora from "ora";
import type { Ora } from "ora";
import Table from "cli-table3";

/** Create an ora spinner with consistent styling. */
export function createSpinner(text: string): Ora {
  return ora({ text, spinner: "dots" });
}

/** Format milliseconds as human-readable duration (e.g. "1.5s" or "1m 23s"). */
export function formatDuration(ms: number): string {
  const secs = ms / 1000;
  if (secs < 60) {
    return `${secs.toFixed(secs < 10 ? 2 : 1)}s`;
  }
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return `${mins}m ${remainSecs}s`;
}

/** Format bytes as human-readable size (e.g. "11.0 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/** Format a number with locale-aware separators (e.g. 1,234,567). */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Regex matching ANSI escape sequences (SGR codes). */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g;

/** Strip ANSI escape codes and return visual string length. */
function visualLength(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

/**
 * Compute column widths that fill the terminal.
 * Expands `flexCol` to absorb remaining space.
 */
function fillWidths(
  columns: string[][],
  colCount: number,
  flexCol: number,
): number[] | undefined {
  const termWidth = process.stdout.columns || 80;
  // Compute natural width per column (max visual length across all rows)
  const natural = Array.from<number>({ length: colCount }).fill(0);
  for (const row of columns) {
    for (let i = 0; i < colCount; i++) {
      natural[i] = Math.max(natural[i] ?? 0, visualLength(row[i] ?? ""));
    }
  }
  // Overhead: 2 chars left pad + 2 chars per column separator (between cols)
  const overhead = 2 + 2 * (colCount - 1);
  const naturalTotal = overhead + natural.reduce((a, b) => a + b, 0);
  if (naturalTotal >= termWidth) return undefined; // already fills or exceeds
  const extra = termWidth - naturalTotal;
  const widths = [...natural];
  widths[flexCol] = (widths[flexCol] ?? 0) + extra;
  return widths;
}

/**
 * Shared cli-table3 border characters.
 *
 * Uses 2-char left indent ("  "), 2-char column gap ("  "), no right border.
 * The "mid" intersection chars ("──") must match the 2-char width of "middle"
 * so horizontal rules span the full table width.
 */
const TABLE_CHARS = {
  top: "─",
  "top-mid": "──",
  "top-left": "  ",
  "top-right": "",
  bottom: "─",
  "bottom-mid": "──",
  "bottom-left": "  ",
  "bottom-right": "",
  left: "  ",
  "left-mid": "  ",
  right: "",
  "right-mid": "",
  mid: "─",
  "mid-mid": "──",
  middle: "  ",
} as const;

/** Shared cli-table3 style. */
const TABLE_STYLE: {
  head: string[];
  border: string[];
  "padding-left": number;
  "padding-right": number;
} = {
  head: [],
  border: [],
  "padding-left": 0,
  "padding-right": 0,
};

/** Render a styled heading line. */
export function heading(text: string): string {
  return chalk.bold(text);
}

/** Render a success message with green checkmark. */
export function success(text: string): string {
  return chalk.green(`✔ ${text}`);
}

/** Render an error message with red X. */
export function error(text: string): string {
  return chalk.red(`✘ ${text}`);
}

/** Options for a key-value summary block. */
interface SummaryBlockOptions {
  /** Title line displayed above the table */
  title: string;
  /** Key-value pairs to display */
  rows: Array<[label: string, value: string]>;
  /** Optional footer line displayed below the table */
  footer?: string | undefined;
}

/** Render a key-value summary block with horizontal rules. */
export function summaryBlock({ title, rows, footer }: SummaryBlockOptions): string {
  const allCells = rows.map(([l, v]) => [l, v]);
  const colWidths = fillWidths(allCells, 2, 1);

  const table = new Table({
    chars: TABLE_CHARS,
    style: TABLE_STYLE,
    ...(colWidths ? { colWidths } : {}),
  });

  for (const [label, value] of rows) {
    table.push([chalk.dim(label), value]);
  }

  const lines: string[] = [];
  lines.push("");
  lines.push(`  ${heading(title)}`);
  lines.push(table.toString());
  if (footer !== undefined) {
    lines.push(`  ${footer}`);
  }
  lines.push("");

  return lines.join("\n");
}

/** Render a multi-column data table. */
export function dataTable(head: string[], rows: string[][]): string {
  const table = new Table({
    head: head.map((h) => chalk.dim(h)),
    chars: TABLE_CHARS,
    style: TABLE_STYLE,
  });

  for (const row of rows) {
    table.push(row);
  }

  return table.toString();
}
