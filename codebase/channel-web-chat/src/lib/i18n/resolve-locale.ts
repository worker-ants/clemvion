// 위젯 UI 언어 해석. SoT: spec/7-channel-web-chat/1-widget-app §4 (boot 1회 해석).
// 우선순위: 명시 BootConfig.locale → 브라우저 navigator.language(auto-detect) → ko fallback.
import type { Locale } from "./catalog";

/**
 * @param explicit    BootConfig.locale (운영자/개발자가 명시). "ko"|"en" 이면 그대로 사용.
 * @param navigatorLang  브라우저 언어(navigator.language 등). "en"/"en-US"/"en_GB" → en, 그 외 → ko.
 */
export function resolveLocale(
  explicit: string | undefined | null,
  navigatorLang: string | undefined | null,
): Locale {
  if (explicit === "ko" || explicit === "en") return explicit;
  if (navigatorLang && /^en([-_]|$)/i.test(navigatorLang)) return "en";
  return "ko";
}

/** 브라우저 환경에서 navigator.language 를 안전 조회(SSR/build 가드). */
export function currentNavigatorLang(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.language;
}
