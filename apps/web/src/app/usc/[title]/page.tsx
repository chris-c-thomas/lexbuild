import { cache } from "react";
import { notFound } from "next/navigation";
import { getContentProvider } from "@/lib/content";
import { parseFrontmatter, renderMarkdownToHtml } from "@/lib/markdown";
import { highlightMarkdown } from "@/lib/shiki";
import { ContentViewer } from "@/components/content/content-viewer";

interface Props {
  params: Promise<{ title: string }>;
}

const RESERVED_TITLES: Record<string, string> = {
  "title-53": "RESERVED",
};

const getContent = cache(async (title: string) => {
  const content = getContentProvider();
  return content.getFile(`title/usc/${title}.md`);
});

export default async function TitlePage({ params }: Props) {
  const { title } = await params;

  const reservedName = RESERVED_TITLES[title];
  if (reservedName) {
    return <ReservedTitle slug={title} name={reservedName} />;
  }

  const raw = await getContent(title);
  if (!raw) notFound();

  const { frontmatter, body } = parseFrontmatter(raw);
  const [highlightedSource, renderedHtml] = await Promise.all([
    highlightMarkdown(raw),
    renderMarkdownToHtml(body),
  ]);

  return (
    <ContentViewer
      rawMarkdown={raw}
      highlightedSource={highlightedSource}
      renderedHtml={renderedHtml}
      frontmatter={frontmatter}
      downloadFilename={`${title}.md`}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { title } = await params;
  const reservedName = RESERVED_TITLES[title];
  if (reservedName) {
    const num = title.replace("title-", "").replace(/^0+/, "");
    return {
      title: `Title ${num} — ${reservedName}`,
      description: `Title ${num} of the U.S. Code is reserved.`,
    };
  }
  const raw = await getContent(title);
  if (!raw) return { title: "Not found" };
  const { frontmatter } = parseFrontmatter(raw);
  return {
    title: frontmatter.title,
    description: `${frontmatter.title} — Structured Markdown from LexBuild.`,
    openGraph: { title: frontmatter.title, type: "article" },
  };
}

function ReservedTitle({ slug, name }: { slug: string; name: string }) {
  const num = slug.replace("title-", "").replace(/^0+/, "");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">
        Title {num} — {name}
      </h1>
      <div className="rounded-lg border border-border bg-muted/50 p-6">
        <p className="text-muted-foreground">
          Title {num} of the United States Code is reserved. No statutory text has been enacted
          under this title.
        </p>
      </div>
    </div>
  );
}
