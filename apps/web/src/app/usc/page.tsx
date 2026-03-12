import Link from "next/link";
import { getNavProvider } from "@/lib/content";
import { toTitleCase } from "@/lib/utils";

/** Cache indefinitely at the edge — purge manually after content updates. */
export const revalidate = false;

export const metadata = {
  title: "U.S. Code",
  description: "Browse all titles of the United States Code as structured Markdown.",
};

/**
 * Format a release point string into a human-readable description.
 * Example: "119-73not60" → "Current through Public Law 119-73, except 119-60"
 */
function formatReleasePoint(releasePoint: string): string {
  const match = /^(\d+-\d+)(?:not(\d+))?$/.exec(releasePoint);
  if (!match?.[1]) return `Release point ${releasePoint}`;
  const base = match[1];
  const [congress] = base.split("-");
  const excluded = match[2];
  if (excluded) {
    return `Current through Public Law ${base}, except ${congress}-${excluded}`;
  }
  return `Current through Public Law ${base}`;
}

export default async function UscIndexPage() {
  const nav = await getNavProvider();
  const titles = await nav.getTitles();

  // Use the release point from the first available title's metadata
  const releasePoint = titles.find((t) => t.releasePoint)?.releasePoint;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">U.S. Code</h1>
        <h2 className="mt-1 text-xl font-normal">
          Sourced from the{" "}
          <a href="https://uscode.house.gov/" target="_blank" rel="noopener noreferrer">
            <span className="text-slate-blue-600">Office of the Law Revision Counsel</span>
          </a>
        </h2>
        {releasePoint && (
          <p className="mt-2 text-muted-foreground">{formatReleasePoint(releasePoint)}.</p>
        )}
        <p className="mt-2 text-muted-foreground">
          {titles.length} titles available — select a title to browse.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {titles.map((t) => (
          <Link
            key={t.directory}
            href={`/usc/${t.directory}/`}
            prefetch={false}
            className="rounded-lg border border-border p-4 transition-colors hover:border-slate-blue-400 hover:bg-slate-blue-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Title {t.number}</span>
            </div>
            <div className="mt-1 font-semibold text-foreground">{toTitleCase(t.name)}</div>
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
