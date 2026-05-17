"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { isLocale } from "./types";

/**
 * Runs once on mount to hydrate the locale store from localStorage, and
 * thereafter keeps it in sync with the authenticated user's profile locale.
 * `user.locale` takes precedence over the locally stored value; on logout
 * the last known locale is preserved so the next sign-in starts from the
 * same UI language until a new profile overrides it.
 *
 * Side effects (localStorage read, `<html lang>` mutation) are issued through
 * `useLocaleStore.setLocale` / `initFromStorage`, so this component owns
 * neither storage nor DOM state directly.
 */
export function LocaleSync() {
  const userLocale = useAuthStore((s) => s.user?.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const initFromStorage = useLocaleStore((s) => s.initFromStorage);

  useEffect(() => {
    // Prefer the authenticated profile locale; fall back to whatever is in
    // localStorage (which also updates <html lang> and state). Combining both
    // sources in a single effect keeps side effects from double-firing.
    if (userLocale && isLocale(userLocale)) {
      setLocale(userLocale);
    } else {
      initFromStorage();
    }
  }, [userLocale, setLocale, initFromStorage]);

  return null;
}
