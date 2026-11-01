"use client";

import Image from "next/image";
import { useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";
import { extractApiCode } from "@/lib/api/errors";
import { USER_PROFILE_QUERY_KEY, usersApi } from "@/lib/api/users";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useT, type TranslationKey } from "@/lib/i18n";
import { PasskeyCard } from "./passkey-card";

// 설정 시작은 비밀번호를 다시 확인한다(NERV CLE-ACCT-SIGNIN, CLE-T-94FTMV). 비밀번호가 없는 계정(OAuth 전용)은
// 비밀번호 재설정으로 먼저 비밀번호를 만들어야 켤 수 있다.
const SETUP_PASSWORD_ERRORS: Partial<Record<string, TranslationKey>> = {
  PASSWORD_INVALID: "profile.security.passwordInvalid",
  PASSWORD_REQUIRED: "profile.security.passwordNotSet",
};

export default function SecurityPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const [setupPassword, setSetupPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // 화면의 켜짐 여부는 auth store 의 user 에서 읽는다. 켜기 · 끄기 뒤 서버 값으로 다시 맞춘다.
  const refreshUser = async () => {
    queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
    try {
      setUser((await usersApi.getMe()).data.data);
    } catch {
      // 다시 불러오지 못하면 다음 세션 복원 때 맞춰진다.
    }
  };

  // 다른 탭에서 먼저 켰으면 서버가 409 TOTP_ALREADY_ENABLED 로 거부한다(NERV CLE-ACCT-SIGNIN, CLE-T-94FTMV).
  // 설정 화면을 닫고 켜진 상태로 다시 그린다.
  const handleAlreadyEnabled = (err: unknown): boolean => {
    if (
      !axios.isAxiosError(err) ||
      extractApiCode(err) !== "TOTP_ALREADY_ENABLED"
    ) {
      return false;
    }
    setQrDataUrl(null);
    setCode("");
    toast.info(t("profile.security.alreadyEnabled"));
    void refreshUser();
    return true;
  };

  const setupMutation = useMutation({
    mutationFn: (password: string) => authApi.setup2fa(password),
    onSuccess: (res) => {
      setQrDataUrl(res.data.data.qrCodeDataUrl);
      setRecoveryCodes(null);
      setSetupPassword("");
    },
    onError: (err) => {
      if (handleAlreadyEnabled(err)) return;
      const code = axios.isAxiosError(err) ? extractApiCode(err) : undefined;
      toast.error(
        t(
          (code && SETUP_PASSWORD_ERRORS[code]) ||
            "profile.security.setupStartFailed",
        ),
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (c: string) => authApi.verify2fa(c),
    onSuccess: (res) => {
      setRecoveryCodes(res.data.data.recoveryCodes);
      setQrDataUrl(null);
      setCode("");
      toast.success(t("profile.security.verifySuccess"));
      void refreshUser();
    },
    onError: (err) => {
      if (!handleAlreadyEnabled(err)) {
        toast.error(t("profile.security.verifyFailed"));
      }
    },
  });

  const disableMutation = useMutation({
    // 비활성화에는 비밀번호와 TOTP 코드(또는 복구 코드)가 함께 필요하다
    // (NERV CLE-ACCT-SIGNIN, CLE-T-75TDTN).
    mutationFn: ({ password, code }: { password: string; code: string }) =>
      authApi.disable2fa(password, code),
    onSuccess: () => {
      toast.success(t("profile.security.disableSuccess"));
      setDisablePassword("");
      setDisableCode("");
      // 끈 뒤에는 폐기된 복구 코드를 더 보여 주지 않는다.
      setRecoveryCodes(null);
      void refreshUser();
    },
    onError: () => toast.error(t("profile.security.disableFailedDetail")),
  });

  const twoFactorEnabled = (user as { twoFactorEnabled?: boolean } | null)
    ?.twoFactorEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("profile.security.pageTitle")}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t("profile.security.pageDescription")}
        </p>
      </div>

      <PasskeyCard />

      {twoFactorEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {t("profile.security.active")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {t("profile.security.activeMessage")}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (disablePassword.length < 8) {
                  toast.error(t("profile.security.passwordRequired"));
                  return;
                }
                const trimmedCode = disableCode.trim();
                if (!trimmedCode) {
                  toast.error(t("profile.security.disableCodeRequired"));
                  return;
                }
                disableMutation.mutate({
                  password: disablePassword,
                  code: trimmedCode,
                });
              }}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <Input
                type="password"
                placeholder={t("profile.security.accountPasswordPlaceholder")}
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="sm:max-w-xs"
              />
              {/* 복구 코드에는 영문이 섞여 있어 숫자 키패드(inputMode numeric)를 쓰지 않는다. */}
              <Input
                type="text"
                autoComplete="one-time-code"
                placeholder={t("profile.security.disableCodePlaceholder")}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="sm:max-w-xs"
              />
              <Button
                type="submit"
                variant="destructive"
                disabled={disableMutation.isPending}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                {t("profile.security.disableButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("profile.security.setupCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!qrDataUrl && !recoveryCodes && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (setupPassword.length < 8) {
                    toast.error(t("profile.security.passwordRequired"));
                    return;
                  }
                  setupMutation.mutate(setupPassword);
                }}
              >
                <p className="text-sm">
                  {t("profile.security.setupPasswordHint")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("profile.security.accountPasswordPlaceholder")}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="sm:max-w-xs"
                  />
                  <Button type="submit" disabled={setupMutation.isPending}>
                    {setupMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("profile.security.startSetup")}
                  </Button>
                </div>
              </form>
            )}

            {qrDataUrl && (
              <>
                <div>
                  <p className="mb-2 text-sm">
                    {t("profile.security.scanInstruction")}
                  </p>
                  <Image
                    src={qrDataUrl}
                    alt={t("profile.security.qrAlt")}
                    width={200}
                    height={200}
                    unoptimized
                  />
                </div>
                <form
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim().length !== 6) {
                      toast.error(t("profile.security.invalidCode"));
                      return;
                    }
                    verifyMutation.mutate(code.trim());
                  }}
                >
                  <div className="flex-1">
                    <Label htmlFor="verify-code">{t("profile.security.codeLabel")}</Label>
                    <Input
                      id="verify-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t("profile.security.codePlaceholder")}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="sm:max-w-xs"
                    />
                  </div>
                  <Button type="submit" disabled={verifyMutation.isPending}>
                    {verifyMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("profile.security.verifyActivateButton")}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 활성화에 성공하면 켜진 카드로 바뀐다. 복구 코드는 한 번만 보여 주므로 카드 밖에 두어 그대로 남긴다. */}
      {recoveryCodes && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold">
            {t("profile.security.recoveryCodesTitle")}
          </p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {t("profile.security.recoveryCodesHint")}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <li
                key={c}
                className="rounded bg-[hsl(var(--muted))/0.5] px-2 py-1"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
