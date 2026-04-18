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
import type { OAuthProvider } from "@/lib/api/auth-providers";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api";

function startOauth(provider: OAuthProvider) {
  window.location.href = `${API_BASE_URL}/auth/oauth/${provider}?mode=register`;
}

interface RegisterFormProps {
  enabledProviders?: OAuthProvider[];
}

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

function RegisterFormInner({ enabledProviders = [] }: RegisterFormProps) {
  const t = useT();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const showGoogle = enabledProviders.includes("google");
  const showGithub = enabledProviders.includes("github");
  const showOauth = showGoogle || showGithub;

  // defined inside component so validation messages pick up the current locale via t()
  const registerSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("auth.validation.nameRequired"))
          .min(2, t("auth.register.nameMin")),
        email: z
          .string()
          .min(1, t("auth.validation.emailRequired"))
          .email(t("auth.validation.emailInvalid")),
        password: z
          .string()
          .min(1, t("auth.validation.passwordRequired"))
          .min(8, t("auth.validation.passwordTooShort")),
        termsAccepted: z.boolean().refine((val) => val === true, {
          message: t("auth.register.termsRequired"),
        }),
      }),
    [t],
  );

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      termsAccepted: false,
    },
  });

  const password = watch("password");
  const strength = getPasswordStrength(password, t);

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        termsAccepted: data.termsAccepted,
      });
      toast.success(t("auth.register.success"));
      router.push("/verify-email");
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const message =
        error.response?.data?.message ?? t("auth.register.genericFailed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.register.createAccount")}</CardTitle>
        <CardDescription>{t("auth.register.subtitleCta")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.register.name")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("auth.register.namePlaceholder")}
              autoComplete="name"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.register.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.register.emailPlaceholder")}
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.register.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.register.passwordCreatePlaceholder")}
              autoComplete="new-password"
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
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.password.message}</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--input))]"
              {...register("termsAccepted")}
            />
            <span>
              {(() => {
                const template = t("auth.register.termsAgreeHtml", {
                  terms: "\u0000TERMS\u0000",
                  privacy: "\u0000PRIVACY\u0000",
                });
                const parts = template.split(/\u0000TERMS\u0000|\u0000PRIVACY\u0000/);
                const termsFirst = template.indexOf("\u0000TERMS\u0000") < template.indexOf("\u0000PRIVACY\u0000");
                const firstLink = (
                  <Link
                    key="first"
                    href={termsFirst ? "/terms" : "/privacy"}
                    className="text-[hsl(var(--primary))] hover:underline"
                  >
                    {termsFirst ? t("auth.register.termsOfService") : t("auth.register.privacyPolicy")}
                  </Link>
                );
                const secondLink = (
                  <Link
                    key="second"
                    href={termsFirst ? "/privacy" : "/terms"}
                    className="text-[hsl(var(--primary))] hover:underline"
                  >
                    {termsFirst ? t("auth.register.privacyPolicy") : t("auth.register.termsOfService")}
                  </Link>
                );
                return (
                  <>
                    {parts[0]}
                    {firstLink}
                    {parts[1]}
                    {secondLink}
                    {parts[2]}
                  </>
                );
              })()}
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="text-sm text-[hsl(var(--destructive))]">{errors.termsAccepted.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("auth.register.creatingAccount") : t("auth.register.createAccount")}
          </Button>
        </form>

        {showOauth && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[hsl(var(--border))]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted-foreground))]">
                  {t("auth.register.orContinueWith")}
                </span>
              </div>
            </div>

            <div
              className={
                showGoogle && showGithub
                  ? "grid grid-cols-2 gap-3"
                  : "grid grid-cols-1 gap-3"
              }
            >
              {showGoogle && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startOauth("google")}
                >
                  Google
                </Button>
              )}
              {showGithub && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startOauth("github")}
                >
                  GitHub
                </Button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {t("auth.register.haveAccountCta")}{" "}
          <Link href="/login" className="text-[hsl(var(--primary))] hover:underline">
            {t("auth.login.submit")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function RegisterForm(props: RegisterFormProps) {
  const locale = useLocale();
  return <RegisterFormInner key={locale} {...props} />;
}
