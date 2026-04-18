"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setAccessToken } from "@/lib/api/client";
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
  token?: string;
}

export function CallbackContent({ success, error, token }: CallbackContentProps) {
  const t = useT();
  const router = useRouter();
  const hasError = !!error || (!success && !token);
  const [status] = useState<"loading" | "error">(
    hasError ? "error" : "loading",
  );

  useEffect(() => {
    if (hasError) return;

    if (token) {
      setAccessToken(token);
    }
    router.push("/dashboard");
  }, [hasError, token, router]);

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
