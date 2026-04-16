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

export default function SecurityPage() {
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
    onError: () => toast.error("2FA 설정 시작에 실패했어요."),
  });

  const verifyMutation = useMutation({
    mutationFn: (c: string) => authApi.verify2fa(c),
    onSuccess: (res) => {
      setRecoveryCodes(res.data.data.recoveryCodes);
      setQrDataUrl(null);
      setCode("");
      toast.success("2FA가 활성화됐어요.");
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: () => toast.error("인증 코드가 올바르지 않아요."),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => authApi.disable2fa(password),
    onSuccess: () => {
      toast.success("2FA를 비활성화했어요.");
      setDisablePassword("");
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: () => toast.error("비밀번호가 일치하지 않거나 처리에 실패했어요."),
  });

  // user 객체에 twoFactorEnabled 필드가 있다고 가정 (백엔드가 노출 시).
  // 없다면 별도 me 호출에서 받아온 값으로 판단.
  const twoFactorEnabled = (user as { twoFactorEnabled?: boolean } | null)
    ?.twoFactorEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">보안 · 2단계 인증</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Authenticator 앱(예: Google Authenticator, 1Password)으로 발급되는 6자리 코드를 로그인 시 추가로 요구해요.
        </p>
      </div>

      {twoFactorEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              2FA 활성 상태
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              2FA가 켜져 있어요. 비활성화하려면 계정 비밀번호를 입력해 주세요.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (disablePassword.length < 8) {
                  toast.error("비밀번호를 입력해 주세요.");
                  return;
                }
                disableMutation.mutate(disablePassword);
              }}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <Input
                type="password"
                placeholder="계정 비밀번호"
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
                2FA 비활성
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">2FA 설정</CardTitle>
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
                설정 시작
              </Button>
            )}

            {qrDataUrl && (
              <>
                <div>
                  <p className="mb-2 text-sm">
                    Authenticator 앱으로 아래 QR 코드를 스캔한 뒤, 표시되는 6자리 코드를 입력해 주세요.
                  </p>
                  <Image
                    src={qrDataUrl}
                    alt="TOTP QR Code"
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
                      toast.error("6자리 코드를 입력해 주세요.");
                      return;
                    }
                    verifyMutation.mutate(code.trim());
                  }}
                >
                  <div className="flex-1">
                    <Label htmlFor="verify-code">인증 코드</Label>
                    <Input
                      id="verify-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="sm:max-w-xs"
                    />
                  </div>
                  <Button type="submit" disabled={verifyMutation.isPending}>
                    {verifyMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    검증·활성화
                  </Button>
                </form>
              </>
            )}

            {recoveryCodes && (
              <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold">
                  복구 코드 (한 번만 표시됩니다 — 안전한 곳에 저장하세요)
                </p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Authenticator 앱을 사용할 수 없을 때 각 코드를 한 번씩 사용해 로그인할 수 있어요.
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
