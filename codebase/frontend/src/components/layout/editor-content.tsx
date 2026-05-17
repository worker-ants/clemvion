"use client";

import { useSidebarStore, selectCollapsed } from "@/lib/stores/sidebar-store";
import { cn } from "@/lib/utils/cn";

export function EditorContent({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarStore(selectCollapsed);
  const isSmall = useSidebarStore((s) => s.isSmall);

  return (
    <main
      className={cn(
        "h-screen transition-all duration-200",
        isSmall ? "pl-0" : collapsed ? "pl-16" : "pl-60",
      )}
    >
      {children}
    </main>
  );
}
