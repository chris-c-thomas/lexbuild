"use client";

import { useState } from "react";
import type { ContentViewerProps } from "@/lib/types";
import { cn } from "@/lib/utils";
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
  downloadFilename,
}: ContentViewerProps) {
  const [view, setView] = useState<"source" | "rendered">("source");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-foreground">{frontmatter.title}</h1>
        <FrontmatterPanel frontmatter={frontmatter} />
      </div>

      <div className="flex items-center gap-2 border-b border-border pb-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setView("source")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "source"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Markdown
          </button>
          <button
            onClick={() => setView("rendered")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "rendered"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Preview
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
