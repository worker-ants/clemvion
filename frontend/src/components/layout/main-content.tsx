"use client";

import { useSidebarStore, selectCollapsed } from "@/lib/stores/sidebar-store";
import { cn } from "@/lib/utils/cn";

export function MainContent({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarStore(selectCollapsed);
  const isSmall = useSidebarStore((s) => s.isSmall);

  return (
    <main
      className={cn(
        "transition-all duration-200",
        isSmall ? "pl-0" : collapsed ? "pl-16" : "pl-60",
      )}
    >
      <div className={cn("p-6", isSmall ? "pt-16" : "pt-6")}>{children}</div>
    </main>
  );
}
