import {
  ADMIN_ROLES,
  NOT_A_MEMBER,
  ROLE_REQUIRED,
  WORKSPACE_ROLE_LEVEL,
  workspaceRoleLevel,
} from './workspace-roles';
import { WORKSPACE_ROLES } from '../../modules/workspaces/dto/add-member.dto';

describe('workspace-roles — 가드와 서비스가 보는 단일 역할 서열', () => {
  it('서열은 viewer < editor < admin < owner', () => {
    expect(
      ['viewer', 'editor', 'admin', 'owner'].map(workspaceRoleLevel),
    ).toEqual([1, 2, 3, 4]);
  });

  it('DTO 가 받는 역할 전부가 서열에 있다 — 한쪽에만 역할이 늘면 RED', () => {
    expect(Object.keys(WORKSPACE_ROLE_LEVEL).sort()).toEqual(
      [...WORKSPACE_ROLES].sort(),
    );
  });

  it('계층 밖 문자열은 0 — 프로토타입 키도 서열로 읽지 않는다', () => {
    expect(workspaceRoleLevel('superadmin')).toBe(0);
    expect(workspaceRoleLevel('constructor')).toBe(0);
    expect(workspaceRoleLevel('')).toBe(0);
  });

  it('ADMIN_ROLES 는 서열에서 파생된다 — admin 이상(admin · owner)', () => {
    expect([...ADMIN_ROLES].sort()).toEqual(['admin', 'owner']);
  });

  it('역할 미달 본문은 요구 역할마다 있고 viewer 는 비멤버와 같다', () => {
    expect(Object.keys(ROLE_REQUIRED).sort()).toEqual(
      Object.keys(WORKSPACE_ROLE_LEVEL).sort(),
    );
    expect(ROLE_REQUIRED.viewer).toEqual(NOT_A_MEMBER);
    expect(
      (['editor', 'admin', 'owner'] as const).map((r) => ROLE_REQUIRED[r].code),
    ).toEqual(['EDITOR_REQUIRED', 'ADMIN_REQUIRED', 'OWNER_REQUIRED']);
  });
});
