"use client";

import { create } from "zustand";
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isTheme,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme/theme-constants";

/**
 * 화면에 적용한 테마. 스펙: CLE-ACCT-PROFILE §테마.
 *
 * - `theme` 은 사용자가 확정한 테마다. 바꾸면 `<html>` 클래스와 localStorage(`clemvion.theme`)를
 *   함께 바꾼다. localStorage 값은 다음 새로 고침 때 `THEME_INIT_SCRIPT` 가 첫 화면에 쓴다.
 * - `preview` 는 환경설정 카드의 미리보기다. 화면만 바꾸고 localStorage 에는 쓰지 않는다.
 * - 화면에 그리는 테마가 `system` 이면 OS 색상 모드 변경(`change`)을 구독해 바로 따라 바꾼다
 *   (REQ-PROFILE-023). 다른 테마로 바꾸면 구독을 끊는다.
 */
interface ThemeState {
  /** 사용자가 확정한 테마. */
  theme: Theme;
  /** 환경설정 카드의 미리보기. null 이면 확정한 테마를 그린다. */
  preview: Theme | null;
  /** 확정한 테마를 바꾸고 이 브라우저에 기억한다. */
  setTheme: (theme: Theme) => void;
  /** 저장하기 전에 화면만 바꾼다. */
  previewTheme: (theme: Theme) => void;
  /** 미리보기를 거두고 확정한 테마로 돌린다. */
  clearPreview: () => void;
  /** 이 브라우저에 기억한 테마를 확정한 테마로 싣는다(로그인 전 · 로그아웃 뒤). */
  initFromStorage: () => void;
}

type ThemeSelection = Pick<ThemeState, "theme" | "preview">;

function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function applyThemeClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const { classList } = document.documentElement;
  const other: ResolvedTheme = resolved === "dark" ? "light" : "dark";
  // 이미 같은 클래스면 DOM 을 건드리지 않는다(MutationObserver 를 깨우지 않게).
  if (classList.contains(resolved) && !classList.contains(other)) return;
  classList.remove(other);
  classList.add(resolved);
}

let systemQuery: MediaQueryList | null = null;

function handleSystemChange() {
  render(useThemeStore.getState());
}

function syncSystemListener(applied: Theme) {
  if (applied !== "system") {
    systemQuery?.removeEventListener("change", handleSystemChange);
    systemQuery = null;
    return;
  }
  if (systemQuery) return;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  systemQuery = window.matchMedia(DARK_MEDIA_QUERY);
  systemQuery.addEventListener("change", handleSystemChange);
}

function render(selection: ThemeSelection) {
  const applied = selection.preview ?? selection.theme;
  applyThemeClass(resolveTheme(applied, prefersDark()));
  syncSystemListener(applied);
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : DEFAULT_THEME;
  } catch {
    /* localStorage 를 쓸 수 없다(private 모드 등) — 기본값 */
    return DEFAULT_THEME;
  }
}

function writeStoredTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* localStorage 를 쓸 수 없다(private 모드 · 용량 초과) */
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: DEFAULT_THEME,
  preview: null,
  setTheme: (theme) => {
    writeStoredTheme(theme);
    render({ theme, preview: get().preview });
    set({ theme });
  },
  previewTheme: (preview) => {
    render({ theme: get().theme, preview });
    set({ preview });
  },
  clearPreview: () => {
    render({ theme: get().theme, preview: null });
    set({ preview: null });
  },
  initFromStorage: () => {
    const theme = readStoredTheme();
    render({ theme, preview: get().preview });
    set({ theme });
  },
}));
