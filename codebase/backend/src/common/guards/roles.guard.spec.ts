import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles, RolesGuard, ROLES_KEY } from './roles.guard';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

/**
 * `tokenWorkspaceId` 는 `jwt.strategy` 가 **멤버십 검증 후** 채운
 * `request.user.workspaceId` 다 — 그래서 이 값만 쓰는 경로는 재검증이 불요하다.
 * `headerWorkspaceId` 는 클라이언트가 보낸 `X-Workspace-Id` 로 **무검증**이다.
 * 두 값을 분리해 모델링하는 것이 이 스위트의 핵심 — 종전 헬퍼는 헤더만 모델링해
 * "헤더가 토큰을 덮어쓴다" 는 이 결함의 재현 조건을 표현할 수 없었다.
 */
function makeContext(opts: {
  userId?: string;
  headerWorkspaceId?: string | string[];
  tokenWorkspaceId?: string;
  handler?: (...args: unknown[]) => unknown;
}): ExecutionContext {
  const handler = opts.handler ?? function noop() {};
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: opts.userId
          ? { sub: opts.userId, workspaceId: opts.tokenWorkspaceId }
          : undefined,
        headers: opts.headerWorkspaceId
          ? { 'x-workspace-id': opts.headerWorkspaceId }
          : {},
      }),
    }),
    getHandler: () => handler,
    getClass: () => class Dummy {},
  } as unknown as ExecutionContext;
}

class RolesTarget {
  @Roles('editor')
  editorOnly() {}

  @Roles('admin')
  adminOnly() {}
}

/** `@Roles()` 가 없는 핸들러 — 이 결함이 살던 자리다. */
function undecorated() {}

describe('RolesGuard', () => {
  const reflector = new Reflector();

  function buildGuard(memberRole: string | null) {
    const getMemberRole = jest.fn().mockResolvedValue(memberRole);
    const workspaces = { getMemberRole } as unknown as WorkspacesService;
    return { guard: new RolesGuard(reflector, workspaces), getMemberRole };
  }

  describe('역할 계층 — @Roles("editor") 라우트', () => {
    it.each([
      ['owner', true],
      ['admin', true],
      ['editor', true],
      ['viewer', false],
    ])('memberRole=%s → canActivate=%s', async (role, expected) => {
      const { guard } = buildGuard(role);
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'ws1',
        tokenWorkspaceId: 'ws1',
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(expected);
    });
  });

  describe('역할 계층 — @Roles("admin") 라우트', () => {
    it.each([
      ['owner', true],
      ['admin', true],
      ['editor', false],
      ['viewer', false],
    ])('memberRole=%s → canActivate=%s', async (role, expected) => {
      const { guard } = buildGuard(role);
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'ws1',
        tokenWorkspaceId: 'ws1',
        handler: RolesTarget.prototype.adminOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(expected);
    });
  });

  /**
   * 본 결함의 핵심 계약. 종전 스위트는 여기서 "@Roles 미부착 핸들러는 항상 통과" 를
   * **의도된 동작으로 고정**하고 있었다 — 그 테스트가 있는 동안 취약점은 회귀가 아니라
   * 계약이었다. 새 계약으로 교체한다.
   */
  describe('헤더가 토큰을 덮어쓰면 @Roles() 유무와 무관하게 멤버십을 검증한다', () => {
    it('비멤버가 헤더로 타 워크스페이스를 지정 + @Roles() 없음 → 거부', async () => {
      const { guard, getMemberRole } = buildGuard(null); // 비멤버
      const ctx = makeContext({
        userId: 'attacker',
        headerWorkspaceId: 'victim-ws',
        tokenWorkspaceId: 'own-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      // 멤버십을 **실제로 조회했는지** 단언한다 — 우연히 false 가 된 것이 아님을 고정.
      expect(getMemberRole).toHaveBeenCalledWith('victim-ws', 'attacker');
    });

    it('멤버가 헤더로 전환 + @Roles() 없음 → 통과', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'other-ws',
        tokenWorkspaceId: 'own-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).toHaveBeenCalledWith('other-ws', 'u1');
    });

    it('비멤버 + @Roles("editor") → 거부 (종전 동작 보존)', async () => {
      const { guard } = buildGuard(null);
      const ctx = makeContext({
        userId: 'attacker',
        headerWorkspaceId: 'victim-ws',
        tokenWorkspaceId: 'own-ws',
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  describe('헤더가 없으면 재검증하지 않는다 (jwt.strategy 가 이미 검증)', () => {
    it('헤더 부재 + @Roles() 없음 → 통과, getMemberRole 미호출', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        tokenWorkspaceId: 'own-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      // 불필요한 DB 왕복을 넣지 않았음을 고정 — "무조건 조회" 로 구현하면 RED.
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    it('헤더가 토큰과 동일해도 재검증하지 않는다', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'same-ws',
        tokenWorkspaceId: 'same-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    it('헤더 부재 + @Roles() 있으면 역할 조회는 여전히 필요', async () => {
      const { guard, getMemberRole } = buildGuard('editor');
      const ctx = makeContext({
        userId: 'u1',
        tokenWorkspaceId: 'own-ws',
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).toHaveBeenCalledWith('own-ws', 'u1');
    });
  });

  describe('전역 APP_GUARD 로서 보존해야 하는 경로', () => {
    it('미인증(@Public 등) + @Roles() 없음 → 통과 (인증 판정은 JwtAuthGuard 소관)', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({ handler: undecorated });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    it('미인증 + 헤더 위조 시도 → 통과 (워크스페이스 컨텍스트를 쓰는 핸들러가 아니면 무해)', async () => {
      const { guard } = buildGuard(null);
      const ctx = makeContext({
        headerWorkspaceId: 'victim-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('미인증 + @Roles() → 거부', async () => {
      const { guard } = buildGuard('owner');
      const ctx = makeContext({
        headerWorkspaceId: 'ws1',
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });

    it('워크스페이스 컨텍스트 없음 + @Roles() 없음 → 통과', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({ userId: 'u1', handler: undecorated });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    it('워크스페이스 컨텍스트 없음 + @Roles() → 거부', async () => {
      const { guard } = buildGuard('owner');
      const ctx = makeContext({
        userId: 'u1',
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  describe('헤더 배열 정규화', () => {
    it('중복 헤더(배열)면 첫 값을 쓰고 그 값으로 멤버십을 검증한다', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({
        userId: 'attacker',
        headerWorkspaceId: ['victim-ws', 'decoy-ws'],
        tokenWorkspaceId: 'own-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      expect(getMemberRole).toHaveBeenCalledWith('victim-ws', 'attacker');
    });
  });

  it('@Roles + ROLES_KEY 메타데이터 라운드트립', () => {
    class T {
      @Roles('admin', 'owner')
      h() {}
    }
    expect(reflector.get<string[]>(ROLES_KEY, T.prototype.h)).toEqual([
      'admin',
      'owner',
    ]);
  });
});
