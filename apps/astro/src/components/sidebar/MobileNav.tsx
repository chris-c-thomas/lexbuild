import { useState } from "react";
import { ChevronDown, Layers, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./SidebarContent";
import DocsSidebar from "@/components/docs/DocsSidebar";
import { cn } from "@/lib/utils";
import type { SourceId } from "@/lib/types";

const SOURCES: { id: SourceId; label: string }[] = [
  { id: "usc", label: "U.S. Code" },
  { id: "ecfr", label: "eCFR" },
  { id: "fr", label: "Federal Register" },
];

const NAV_LINKS: { label: string; href: string; activePrefix: string }[] = [
  { label: "CLI", href: "/docs/cli/installation", activePrefix: "/docs/cli" },
  { label: "API", href: "/docs/api", activePrefix: "/docs/api" },
  { label: "MCP", href: "/docs/mcp/overview", activePrefix: "/docs/mcp" },
  { label: "Docs", href: "/docs/", activePrefix: "/docs" },
];

interface MobileNavProps {
  source?: SourceId;
  currentPath: string;
}

export function MobileNav({ source, currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const [previewSource, setPreviewSource] = useState<SourceId | null>(null);
  const activeSource = previewSource ?? source;
  const isDocsPage = currentPath.startsWith("/docs");

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setPreviewSource(null);
          setBrowseExpanded(false);
        }
      }}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>

      <SheetContent side="left" className="bg-sidebar flex w-72 flex-col overflow-y-auto p-0 sm:max-w-72">
        <SheetHeader className="border-sidebar-border flex shrink-0 flex-row items-center gap-2 border-b px-4 py-3">
          <Layers className="text-slate-blue-900 dark:text-slate-blue-200 size-5" />
          <SheetTitle className="font-display text-slate-blue-900 dark:text-slate-blue-200 text-base font-semibold">
            LexBuild
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>

        {/* Navigation links */}
        <nav className="border-sidebar-border border-b px-3 py-2.5" aria-label="Main navigation">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() => setBrowseExpanded((v) => !v)}
              className={cn(
                "inline-flex items-center gap-0.5 text-sm font-medium transition-colors",
                activeSource
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}>
              Browse
              <ChevronDown
                className={cn("size-3.5 transition-transform", browseExpanded && "rotate-180")}
              />
            </button>
            {NAV_LINKS.map((link) => {
              const isActive =
                link.label === "Docs"
                  ? currentPath.startsWith("/docs") &&
                    !currentPath.startsWith("/docs/cli") &&
                    !currentPath.startsWith("/docs/api") &&
                    !currentPath.startsWith("/docs/mcp")
                  : currentPath.startsWith(link.activePrefix);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isActive
                      ? "text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                  )}>
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Browse sources dropdown */}
          {browseExpanded && (
            <div className="mt-2 flex flex-col gap-0.5 pl-1">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPreviewSource(s.id);
                    setBrowseExpanded(false);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                    activeSource === s.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Content area */}
        {isDocsPage && !activeSource ? (
          <DocsSidebar currentPath={currentPath} />
        ) : activeSource ? (
          <SidebarContent sourceId={activeSource} currentPath={currentPath} />
        ) : null}

        {/* Minimal footer */}
        <div className="mt-auto">
          <nav
            className="border-sidebar-border flex items-center justify-center border-t px-4 py-2.5"
            aria-label="External links">
            <a
              href="https://github.com/chris-c-thomas/LexBuild"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              aria-label="GitHub repository">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
              </svg>
              GitHub
            </a>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
