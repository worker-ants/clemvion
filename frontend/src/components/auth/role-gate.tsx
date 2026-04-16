"use client";

import {
  selectCurrentRole,
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

interface Props {
  /** 최소 요구 역할. 사용자가 이 이상의 역할일 때만 children 렌더 */
  minRole: WorkspaceRole;
  children: React.ReactNode;
  /** 권한 부족 시 대체 노출 (기본: null) */
  fallback?: React.ReactNode;
}

/**
 * 현재 워크스페이스에서 사용자가 `minRole` 이상일 때만 children을 렌더한다.
 * Backend의 `RolesGuard` + `@Roles()`와 같은 계층(viewer < editor < admin < owner).
 * UI는 권한 없는 동작 자체를 숨겨 사용자 혼란을 줄이고, API는 별도로 가드한다.
 */
export function RoleGate({ minRole, children, fallback = null }: Props) {
  const role = useWorkspaceStore(selectCurrentRole);
  if (!role) return <>{fallback}</>;
  if (ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) return <>{fallback}</>;
  return <>{children}</>;
}

/** 훅 형태 — boolean으로 권한 확인이 필요한 곳 */
export function useHasRole(minRole: WorkspaceRole): boolean {
  const role = useWorkspaceStore(selectCurrentRole);
  if (!role) return false;
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
}
