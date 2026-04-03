import type { ContentViewerProps } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Eye } from "lucide-react";

/**
 * Shared content viewer for all granularity levels.
 * Provides source/rendered toggle with shadcn-style tabs.
 *
 * Note: dangerouslySetInnerHTML is used intentionally for pre-rendered HTML
 * from Shiki (syntax highlighting) and the rehype pipeline (which applies
 * rehype-sanitize for defense-in-depth). Both are server-generated from
 * trusted content files, not user input.
 */
export default function ContentViewer({ highlightedSource, renderedHtml }: ContentViewerProps) {
  return (
    <Tabs defaultValue="source" className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="border-border bg-muted/40 flex items-center justify-between rounded-t-md border px-4 py-2">
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
      </div>

      {/* Content — uses server-generated, sanitized HTML (not user input) */}
      <TabsContent value="source" className="mt-0">
        <div className="border-border bg-background overflow-hidden rounded-b-md border border-t-0 p-4">
          <div className="shiki-wrap text-sm" dangerouslySetInnerHTML={{ __html: highlightedSource }} />
        </div>
      </TabsContent>
      <TabsContent value="rendered" className="mt-0">
        <div className="border-border bg-background rounded-b-md border border-t-0 p-6 lg:p-8">
          <article
            className="prose prose-zinc dark:prose-invert prose-headings:text-slate-blue-800 dark:prose-headings:text-slate-blue-300 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-7 prose-li:leading-7 prose-blockquote:border-slate-blue-300 dark:prose-blockquote:border-slate-blue-700 prose-hr:border-border prose-strong:text-foreground max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
