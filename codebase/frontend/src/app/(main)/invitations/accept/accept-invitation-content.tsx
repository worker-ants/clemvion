"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { workspacesApi } from "@/lib/api/workspaces";
import { invitationsApi, type InvitationMeta } from "@/lib/api/invitations";
import { authApi } from "@/lib/api/auth";
import { setAccessToken } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT, translate } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/stores/locale-store";

// §1.5.3 — 이미 가입한 사용자가 다른 워크스페이스에 초대된 흐름. 마운트 즉시 자동
// 수락(종전) 대신, 토큰 메타를 조회해 (a) 로그인 이메일 == 토큰 이메일이면 [수락]
// 버튼을, (b) 불일치면 "해당 계정으로 로그인" 안내 + 로그아웃 버튼을 노출한다.
type Status =
  | "loading"
  | "ready"
  | "mismatch"
  | "accepting"
  | "success"
  | "error"
  | "missing";

export function AcceptInvitationContent() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
  const [meta, setMeta] = useState<InvitationMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fetchedRef = useRef(false);

  // 토큰 메타 조회 → 로그인 이메일과 비교. deps 에 locale 을 넣지 않아(토글이
  // 재조회를 유발하지 않도록) 텍스트 변환은 렌더 시점에서 수행한다.
  useEffect(() => {
    if (!token || fetchedRef.current) return;
    fetchedRef.current = true;
    // unmount 후 setState 방지 — register-form 의 meta 조회 패턴과 동일한 가드.
    let cancelled = false;
    const currentLocale = useLocaleStore.getState().locale;
    (async () => {
      try {
        const m = await invitationsApi.getByToken(token);
        if (cancelled) return;
        setMeta(m);
        const userEmail = useAuthStore.getState().user?.email;
        setStatus(userEmail && userEmail === m.email ? "ready" : "mismatch");
      } catch (err) {
        if (cancelled) return;
        const error = err as AxiosError<{ message?: string }>;
        setErrorMessage(
          error.response?.data?.message ??
            translate(currentLocale, "invitations.accept.acceptFailedDefault"),
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    const currentLocale = useLocaleStore.getState().locale;
    setStatus("accepting");
    try {
      const result = await workspacesApi.acceptInvitation(token);
      const list = await workspacesApi.list();
      setWorkspaces(list);
      switchWorkspace(result.workspaceId);
      setStatus("success");
      toast.success(translate(currentLocale, "invitations.accept.joined"));
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      setErrorMessage(
        error.response?.data?.message ??
          translate(currentLocale, "invitations.accept.acceptFailedDefault"),
      );
      setStatus("error");
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // 로그아웃 요청이 실패해도 클라이언트 세션은 정리하고 로그인으로 보낸다.
    }
    setAccessToken(null);
    useAuthStore.getState().setUser(null);
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("invitations.accept.title")}</CardTitle>
          <CardDescription>
            {status === "loading" && t("invitations.accept.statusAccepting")}
            {status === "ready" &&
              meta &&
              translate(locale, "invitations.accept.message", {
                workspace: meta.workspaceName,
              })}
            {status === "mismatch" && t("invitations.accept.mismatchTitle")}
            {status === "accepting" && t("invitations.accept.statusAccepting")}
            {status === "success" && t("invitations.accept.statusSuccess")}
            {status === "error" && t("invitations.accept.statusError")}
            {status === "missing" && t("invitations.accept.statusMissing")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === "loading" || status === "accepting") && (
            <div className="flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          )}
          {status === "ready" && (
            <div className="flex justify-center">
              <Button onClick={handleAccept}>
                {t("invitations.accept.accept")}
              </Button>
            </div>
          )}
          {status === "mismatch" && meta && (
            <>
              <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
                {translate(locale, "invitations.accept.mismatchHint", {
                  email: meta.email,
                })}
              </p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleLogout}>
                  {t("invitations.accept.logoutAndSwitch")}
                </Button>
              </div>
            </>
          )}
          {status === "missing" && (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("invitations.accept.missingHint")}
            </p>
          )}
          {status === "error" && (
            <>
              <p className="text-center text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  {t("invitations.accept.goDashboard")}
                </Button>
              </div>
            </>
          )}
          {status === "success" && (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("invitations.accept.redirectingDashboard")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
