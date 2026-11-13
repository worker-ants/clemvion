"use client";

// (main) 세그먼트 에러 바운더리 — [오류 화면과 빈 상태 「감지 규칙」](CLE-UI-ERRORS#감지-규칙).
// 페이지에서 전파된(uncaught) 에러를 HTTP 상태별 에러 페이지로 매핑한다.
// 403/404/500/네트워크는 (main)/layout.tsx 의 사이드바를 유지한다.
// 401(세션 만료)은 사이드바 없는 (auth) 경로(/login)로 보낸다. 지금 화면의 경로와 쿼리를 복귀 경로로
// 담아 로그인 뒤 같은 화면이 같은 쿼리로 열린다. 인증 프로바이더 · proxy 와 같은 규칙이다
// ([세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION#로그인-뒤-이동)).

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErrorPage, errorToVariant } from "@/components/ui/error-page";
import { useCurrentLoginHref } from "@/lib/auth/use-current-login-href";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const loginHref = useCurrentLoginHref();
  const variant = errorToVariant(error);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // 민감정보(axios error.response.data 등) 노출을 피해 message/digest 만 남긴다.
      console.error("[error-boundary]", error.message, error.digest ?? "");
    }
  }, [error]);

  useEffect(() => {
    if (variant === "sessionExpired") {
      router.replace(loginHref);
    }
  }, [variant, loginHref, router]);

  // 세션 만료는 redirect 중이므로 (main) 사이드바와 함께 렌더하지 않는다.
  if (variant === "sessionExpired") return null;

  return <ErrorPage variant={variant} onRetry={reset} />;
}
