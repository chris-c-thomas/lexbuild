import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">LexBuild</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          The complete U.S. Code as structured Markdown — built for AI and RAG ingestion.
        </p>
      </div>
      <Link
        href="/usc/"
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Browse U.S. Code
      </Link>
    </div>
  );
}
