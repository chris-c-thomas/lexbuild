import Link from "next/link";
import { getNavProvider } from "@/lib/content";

export const metadata = {
  title: "U.S. Code",
  description: "Browse all titles of the United States Code as structured Markdown.",
};

export default async function UscIndexPage() {
  const nav = getNavProvider();
  const titles = await nav.getTitles();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">U.S. Code</h1>
        <p className="mt-2 text-muted-foreground">
          {titles.length} titles available — select a title to browse.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {titles.map((t) => (
          <Link
            key={t.directory}
            href={`/usc/${t.directory}/`}
            className="rounded-lg border border-border p-4 transition-colors hover:border-ring hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Title {t.number}</span>
            </div>
            <div className="mt-1 font-semibold text-foreground">{t.name}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{t.chapterCount} chapters</span>
              <span>{t.sectionCount} sections</span>
              {t.tokenEstimate > 0 && <span>~{Math.round(t.tokenEstimate / 1000)}k tokens</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
