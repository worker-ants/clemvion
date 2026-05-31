import type { WorkspaceRole } from "@/lib/stores/workspace-store";

/**
 * Re-run 권한 판정 (spec/5-system/13-replay-rerun.md §RR-PL-06).
 *
 * 다음을 **모두** 만족해야 true:
 * 1. 호출자가 워크스페이스 Editor 이상 (editor / admin / owner).
 * 2. 호출자가 원본 실행의 시작자이거나(`executedBy === currentUserId`),
 *    워크스페이스 Owner / Admin 이거나, 원본에 시작자가 없는 자동 실행
 *    (`executedBy == null` — 트리거/스케줄/웹훅; v1 정책상 워크스페이스 자원으로
 *    취급해 Editor+ 면 누구나 허용).
 *
 * dry-run 모드에도 동일하게 적용된다. 백엔드도 같은 가드를 enforce 하므로 본
 * 헬퍼는 UI affordance (버튼 disabled/hidden) 결정용이다.
 *
 * 역할 계층 (viewer < editor < admin < owner) 은 `RoleGate` 의 ROLE_LEVEL 과
 * 동일하게 유지한다.
 */
const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export interface ReRunUser {
  /** 현재 사용자 id (auth-store). 미인증이면 null. */
  id: string | null;
  /** 현재 워크스페이스에서의 역할. 멤버가 아니면 null. */
  role: WorkspaceRole | null;
}

export interface ReRunExecution {
  /** 원본 실행 시작자 user id. 자동 실행(트리거/스케줄/웹훅)은 null. */
  executedBy?: string | null;
}

export function canReRun(user: ReRunUser, execution: ReRunExecution): boolean {
  const { id: currentUserId, role } = user;

  // (1) Editor 이상.
  if (!role || ROLE_LEVEL[role] < ROLE_LEVEL.editor) return false;

  // (2) Owner / Admin 은 타인 실행도 허용.
  if (role === "owner" || role === "admin") return true;

  // Editor: 시작자가 없는 자동 실행이거나 본인이 시작한 실행이어야 한다.
  const executedBy = execution.executedBy ?? null;
  if (executedBy == null) return true;
  return currentUserId != null && executedBy === currentUserId;
}
