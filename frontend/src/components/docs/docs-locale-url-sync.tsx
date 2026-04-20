"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/types";

/**
 * Keeps the `/docs/<locale>/...` URL in sync with the user's chosen locale.
 *
 * When the profile locale changes (e.g. via the language switcher) and the
 * active path still points at the previous locale segment, we `router.replace`
 * to the equivalent path under the new locale. No-op on non-`/docs` routes.
 */
export function DocsLocaleUrlSync() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/docs/")) return;
    const segments = pathname.split("/").filter(Boolean); // ["docs", "<loc?>", ...]
    const pathLocale = segments[1];
    if (!isLocale(pathLocale)) return; // legacy or /docs itself — let server handle
    if (pathLocale === locale) return;
    const rest = segments.slice(2).join("/");
    router.replace(`/docs/${locale}${rest ? `/${rest}` : ""}`);
  }, [locale, pathname, router]);

  return null;
}
