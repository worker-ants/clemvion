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

export function VerifyEmailContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "check-email"
  >(token ? "verifying" : "check-email");
  const [errorMessage, setErrorMessage] = useState("");
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

        {status === "check-email" && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t("auth.verifyEmail.backToLogin")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
