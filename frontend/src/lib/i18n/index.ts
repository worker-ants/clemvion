"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { DEFAULT_LOCALE, type Locale } from "./types";
import { translate, type TFunction, type TranslationKey } from "./core";

export type { Locale } from "./types";
export { isLocale, LOCALES, DEFAULT_LOCALE } from "./types";
export { translate };
export type { TFunction, TranslationKey };

/**
 * React hook that returns a memoized translate function bound to the current user locale.
 * Re-renders the consuming component on locale change via `useSyncExternalStore`.
 */
export function useT(): TFunction {
  const locale = useSyncExternalStore(
    useLocaleStore.subscribe,
    () => useLocaleStore.getState().locale,
    () => DEFAULT_LOCALE,
  );
  return useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );
}

/**
 * React hook that returns the current locale. Re-renders on locale change.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(
    useLocaleStore.subscribe,
    () => useLocaleStore.getState().locale,
    () => DEFAULT_LOCALE,
  );
}
