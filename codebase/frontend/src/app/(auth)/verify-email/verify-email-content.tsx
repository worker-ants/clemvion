"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { setAccessToken } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT, translate } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/stores/locale-store";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "check-email"
  >(token ? "verifying" : "check-email");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    async function verify() {
      const currentLocale = useLocaleStore.getState().locale;
      try {
        const response = await authApi.verifyEmail(token!);
        const accessToken = response.data.data?.accessToken;
        if (accessToken) {
          setAccessToken(accessToken);
        }
        setStatus("success");
        toast.success(translate(currentLocale, "auth.verifyEmail.verifiedToast"));
        setTimeout(() => router.push("/dashboard"), 2000);
      } catch (err) {
        const error = err as AxiosError<{ message?: string }>;
        const message =
          error.response?.data?.message ??
          translate(currentLocale, "auth.verifyEmail.genericFailed");
        setErrorMessage(message);
        setStatus("error");
        toast.error(message);
      }
    }

    verify();
  }, [token, router]);

  // 쿨다운 카운트다운 — 1초마다 감소, 0 도달 시 정지.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleResend() {
    // Basic format guard: reject malformed ?email= param before hitting the API.
    // The backend DTO (@IsEmail) is the authoritative validator; this is a
    // cheap client-side shield against crafted links reusing the resend endpoint.
    if (!email || !EMAIL_RE.test(email) || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    const currentLocale = useLocaleStore.getState().locale;
    try {
      await authApi.resendVerification(email);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(translate(currentLocale, "auth.verifyEmail.resendSent"));
    } catch {
      toast.error(translate(currentLocale, "auth.verifyEmail.resendFailed"));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.verifyEmail.title")}</CardTitle>
        <CardDescription>
          {status === "verifying" && t("auth.verifyEmail.descVerifying")}
          {status === "check-email" && t("auth.verifyEmail.descCheckEmail")}
          {status === "success" && t("auth.verifyEmail.descSuccess")}
          {status === "error" && t("auth.verifyEmail.descError")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "verifying" && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        )}

        {status === "check-email" && (
          <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>{t("auth.verifyEmail.checkEmailBody1")}</p>
            <p className="mt-2">
              {t("auth.verifyEmail.checkEmailBody2")}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>{t("auth.verifyEmail.redirecting")}</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[hsl(var(--destructive))]">
              {errorMessage}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">{t("auth.verifyEmail.backToLogin")}</Link>
            </Button>
          </div>
        )}

        {status === "check-email" && email && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendCooldown > 0 || isResending}
            onClick={() => void handleResend()}
          >
            {resendCooldown > 0
              ? t("auth.verifyEmail.resendCooldown", {
                  seconds: String(resendCooldown),
                })
              : t("auth.verifyEmail.resendLink")}
          </Button>
        )}

        {status === "check-email" && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t("auth.verifyEmail.backToLogin")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
