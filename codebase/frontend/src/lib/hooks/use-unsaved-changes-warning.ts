"use client";

import { useEffect } from "react";

/**
 * 미저장 입력이 있을 때 브라우저 이탈(새로고침·탭 닫기)에 네이티브 확인
 * 다이얼로그를 띄운다. `active` 가 false 면 리스너를 붙이지 않는다.
 * spec/2-navigation/4-integration.md §3.6(이탈·복원)의 이탈 가드.
 * (refactor 03 m-3 — page.tsx beforeunload effect 에서 무변경 추출.)
 *
 * @param active 가드 활성 여부(미저장 입력 존재).
 */
export function useUnsavedChangesWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
