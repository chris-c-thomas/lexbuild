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
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {titles.length} titles available — select a title to browse.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {titles.map((t) => (
          <Link
            key={t.directory}
            href={`/usc/${t.directory}/`}
            className="rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Title {t.number}
            </div>
            <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</div>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {t.chapterCount} chapters · {t.sectionCount} sections
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
