/**
 * 워크스페이스 역할 서열 — `RolesGuard` 의 `@Roles()` 판정과 서비스 계층의 Admin 판정이 **같은 표**를 본다.
 *
 * 종전엔 가드의 숫자 서열(`ROLE_HIERARCHY`)과 두 서비스(`workspaces.service.ts` ·
 * `workspace-invitations.service.ts`)의 `ADMIN_ROLES` 집합이 각자 따로 있었다. 경로 워크스페이스
 * 라우트가 가드와 서비스 양쪽에서 같은 요구를 판정하게 되면서(2026-09-25) 두 표현이 갈리면 두 선이
 * 서로 다른 답을 내게 됐다 — 서열 하나에서 파생한다.
 */
export const WORKSPACE_ROLE_LEVEL: Readonly<Record<string, number>> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

/** 역할의 서열. 계층 밖 문자열(프로토타입 키 포함)은 0 — 어떤 요구도 충족하지 못한다. */
export function workspaceRoleLevel(role: string): number {
  return Object.hasOwn(WORKSPACE_ROLE_LEVEL, role)
    ? WORKSPACE_ROLE_LEVEL[role]
    : 0;
}

/** Admin 이상(admin · owner). 서비스 계층의 Admin 판정이 쓴다. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(
  Object.keys(WORKSPACE_ROLE_LEVEL).filter(
    (role) => workspaceRoleLevel(role) >= workspaceRoleLevel('admin'),
  ),
);
