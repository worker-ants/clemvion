"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, KeyRound, Trash2, RefreshCcw, Pencil } from "lucide-react";
import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authApi } from "@/lib/api/auth";
import type { WebAuthnCredentialSummary } from "@/lib/api/auth";
import { useT } from "@/lib/i18n";
import { MIN_ACCOUNT_PASSWORD_LENGTH } from "@/lib/utils/password";
import { formatDate } from "@/lib/utils/date";
import { passwordRecheckErrorKey } from "./security-errors";

const QK_LIST = ["webauthn", "credentials"] as const;

export function PasskeyCard() {
  const t = useT();
  const qc = useQueryClient();
  const supported = typeof window !== "undefined" && browserSupportsWebAuthn();

  const [deviceName, setDeviceName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [regenPassword, setRegenPassword] = useState("");
  // 삭제 대화상자가 가리키는 인증기. null 이면 대화상자가 닫혀 있다.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");

  // 서버 env(WEBAUTHN_RP_ID + WEBAUTHN_ORIGIN) 미설정 시 기능 비활성 — 카드 자체를 숨긴다.
  const availabilityQuery = useQuery({
    queryKey: ["webauthn", "availability"] as const,
    queryFn: async () => {
      const res = await authApi.webauthnAvailability();
      return res.data.data.enabled;
    },
    staleTime: 5 * 60 * 1000,
  });
  const serverEnabled = availabilityQuery.data === true;

  const credentialsQuery = useQuery({
    queryKey: QK_LIST,
    queryFn: async () => {
      const res = await authApi.webauthnListCredentials();
      return res.data.data.items;
    },
    enabled: supported && serverEnabled,
  });

  // 등록 옵션은 계정 비밀번호를 다시 확인한다(NERV CLE-ACCT-SIGNIN, CLE-T-FRCRF7). 비밀번호가 틀리면 등록 옵션을
  // 받지 못하므로 인증기를 부르지 않는다.
  const registerMutation = useMutation({
    mutationFn: async ({
      name,
      password,
    }: {
      name: string;
      password: string;
    }) => {
      const optsRes = await authApi.webauthnRegisterOptions(password);
      const { publicKey, optionsToken } = optsRes.data.data;
      // @ts-expect-error — simplewebauthn 타입 정의를 줄이기 위해 publicKey 를 unknown 으로 보관
      const attestation = await startRegistration({ optionsJSON: publicKey });
      const verifyRes = await authApi.webauthnRegisterVerify(
        optionsToken,
        attestation,
        name.trim() || undefined,
      );
      return verifyRes.data.data;
    },
    onSuccess: (data) => {
      if (data.webauthnRecoveryCodes && data.webauthnRecoveryCodes.length > 0) {
        setRecoveryCodes(data.webauthnRecoveryCodes);
      }
      setDeviceName("");
      setRegisterPassword("");
      qc.invalidateQueries({ queryKey: QK_LIST });
      toast.success(t("profile.security.webauthn.registerSuccess"));
    },
    onError: (err) =>
      toast.error(
        t(
          passwordRecheckErrorKey(
            err,
            "profile.security.webauthn.registerFailed",
          ),
        ),
      ),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      authApi.webauthnRenameCredential(id, name),
    onSuccess: () => {
      setEditingId(null);
      setEditingName("");
      qc.invalidateQueries({ queryKey: QK_LIST });
      toast.success(t("profile.security.webauthn.renameSuccess"));
    },
    onError: () => toast.error(t("profile.security.webauthn.renameFailed")),
  });

  // 삭제도 계정 비밀번호를 다시 확인한다(CLE-ACCT-SIGNIN-PASSKEY 「Passkey 삭제」, CLE-T-Q6E11N).
  // 비밀번호가 없는 계정은 401 PASSWORD_REQUIRED 를 받고 비밀번호 재설정 안내(passwordNotSet)를 본다.
  const deleteMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      authApi.webauthnDeleteCredential(id, password),
    onSuccess: () => {
      setDeleteTargetId(null);
      setDeletePassword("");
      qc.invalidateQueries({ queryKey: QK_LIST });
      toast.success(t("profile.security.webauthn.deleteSuccess"));
    },
    onError: (err) =>
      toast.error(
        t(
          passwordRecheckErrorKey(err, "profile.security.webauthn.deleteFailed"),
        ),
      ),
  });

  const openDeleteDialog = (id: string) => {
    setDeletePassword("");
    setDeleteTargetId(id);
  };
  const closeDeleteDialog = () => {
    if (deleteMutation.isPending) return;
    setDeleteTargetId(null);
    setDeletePassword("");
  };

  const regenMutation = useMutation({
    mutationFn: (password: string) =>
      authApi.webauthnRegenerateRecoveryCodes(password),
    onSuccess: (res) => {
      setRecoveryCodes(res.data.data.webauthnRecoveryCodes);
      setRegenPassword("");
      toast.success(t("profile.security.webauthn.regenSuccess"));
    },
    onError: (err) =>
      toast.error(
        t(passwordRecheckErrorKey(err, "profile.security.webauthn.regenFailed")),
      ),
  });

  const credentials = credentialsQuery.data ?? [];
  const hasCredentials = credentials.length > 0;

  if (!availabilityQuery.isPending && !serverEnabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <KeyRound className="h-4 w-4" />
          {t("profile.security.webauthn.cardTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported && (
          <p className="text-sm text-[hsl(var(--destructive))]">
            {t("profile.security.webauthn.unsupported")}
          </p>
        )}

        {/* 등록 폼 */}
        {supported && (
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (registerPassword.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
                toast.error(t("profile.security.passwordRequired"));
                return;
              }
              registerMutation.mutate({
                name: deviceName,
                password: registerPassword,
              });
            }}
          >
            <div className="flex-1">
              <Label htmlFor="webauthn-device-name">
                {t("profile.security.webauthn.deviceNameLabel")}
              </Label>
              <Input
                id="webauthn-device-name"
                placeholder={t("profile.security.webauthn.deviceNamePlaceholder")}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="webauthn-register-pw">
                {t("profile.security.webauthn.registerPasswordLabel")}
              </Label>
              <Input
                id="webauthn-register-pw"
                type="password"
                autoComplete="current-password"
                placeholder={t("profile.security.accountPasswordPlaceholder")}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("profile.security.webauthn.registerButton")}
            </Button>
          </form>
        )}

        {/* credential 목록 */}
        {hasCredentials && (
          <ul className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
            {credentials.map((c) => (
              <CredentialRow
                key={c.id}
                credential={c}
                editing={editingId === c.id}
                editingName={editingName}
                onEditStart={() => {
                  setEditingId(c.id);
                  setEditingName(c.deviceName ?? "");
                }}
                onEditChange={setEditingName}
                onEditCancel={() => {
                  setEditingId(null);
                  setEditingName("");
                }}
                onEditSubmit={() =>
                  renameMutation.mutate({ id: c.id, name: editingName })
                }
                onDelete={() => openDeleteDialog(c.id)}
                pendingRename={renameMutation.isPending}
                pendingDelete={deleteMutation.isPending}
              />
            ))}
          </ul>
        )}

        {!hasCredentials && supported && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("profile.security.webauthn.emptyHint")}
          </p>
        )}

        {/* 복구 코드 모달 (인라인 노출) */}
        {recoveryCodes && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold">
              {t("profile.security.webauthn.recoveryCodesTitle")}
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t("profile.security.webauthn.recoveryCodesHint")}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setRecoveryCodes(null)}
            >
              {t("profile.security.webauthn.dismissCodes")}
            </Button>
          </div>
        )}

        {/* 복구 코드 재발급 */}
        {hasCredentials && (
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end border-t border-[hsl(var(--border))] pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (regenPassword.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
                toast.error(t("profile.security.passwordRequired"));
                return;
              }
              regenMutation.mutate(regenPassword);
            }}
          >
            <div className="flex-1">
              <Label htmlFor="webauthn-regen-pw">
                {t("profile.security.webauthn.regenLabel")}
              </Label>
              <Input
                id="webauthn-regen-pw"
                type="password"
                placeholder={t("profile.security.accountPasswordPlaceholder")}
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={regenMutation.isPending}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {t("profile.security.webauthn.regenButton")}
            </Button>
          </form>
        )}
      </CardContent>

      {/* 삭제 확인: 계정 비밀번호를 받는다 */}
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (deleteTargetId === null) return;
              if (deletePassword.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
                toast.error(t("profile.security.passwordRequired"));
                return;
              }
              deleteMutation.mutate({
                id: deleteTargetId,
                password: deletePassword,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {t("profile.security.webauthn.deleteDialogTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("profile.security.webauthn.deleteConfirm")}
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="webauthn-delete-pw">
                {t("profile.security.webauthn.deletePasswordLabel")}
              </Label>
              <Input
                id="webauthn-delete-pw"
                type="password"
                autoComplete="current-password"
                placeholder={t("profile.security.accountPasswordPlaceholder")}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteDialog}
                disabled={deleteMutation.isPending}
              >
                {t("profile.security.webauthn.cancelName")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("profile.security.webauthn.deleteButton")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface CredentialRowProps {
  credential: WebAuthnCredentialSummary;
  editing: boolean;
  editingName: string;
  onEditStart: () => void;
  onEditChange: (v: string) => void;
  onEditCancel: () => void;
  onEditSubmit: () => void;
  onDelete: () => void;
  pendingRename: boolean;
  pendingDelete: boolean;
}

function CredentialRow({
  credential,
  editing,
  editingName,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSubmit,
  onDelete,
  pendingRename,
  pendingDelete,
}: CredentialRowProps) {
  const t = useT();
  const lastUsed = credential.lastUsedAt
    ? formatDate(credential.lastUsedAt, "datetime")
    : t("profile.security.webauthn.never");
  const created = formatDate(credential.createdAt, "datetime");

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingName.trim().length > 0) onEditSubmit();
            }}
          >
            <Input
              autoFocus
              value={editingName}
              onChange={(e) => onEditChange(e.target.value)}
              maxLength={100}
              className="h-8"
            />
            <Button
              type="submit"
              size="sm"
              disabled={pendingRename || editingName.trim().length === 0}
            >
              {t("profile.security.webauthn.saveName")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onEditCancel}
            >
              {t("profile.security.webauthn.cancelName")}
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {credential.deviceName ??
                t("profile.security.webauthn.unnamedDevice")}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onEditStart}
              aria-label={t("profile.security.webauthn.editName")}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("profile.security.webauthn.lastUsed")}: {lastUsed} ·{" "}
          {t("profile.security.webauthn.registered")}: {created}
          {credential.transports.length > 0 && (
            <> · {credential.transports.join(", ")}</>
          )}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-[hsl(var(--destructive))]"
        onClick={onDelete}
        disabled={pendingDelete}
        aria-label={t("profile.security.webauthn.deleteAria")}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        {t("profile.security.webauthn.deleteButton")}
      </Button>
    </li>
  );
}
