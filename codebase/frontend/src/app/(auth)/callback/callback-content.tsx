"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { refreshAccessToken } from "@/lib/api/client";
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
  const initialError = !!error || !success;
  const [status, setStatus] = useState<"loading" | "error">(
    initialError ? "error" : "loading",
  );

  useEffect(() => {
    if (initialError) return;
    let cancelled = false;
    // decision A (2026-05-31) — OAuth 콜백은 access token 을 URL 로 받지 않는다.
    // 콜백 응답이 refresh token 을 httpOnly 쿠키로 이미 설정했으므로,
    // `refreshAccessToken()` (`POST /auth/refresh`, withCredentials) 로 access
    // token 을 발급받아 메모리에 적재한 뒤 대시보드로 이동한다.
    refreshAccessToken()
      .then((token) => {
        if (cancelled) return;
        if (token) {
          router.push("/dashboard");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
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
