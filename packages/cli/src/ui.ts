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
  const table = new Table({
    chars: {
      top: "─",
      "top-mid": "",
      "top-left": "  ",
      "top-right": "",
      bottom: "─",
      "bottom-mid": "",
      "bottom-left": "  ",
      "bottom-right": "",
      left: "  ",
      "left-mid": "  ",
      right: "",
      "right-mid": "",
      mid: "─",
      "mid-mid": "",
      middle: "  ",
    },
    style: {
      head: [],
      border: [],
      "padding-left": 0,
      "padding-right": 0,
    },
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
    chars: {
      top: "─",
      "top-mid": "",
      "top-left": "  ",
      "top-right": "",
      bottom: "─",
      "bottom-mid": "",
      "bottom-left": "  ",
      "bottom-right": "",
      left: "  ",
      "left-mid": "  ",
      right: "",
      "right-mid": "",
      mid: "─",
      "mid-mid": "",
      middle: "  ",
    },
    style: {
      head: [],
      border: [],
      "padding-left": 0,
      "padding-right": 0,
    },
  });

  for (const row of rows) {
    table.push(row);
  }

  return table.toString();
}
