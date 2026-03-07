import Link from "next/link";
import { getNavProvider } from "@/lib/content";
import { Scale, FileText, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const nav = getNavProvider();
  const titles = await nav.getTitles();

  const totalSections = titles.reduce((sum, t) => sum + t.sectionCount, 0);
  const totalChapters = titles.reduce((sum, t) => sum + t.chapterCount, 0);
  const totalTokens = titles.reduce((sum, t) => sum + t.tokenEstimate, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-12">
        {/* Hero */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">LexBuild</h1>
            <ThemeToggle />
          </div>
          <p className="max-w-2xl text-lg text-muted-foreground">
            The complete U.S. Code as structured Markdown — built for AI and RAG ingestion. Browse
            every title, chapter, and section with syntax-highlighted source and rendered HTML.
          </p>
          <Link
            href="/usc/"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <Scale className="h-4 w-4" />
            Browse U.S. Code
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Titles" value={titles.length} icon={<BookOpen className="h-5 w-5" />} />
          <StatCard
            label="Chapters"
            value={totalChapters}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            label="Sections"
            value={totalSections}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            label="Est. Tokens"
            value={totalTokens}
            icon={<FileText className="h-5 w-5" />}
          />
        </div>

        {/* Title grid */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">All Titles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {titles.map((t) => (
              <Link
                key={t.directory}
                href={`/usc/${t.directory}/`}
                className="rounded-lg border border-border p-4 transition-colors hover:border-ring hover:bg-accent"
              >
                <div className="text-sm font-medium text-muted-foreground">Title {t.number}</div>
                <div className="mt-1 font-semibold text-foreground">{t.name}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {t.chapterCount} chapters · {t.sectionCount} sections
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-lg font-semibold text-foreground">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
