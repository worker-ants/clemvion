"use client";

import { create } from "zustand";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/types";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";

const STORAGE_KEY = "idea-workflow.locale";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/** 서버 컴포넌트가 SSR 시점에 locale을 판정할 수 있도록 쿠키에 미러링해요.
 *  `document.cookie`는 `localStorage`와 달리 private 모드에서도 조용히 성공해요
 *  (어쨌든 try/catch로 감싸서 예상치 못한 SecurityError를 차단).
 *  `Secure` 플래그는 HTTPS 배포에서만 설정 — dev 환경의 http://localhost에서도
 *  쿠키가 저장되도록 분기해요. */
function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  try {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}

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
    writeLocaleCookie(locale);
    set({ locale });
  },
  initFromStorage: () => {
    const next = readStoredLocale();
    applyHtmlLang(next);
    // Re-hydrate the cookie on startup so a fresh session (no cookie yet)
    // starts emitting locale-aware SSR from the next navigation.
    writeLocaleCookie(next);
    set({ locale: next });
  },
}));
