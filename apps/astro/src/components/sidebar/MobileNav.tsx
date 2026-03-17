import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./SidebarContent";
import type { SourceId } from "@/lib/types";

interface MobileNavProps {
  source?: SourceId;
  currentPath: string;
}

export function MobileNav({ source, currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false);

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
        <SheetHeader className="border-sidebar-border flex shrink-0 flex-row items-center gap-3 border-b px-4 py-3">
          <SheetTitle className="text-sidebar-foreground text-base font-bold">LexBuild</SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <div className="relative">
            <select
              value={source ?? ""}
              onChange={(e) => {
                window.location.href = `/${e.target.value}`;
              }}
              className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground appearance-none rounded-md border py-1 pr-7 pl-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label="Select source"
            >
              <option value="usc">U.S. Code</option>
              <option value="ecfr">eCFR</option>
            </select>
            <ChevronDown className="text-sidebar-foreground/50 pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2" />
          </div>
        </SheetHeader>

        {/* Sidebar tree */}
        {source && <SidebarContent sourceId={source} currentPath={currentPath} />}

        {/* Fallback when no source (home page) */}
        {!source && (
          <nav className="flex flex-col gap-1 p-3">
            <a
              href="https://www.npmjs.com/package/@lexbuild/cli"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              CLI
            </a>
            <a
              href="/usc"
              className="text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              U.S. Code
            </a>
            <a
              href="/ecfr"
              className="text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              eCFR
            </a>
            <a
              href="https://github.com/chris-c-thomas/LexBuild/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              Docs
            </a>
          </nav>
        )}
      </SheetContent>
    </Sheet>
  );
}
