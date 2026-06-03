"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  invitationsApi,
  INVITATION_ERROR,
  type InvitationMeta,
} from "@/lib/api/invitations";
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

/**
 * 백엔드 응답은 GlobalExceptionFilter 가 `{error: {code, message, ...}}` 로 wrap 한다.
 * 일부 컨트롤러는 평탄한 `{code, message}` 도 반환할 수 있어 양쪽을 모두 탐색한다.
 */
type ApiErrorBody = {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
};

function extractApiCode(err: AxiosError<ApiErrorBody>): string | undefined {
  const data = err.response?.data;
  return data?.code ?? data?.error?.code;
}

function extractApiMessage(err: AxiosError<ApiErrorBody>): string | undefined {
  const data = err.response?.data;
  return data?.message ?? data?.error?.message;
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
  | {
      kind: "error";
      /** HTTP status (410=만료/사용됨, 404=없음). 다른 경우 undefined. */
      status?: number;
      /** 서버가 내려준 raw message (없으면 status 별 i18n key 로 폴백). */
      message?: string;
    };

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
  // 이메일 중복 확인(onBlur) 상태. 초대 흐름(읽기전용)에서는 사용하지 않는다.
  const [emailCheck, setEmailCheck] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  // 마지막으로 서버에 확인 요청한 이메일 — blur 재트리거 시 중복 호출을 막는다.
  const lastCheckedEmailRef = useRef<string>("");
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
    // effect deps 에 `t` 를 넣지 않는 것이 의도적이다 — `useT` 는 locale 변경 시
    // 새 reference 를 돌려주므로, deps 에 포함되면 locale 토글이 토큰 재페치를
    // 유발한다. status 만 저장하고 텍스트 변환은 렌더 시점(banner)에서.
    if (!invitationToken) return;
    let cancelled = false;
    (async () => {
      try {
        const meta = await invitationsApi.getByToken(invitationToken);
        if (!cancelled) setInvitationState({ kind: "ready", meta });
      } catch (err) {
        if (cancelled) return;
        const error = err as AxiosError<ApiErrorBody>;
        setInvitationState({
          kind: "error",
          status: error.response?.status,
          message: extractApiMessage(error),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitationToken]);

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
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
      }
    } catch (err) {
      const error = err as AxiosError<ApiErrorBody>;
      const code = extractApiCode(error);
      const message =
        code === INVITATION_ERROR.EMAIL_MISMATCH
          ? t("auth.register.invitationEmailMismatch")
          : extractApiMessage(error) ?? t("auth.register.genericFailed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  // 이메일 Input blur 시 중복 확인 — 빈 값/형식 오류/초대 흐름은 건너뛴다.
  // 가벼운 형식 가드로 빈/잘못된 이메일에 대한 불필요한 호출을 막는다.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  async function checkEmailAvailability(value: string) {
    const email = value.trim();
    if (emailReadOnly || !email || !EMAIL_RE.test(email)) {
      setEmailCheck("idle");
      return;
    }
    // 이미 진행 중이거나, 직전 확인과 동일한 이메일이면 재요청하지 않는다.
    // 서버 레이트 리밋(5 req/min)과 결합해 반복 blur 에 의한 열거를 차단한다.
    if (emailCheck === "checking" || email === lastCheckedEmailRef.current) {
      return;
    }
    lastCheckedEmailRef.current = email;
    setEmailCheck("checking");
    try {
      const response = await authApi.checkEmail(email);
      setEmailCheck(response.data.data?.available ? "available" : "taken");
    } catch {
      // 네트워크/서버 오류 시 차단하지 않는다 — 제출 시 백엔드가 최종 검증.
      setEmailCheck("idle");
    }
  }

  const emailField = register("email");
  const emailTaken = emailCheck === "taken";

  const emailReadOnly = invitationState.kind === "ready";
  // submit 가능 여부: 일반 가입 OK / 초대 흐름에서는 ready 상태일 때만 허용.
  const submitDisabled =
    isLoading ||
    invitationState.kind === "loading" ||
    invitationState.kind === "error";

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle as="h1">{t("auth.register.createAccount")}</CardTitle>
        <CardDescription>{t("auth.register.subtitleCta")}</CardDescription>
      </CardHeader>
      <CardContent>
        <InvitationBanner state={invitationState} />

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
              aria-invalid={errors.email || emailTaken ? "true" : undefined}
              aria-describedby={
                errors.email || emailTaken ? emailErrorId : undefined
              }
              className={emailReadOnly ? "bg-[hsl(var(--muted))]" : undefined}
              {...emailField}
              onBlur={(e) => {
                void emailField.onBlur(e);
                void checkEmailAvailability(e.target.value);
              }}
              onChange={(e) => {
                void emailField.onChange(e);
                // 입력이 바뀌면 이전 중복 확인 결과를 무효화한다.
                if (emailCheck !== "idle") setEmailCheck("idle");
              }}
            />
            {emailReadOnly && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("auth.register.invitationEmailLocked")}
              </p>
            )}
            {!emailReadOnly && emailCheck === "checking" && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("auth.register.emailChecking")}
              </p>
            )}
            {!errors.email && emailTaken && (
              <p
                id={emailErrorId}
                role="alert"
                className="text-sm text-[hsl(var(--destructive))]"
              >
                {t("auth.register.emailTaken")}
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

          <Button
            type="submit"
            className="w-full"
            disabled={submitDisabled}
          >
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

/**
 * 초대 토큰 흐름의 안내 배너. loading 동안 placeholder, error 시 raw 메시지/
 * status 별 i18n 텍스트, ready 시 워크스페이스·초대자 안내.
 *
 * effect 의 deps 에 `t` 를 넣지 않으려고 status 만 state 에 보관하므로 변환은
 * 여기서 렌더 시점에 처리한다.
 */
function InvitationBanner({ state }: { state: InvitationState }) {
  const t = useT();
  if (state.kind === "none") return null;

  if (state.kind === "loading") {
    return (
      <div className="mb-4">
        <p className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t("auth.register.invitationLoading")}
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    const message =
      state.message ??
      (state.status === 410
        ? t("auth.register.invitationGone")
        : state.status === 404
          ? t("auth.register.invitationNotFound")
          : t("auth.register.invitationFetchFailed"));
    return (
      <div className="mb-4">
        <p
          role="alert"
          className="rounded-md border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]"
        >
          {message}
        </p>
      </div>
    );
  }

  // ready
  const { workspaceName, invitedByName } = state.meta;
  return (
    <div className="mb-4">
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
    </div>
  );
}

export function RegisterForm(props: RegisterFormProps) {
  const locale = useLocale();
  return <RegisterFormInner key={locale} {...props} />;
}
