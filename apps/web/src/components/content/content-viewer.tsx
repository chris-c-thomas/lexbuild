"use client";

import { useState } from "react";
import type { ContentViewerProps } from "@/lib/types";
import { CopyButton } from "./copy-button";
import { DownloadButton } from "./download-button";
import { FrontmatterPanel } from "./frontmatter-panel";

/**
 * Shared content viewer for all three granularity levels.
 * Provides source/rendered toggle, copy, and download.
 */
export function ContentViewer({
  rawMarkdown,
  highlightedSource,
  renderedHtml,
  frontmatter,
  granularity,
  downloadFilename,
}: ContentViewerProps) {
  const [view, setView] = useState<"rendered" | "source">("rendered");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {frontmatter.title}
        </h1>
        <FrontmatterPanel frontmatter={frontmatter} granularity={granularity} />
      </div>

      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            onClick={() => setView("rendered")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "rendered"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Rendered
          </button>
          <button
            onClick={() => setView("source")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "source"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Source
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          <CopyButton text={rawMarkdown} />
          <DownloadButton content={rawMarkdown} filename={downloadFilename} />
        </div>
      </div>

      {view === "rendered" ? (
        <article
          className="prose prose-zinc max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        <div
          className="overflow-x-auto rounded-lg text-sm [&_pre]:!rounded-lg [&_pre]:!p-4"
          dangerouslySetInnerHTML={{ __html: highlightedSource }}
        />
      )}
    </div>
  );
}
