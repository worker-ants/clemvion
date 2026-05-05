"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useT, useLocale, type TFunction } from "@/lib/i18n";

function getPasswordStrength(
  password: string,
  t: TFunction,
): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: t("auth.register.strengthWeak"), color: "bg-red-500" };
  if (score <= 2) return { score, label: t("auth.register.strengthFair"), color: "bg-orange-500" };
  if (score <= 3) return { score, label: t("auth.register.strengthGood"), color: "bg-yellow-500" };
  if (score <= 4) return { score, label: t("auth.register.strengthStrong"), color: "bg-green-400" };
  return { score, label: t("auth.register.strengthVeryStrong"), color: "bg-green-600" };
}

interface ResetPasswordFormProps {
  token: string;
}

function ResetPasswordFormInner({ token }: ResetPasswordFormProps) {
  const t = useT();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
      const error = err as AxiosError<{ message?: string }>;
      const message =
        error.response?.data?.message ?? t("auth.resetPassword.genericFailed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth.resetPassword.successTitle")}</CardTitle>
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
          <CardTitle>{t("auth.resetPassword.invalidTitle")}</CardTitle>
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
        <CardTitle>{t("auth.resetPassword.title")}</CardTitle>
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
              aria-describedby={errors.password ? "password-error" : undefined}
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
                id="password-error"
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
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p
                id="confirm-password-error"
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

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/login" className="text-[hsl(var(--primary))] hover:underline">
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
