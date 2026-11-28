"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { workspacesApi } from "@/lib/api/workspaces";
import { invitationsApi, type InvitationMeta } from "@/lib/api/invitations";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { buildWorkspaceHref } from "@/lib/workspace/href";
import { buildInvitationLoginHref } from "@/lib/invitations/accept-path";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT, translate, type Locale } from "@/lib/i18n";
import { serverErrorMessage } from "@/lib/api/server-error-messages";
import { useLocaleStore } from "@/lib/stores/locale-store";

// CLE-ACCT-WS 「이미 가입한 사용자의 수락 경로」 — 이미 가입한 사용자가 다른 워크스페이스에 초대된
// 흐름. 마운트 즉시 자동 수락(종전) 대신, 토큰 메타를 조회해 (a) 로그인 이메일 == 토큰 이메일이면
// [수락] 버튼을, (b) 불일치면 "해당 계정으로 로그인" 안내 + 로그아웃 버튼을 노출한다.
// 초대 알림이 여는 초대 id 모드(`?invitationId=`, CLE-T-86E38Q)는 서버가 로그인 이메일로 온 초대만 돌려주므로
// 불일치 안내가 없다. 없거나 남의 초대(404) · 이미 처리한 초대(410)는 오류 상태로 보인다. 두 값이 다 있으면
// 토큰을 쓴다.
/**
 * 초대 조회 · 수락 실패 문구. 서버 `message` 는 영문이라 에러 코드로 사전 문구를 고른다(NERV CLE-UI-I18N-BACKEND 규칙 5,
 * Task CLE-T-MBMPX5). 모르는 코드면 서버 문구, 응답이 없으면 기본 실패 문구다.
 */
function acceptErrorMessage(err: unknown, locale: Locale): string {
  return serverErrorMessage(
    err,
    (key, params) => translate(locale, key, params),
    translate(locale, "invitations.accept.acceptFailedDefault"),
  );
}

type Status =
  | "loading"
  | "ready"
  | "mismatch"
  | "accepting"
  | "success"
  | "error"
  | "missing";

// 수락 페이지가 연 초대의 출처. 토큰이 있으면 토큰 모드, 없고 초대 id 만 있으면 초대 id 모드다.
// 모드 판별과 모드별 호출(메타 조회 · 수락 · 로그인 복귀 경로)을 이 유니온 한 곳에 모은다.
type Source =
  | { kind: "token"; token: string }
  | { kind: "id"; invitationId: string };

function fetchMeta(source: Source): Promise<InvitationMeta> {
  return source.kind === "token"
    ? invitationsApi.getByToken(source.token)
    : invitationsApi.getMine(source.invitationId);
}

function acceptSource(source: Source) {
  return source.kind === "token"
    ? workspacesApi.acceptInvitation(source.token)
    : invitationsApi.acceptMine(source.invitationId);
}

export function AcceptInvitationContent() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invitationId = searchParams.get("invitationId");
  const source = useMemo<Source | null>(() => {
    if (token) return { kind: "token", token };
    if (invitationId) return { kind: "id", invitationId };
    return null;
  }, [token, invitationId]);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const [status, setStatus] = useState<Status>(source ? "loading" : "missing");
  const [meta, setMeta] = useState<InvitationMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // 토큰 메타 조회 → 로그인 이메일과 비교. deps 에 locale 을 넣지 않아(토글이
  // 재조회를 유발하지 않도록) 텍스트 변환은 렌더 시점에서 수행한다.
  useEffect(() => {
    if (!source) return;
    // cleanup 이후 도착한 응답은 버린다. `useInvitationGate`(`components/auth/use-invitation-gate.ts`)의
    // 메타 조회와 같은 가드다. 한 번만 부르려는 ref 가드를 함께 두면 StrictMode 가 effect 를 mount,
    // cleanup, mount 로 돌릴 때 첫 응답은 버려지고 두 번째 실행은 건너뛰어 loading 에 머문다. 토큰 메타
    // 조회는 멱등 GET 이라 다시 불러도 된다.
    let cancelled = false;
    const currentLocale = useLocaleStore.getState().locale;
    (async () => {
      try {
        const m = await fetchMeta(source);
        if (cancelled) return;
        setMeta(m);
        if (source.kind === "id") {
          // 서버가 로그인 이메일로 온 초대만 돌려주므로 이메일 비교가 없다.
          setStatus("ready");
          return;
        }
        const userEmail = useAuthStore.getState().user?.email;
        // 서버 수락과 같은 규칙이다. 로그인 이메일을 소문자로 바꿔 토큰 이메일과 비교한다.
        setStatus(
          userEmail && userEmail.toLowerCase() === m.email.toLowerCase()
            ? "ready"
            : "mismatch",
        );
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(acceptErrorMessage(err, currentLocale));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  async function handleAccept() {
    if (!source) return;
    const currentLocale = useLocaleStore.getState().locale;
    setStatus("accepting");
    try {
      const result = await acceptSource(source);
      const list = await workspacesApi.list();
      setWorkspaces(list);
      void switchWorkspace(result.workspaceId);
      setStatus("success");
      toast.success(translate(currentLocale, "invitations.accept.joined"));
      // 합류한 워크스페이스의 slug URL 로 이동 (목록에서 slug 해소; 미발견 시 catch-all 흡수).
      const joined = list.find((w) => w.id === result.workspaceId);
      const dest = joined
        ? buildWorkspaceHref(joined.slug, "/dashboard")
        : "/dashboard";
      setTimeout(() => router.push(dest), 1500);
    } catch (err) {
      setErrorMessage(acceptErrorMessage(err, currentLocale));
      setStatus("error");
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // 로그아웃 요청이 실패해도 클라이언트 세션은 정리하고 로그인으로 보낸다.
    }
    // store 의 logout() 은 access token·`has_session` 힌트 쿠키·인증 플래그를 한꺼번에
    // 정리한다. setUser(null) 만 쓰면 has_session 쿠키가 남아, 이후 초대 링크 재진입 시
    // `useInvitationGate` 가 stale 쿠키로 잘못 리다이렉트한다(CLE-ACCT-WS 「초대 가입 화면」
    // 진입 경로가 has_session 을 load-bearing 으로 쓰므로 로그아웃도 이 쿠키를 반드시 지워야 한다).
    useAuthStore.getState().logout();
    // 다른 계정으로 로그인한 뒤 이 초대 수락 페이지로 돌아온다.
    // 초대 id 모드는 불일치 화면이 없어 여기 오지 않지만, 오더라도 돌아올 토큰이 없으니 `/login` 이다.
    router.push(
      buildInvitationLoginHref(source?.kind === "token" ? source.token : null),
    );
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
