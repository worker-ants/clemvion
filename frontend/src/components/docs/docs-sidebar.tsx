"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsSection } from "@/lib/docs/registry";
import { cn } from "@/lib/utils/cn";

export function DocsSidebar({ sections }: { sections: DocsSection[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="매뉴얼 섹션" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.key}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {section.label}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className={cn(
                      "block rounded-md px-2 py-1 text-sm transition-colors",
                      active
                        ? "bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {page.frontmatter.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
