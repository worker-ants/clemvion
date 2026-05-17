"use client";

import type { DocFrontmatter } from "@/lib/docs/registry";
import { localizedSummary, localizedTitle } from "@/lib/docs/locale";
import { useLocale } from "@/lib/i18n";

/**
 * Client header for a documentation page. Server-rendered metadata still uses
 * the Korean title (see generateMetadata), but the in-page heading flips with
 * the user's profile locale.
 */
export function DocHeader({ frontmatter }: { frontmatter: DocFrontmatter }) {
  const locale = useLocale();
  return (
    <header className="mb-6 border-b border-[hsl(var(--border))] pb-4">
      <h1 className="text-3xl font-semibold">{localizedTitle(frontmatter, locale)}</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        {localizedSummary(frontmatter, locale)}
      </p>
    </header>
  );
}
