/**
 * 워크스페이스 역할 서열 — `RolesGuard` 의 `@Roles()` 판정과 서비스 계층의 Admin 판정이 **같은 표**를 본다.
 *
 * 종전엔 가드의 숫자 서열(`ROLE_HIERARCHY`)과 두 서비스(`workspaces.service.ts` ·
 * `workspace-invitations.service.ts`)의 `ADMIN_ROLES` 집합이 각자 따로 있었다. 경로 워크스페이스
 * 라우트가 가드와 서비스 양쪽에서 같은 요구를 판정하게 되면서(2026-09-25) 두 표현이 갈리면 두 선이
 * 서로 다른 답을 내게 됐다 — 서열 하나에서 파생한다. `integrations.service.ts` 의 같은 값 로컬 `ADMIN_ROLES`
 * (통합 관리 권한)도 뒤이어 이 표로 옮겼다 — 동명이인 상수가 남으면 한쪽만 바뀌는 날 두 판정이 갈린다.
 */
export const WORKSPACE_ROLE_LEVEL = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
} as const satisfies Record<string, number>;

/** 역할 이름 — `@Roles(...)` 가 받는 값. 오탈자는 컴파일에서 막힌다(미등록 문자열은 서열 0 이라 요구가 사라진다). */
export type WorkspaceRoleName = keyof typeof WORKSPACE_ROLE_LEVEL;

/** 역할의 서열. 계층 밖 문자열(프로토타입 키 포함)은 0 — 어떤 요구도 충족하지 못한다. */
export function workspaceRoleLevel(role: string): number {
  return Object.hasOwn(WORKSPACE_ROLE_LEVEL, role)
    ? WORKSPACE_ROLE_LEVEL[role as WorkspaceRoleName]
    : 0;
}

/** Admin 이상(admin · owner). 서비스 계층의 Admin 판정이 쓴다. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(
  Object.keys(WORKSPACE_ROLE_LEVEL).filter(
    (role) => workspaceRoleLevel(role) >= workspaceRoleLevel('admin'),
  ),
);

/** 거부 본문 — `ForbiddenException` 에 넘기는 `{ code, message }`. */
export interface WorkspaceRoleRejection {
  readonly code: string;
  readonly message: string;
}

/**
 * 비멤버 거부. `RolesGuard` 와 서비스 계층(`WorkspacesService`)이 같은 본문을 낸다 — 두 선이 같은
 * 실패에 다른 문장을 내지 않게 한 표에 둔다. 예외에 넘길 때는 펼쳐서(`{ ...NOT_A_MEMBER }`) 공유
 * 객체가 요청 사이에 새지 않게 한다.
 */
export const NOT_A_MEMBER: WorkspaceRoleRejection = {
  code: 'NOT_A_MEMBER',
  message: '워크스페이스 멤버가 아닙니다.',
};

/**
 * 멤버의 역할 미달 거부 — **요구한 최소 역할**의 본문. 키가 `WorkspaceRoleName` 전부라 서열에 역할이
 * 늘면 여기서 컴파일이 막힌다. `viewer` 는 멤버십과 같아 비멤버와 같은 본문이다(멤버는 누구나 viewer
 * 이상이라 DB 에 계층 밖 역할 문자열이 있을 때만 닿는다).
 */
export const ROLE_REQUIRED: Readonly<
  Record<WorkspaceRoleName, WorkspaceRoleRejection>
> = {
  viewer: NOT_A_MEMBER,
  editor: {
    code: 'EDITOR_REQUIRED',
    message: 'Editor 이상의 권한이 필요합니다.',
  },
  admin: { code: 'ADMIN_REQUIRED', message: 'Admin 이상의 권한이 필요합니다.' },
  owner: { code: 'OWNER_REQUIRED', message: 'Owner 권한이 필요합니다.' },
};
