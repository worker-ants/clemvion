"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { RevokeSessionPayload } from "@/lib/api/sessions";

export type ReauthMode = "password" | "totp" | "unavailable";

export interface RevokeConfirmDialogProps {
  /**
   * Parent should conditionally render this component (`{open && <Dialog />}`)
   * so password/totp fields are not retained across opens — that's safer than
   * leaking entered credentials in memory between sessions.
   */
  onClose: () => void;
  /** Resolves on success; rejecting allows the dialog to show an inline error. */
  onConfirm: (payload: RevokeSessionPayload) => Promise<void>;
  scope: "single" | "all";
  reauthMode: ReauthMode;
  isPending: boolean;
}

export function RevokeConfirmDialog({
  onClose,
  onConfirm,
  scope,
  reauthMode,
  isPending,
}: RevokeConfirmDialogProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title =
    scope === "all"
      ? t("profile.sessions.dialogTitleAll")
      : t("profile.sessions.dialogTitleSingle");

  const description =
    reauthMode === "password"
      ? t("profile.sessions.dialogPasswordDescription")
      : reauthMode === "totp"
        ? t("profile.sessions.dialogTotpDescription")
        : t("profile.sessions.dialogReauthUnavailable");

  async function handleConfirm() {
    setError(null);
    const payload: RevokeSessionPayload = {};
    if (reauthMode === "password") payload.password = password;
    if (reauthMode === "totp") payload.totpCode = totp;
    try {
      await onConfirm(payload);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("profile.sessions.revokeFailedToast");
      setError(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {reauthMode === "password" && (
          <div className="space-y-2">
            <Label htmlFor="revoke-password">
              {t("profile.security.accountPasswordPlaceholder")}
            </Label>
            <Input
              id="revoke-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("profile.sessions.passwordPlaceholder")}
              disabled={isPending}
            />
          </div>
        )}

        {reauthMode === "totp" && (
          <div className="space-y-2">
            <Label htmlFor="revoke-totp">
              {t("profile.security.codeLabel")}
            </Label>
            <Input
              id="revoke-totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              placeholder={t("profile.sessions.totpPlaceholder")}
              disabled={isPending}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-[hsl(var(--destructive))]" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t("profile.sessions.dialogCancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={
              isPending ||
              reauthMode === "unavailable" ||
              (reauthMode === "password" && !password) ||
              (reauthMode === "totp" && totp.length < 6)
            }
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("profile.sessions.dialogConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
