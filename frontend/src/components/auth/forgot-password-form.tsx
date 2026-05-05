"use client";

import { useId, useMemo, useState } from "react";
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

function ForgotPasswordFormInner() {
  const t = useT();
  const emailErrorId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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
      setIsSubmitted(true);
      toast.success(t("auth.forgotPassword.genericInfo"));
    }
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth.forgotPassword.submittedTitle")}</CardTitle>
          <CardDescription>
            {t("auth.forgotPassword.submittedDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        <CardTitle>{t("auth.forgotPassword.title")}</CardTitle>
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
