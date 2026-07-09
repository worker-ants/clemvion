"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaces } from "@/lib/workspace/use-workspaces";
import { buildWorkspaceHref } from "@/lib/workspace/href";
import { resolveFallbackWorkspace } from "@/lib/workspace/resolve-fallback";

/**
 * `/w/[slug]/...` 워크스페이스 컨텍스트 게이트 (공용).
 *
 * URL slug 가 활성 워크스페이스의 **FE 라우팅 SoT** 다 (spec/2-navigation/9-user-profile.md §3,
 * data-flow/12-workspace.md §1.5 Rationale). 이 게이트는:
 *   1. slug → 워크스페이스 해소 (`GET /workspaces` 응답의 slug 필드).
 *   2. **reconcile (URL 우선)** — resolved id ≠ store 활성 id 면 `switchWorkspace(resolvedId)` 로
 *      토큰·store 를 URL 에 맞춘다. 이는 기존 흐름(store.currentWorkspaceId → axios `X-Workspace-Id`
 *      헤더 → `/switch` 토큰 재발급)을 구동할 뿐, backend 인가 모델(header-first→토큰 클레임)은 불변.
 *   3. **멤버십 redirect (UX 전용)** — 비멤버/무효 slug → default 워크스페이스. 인가 경계는 아니며
 *      (유일 강제 지점은 backend RolesGuard 403), 편의 리다이렉트일 뿐이다.
 *   4. **gate** — store 가 URL 워크스페이스로 정합될 때까지 children 렌더를 막는다. 그래야 페이지
 *      쿼리가 올바른 `X-Workspace-Id` 헤더/토큰으로 발사된다 (전환 중 wrong-workspace 데이터 방지).
 *
 * `(main)/w/[slug]/layout.tsx`(사이드바+`MainContent` chrome) 와 `(editor)/w/[slug]/layout.tsx`
 * (`EditorContent` 풀스크린 chrome) 양쪽이 이 컴포넌트를 공유한다 — 게이트 로직은 route group
 * 무관하게 `useParams().slug` 로만 동작한다.
 */
export function WorkspaceSlugGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const router = useRouter();

  // 목록 fetch (queryKey dedup — 사이드바와 단일 요청).
  useWorkspaces();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loaded = useWorkspaceStore((s) => s.loaded);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const resolved = workspaces.find((w) => w.slug === slug) ?? null;
  const reconciled = resolved !== null && resolved.id === currentWorkspaceId;

  // URL 우선 reconcile: 활성 워크스페이스가 URL 과 다르면 URL 에 맞춰 전환.
  useEffect(() => {
    if (!loaded || !resolved) return;
    if (resolved.id !== currentWorkspaceId) {
      void switchWorkspace(resolved.id);
    }
  }, [loaded, resolved, currentWorkspaceId, switchWorkspace]);

  // 무효/비멤버 slug → default 워크스페이스 dashboard (UX 전용).
  useEffect(() => {
    if (!loaded || resolved || workspaces.length === 0) return;
    const fallback = resolveFallbackWorkspace(workspaces, currentWorkspaceId);
    if (fallback) {
      router.replace(buildWorkspaceHref(fallback.slug, "/dashboard"));
    }
  }, [loaded, resolved, workspaces, currentWorkspaceId, router]);

  if (!loaded || !reconciled) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
