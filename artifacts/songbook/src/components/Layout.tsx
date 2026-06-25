import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { useAppStore } from "@/store";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PanelLeftOpen } from "lucide-react";

export default function Layout({ children }: { children: ReactNode }) {
  const { isSidebarOpen, setSidebarOpen, desktopSidebarOpen, setDesktopSidebarOpen } =
    useAppStore();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar — collapsible so the song can fill the screen */}
      {desktopSidebarOpen && (
        <div className="hidden md:flex w-80 shrink-0 border-r border-border flex-col bg-sidebar">
          <Sidebar />
        </div>
      )}

      {/* Desktop reveal tab — only when the sidebar is collapsed */}
      {!desktopSidebarOpen && (
        <button
          type="button"
          onClick={() => setDesktopSidebarOpen(true)}
          aria-label="Show sidebar"
          title="Show sidebar"
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-50 h-16 w-7 items-center justify-center rounded-r-lg border border-l-0 border-border bg-card text-muted-foreground shadow-md hover:bg-accent hover:text-foreground"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-80 p-0 border-r-0 sm:max-w-xs">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}