import { cache } from "react";
import { notFound } from "next/navigation";
import { getContentProvider } from "@/lib/content";
import { parseFrontmatter, renderMarkdownToHtml } from "@/lib/markdown";
import { highlightMarkdown } from "@/lib/shiki";
import { ContentViewer } from "@/components/content/content-viewer";

interface Props {
  params: Promise<{ title: string; chapter: string; section: string }>;
}

const getContent = cache(async (title: string, chapter: string, section: string) => {
  const content = getContentProvider();
  return content.getFile(`section/usc/${title}/${chapter}/${section}.md`);
});

export default async function SectionPage({ params }: Props) {
  const { title, chapter, section } = await params;

  const raw = await getContent(title, chapter, section);
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
      downloadFilename={`${section}.md`}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { title, chapter, section } = await params;
  const raw = await getContent(title, chapter, section);
  if (!raw) return { title: "Not found" };
  const { frontmatter } = parseFrontmatter(raw);
  return {
    title: frontmatter.title,
    description: `${frontmatter.title} — Structured Markdown from LexBuild.`,
    openGraph: { title: frontmatter.title, type: "article" },
  };
}
