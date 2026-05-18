"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { toast } from "sonner";
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { setAccessToken } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
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
import { useT, useLocale } from "@/lib/i18n";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api";

interface LoginFormProps {
  enabledProviders?: OAuthProvider[];
}

function LoginFormInner({ enabledProviders = [] }: LoginFormProps) {
  const t = useT();
  const router = useRouter();
  // 페이지에 동일 폼이 두 번 마운트되어도 ID 충돌이 없도록 useId 사용
  // (review W-10 — 고정 "email-error" 등은 axe duplicate-id 위반 위험).
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"webauthn" | "totp" | null>(
    null,
  );
  const [totpCode, setTotpCode] = useState("");
  const [webauthnError, setWebauthnError] = useState<string | null>(null);
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const webauthnAttemptedRef = useRef(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  // defined inside component so validation messages pick up the current locale via t()
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("auth.validation.emailRequired"))
          .email(t("auth.validation.emailInvalid")),
        password: z.string().min(1, t("auth.validation.passwordRequired")),
        rememberMe: z.boolean().optional(),
      }),
    [t],
  );

  type LoginFormValues = z.infer<typeof loginSchema>;

  const completeLogin = useCallback(
    async (accessToken: string) => {
      setAccessToken(accessToken);
      try {
        const userRes = await usersApi.getMe();
        const user = userRes.data.data;
        if (user) {
          setAuthenticated(accessToken, user);
        }
      } catch {
        /* AuthProvider will restore on next page load */
      }
      toast.success(t("auth.login.signedIn"));
      router.push("/dashboard");
    },
    [router, setAuthenticated, t],
  );

  async function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken || totpCode.trim().length < 6) return;
    setIsLoading(true);
    try {
      const response = await authApi.loginTotp(challengeToken, totpCode.trim());
      const accessToken = response.data.data?.accessToken;
      if (accessToken) {
        await completeLogin(accessToken);
      }
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const message =
        error.response?.data?.message ?? t("auth.login.invalidTotp");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  function startOauth(provider: OAuthProvider) {
    const rememberMe = getValues("rememberMe") ? "&rememberMe=true" : "";
    window.location.href = `${API_BASE_URL}/auth/oauth/${provider}?mode=login${rememberMe}`;
  }

  const showGoogle = enabledProviders.includes("google");
  const showGithub = enabledProviders.includes("github");
  const showOauth = showGoogle || showGithub;

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      const response = await authApi.login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });
      const payload = response.data.data;
      if (payload && "requires2fa" in payload && payload.requires2fa) {
        setChallengeToken(payload.challengeToken);
        // spec/5-system/1-auth.md §1.4.2 — WebAuthn 우선, TOTP fallback 자동 금지
        const method = payload.methods.includes("webauthn") ? "webauthn" : "totp";
        setTwoFactorMethod(method);
        webauthnAttemptedRef.current = false;
        setShowRecoveryInput(false);
        setRecoveryCode("");
        setTotpCode("");
        setWebauthnError(null);
        toast.info(
          method === "webauthn"
            ? t("auth.login.webauthnRequired")
            : t("auth.login.totpRequired"),
        );
        return;
      }
      const accessToken =
        payload && "accessToken" in payload ? payload.accessToken : undefined;
      if (accessToken) {
        await completeLogin(accessToken);
      }
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const message = error.response?.data?.message ?? t("auth.login.genericFailed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  // ===== WebAuthn helpers =====

  const runWebAuthn = useCallback(async () => {
    if (!challengeToken) return;
    if (!browserSupportsWebAuthn()) {
      setWebauthnError(t("auth.login.webauthnUnsupported"));
      return;
    }
    setIsLoading(true);
    setWebauthnError(null);
    try {
      const optionsRes = await authApi.webauthnAuthenticateOptions(challengeToken);
      const { publicKey, optionsToken } = optionsRes.data.data;
      // @ts-expect-error — simplewebauthn 의 PublicKeyCredentialRequestOptionsJSON 형 가져오기 생략
      const credential = await startAuthentication({ optionsJSON: publicKey });
      const verifyRes = await authApi.webauthnAuthenticateVerify(
        challengeToken,
        optionsToken,
        credential,
      );
      const accessToken = verifyRes.data.data?.accessToken;
      if (accessToken) {
        await completeLogin(accessToken);
      }
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const msg = error.response?.data?.message ?? t("auth.login.webauthnFailed");
      setWebauthnError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [challengeToken, completeLogin, t]);

  useEffect(() => {
    if (
      twoFactorMethod === "webauthn" &&
      challengeToken &&
      !webauthnAttemptedRef.current &&
      browserSupportsWebAuthn()
    ) {
      webauthnAttemptedRef.current = true;
      void runWebAuthn();
    }
  }, [twoFactorMethod, challengeToken, runWebAuthn]);

  async function onSubmitRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken || recoveryCode.trim().length < 12) return;
    setIsLoading(true);
    try {
      const response = await authApi.webauthnRecovery(
        challengeToken,
        recoveryCode.trim(),
      );
      const accessToken = response.data.data?.accessToken;
      if (accessToken) {
        await completeLogin(accessToken);
      }
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const msg = error.response?.data?.message ?? t("auth.login.recoveryFailed");
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function backToPassword() {
    setChallengeToken(null);
    setTwoFactorMethod(null);
    setTotpCode("");
    setRecoveryCode("");
    setShowRecoveryInput(false);
    setWebauthnError(null);
    webauthnAttemptedRef.current = false;
  }

  if (challengeToken && twoFactorMethod === "webauthn") {
    const browserOk = browserSupportsWebAuthn();
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth.twoFactor.title")}</CardTitle>
          <CardDescription>
            {t("auth.login.webauthnSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!browserOk && (
            <p className="mb-4 text-sm text-[hsl(var(--destructive))]">
              {t("auth.login.webauthnUnsupported")}
            </p>
          )}
          {!showRecoveryInput && (
            <div className="space-y-4">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  webauthnAttemptedRef.current = true;
                  void runWebAuthn();
                }}
                disabled={isLoading || !browserOk}
              >
                {isLoading
                  ? t("auth.login.webauthnConfirming")
                  : t("auth.login.webauthnConfirm")}
              </Button>
              {webauthnError && (
                <p
                  role="alert"
                  className="text-sm text-[hsl(var(--destructive))]"
                >
                  {webauthnError}
                </p>
              )}
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setShowRecoveryInput(true)}
              >
                {t("auth.login.useRecoveryCode")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={backToPassword}
              >
                {t("auth.login.backToLogin")}
              </Button>
            </div>
          )}
          {showRecoveryInput && (
            <form onSubmit={onSubmitRecovery} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery">
                  {t("auth.login.recoveryCodeLabel")}
                </Label>
                <Input
                  id="recovery"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder={t("auth.login.recoveryCodePlaceholder")}
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? t("auth.login.recoveryConfirming")
                  : t("auth.login.recoveryConfirm")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowRecoveryInput(false)}
              >
                {t("auth.login.backToWebauthn")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    );
  }

  if (challengeToken && twoFactorMethod === "totp") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth.twoFactor.title")}</CardTitle>
          <CardDescription>
            {t("auth.login.totpSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmitTotp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp">{t("auth.login.totpLabel")}</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("auth.login.totpPlaceholder")}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("auth.login.totpConfirming") : t("auth.login.totpConfirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={backToPassword}
            >
              {t("auth.login.backToLogin")}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle as="h1">{t("auth.login.title")}</CardTitle>
        <CardDescription>{t("auth.login.welcomeBack")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.login.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.login.emailPlaceholder")}
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

          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.login.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.login.passwordPlaceholder")}
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={errors.password ? passwordErrorId : undefined}
              {...register("password")}
            />
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[hsl(var(--input))]"
                {...register("rememberMe")}
              />
              {t("auth.login.rememberMe")}
            </label>
            <Link
              href="/forgot-password"
              // WCAG 1.4.1 (link-in-text-block) — 본문과의 식별을 색에만
              // 의존하지 않도록 underline 항시 노출. hover-only underline 으로
              // 되돌리지 말 것.
              className="text-sm text-[hsl(var(--primary))] underline"
            >
              {t("auth.login.forgotPassword")}
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("auth.login.submitting") : t("auth.login.submit")}
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
                  {t("auth.login.orContinueWith")}
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
          {t("auth.login.noAccountCta")}{" "}
          <Link href="/register" className="text-[hsl(var(--primary))] underline">
            {t("auth.login.createAccount")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function LoginForm(props: LoginFormProps) {
  // Key by locale so the underlying useForm resolver picks up new validation messages after switch.
  const locale = useLocale();
  return <LoginFormInner key={locale} {...props} />;
}
