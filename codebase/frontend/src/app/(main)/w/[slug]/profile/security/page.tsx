"use client";

import Image from "next/image";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useT } from "@/lib/i18n";
import { PasskeyCard } from "./passkey-card";

export default function SecurityPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");

  const setupMutation = useMutation({
    mutationFn: () => authApi.setup2fa(),
    onSuccess: (res) => {
      setQrDataUrl(res.data.data.qrCodeDataUrl);
      setRecoveryCodes(null);
    },
    onError: () => toast.error(t("profile.security.setupStartFailed")),
  });

  const verifyMutation = useMutation({
    mutationFn: (c: string) => authApi.verify2fa(c),
    onSuccess: (res) => {
      setRecoveryCodes(res.data.data.recoveryCodes);
      setQrDataUrl(null);
      setCode("");
      toast.success(t("profile.security.verifySuccess"));
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: () => toast.error(t("profile.security.verifyFailed")),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => authApi.disable2fa(password),
    onSuccess: () => {
      toast.success(t("profile.security.disableSuccess"));
      setDisablePassword("");
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
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
                disableMutation.mutate(disablePassword);
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
              <Button
                type="button"
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("profile.security.startSetup")}
              </Button>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
