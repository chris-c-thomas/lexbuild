import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
        className="w-72 overflow-y-auto bg-sidebar p-0 sm:max-w-72"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="text-base font-bold text-sidebar-foreground">
            LexBuild
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-3 pt-3">
          <a
            href="/usc"
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              source === "usc"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            U.S. Code
          </a>
          <a
            href="/ecfr"
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              source === "ecfr"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            eCFR
          </a>
        </nav>

        {/* Sidebar tree (only on source pages) */}
        {source && (
          <>
            <Separator className="my-2" />
            <SidebarContent sourceId={source} currentPath={currentPath} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
