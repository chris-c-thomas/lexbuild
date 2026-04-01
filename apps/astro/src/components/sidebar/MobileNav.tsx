import { useState } from "react";
import { Layers, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./SidebarContent";
import { cn } from "@/lib/utils";
import type { SourceId } from "@/lib/types";

interface MobileNavProps {
  source?: SourceId;
  currentPath: string;
}

export function MobileNav({ source, currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  // On source pages, always show that source's tree.
  // On the home page, let the user pick a source to browse inline.
  const [previewSource, setPreviewSource] = useState<SourceId | null>(null);
  const activeSource = previewSource ?? source;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <SheetContent
        side="left"
        className="bg-sidebar flex w-72 flex-col overflow-y-auto p-0 sm:max-w-72"
      >
        <SheetHeader className="border-sidebar-border flex shrink-0 flex-row items-center gap-2 border-b px-4 py-3">
          <Layers className="text-slate-blue-900 dark:text-slate-blue-200 size-5" />
          <SheetTitle className="font-display text-slate-blue-900 dark:text-slate-blue-200 text-base font-semibold">
            LexBuild
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>

        {/* Source switcher */}
        <nav className="border-sidebar-border flex gap-1 border-b p-2" aria-label="Sources">
          <button
            type="button"
            onClick={() => setPreviewSource("usc")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors",
              activeSource === "usc"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            U.S. Code
          </button>
          <button
            type="button"
            onClick={() => setPreviewSource("ecfr")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors",
              activeSource === "ecfr"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            eCFR
          </button>
          <button
            type="button"
            onClick={() => setPreviewSource("fr")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors",
              activeSource === "fr"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            FR
          </button>
        </nav>

        {/* Sidebar tree */}
        {activeSource && <SidebarContent sourceId={activeSource} currentPath={currentPath} />}

        {/* Footer: secondary links */}
        <div className="mt-auto">
          <nav className="border-sidebar-border flex items-center gap-4 border-t px-4 py-2.5" aria-label="External links">
            <a
              href="https://www.npmjs.com/package/@lexbuild/cli"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground text-xs font-medium transition-colors"
            >
              CLI
            </a>
            <a
              href="https://github.com/chris-c-thomas/LexBuild/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground text-xs font-medium transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/chris-c-thomas/LexBuild"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground text-xs font-medium transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
