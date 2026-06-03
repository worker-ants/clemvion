"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useT, useLocale } from "@/lib/i18n";

const RESEND_COOLDOWN_SECONDS = 60;

function ForgotPasswordFormInner() {
  const t = useT();
  const emailErrorId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // 제출된 이메일을 보관해 재발송 버튼이 동일 주소로 재요청할 수 있게 한다.
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // 쿨다운 카운트다운 — 1초마다 감소, 0 도달 시 정지.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // defined inside component so validation messages pick up the current locale via t()
  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("auth.validation.emailRequired"))
          .email(t("auth.validation.emailInvalid")),
      }),
    [t],
  );

  type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(data.email);
    } catch (err) {
      const error = err as AxiosError;
      void error;
    } finally {
      setIsLoading(false);
      setSubmittedEmail(data.email);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setIsSubmitted(true);
      toast.success(t("auth.forgotPassword.genericInfo"));
    }
  }

  async function handleResend() {
    if (!submittedEmail || resendCooldown > 0) return;
    try {
      await authApi.forgotPassword(submittedEmail);
    } catch (err) {
      const error = err as AxiosError;
      void error;
    } finally {
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(t("auth.forgotPassword.resendSent"));
    }
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle as="h1">{t("auth.forgotPassword.submittedTitle")}</CardTitle>
          <CardDescription>
            {t("auth.forgotPassword.submittedDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendCooldown > 0}
            onClick={() => void handleResend()}
          >
            {resendCooldown > 0
              ? t("auth.forgotPassword.resendCooldown", {
                  seconds: String(resendCooldown),
                })
              : t("auth.forgotPassword.resend")}
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t("auth.forgotPassword.backToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle as="h1">{t("auth.forgotPassword.title")}</CardTitle>
        <CardDescription>
          {t("auth.forgotPassword.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.forgotPassword.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.forgotPassword.emailPlaceholder")}
              autoComplete="email"
              aria-invalid={errors.email ? "true" : undefined}
              aria-describedby={errors.email ? emailErrorId : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p
                id={emailErrorId}
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/login" className="text-[hsl(var(--primary))] underline">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const locale = useLocale();
  return <ForgotPasswordFormInner key={locale} />;
}
