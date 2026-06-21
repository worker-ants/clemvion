"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { setAccessToken } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

function VerifyEmailChangeInner() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // verify 실패만 state 로 둔다 (async catch). 토큰 부재는 render 시점에 파생한다
  // — effect 내 동기 setState 회피.
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // 토큰은 1회성이라 effect 중복 실행(strict mode)으로 두 번 verify 하지 않도록 가드.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;

    usersApi
      .verifyEmailChange(token)
      .then((res) => {
        // 전 세션 revoke + 현재 디바이스 재발급 — 새 access token 으로 교체(refresh 쿠키 자동 회전).
        setAccessToken(res.data.data.accessToken);
        toast.success(t("profile.changeEmailVerifySuccess"));
        router.replace("/profile");
      })
      .catch(() => {
        setVerifyError(t("profile.changeEmailVerifyFailed"));
      });
  }, [token, router, t]);

  const error = !token ? t("profile.changeEmailMissingToken") : verifyError;

  if (!error) {
    return (
      <div
        className="flex items-center justify-center gap-3 py-12 text-[hsl(var(--muted-foreground))]"
        data-testid="email-change-verifying"
      >
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>{t("profile.changeEmailVerifying")}</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("profile.changeEmailPageTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className="text-sm text-[hsl(var(--destructive))]"
            data-testid="email-change-verify-error"
          >
            {error}
          </p>
          <Button
            variant="outline"
            onClick={() => router.replace("/profile/change-email")}
          >
            {t("profile.changeEmailPageTitle")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailChangePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      }
    >
      <VerifyEmailChangeInner />
    </Suspense>
  );
}
