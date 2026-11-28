"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import {
  serverErrorMessage,
  type ServerErrorKeyTable,
} from "@/lib/api/server-error-messages";
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
import { getPasswordStrength } from "@/lib/utils/password";

/**
 * 재설정 실패는 400 `VALIDATION_ERROR` 하나다(무효 · 만료 토큰, 비밀번호 규칙 위반). 원인을 가를 수 없어 링크 만료와
 * 비밀번호 규칙을 함께 안내하는 이 화면의 문구를 공용 표보다 먼저 고른다(NERV Task CLE-T-7QQPK7).
 */
const RESET_ERROR_OVERRIDES: ServerErrorKeyTable = {
  VALIDATION_ERROR: "auth.resetPassword.rejected",
};

interface ResetPasswordFormProps {
  token: string;
}

function ResetPasswordFormInner({ token }: ResetPasswordFormProps) {
  const t = useT();
  const router = useRouter();
  const passwordErrorId = useId();
  const confirmPasswordErrorId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // 서버가 재설정을 거부했는지. REQ-SIGNIN-035 의 재요청 링크를 보일지 정한다.
  const [serverRejected, setServerRejected] = useState(false);

  // defined inside component so validation messages pick up the current locale via t()
  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(1, t("auth.validation.passwordRequired"))
            .min(8, t("auth.validation.passwordTooShort")),
          confirmPassword: z.string().min(1, t("auth.resetPassword.confirmRequired")),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("auth.resetPassword.mismatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  const strength = getPasswordStrength(password, t);

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!token) {
      toast.error(t("auth.resetPassword.invalidTokenShort"));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, data.password);
      setIsSuccess(true);
      toast.success(t("auth.resetPassword.passwordChanged"));
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      // 실패는 모두 400 VALIDATION_ERROR 라 코드로 원인을 가를 수 없다. 링크 만료와 비밀번호 규칙을 함께 안내한다.
      // 서버 `message` 는 영문이라 보이지 않는다(NERV CLE-UI-I18N-BACKEND 규칙 5, Task CLE-T-7QQPK7).
      const error = err as AxiosError;
      toast.error(
        serverErrorMessage(
          err,
          t,
          t("auth.resetPassword.genericFailed"),
          RESET_ERROR_OVERRIDES,
        ),
      );
      // 만료 · 무효 토큰도 같은 코드라 서버가 거부한 모든 경우에 재요청 링크를 보인다(REQ-SIGNIN-035).
      // 응답을 받지 못했으면 토큰 문제인지 알 수 없으므로 보이지 않는다.
      setServerRejected(Boolean(error.response));
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle as="h1">{t("auth.resetPassword.successTitle")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.successDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">{t("auth.resetPassword.goToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle as="h1">{t("auth.resetPassword.invalidTitle")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.invalidDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/forgot-password">{t("auth.resetPassword.requestNewLink")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle as="h1">{t("auth.resetPassword.title")}</CardTitle>
        <CardDescription>{t("auth.resetPassword.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.resetPassword.newPassword")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={errors.password ? passwordErrorId : undefined}
              {...register("password")}
            />
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex h-2 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : "bg-[hsl(var(--muted))]"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{strength.label}</p>
              </div>
            )}
            {errors.password && (
              <p
                id={passwordErrorId}
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? "true" : undefined}
              aria-describedby={
                errors.confirmPassword ? confirmPasswordErrorId : undefined
              }
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p
                id={confirmPasswordErrorId}
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
          </Button>
        </form>

        {serverRejected && (
          <p className="mt-4 text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-[hsl(var(--primary))] underline"
            >
              {t("auth.resetPassword.requestNewLink")}
            </Link>
          </p>
        )}

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/login" className="text-[hsl(var(--primary))] underline">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const locale = useLocale();
  return <ResetPasswordFormInner key={locale} {...props} />;
}
