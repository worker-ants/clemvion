"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  sessionsApi,
  type RevokeSessionPayload,
  type SessionDto,
} from "@/lib/api/sessions";
import { SessionRow } from "./components/session-row";
import {
  RevokeConfirmDialog,
  type ReauthMode,
} from "./components/revoke-confirm-dialog";
import { LoginHistoryList } from "./components/login-history-list";

type DialogState =
  | { open: false }
  | { open: true; scope: "single"; familyId: string }
  | { open: true; scope: "all" };

function axiosMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (
      err.response?.data?.error?.message ??
      err.response?.data?.message ??
      err.message ??
      fallback
    );
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function SessionsPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user) as
    | { passwordHash?: unknown; twoFactorEnabled?: boolean }
    | null;

  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const sessionsQuery = useQuery<SessionDto[]>({
    queryKey: ["auth", "sessions"],
    queryFn: () => sessionsApi.listSessions(),
  });

  const reauthMode: ReauthMode = useMemo(() => {
    // The /users/me payload doesn't expose passwordHash for safety, so we
    // infer "has password" from twoFactorEnabled and a hasPassword hint when
    // available. As a conservative default we offer password input — if the
    // server rejects with REAUTH_NOT_AVAILABLE the dialog surfaces it inline.
    const has2fa = !!user?.twoFactorEnabled;
    return has2fa ? "totp" : "password";
  }, [user?.twoFactorEnabled]);

  const revokeMutation = useMutation<
    SessionDto[],
    unknown,
    { scope: "single" | "all"; familyId?: string; payload: RevokeSessionPayload }
  >({
    mutationFn: async ({ scope, familyId, payload }) => {
      if (scope === "all") return sessionsApi.revokeOtherSessions(payload);
      if (!familyId) throw new Error("familyId required");
      return sessionsApi.revokeSession(familyId, payload);
    },
    onSuccess: (sessions, variables) => {
      queryClient.setQueryData(["auth", "sessions"], sessions);
      queryClient.invalidateQueries({ queryKey: ["auth", "login-history"] });
      toast.success(
        variables.scope === "all"
          ? t("profile.sessions.othersRevokedToast")
          : t("profile.sessions.sessionRevokedToast"),
      );
      setDialog({ open: false });
    },
    onError: (err) => {
      // We rethrow so the dialog can render an inline error too.
      const message = axiosMessage(err, t("profile.sessions.revokeFailedToast"));
      toast.error(message);
      throw err instanceof Error ? err : new Error(message);
    },
  });

  function openRevokeSingle(familyId: string) {
    setDialog({ open: true, scope: "single", familyId });
  }

  function openRevokeAll() {
    setDialog({ open: true, scope: "all" });
  }

  async function handleConfirm(payload: RevokeSessionPayload) {
    if (!dialog.open) return;
    if (dialog.scope === "single") {
      await revokeMutation.mutateAsync({
        scope: "single",
        familyId: dialog.familyId,
        payload,
      });
    } else {
      await revokeMutation.mutateAsync({ scope: "all", payload });
    }
  }

  const sessions = sessionsQuery.data ?? [];
  const hasOtherSessions = sessions.some((s) => !s.isCurrent);

  return (
    <>
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            {t("profile.sessions.tabActive")}
          </TabsTrigger>
          <TabsTrigger value="history">
            {t("profile.sessions.tabHistory")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {sessionsQuery.isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {sessionsQuery.isError && (
            <p className="py-6 text-center text-sm text-[hsl(var(--destructive))]">
              {t("profile.sessions.loadFailed")}
            </p>
          )}

          {!sessionsQuery.isLoading &&
            !sessionsQuery.isError &&
            sessions.length === 0 && (
              <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {t("profile.sessions.empty")}
              </p>
            )}

          <div className="space-y-2">
            {sessions.map((s) => (
              <SessionRow
                key={s.familyId}
                session={s}
                onRevoke={openRevokeSingle}
                pending={revokeMutation.isPending}
              />
            ))}
          </div>

          {hasOtherSessions && (
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={openRevokeAll}
                disabled={revokeMutation.isPending}
              >
                {t("profile.sessions.revokeAllOthers")}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <LoginHistoryList />
        </TabsContent>
      </Tabs>

      {dialog.open && (
        <RevokeConfirmDialog
          onClose={() => setDialog({ open: false })}
          onConfirm={handleConfirm}
          scope={dialog.scope}
          reauthMode={reauthMode}
          isPending={revokeMutation.isPending}
        />
      )}
    </>
  );
}
