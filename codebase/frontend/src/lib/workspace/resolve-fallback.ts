import type { WorkspaceSummary } from "@/lib/stores/workspace-store";

/**
 * 활성 워크스페이스(있으면), 없으면 첫 워크스페이스를 해소한다 (없으면 null).
 *
 * `[slug]` layout 의 무효/비멤버 slug 폴백 리다이렉트와 `(main)/[...rest]` catch-all 이 **동일
 * 규칙을 공유**하도록 단일 순수 함수로 추출 — 정책이 바뀔 때 한 곳만 고치면 되고, 두 지점이
 * 서로 다른 워크스페이스로 귀결되는 drift 를 막는다.
 */
export function resolveFallbackWorkspace(
  workspaces: WorkspaceSummary[],
  currentWorkspaceId: string | null,
): WorkspaceSummary | null {
  return (
    workspaces.find((w) => w.id === currentWorkspaceId) ??
    workspaces[0] ??
    null
  );
}
