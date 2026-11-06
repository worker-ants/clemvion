/**
 * 테마 값과 규칙. `"use client"` 가 없는 모듈이라 서버 컴포넌트(루트 레이아웃의 인라인
 * 스크립트)와 클라이언트 store 가 같은 값을 쓴다.
 *
 * 스펙: CLE-ACCT-PROFILE §테마 (REQ-PROFILE-022 · 023 · 028 · 029).
 */

export const THEMES = ["light", "dark", "system"] as const;

/** 사용자가 고르는 테마. 서버 `users.theme` 저장값과 같다. */
export type Theme = (typeof THEMES)[number];

/** 화면에 실제로 그리는 테마. `<html>` 의 클래스 이름이다. */
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME: Theme = "light";

/** 이 브라우저에서 마지막으로 확정한 테마를 기억하는 localStorage 키. */
export const THEME_STORAGE_KEY = "clemvion.theme";

export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** `system` 은 OS 색상 모드로 라이트나 다크를 고른다. */
export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}
