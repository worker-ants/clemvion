"use client";

import { create } from "zustand";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/types";

const STORAGE_KEY = "idea-workflow.locale";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    /* localStorage unavailable (e.g. private mode) — fall back to default */
    return DEFAULT_LOCALE;
  }
}

/** Mirror the active locale onto `<html lang>` so screen readers, browsers and
 *  font stacks pick it up. Only touches the DOM when the value actually changes
 *  to avoid spurious MutationObserver callbacks. */
function applyHtmlLang(locale: Locale) {
  if (typeof document === "undefined") return;
  if (document.documentElement.lang !== locale) {
    document.documentElement.lang = locale;
  }
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  initFromStorage: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: DEFAULT_LOCALE,
  setLocale: (locale) => {
    // Order mirrors `initFromStorage`: DOM + storage first, then state publish,
    // so observers notified by zustand see a consistent world.
    applyHtmlLang(locale);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        /* localStorage unavailable (e.g. private mode or quota exceeded) */
      }
    }
    set({ locale });
  },
  initFromStorage: () => {
    const next = readStoredLocale();
    applyHtmlLang(next);
    set({ locale: next });
  },
}));
