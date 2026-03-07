"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Scale } from "lucide-react";
import { fetchTitles } from "@/lib/nav";
import type { TitleSummary } from "@/lib/types";
import { TitleList } from "./title-list";
import { parseUscPath } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchTrigger } from "@/components/search/search-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Sidebar container — loads titles on mount, manages mobile open/close. */
export function Sidebar() {
  const [titles, setTitles] = useState<TitleSummary[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { titleDir } = parseUscPath(pathname);

  useEffect(() => {
    fetchTitles().then(setTitles);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-border bg-background transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link
            href="/usc/"
            className="flex items-center gap-2 font-semibold text-foreground"
          >
            <Scale className="h-5 w-5" />
            U.S. Code
          </Link>
          <div className="flex items-center gap-1">
            <SearchTrigger />
            <ThemeToggle />
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
          {titles.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <TitleList titles={titles} activeTitleDir={titleDir} />
          )}
        </nav>
      </aside>
    </>
  );
}
