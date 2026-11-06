"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useThemeStore } from "@/lib/stores/theme-store";
import { isTheme } from "./theme-constants";

/**
 * 로그인한 사용자의 저장 테마(`GET /api/users/me` 의 `theme`)를 앱 전체에 적용한다
 * (REQ-PROFILE-028). 앱 루트 `Providers` 에 있어 `/profile` 밖의 화면과 워크플로 에디터에도
 * 같은 테마가 적용된다.
 *
 * 사용자 정보가 없으면(로그인 전 · 세션 복원 중 · 로그아웃 뒤) 이 브라우저에 기억한 테마를
 * 쓴다. 로그아웃해도 기억한 값은 지우지 않는다. UI 언어의 `LocaleSync` 와 같은 방식이다.
 */
export function ThemeSync() {
  const userTheme = useAuthStore((s) => s.user?.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const initFromStorage = useThemeStore((s) => s.initFromStorage);

  useEffect(() => {
    if (isTheme(userTheme)) {
      setTheme(userTheme);
    } else {
      initFromStorage();
    }
  }, [userTheme, setTheme, initFromStorage]);

  return null;
}
