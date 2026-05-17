"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { type Locale } from "./types";
import { translate, type TFunction, type TranslationKey } from "./core";

export type { Locale } from "./types";
export { isLocale, LOCALES, DEFAULT_LOCALE } from "./types";
export { translate };
export type { TFunction, TranslationKey };

/**
 * React hook that returns a memoized translate function bound to the current user locale.
 * Re-renders the consuming component on locale change via `useSyncExternalStore`.
 *
 * getServerSnapshot 도 store 를 읽는다 — hardcoded `DEFAULT_LOCALE` 은 SSR · hydration
 * 경로 (그리고 Suspense throw 후 재마운트 경로) 에서 사용자가 고른 locale 을 무시하고
 * 항상 ko 를 반환해 vitest 회귀(`execution-list-page` · `candidate-picker`) 의 원인이 됐다.
 */
export function useT(): TFunction {
  const locale = useSyncExternalStore(
    useLocaleStore.subscribe,
    () => useLocaleStore.getState().locale,
    () => useLocaleStore.getState().locale,
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
    () => useLocaleStore.getState().locale,
  );
}
