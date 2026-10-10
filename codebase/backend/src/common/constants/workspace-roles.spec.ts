import { ForbiddenException } from '@nestjs/common';
import {
  ADMIN_ROLE_CHANGE_REQUIRES_OWNER,
  ADMIN_ROLES,
  assertMayChangeAdminRole,
  lowestRequiredRole,
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

  it('lowestRequiredRole — 요구 중 가장 낮은 역할이 문턱이다(순서 무관)', () => {
    expect(lowestRequiredRole(['admin', 'editor'])).toBe('editor');
    expect(lowestRequiredRole(['editor', 'admin'])).toBe('editor');
    expect(lowestRequiredRole(['owner'])).toBe('owner');
    expect(lowestRequiredRole(['owner', 'viewer', 'admin'])).toBe('viewer');
    // 서열 밖 문자열(0)은 어떤 역할보다 낮다 — 그것이 문턱이 되어 요구가 사라진다(주석의 경고를 고정).
    expect(lowestRequiredRole(['admin', 'superadmin'])).toBe('superadmin');
    // 빈 요구는 호출자 계약 위반이다 — 조용히 문턱을 지어내지 않고 던진다.
    expect(() => lowestRequiredRole([])).toThrow(TypeError);
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

  describe('assertMayChangeAdminRole — 관리자 역할을 주거나 빼는 변경은 owner 만', () => {
    const rejection = () => {
      try {
        assertMayChangeAdminRole('admin', 'admin');
      } catch (err) {
        return err as ForbiddenException;
      }
      throw new Error('expected rejection');
    };

    it.each([
      ['admin', ['admin']],
      ['admin', ['editor', 'admin']],
      ['admin', ['admin', 'viewer']],
      ['editor', ['admin']],
      ['superadmin', ['admin']],
    ])(
      '요청자 %s 가 %j 를 건드리면 403 OWNER_REQUIRED',
      (requester, touched) => {
        expect(() => assertMayChangeAdminRole(requester, ...touched)).toThrow(
          ForbiddenException,
        );
        const body = rejection().getResponse() as Record<string, unknown>;
        expect(body).toEqual({ ...ADMIN_ROLE_CHANGE_REQUIRES_OWNER });
        expect(body.code).toBe(ROLE_REQUIRED.owner.code);
      },
    );

    it.each([
      ['owner', ['admin']],
      ['owner', ['admin', 'admin']],
      ['admin', ['editor']],
      ['admin', ['viewer', 'editor']],
      ['admin', []],
      ['admin', [null, undefined]],
    ] as Array<[string, Array<string | null | undefined>]>)(
      '요청자 %s 가 %j 를 건드리면 통과한다',
      (requester, touched) => {
        expect(() =>
          assertMayChangeAdminRole(requester, ...touched),
        ).not.toThrow();
      },
    );

    it('거부 본문은 호출마다 새 객체다 — 공유 상수가 요청 사이에 새지 않는다', () => {
      const first = rejection().getResponse();
      const second = rejection().getResponse();
      expect(first).not.toBe(ADMIN_ROLE_CHANGE_REQUIRES_OWNER);
      expect(first).not.toBe(second);
    });
  });
});
