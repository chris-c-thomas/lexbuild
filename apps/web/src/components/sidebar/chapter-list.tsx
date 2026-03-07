"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChapterNav } from "@/lib/types";
import { SectionList } from "./section-list";

interface ChapterListProps {
  chapters: ChapterNav[];
  titleDir: string;
  activeChapterDir?: string;
  activeSectionSlug?: string;
}

/** Accordion list of chapters within an expanded title. */
export function ChapterList({
  chapters,
  titleDir,
  activeChapterDir,
  activeSectionSlug,
}: ChapterListProps) {
  const [expandedChapter, setExpandedChapter] = useState<string | null>(activeChapterDir ?? null);
  const [prevActiveChapterDir, setPrevActiveChapterDir] = useState(activeChapterDir);

  // Auto-expand when the active chapter changes (React-approved state-from-props pattern)
  if (prevActiveChapterDir !== activeChapterDir) {
    setPrevActiveChapterDir(activeChapterDir);
    if (activeChapterDir) {
      setExpandedChapter(activeChapterDir);
    }
  }

  const toggleChapter = useCallback((dir: string) => {
    setExpandedChapter((prev) => (prev === dir ? null : dir));
  }, []);

  return (
    <ul className="space-y-0.5">
      {chapters.map((ch) => {
        const isExpanded = expandedChapter === ch.directory;
        const isActive = activeChapterDir === ch.directory;

        return (
          <li key={ch.directory}>
            <div className="flex items-center">
              <button
                onClick={() => toggleChapter(ch.directory)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
                />
              </button>
              <Link
                href={`/usc/${titleDir}/${ch.directory}/`}
                className={cn(
                  "flex-1 truncate rounded-md px-2 py-1 text-xs transition-colors",
                  isActive && !activeSectionSlug
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                title={`Chapter ${ch.number} — ${ch.name}`}
              >
                <span className="font-medium">Ch. {ch.number}</span> {ch.name}
              </Link>
            </div>

            {isExpanded && (
              <div className="ml-5 mt-0.5">
                <SectionList
                  sections={ch.sections}
                  titleDir={titleDir}
                  chapterDir={ch.directory}
                  activeSectionSlug={isActive ? activeSectionSlug : undefined}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
