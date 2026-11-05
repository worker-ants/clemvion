"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { refreshAccessToken } from "@/lib/api/client";
import { establishSession } from "@/lib/auth/establish-session";
import { consumeOauthRedirect } from "@/lib/auth/post-login-redirect";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/**
 * 소셜 로그인 콜백의 로그인 마무리. 액세스 토큰을 받지 못하면 `false` 다.
 *
 * decision A (2026-05-31) — OAuth 콜백은 액세스 토큰을 URL 로 받지 않는다. 콜백 응답이 리프레시 토큰을
 * httpOnly 쿠키로 이미 설정했으므로 `refreshAccessToken()`(`POST /auth/refresh`)으로 액세스 토큰을 받는다.
 * 이어서 비밀번호 로그인과 같은 진입점으로 로그인 상태와 힌트 쿠키(`has_session`)를 둔다. 사용자 조회만
 * 실패하면 힌트 쿠키를 둔 채 이동하고 목적지 화면의 AuthProvider 가 다시 복원한다(establishSession 주석).
 *
 * StrictMode 가 effect 를 두 번 돌리면 첫 실행은 취소된다. 리프레시는 `refreshAccessToken` 이 한 번으로
 * 합치고, 취소된 실행은 사용자 조회를 건너뛴다.
 */
async function finishOauthSignIn(isCancelled: () => boolean): Promise<boolean> {
  const token = await refreshAccessToken().catch(() => null);
  if (!token) return false;
  if (!isCancelled()) await establishSession(token);
  return true;
}

interface CallbackContentProps {
  success?: string;
  error?: string;
}

export function CallbackContent({ success, error }: CallbackContentProps) {
  const t = useT();
  const router = useRouter();
  const initialError = !!error || !success;
  const [status, setStatus] = useState<"loading" | "error">(
    initialError ? "error" : "loading",
  );
  // 로그인 화면이 남긴 복귀 경로. StrictMode 가 effect 를 두 번 돌려도 한 번만 꺼내도록 ref 에 둔다.
  const redirectToRef = useRef<string | null>(null);

  useEffect(() => {
    // 성공 · 실패와 관계없이 꺼내는 즉시 지운다. 남겨 두면 다음 로그인의 목적지가 된다.
    redirectToRef.current ??= consumeOauthRedirect();
    if (initialError) return;
    const redirectTo = redirectToRef.current;
    let cancelled = false;
    void finishOauthSignIn(() => cancelled).then((signedIn) => {
      if (cancelled) return;
      if (signedIn) router.push(redirectTo);
      else setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [initialError, router]);

  if (status === "loading") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth.callback.signingIn")}</CardTitle>
          <CardDescription>{t("auth.callback.pleaseWait")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.callback.authFailedTitle")}</CardTitle>
        <CardDescription>
          {error ?? t("auth.callback.authFailedDefault")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full">
          <Link href="/login">{t("auth.callback.tryAgain")}</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("auth.callback.backToLogin")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
