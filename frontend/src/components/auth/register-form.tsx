"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { setAccessToken } from "@/lib/api/client";
import type { OAuthProvider } from "@/lib/api/auth-providers";
import { invitationsApi, type InvitationMeta } from "@/lib/api/workspaces";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api";

function startOauth(provider: OAuthProvider) {
  window.location.href = `${API_BASE_URL}/auth/oauth/${provider}?mode=register`;
}

interface RegisterFormProps {
  enabledProviders?: OAuthProvider[];
  /** spec/2-navigation/10-auth-flow.md §2.6 — 메일 링크로 들어왔을 때만 채워진다. */
  invitationToken?: string;
}

type InvitationState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; meta: InvitationMeta }
  | { kind: "error"; message: string };

function RegisterFormInner({
  enabledProviders = [],
  invitationToken,
}: RegisterFormProps) {
  const t = useT();
  const router = useRouter();
  // useId — 동일 폼 다중 마운트 시 ID 충돌 방지 (review W-10).
  const nameErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const termsErrorId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [invitationState, setInvitationState] = useState<InvitationState>(
    invitationToken ? { kind: "loading" } : { kind: "none" },
  );

  // OAuth 는 초대 토큰 흐름에서 의미가 없다 — 토큰의 이메일과 OAuth 프로바이더
  // 이메일이 다른 경우 가입 후 자동 accept 가 깨지므로 일부러 숨긴다.
  const isInvitationFlow = !!invitationToken;
  const showGoogle = !isInvitationFlow && enabledProviders.includes("google");
  const showGithub = !isInvitationFlow && enabledProviders.includes("github");
  const showOauth = showGoogle || showGithub;

  useEffect(() => {
    if (!invitationToken) return;
    let cancelled = false;
    (async () => {
      try {
        const meta = await invitationsApi.getByToken(invitationToken);
        if (!cancelled) setInvitationState({ kind: "ready", meta });
      } catch (err) {
        if (cancelled) return;
        const error = err as AxiosError<{
          message?: string;
          code?: string;
        }>;
        const status = error.response?.status;
        // 410 = 만료/사용됨, 404 = 존재하지 않음. 둘 다 가입 페이지에서는
        // "이 초대는 더 이상 유효하지 않아요" 안내로 묶어서 보여준다.
        const message =
          status === 410
            ? t("auth.register.invitationGone")
            : status === 404
              ? t("auth.register.invitationNotFound")
              : error.response?.data?.message ??
                t("auth.register.invitationFetchFailed");
        setInvitationState({ kind: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitationToken, t]);

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
    setValue,
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

  // 초대 메타가 도착하면 이메일을 폼 값으로 prefill — 폼 제출 시 이 값이 그대로
  // 백엔드에 보내진다 (백엔드는 토큰 이메일과 본문 이메일 일치를 강제).
  useEffect(() => {
    if (invitationState.kind === "ready") {
      setValue("email", invitationState.meta.email, {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [invitationState, setValue]);

  const password = watch("password");
  const strength = getPasswordStrength(password, t);

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      const response = await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        termsAccepted: data.termsAccepted,
        invitationToken,
      });
      const result = response.data.data;
      const accessToken = result?.accessToken;
      if (accessToken) {
        // 초대 토큰 가입 — 백엔드가 이메일 인증을 건너뛰고 자동 로그인.
        // Access Token 을 메모리에 셋하고 Refresh Token 쿠키는 이미 응답에서 셋됐다.
        setAccessToken(accessToken);
        toast.success(t("auth.register.invitationSuccess"));
        router.push("/dashboard");
      } else {
        toast.success(t("auth.register.success"));
        router.push("/verify-email");
      }
    } catch (err) {
      const error = err as AxiosError<{ message?: string; code?: string }>;
      const code = error.response?.data?.code;
      const message =
        code === "invitation_email_mismatch"
          ? t("auth.register.invitationEmailMismatch")
          : error.response?.data?.message ?? t("auth.register.genericFailed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  // 초대 토큰 메타가 도착하지 않았거나 실패한 경우 상단에 안내 카드.
  const invitationBanner = (() => {
    if (invitationState.kind === "loading") {
      return (
        <p className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t("auth.register.invitationLoading")}
        </p>
      );
    }
    if (invitationState.kind === "error") {
      return (
        <p className="rounded-md border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {invitationState.message}
        </p>
      );
    }
    if (invitationState.kind === "ready") {
      const { workspaceName, invitedByName } = invitationState.meta;
      return (
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm">
          <p className="font-medium">
            {t("auth.register.invitationHeader", { workspace: workspaceName })}
          </p>
          {invitedByName && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("auth.register.invitationFrom", { name: invitedByName })}
            </p>
          )}
        </div>
      );
    }
    return null;
  })();

  const emailReadOnly = invitationState.kind === "ready";

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle as="h1">{t("auth.register.createAccount")}</CardTitle>
        <CardDescription>{t("auth.register.subtitleCta")}</CardDescription>
      </CardHeader>
      <CardContent>
        {invitationBanner && (
          <div className="mb-4">{invitationBanner}</div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.register.name")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("auth.register.namePlaceholder")}
              autoComplete="name"
              aria-invalid={errors.name ? "true" : undefined}
              aria-describedby={errors.name ? nameErrorId : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p
                id={nameErrorId}
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.register.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.register.emailPlaceholder")}
              autoComplete="email"
              readOnly={emailReadOnly}
              aria-readonly={emailReadOnly}
              aria-invalid={errors.email ? "true" : undefined}
              aria-describedby={errors.email ? emailErrorId : undefined}
              className={emailReadOnly ? "bg-[hsl(var(--muted))]" : undefined}
              {...register("email")}
            />
            {emailReadOnly && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("auth.register.invitationEmailLocked")}
              </p>
            )}
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

          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.register.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.register.passwordCreatePlaceholder")}
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

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--input))]"
              aria-invalid={errors.termsAccepted ? "true" : undefined}
              aria-describedby={
                errors.termsAccepted ? termsErrorId : undefined
              }
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
                    className="text-[hsl(var(--primary))] underline"
                  >
                    {termsFirst ? t("auth.register.termsOfService") : t("auth.register.privacyPolicy")}
                  </Link>
                );
                const secondLink = (
                  <Link
                    key="second"
                    href={termsFirst ? "/privacy" : "/terms"}
                    className="text-[hsl(var(--primary))] underline"
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
            <p
              id={termsErrorId}
              role="alert"
              className="text-sm text-[hsl(var(--destructive))]"
            >
              {errors.termsAccepted.message}
            </p>
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
          <Link href="/login" className="text-[hsl(var(--primary))] underline">
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
