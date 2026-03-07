import { notFound } from "next/navigation";
import { getContentProvider } from "@/lib/content";
import { parseFrontmatter, renderMarkdownToHtml } from "@/lib/markdown";
import { highlightMarkdown } from "@/lib/shiki";
import { ContentViewer } from "@/components/content/content-viewer";

interface Props {
  params: Promise<{ title: string }>;
}

export default async function TitlePage({ params }: Props) {
  const { title } = await params;
  const content = getContentProvider();

  const raw = await content.getFile(`title/usc/${title}.md`);
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
      granularity="title"
      downloadFilename={`${title}.md`}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { title } = await params;
  const content = getContentProvider();
  const raw = await content.getFile(`title/usc/${title}.md`);
  if (!raw) return { title: "Not found" };
  const { frontmatter } = parseFrontmatter(raw);
  return {
    title: frontmatter.title,
    description: `${frontmatter.title} — Structured Markdown from LexBuild.`,
    openGraph: { title: frontmatter.title, type: "article" },
  };
}
