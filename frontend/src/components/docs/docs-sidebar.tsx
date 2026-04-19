"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import type { DocsSection } from "@/lib/docs/registry";
import { localizedSectionLabel, localizedTitle } from "@/lib/docs/locale";
import { cn } from "@/lib/utils/cn";
import { useLocale, useT } from "@/lib/i18n";

const STORAGE_KEY = "docs-sidebar-collapsed";

/**
 * External store for the collapsed-section set. Using `useSyncExternalStore`
 * keeps SSR and client hydration in lockstep (empty set on the server, actual
 * localStorage value on the client) without triggering a post-mount setState
 * in a React effect. The raw JSON string is cached so `getSnapshot` can return
 * a stable reference between reads, which `useSyncExternalStore` requires.
 */
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSnapshot: Set<string> = new Set();
const EMPTY: Set<string> = new Set();

function parseRaw(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function getSnapshot(): Set<string> {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = parseRaw(raw);
  return cachedSnapshot;
}

function getServerSnapshot(): Set<string> {
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  // Also listen for storage events so changes made in other tabs propagate.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", callback);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", callback);
    }
  };
}

function setCollapsed(next: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(next)),
    );
  } catch {
    // ignore write failures (quota, private mode)
  }
  // Invalidate the cache so the next getSnapshot rebuilds from the new value.
  cachedRaw = null;
  listeners.forEach((cb) => cb());
}

export function DocsSidebar({ sections }: { sections: DocsSection[] }) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Section containing the active page — always forced open so the user
  // never loses their current position in a collapsed group.
  const activeSectionKey = useMemo(
    () =>
      sections.find((s) => s.pages.some((p) => p.href === pathname))?.key ??
      null,
    [sections, pathname],
  );

  const toggleSection = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  };

  return (
    <nav aria-label={t("docs.title")} className="flex flex-col gap-3">
      {sections.map((section) => {
        const isActiveSection = section.key === activeSectionKey;
        const isCollapsed = !isActiveSection && collapsed.has(section.key);
        const sectionLabel = localizedSectionLabel(section.key, locale);
        return (
          <div key={section.key}>
            <button
              type="button"
              onClick={() => {
                if (isActiveSection) return;
                toggleSection(section.key);
              }}
              aria-expanded={!isCollapsed}
              aria-controls={`docs-section-${section.key}`}
              aria-disabled={isActiveSection || undefined}
              disabled={isActiveSection}
              className={cn(
                "mb-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                isActiveSection
                  ? "cursor-default text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
            >
              {isActiveSection ? (
                <Minus className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              ) : isCollapsed ? (
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
              )}
              <span className="truncate text-left">{sectionLabel}</span>
            </button>
            {!isCollapsed && (
              <ul
                id={`docs-section-${section.key}`}
                className="flex flex-col gap-0.5"
              >
                {section.pages.map((page) => {
                  const active = pathname === page.href;
                  return (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className={cn(
                          // Extra left padding (pl-5 = 20px, matches chevron + gap width)
                          // makes the depth from section header visually unambiguous.
                          // The left border doubles as both depth guide and active-page accent.
                          "block border-l-2 py-1 pl-5 pr-2 text-sm transition-colors",
                          active
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]"
                            : "border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {localizedTitle(page.frontmatter, locale)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
