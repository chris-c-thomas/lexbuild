"use client";

import { Download } from "lucide-react";

interface DownloadButtonProps {
  content: string;
  filename: string;
}

/** Downloads the raw Markdown content as a .md file. */
export function DownloadButton({ content, filename }: DownloadButtonProps) {
  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      <Download className="h-4 w-4" />
      Download
    </button>
  );
}
