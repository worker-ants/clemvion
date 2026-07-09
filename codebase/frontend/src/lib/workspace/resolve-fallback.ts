import type { WorkspaceSummary } from "@/lib/stores/workspace-store";

/**
 * 활성 워크스페이스(있으면), 없으면 첫 워크스페이스를 해소한다 (없으면 null).
 *
 * "현재 id 가 목록에 있으면 유지, 없으면 첫 항목" 규칙의 **단일 진실 공급원**. 세 소비처가
 * 모두 이 함수에 위임한다: `[slug]` layout 의 무효/비멤버 slug 폴백 리다이렉트,
 * `(main)/[...rest]` catch-all, 그리고 `workspace-store.setWorkspaces`(목록 재로드 시 활성
 * 워크스페이스 유지/재선택). 정책이 바뀌어도 한 곳만 고치면 되고 지점 간 drift 를 막는다.
 * (cf. `useWorkspaceSlug` 는 first-workspace 폴백이 없는 **다른 정책**이다 — URL/store slug 만.)
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
