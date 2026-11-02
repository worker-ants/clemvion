"use client";

import { useState } from "react";
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
  const user = useAuthStore((s) => s.user);

  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const sessionsQuery = useQuery<SessionDto[]>({
    queryKey: ["auth", "sessions"],
    queryFn: () => sessionsApi.listSessions(),
  });

  const [reauthOverride, setReauthOverride] = useState<ReauthMode | null>(null);

  // 비밀번호가 있는 계정은 비밀번호로 확인한다(NERV CLE-ACCT-SESSION REQ-SESSION-025). TOTP 를 켠 계정도
  // 인증 앱을 잃었을 때 비밀번호로 세션을 끊을 수 있어야 한다. /users/me 는 비밀번호 유무를 싣지 않으므로
  // 비밀번호를 먼저 받고 서버 응답으로 바꾼다(handleConfirm).
  const reauthMode: ReauthMode = reauthOverride ?? "password";

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
      setReauthOverride(null);
    },
    // onError 에서는 toast 만 띄우고 mutation 결과를 컨슈머(handleConfirm) 가 처리하도록
    // re-throw 하지 않는다. handleConfirm 의 try/catch 에서 인라인 에러 표시.
  });

  function openRevokeSingle(familyId: string) {
    setDialog({ open: true, scope: "single", familyId });
  }

  function openRevokeAll() {
    setDialog({ open: true, scope: "all" });
  }

  async function handleConfirm(payload: RevokeSessionPayload) {
    if (!dialog.open) return;
    try {
      if (dialog.scope === "single") {
        await revokeMutation.mutateAsync({
          scope: "single",
          familyId: dialog.familyId,
          payload,
        });
      } else {
        await revokeMutation.mutateAsync({ scope: "all", payload });
      }
    } catch (err) {
      // 서버가 REAUTH_NOT_AVAILABLE (403) 을 돌려주면 다이얼로그를
      // "재인증 불가" 모드로 전환해 다음 시도에 사용자에게 명확히 안내한다.
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const code = err.response.data?.error?.code ?? err.response.data?.code;
        if (code === "REAUTH_NOT_AVAILABLE") {
          setReauthOverride("unavailable");
        }
      }
      // 비밀번호가 없는 계정은 비밀번호를 보내면 REAUTH_REQUIRED (400) 를 받는다.
      // TOTP 가 켜진 계정이면 인증 코드 입력으로 바꾼다.
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 400 &&
        reauthMode === "password" &&
        user?.twoFactorEnabled
      ) {
        const code = err.response.data?.error?.code ?? err.response.data?.code;
        if (code === "REAUTH_REQUIRED") {
          setReauthOverride("totp");
        }
      }
      toast.error(axiosMessage(err, t("profile.sessions.revokeFailedToast")));
      throw err instanceof Error ? err : new Error(String(err));
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
