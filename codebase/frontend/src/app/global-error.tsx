"use client";

// 루트 layout 자체가 throw 한 경우의 최종 폴백 — root layout 을 대체하므로
// 자체 <html><body> 와 전역 스타일을 직접 포함해야 한다 (Next.js global-error 규약).
// spec/2-navigation/11-error-empty-states.md §1.2 서버 에러.
import "./globals.css";
import { useEffect } from "react";
import { ErrorPage, errorToVariant } from "@/components/ui/error-page";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[global-error]", error.message, error.digest ?? "");
    }
  }, [error]);

  return (
    // global-error 컨텍스트에서는 i18n 훅·Providers 가 마운트되지 않을 수 있어
    // 기본 언어를 ko 로 고정한다 (루트 layout 의 lang="ko" 와 동일).
    <html lang="ko">
      <body>
        <ErrorPage variant={errorToVariant(error)} onRetry={reset} />
      </body>
    </html>
  );
}
