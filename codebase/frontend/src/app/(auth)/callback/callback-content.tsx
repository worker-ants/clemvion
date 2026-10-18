"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { refreshAccessToken } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { useAuthStore } from "@/lib/stores/auth-store";
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

interface CallbackContentProps {
  success?: string;
  error?: string;
}

export function CallbackContent({ success, error }: CallbackContentProps) {
  const t = useT();
  const router = useRouter();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
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
    // decision A (2026-05-31) — OAuth 콜백은 access token 을 URL 로 받지 않는다.
    // 콜백 응답이 refresh token 을 httpOnly 쿠키로 이미 설정했으므로,
    // `refreshAccessToken()` (`POST /auth/refresh`, withCredentials) 로 access
    // token 을 발급받아 메모리에 적재한 뒤 돌아갈 경로로 이동한다.
    refreshAccessToken()
      .then(async (token) => {
        if (cancelled) return;
        if (!token) {
          setStatus("error");
          return;
        }
        // 비밀번호 로그인과 같이 세션을 표시한다. setAuthenticated 가 심는 `has_session` 힌트 쿠키가
        // 없으면 proxy 가 보호 경로를 다시 /login 으로 돌린다.
        try {
          const user = (await usersApi.getMe()).data.data;
          if (user && !cancelled) setAuthenticated(token, user);
        } catch {
          // 사용자 조회에 실패하면 `has_session` 힌트 쿠키를 심지 못한다(`(auth)` 그룹에는 AuthProvider 가
          // 없어 이 페이지에서 복구하지 않는다). 그대로 이동하면 proxy 가 보호 경로를 `/login?redirect=<경로와
          // 쿼리>` 로 돌려보내므로 돌아갈 경로는 잃지 않고, 사용자는 다시 로그인하게 된다.
          // 이 실패의 처리 정책(재시도 · 오류 화면)은 세션 확립 로직을 모을 때 정한다(CLE-T-1X7DMR).
        }
        if (!cancelled) router.push(redirectTo);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [initialError, router, setAuthenticated]);

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
