"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { axiosMessage } from "@/lib/api/errors";
import {
  usersApi,
  USER_PROFILE_QUERY_KEY,
  type UserProfile,
} from "@/lib/api/users";
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
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function ChangeEmailPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const res = await usersApi.getMe();
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      usersApi.requestEmailChange({
        newEmail: newEmail.trim(),
        password: password || undefined,
        totpCode: totpCode || undefined,
      }),
    onSuccess: () => {
      setPassword("");
      setTotpCode("");
      toast.success(t("profile.changeEmailRequestSuccess"));
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
    },
    onError: (err) => toast.error(axiosMessage(err, t("profile.changeEmailFailed"))),
  });

  const resendMutation = useMutation({
    mutationFn: () => usersApi.resendEmailChange(),
    onSuccess: () => toast.success(t("profile.changeEmailResent")),
    onError: (err) => toast.error(axiosMessage(err, t("profile.changeEmailFailed"))),
  });

  const cancelMutation = useMutation({
    mutationFn: () => usersApi.cancelEmailChange(),
    onSuccess: () => {
      toast.success(t("profile.changeEmailCancelled"));
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
    },
    onError: (err) => toast.error(axiosMessage(err, t("profile.changeEmailFailed"))),
  });

  const busy =
    requestMutation.isPending ||
    resendMutation.isPending ||
    cancelMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("profile.changeEmailPageTitle")}</CardTitle>
          <CardDescription>
            {t("profile.changeEmailPageDescription")}
          </CardDescription>
        </CardHeader>

        {user?.pendingEmail ? (
          <CardContent className="space-y-4" data-testid="email-change-pending">
            <div className="rounded-md border border-[hsl(var(--border))] p-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("profile.changeEmailPendingDescription")}
              </p>
              <p className="mt-2 text-sm font-medium">{user.pendingEmail}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => cancelMutation.mutate()}
                disabled={busy}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => resendMutation.mutate()}
                disabled={busy}
                data-testid="email-change-resend"
              >
                {resendMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("profile.resend")}
              </Button>
            </div>
          </CardContent>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newEmail.trim()) return;
              requestMutation.mutate();
            }}
            noValidate
          >
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">{t("profile.newEmail")}</Label>
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("profile.newEmailPlaceholder")}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("profile.changeEmailReauthHint")}
              </p>

              <div className="space-y-2">
                <Label htmlFor="reauth-password">
                  {t("profile.currentPassword")}
                </Label>
                <Input
                  id="reauth-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("profile.currentPasswordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reauth-totp">
                  {t("profile.totpCodeOptional")}
                </Label>
                <Input
                  id="reauth-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("profile.totpCodePlaceholder")}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/profile")}
                  disabled={busy}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={busy || !newEmail.trim()}
                  data-testid="email-change-submit"
                >
                  {requestMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("profile.changeEmailSubmit")}
                </Button>
              </div>
            </CardContent>
          </form>
        )}
      </Card>
    </div>
  );
}
