import {
  NOT_A_MEMBER,
  ROLE_REQUIRED,
  type WorkspaceRoleName,
} from '../constants/workspace-roles';

/**
 * `@ApiForbiddenResponse` 설명 문장 — `RolesGuard` 가 내는 거부 코드를 싣는다(`spec/conventions/swagger.md` §5-4).
 *
 * 코드 이름은 `NOT_A_MEMBER` · `ROLE_REQUIRED` 상수에서 보간한다 — 문장을 손으로 쓰던 시절 형식이 컨트롤러마다 갈렸고
 * («Admin 미만 권한» · «관리자 권한 필요» · «권한 부족 (Admin 미만) 또는 비멤버») 코드가 빠졌다. 저장소 가드
 * `forbidden-response-codes` 가 모든 라우트의 403 설명이 가드 코드를 담는지 본다.
 */

/**
 * 비멤버 거부 — `@Roles()` 없이 워크스페이스를 소비(`@WorkspaceId()` · `@WorkspaceParam()`)하는 라우트의 403 설명.
 * 비멤버는 요구 역할과 무관하게 이 코드다(`spec/data-flow/12-workspace.md` §Rationale «가드 거부의 오류 코드»).
 */
export const FORBIDDEN_NOT_A_MEMBER = `워크스페이스 멤버가 아님(${NOT_A_MEMBER.code})`;

/** 역할 미달 문구 — `ROLE_REQUIRED` 메시지(«Editor 이상의 권한이 필요합니다.»)와 같은 표기. */
const ROLE_SHORTFALL: Readonly<
  Record<Exclude<WorkspaceRoleName, 'viewer'>, string>
> = {
  editor: 'Editor 이상 권한 필요',
  admin: 'Admin 이상 권한 필요',
  owner: 'Owner 권한 필요',
};

/**
 * `@Roles(role)` 라우트의 403 설명 — 비멤버(`NOT_A_MEMBER`)와 역할 미달(`ROLE_REQUIRED[role]`) 두 거부를 싣는다.
 *
 * `viewer` 는 멤버십과 같아(`ROLE_REQUIRED.viewer` 가 `NOT_A_MEMBER`) 비멤버 문장뿐이다. 여러 역할을 주는 라우트는 가장
 * 낮은 역할을 넘긴다 — 가드의 문턱이다(`lowestRequiredRole`). 서비스가 내는 403 은 이 문장 뒤에 덧붙인다.
 */
export function forbiddenForRole(role: WorkspaceRoleName): string {
  if (role === 'viewer') return FORBIDDEN_NOT_A_MEMBER;
  return `${FORBIDDEN_NOT_A_MEMBER} 또는 ${ROLE_SHORTFALL[role]}(${ROLE_REQUIRED[role].code})`;
}
