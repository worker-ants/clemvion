"use client";

import { useEffect, useMemo } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaces } from "@/lib/workspace/use-workspaces";
import { buildWorkspaceHref } from "@/lib/workspace/href";
import { resolveFallbackWorkspace } from "@/lib/workspace/resolve-fallback";

/**
 * `(main)` 그룹의 slug 없는 경로를 활성 워크스페이스 slug 로 흡수하는 catch-all 리다이렉트.
 *
 * 흡수 대상: 구 무-slug 북마크(`/workflows`·`/dashboard` 등), 알림 딥링크(`/integrations/<id>`·
 * `/profile`), 로그인 후 기본 이동(`/dashboard`) — 전부 `/w/<활성slug>/<경로>` 로 forward 한다.
 *
 * **이미 `/w/` 로 시작하는 경로는 여기서 종결(terminal)한다 — 절대 slug 를 재부착하지 않는다.**
 * `w/[slug]` 하위에 없는 세그먼트는 specific route 매칭에 실패해 이 catch-all 로 온다
 * (예: `/w/<slug>/docs` — `/docs` 는 워크스페이스 밖 라우트라 `w/[slug]` 아래 존재하지 않는다.
 * `/w/<slug>` 단독도 그 레벨에 page 가 없어 여기로 온다). 그때 slug 를 또 붙이면 영원히
 * 매칭되지 않는 경로가 한 세그먼트씩 길어지며 무한 리다이렉트가 된다 —
 * `/w/a/docs` → `/w/a/w/a/docs` → `/w/a/w/a/w/a/docs` → … (실제 사용자 보고 증상).
 *
 * 종결 규칙:
 *   - `/w/<slug>` 단독 → 그 워크스페이스의 dashboard 로 forward (URL 의 slug 를 존중).
 *   - 그 외 `/w/…` → `notFound()`. 그런 워크스페이스 라우트가 없다는 뜻이므로 404 가 정직하다
 *     (spec/2-navigation/11-error-empty-states.md §1.3 "404 감지 = 존재하지 않는 라우트 접근",
 *     사이드바 유지 — `(main)/not-found.tsx` 가 그 바운더리다).
 *
 * `/w/` 접두를 **떼고 재-forward** 하는 대안은 채택하지 않았다: `/w/<slug>/<미지>` → `/<미지>`
 * → 다시 prefix → `/w/<slug>/<미지>` → … 로 ping-pong 무한루프가 되어 증상만 바뀐다.
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

  const rest = useMemo(
    () => (Array.isArray(params.rest) ? params.rest : []),
    [params.rest],
  );

  // 세그먼트 단위 비교 — `/web-chat` 처럼 'w' 로 시작하는 일반 경로와 섞이지 않는다.
  const workspacePrefixed = rest[0] === "w";
  // `/w/<slug>` 단독만 forward 대상. slug 가 URL 에 있으므로 store 로드를 기다릴 필요가 없다.
  const workspaceRootSlug =
    workspacePrefixed && rest.length === 2 ? rest[1] : null;

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";

    if (workspaceRootSlug) {
      router.replace(
        buildWorkspaceHref(workspaceRootSlug, "/dashboard") + search + hash,
      );
      return;
    }
    // 나머지 `/w/…` 는 아래 render 단계의 notFound() 가 종결한다.
    if (workspacePrefixed) return;

    if (!loaded) return;
    const active = resolveFallbackWorkspace(workspaces, currentWorkspaceId);
    if (!active) return;
    const path = rest.length > 0 ? `/${rest.join("/")}` : "/dashboard";
    router.replace(buildWorkspaceHref(active.slug, path) + search + hash);
  }, [
    loaded,
    workspaces,
    currentWorkspaceId,
    rest,
    router,
    workspacePrefixed,
    workspaceRootSlug,
  ]);

  // notFound() 는 **render 중** 호출해야 not-found 바운더리(`(main)/not-found.tsx`)가 잡는다 —
  // effect 안에서 부르면 무시된다. 훅 순서를 깨지 않도록 모든 훅 뒤에 둔다.
  if (workspacePrefixed && !workspaceRootSlug) notFound();

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
