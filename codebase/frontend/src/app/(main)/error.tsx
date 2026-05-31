"use client";

// (main) 세그먼트 에러 바운더리 — spec/2-navigation/11-error-empty-states.md §1.
// 페이지에서 전파된(uncaught) 에러를 HTTP 상태별 에러 페이지로 매핑한다.
// 403/404/500/네트워크는 (main)/layout.tsx 의 사이드바를 유지한다 (§1.3 "사이드바 표시").
// 401(세션 만료)은 §1.3 "사이드바 숨김" 요건에 따라 사이드바 없는 (auth) 경로(/login)로
// 보낸다 — auth-provider 의 세션 만료 처리와 동일 경로이며, redirect 파라미터로 원래 URL 복귀.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ErrorPage,
  errorToVariant,
  isSafeRedirectPath,
} from "@/components/ui/error-page";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const variant = errorToVariant(error);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // 민감정보(axios error.response.data 등) 노출을 피해 message/digest 만 남긴다.
      console.error("[error-boundary]", error.message, error.digest ?? "");
    }
  }, [error]);

  useEffect(() => {
    if (variant === "sessionExpired") {
      const target = isSafeRedirectPath(pathname) ? pathname! : "/dashboard";
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
    }
  }, [variant, pathname, router]);

  // 세션 만료는 redirect 중이므로 (main) 사이드바와 함께 렌더하지 않는다.
  if (variant === "sessionExpired") return null;

  return <ErrorPage variant={variant} onRetry={reset} />;
}
