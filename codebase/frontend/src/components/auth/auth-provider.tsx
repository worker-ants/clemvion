"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { usersApi } from "@/lib/api/users";
import { switchWorkspaceApi, decodeActiveWorkspaceId } from "@/lib/api/auth";
import {
  refreshAccessToken,
  setSessionRestoreInProgress,
} from "@/lib/api/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logout = useAuthStore((s) => s.logout);
  // Prevent duplicate initialization across re-renders
  const initAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated || initAttempted.current) return;
    initAttempted.current = true;

    async function restoreSession() {
      setLoading(true);
      setSessionRestoreInProgress(true);
      try {
        // Restore session via HttpOnly cookie refresh (deduplicated)
        const accessToken = await refreshAccessToken();
        if (!accessToken) {
          throw new Error("No access token");
        }

        const userRes = await usersApi.getMe();
        const user = userRes.data.data;
        if (!user) {
          throw new Error("No user data");
        }

        setAuthenticated(accessToken, user);

        // reconcile-on-load (결정1): /auth/refresh 로 재발급된 토큰은 활성 워크스페이스가
        // personal/first 로 재해석된다(refresh 는 클레임 미보존). 이전에 선택했던
        // 워크스페이스(persisted)와 다르면 /switch 로 재조정해 팀 컨텍스트를 복원한다.
        //
        // URL 우선 (슬러그 라우팅): `/w/<slug>/...` 라우트에서는 `[slug]` layout 이 URL 기준으로
        // reconcile 하므로(data-flow-12 §1.5 — "URL 있으면 URL 우선, 없으면 localStorage"),
        // 여기 persisted(localStorage) 기준 reconcile 은 건너뛴다 — 그렇지 않으면 딥링크가 담은
        // 워크스페이스와 마지막으로 선택한 워크스페이스가 이중으로 /switch 를 태워 레이스가 난다.
        // slug 없는 라우트(editor·catch-all·docs)에서만 localStorage 힌트로 재조정한다.
        const onWorkspaceSlugRoute = pathname.startsWith("/w/");
        const persisted = useWorkspaceStore.getState().currentWorkspaceId;
        if (
          !onWorkspaceSlugRoute &&
          persisted &&
          persisted !== decodeActiveWorkspaceId(accessToken)
        ) {
          try {
            await switchWorkspaceApi(persisted);
          } catch {
            // 비멤버(탈퇴·삭제) 등으로 전환 실패 → persisted 를 비워 다음 setWorkspaces 가
            // default 워크스페이스로 정렬하도록 한다.
            useWorkspaceStore.setState({ currentWorkspaceId: null });
          }
        }
      } catch {
        logout();
        // Only redirect if current path is not already a public auth route
        if (!pathname.startsWith("/login")) {
          const redirect =
            pathname.startsWith("/") && !pathname.startsWith("//")
              ? pathname
              : "/dashboard";
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
        }
      } finally {
        setSessionRestoreInProgress(false);
        setLoading(false);
      }
    }

    restoreSession();
  }, [isAuthenticated, setAuthenticated, setLoading, logout, router, pathname]);

  // Show loading spinner while restoring session
  if (isLoading && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
