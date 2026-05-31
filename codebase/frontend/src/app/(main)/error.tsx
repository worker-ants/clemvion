"use client";

// (main) 세그먼트 에러 바운더리 — spec/2-navigation/11-error-empty-states.md §1.
// 페이지에서 전파된(uncaught) 에러를 HTTP 상태별 에러 페이지로 매핑한다.
// 사이드바는 (main)/layout.tsx 가 유지하므로 §1.3 의 "403/404/500/네트워크 = 사이드바 표시" 부합.

import { useEffect } from "react";
import { ErrorPage, errorToVariant } from "@/components/ui/error-page";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 콘솔에 남겨 디버깅을 돕는다 (외부 로깅은 별도 인프라 단계).
    console.error(error);
  }, [error]);

  return <ErrorPage variant={errorToVariant(error)} onRetry={reset} />;
}
