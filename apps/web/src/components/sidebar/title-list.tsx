"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchTitleNav, parseUscPath } from "@/lib/nav";
import type { TitleSummary, TitleNav } from "@/lib/types";
import { ChapterList } from "./chapter-list";

interface TitleListProps {
  titles: TitleSummary[];
  activeTitleDir?: string;
}

/** Accordion list of titles. Lazy-loads chapter/section data on expand. */
export function TitleList({ titles, activeTitleDir }: TitleListProps) {
  const [expandedTitle, setExpandedTitle] = useState<string | null>(activeTitleDir ?? null);
  const [prevActiveTitleDir, setPrevActiveTitleDir] = useState(activeTitleDir);
  const [navCache, setNavCache] = useState<Record<string, TitleNav | null>>({});
  const pathname = usePathname();
  const { chapterDir, sectionSlug } = parseUscPath(pathname);

  // Auto-expand when the active title changes (React-approved state-from-props pattern)
  if (prevActiveTitleDir !== activeTitleDir) {
    setPrevActiveTitleDir(activeTitleDir);
    if (activeTitleDir) {
      setExpandedTitle(activeTitleDir);
    }
  }

  const toggleTitle = useCallback((dir: string) => {
    setExpandedTitle((prev) => (prev === dir ? null : dir));
  }, []);

  // Track in-flight fetches to prevent retry storms (ref avoids setState in effect)
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      expandedTitle &&
      navCache[expandedTitle] === undefined &&
      !fetchingRef.current.has(expandedTitle)
    ) {
      fetchingRef.current.add(expandedTitle);
      fetchTitleNav(expandedTitle)
        .then((nav) => {
          setNavCache((prev) => ({ ...prev, [expandedTitle]: nav }));
        })
        .catch(() => {
          setNavCache((prev) => ({ ...prev, [expandedTitle]: null }));
        });
    }
  }, [expandedTitle, navCache]);

  return (
    <ul className="space-y-0.5">
      {titles.map((t) => {
        const isExpanded = expandedTitle === t.directory;
        const isActive = activeTitleDir === t.directory;
        const navEntry = navCache[t.directory];
        const nav = navEntry ?? undefined;

        return (
          <li key={t.directory}>
            <div className="flex items-center">
              <button
                onClick={() => toggleTitle(t.directory)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <ChevronRight
                  className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                />
              </button>
              <Link
                href={`/usc/${t.directory}/`}
                className={cn(
                  "flex-1 truncate rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive && !chapterDir
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                )}
                title={`Title ${t.number} — ${t.name}`}
              >
                <span className="font-medium text-muted-foreground">{t.number}.</span> {t.name}
              </Link>
            </div>

            {isExpanded && (
              <div className="ml-5 mt-0.5">
                {nav ? (
                  <ChapterList
                    chapters={nav.chapters}
                    titleDir={t.directory}
                    activeChapterDir={isActive ? chapterDir : undefined}
                    activeSectionSlug={isActive ? sectionSlug : undefined}
                  />
                ) : navEntry === null ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Failed to load.</div>
                ) : (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Loading...</div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
