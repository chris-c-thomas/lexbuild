import type { ContentViewerProps } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { DownloadButton } from "./DownloadButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Eye } from "lucide-react";

/**
 * Shared content viewer for all granularity levels.
 * Provides source/rendered toggle with shadcn-style tabs, copy, and download.
 */
export default function ContentViewer({
  rawMarkdown,
  highlightedSource,
  renderedHtml,
  downloadFilename,
}: ContentViewerProps) {
  return (
    <Tabs defaultValue="source" className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-t-lg border border-border bg-muted/50 px-4 py-2">
        <TabsList>
          <TabsTrigger value="source">
            <FileText className="size-3.5" />
            Markdown
          </TabsTrigger>
          <TabsTrigger value="rendered">
            <Eye className="size-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <CopyButton text={rawMarkdown} />
          <DownloadButton content={rawMarkdown} filename={downloadFilename} />
        </div>
      </div>

      {/* Content */}
      <TabsContent value="source" className="mt-0">
        <div className="overflow-hidden rounded-b-lg border border-t-0 border-border bg-muted/30 p-4">
          <div
            className="shiki-wrap text-sm"
            dangerouslySetInnerHTML={{ __html: highlightedSource }}
          />
        </div>
      </TabsContent>
      <TabsContent value="rendered" className="mt-0">
        <div className="rounded-b-lg border border-t-0 border-border bg-background p-6 lg:p-8">
          <article
            className="prose prose-zinc dark:prose-invert max-w-none prose-headings:text-slate-blue-800 dark:prose-headings:text-slate-blue-300 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-7 prose-li:leading-7 prose-blockquote:border-slate-blue-300 dark:prose-blockquote:border-slate-blue-700 prose-hr:border-border prose-strong:text-foreground"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
