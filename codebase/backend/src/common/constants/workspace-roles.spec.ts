import {
  ADMIN_ROLES,
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
});
