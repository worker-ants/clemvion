"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaces } from "@/lib/workspace/use-workspaces";
import { buildWorkspaceHref } from "@/lib/workspace/href";

/**
 * `(main)` 그룹의 slug 없는 경로를 활성 워크스페이스 slug 로 흡수하는 catch-all 리다이렉트.
 *
 * 흡수 대상: 구 무-slug 북마크(`/workflows`·`/dashboard` 등), 알림 딥링크(`/integrations/<id>`·
 * `/profile`), 로그인 후 기본 이동(`/dashboard`) — 전부 `/w/<활성slug>/<경로>` 로 forward 한다.
 * specific route 가 우선하므로 `/w/[slug]/...`·`/docs/...` 는 여기 오지 않는다.
 *
 * 활성 slug 는 store 의 `currentWorkspaceId`(localStorage 힌트 → AuthProvider 가 토큰과 정합)
 * 에서 구한다. redirect-only 경로라 flash 는 허용(spec 계획 §확정 2). query·hash 는 보존한다.
 */
export default function WorkspaceRedirect() {
  const params = useParams<{ rest?: string[] }>();
  const router = useRouter();

  useWorkspaces();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loaded = useWorkspaceStore((s) => s.loaded);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);

  useEffect(() => {
    if (!loaded) return;
    const active =
      workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0];
    if (!active) return;
    const rest = Array.isArray(params.rest) ? params.rest : [];
    const path = rest.length > 0 ? `/${rest.join("/")}` : "/dashboard";
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(buildWorkspaceHref(active.slug, path) + search + hash);
  }, [loaded, workspaces, currentWorkspaceId, params.rest, router]);

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
