"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { fetchTitles } from "@/lib/nav";
import type { TitleSummary } from "@/lib/types";
import { TitleList } from "./title-list";
import { parseUscPath } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { SearchTrigger } from "@/components/search/search-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Sidebar container — loads titles on mount, manages mobile open/close. */
export function Sidebar() {
  const [titles, setTitles] = useState<TitleSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [corpusOpen, setCorpusOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState<string | null>(null);
  const corpusRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { titleDir } = parseUscPath(pathname);

  // Close corpus dropdown on outside click
  useEffect(() => {
    if (!corpusOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (corpusRef.current && !corpusRef.current.contains(e.target as Node)) {
        setCorpusOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [corpusOpen]);

  useEffect(() => {
    fetchTitles()
      .then((data) => {
        setTitles(data);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  // Close mobile sidebar on navigation (React-approved state-from-props pattern)
  if (prevPathname !== null && prevPathname !== pathname && mobileOpen) {
    setMobileOpen(false);
  }
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
  }

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      {/* Mobile hamburger button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={closeMobile} />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[22rem] flex-col border-r border-border bg-background transition-transform duration-200 lg:static lg:w-80 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1.5 text-lg font-bold text-foreground"
            >
              {/* <Scale className="h-6 w-6 shrink-0" /> */}
              LexBuild
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <div ref={corpusRef} className="relative">
              <button
                onClick={() => setCorpusOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                U.S. Code
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", corpusOpen && "rotate-180")}
                />
              </button>
              {corpusOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background p-1 shadow-lg">
                  <Link
                    href="/usc/"
                    onClick={() => setCorpusOpen(false)}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-sm font-medium text-foreground bg-accent"
                  >
                    U.S. Code
                  </Link>
                  <div className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed">
                    CFR
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                      Soon
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <SearchTrigger />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={closeMobile}
              className="lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable title list */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {!loaded ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">Loading...</div>
          ) : titles.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">No titles available.</div>
          ) : (
            <TitleList titles={titles} activeTitleDir={titleDir} />
          )}
        </nav>
      </aside>
    </>
  );
}
