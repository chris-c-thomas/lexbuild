import { cache } from "react";
import { notFound } from "next/navigation";
import { getContentProvider } from "@/lib/content";
import { parseFrontmatter, renderMarkdownToHtml } from "@/lib/markdown";
import { highlightMarkdown } from "@/lib/shiki";
import { ContentViewer } from "@/components/content/content-viewer";

interface Props {
  params: Promise<{ title: string; chapter: string }>;
}

const getContent = cache(async (title: string, chapter: string) => {
  const content = getContentProvider();
  return content.getFile(`chapter/usc/${title}/${chapter}/${chapter}.md`);
});

export default async function ChapterPage({ params }: Props) {
  const { title, chapter } = await params;

  const raw = await getContent(title, chapter);
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
      downloadFilename={`${chapter}.md`}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { title, chapter } = await params;
  const raw = await getContent(title, chapter);
  if (!raw) return { title: "Not found" };
  const { frontmatter } = parseFrontmatter(raw);
  return {
    title: frontmatter.title,
    description: `${frontmatter.title} — Structured Markdown from LexBuild.`,
    openGraph: { title: frontmatter.title, type: "article" },
  };
}
