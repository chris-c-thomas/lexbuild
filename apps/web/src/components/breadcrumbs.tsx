"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { parseUscPath } from "@/lib/nav";

/** Breadcrumb trail: U.S. Code > Title > Chapter > Section. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const { titleDir, chapterDir, sectionSlug } = parseUscPath(pathname);

  const crumbs: { label: string; href: string }[] = [{ label: "U.S. Code", href: "/usc/" }];

  if (titleDir) {
    crumbs.push({ label: formatTitle(titleDir), href: `/usc/${titleDir}/` });
  }
  if (titleDir && chapterDir) {
    crumbs.push({
      label: formatChapter(chapterDir),
      href: `/usc/${titleDir}/${chapterDir}/`,
    });
  }
  if (titleDir && chapterDir && sectionSlug) {
    crumbs.push({
      label: formatSection(sectionSlug),
      href: `/usc/${titleDir}/${chapterDir}/${sectionSlug}/`,
    });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              {isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "title-01" → "Title 1" */
function formatTitle(dir: string): string {
  const num = dir.replace("title-", "").replace(/^0+/, "") || "0";
  return `Title ${num}`;
}

/** "chapter-01" → "Chapter 1" */
function formatChapter(dir: string): string {
  const num = dir.replace("chapter-", "").replace(/^0+/, "") || "0";
  return `Chapter ${num}`;
}

/** "section-106a" → "§ 106a" */
function formatSection(slug: string): string {
  const num = slug.replace("section-", "");
  return `§ ${num}`;
}
