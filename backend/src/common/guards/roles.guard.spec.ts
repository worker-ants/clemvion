import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles, RolesGuard, ROLES_KEY } from './roles.guard';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

function makeContext(opts: {
  userId?: string;
  workspaceId?: string;
  handler?: (...args: unknown[]) => unknown;
}): ExecutionContext {
  const handler = opts.handler ?? function noop() {};
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: opts.userId ? { sub: opts.userId } : undefined,
        headers: opts.workspaceId ? { 'x-workspace-id': opts.workspaceId } : {},
      }),
    }),
    getHandler: () => handler,
    getClass: () => class Dummy {},
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();

  function buildGuard(memberRole: string | null) {
    const workspaces = {
      getMemberRole: jest.fn().mockResolvedValue(memberRole),
    } as unknown as WorkspacesService;
    return new RolesGuard(reflector, workspaces);
  }

  describe('역할 계층 — @Roles("editor") 라우트', () => {
    class Target {
      @Roles('editor')
      handler() {}
    }
    const handler = Target.prototype.handler;

    it.each([
      ['owner', true],
      ['admin', true],
      ['editor', true],
      ['viewer', false],
    ])('memberRole=%s → canActivate=%s', async (role, expected) => {
      const guard = buildGuard(role);
      const ctx = makeContext({
        userId: 'u1',
        workspaceId: 'ws1',
        handler,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(expected);
    });
  });

  describe('역할 계층 — @Roles("admin") 라우트', () => {
    class Target {
      @Roles('admin')
      handler() {}
    }
    const handler = Target.prototype.handler;

    it.each([
      ['owner', true],
      ['admin', true],
      ['editor', false],
      ['viewer', false],
    ])('memberRole=%s → canActivate=%s', async (role, expected) => {
      const guard = buildGuard(role);
      const ctx = makeContext({
        userId: 'u1',
        workspaceId: 'ws1',
        handler,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(expected);
    });
  });

  describe('가드 통과 조건', () => {
    it('@Roles 미부착 핸들러는 항상 통과', async () => {
      const guard = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        workspaceId: 'ws1',
        handler: function noop() {},
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('userId 없으면 거부', async () => {
      const guard = buildGuard('owner');
      class T {
        @Roles('editor')
        h() {}
      }
      const ctx = makeContext({ workspaceId: 'ws1', handler: T.prototype.h });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });

    it('workspaceId 없으면 거부', async () => {
      const guard = buildGuard('owner');
      class T {
        @Roles('editor')
        h() {}
      }
      const ctx = makeContext({ userId: 'u1', handler: T.prototype.h });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });

    it('워크스페이스 멤버가 아니면 거부 (getMemberRole=null)', async () => {
      const guard = buildGuard(null);
      class T {
        @Roles('editor')
        h() {}
      }
      const ctx = makeContext({
        userId: 'u1',
        workspaceId: 'ws1',
        handler: T.prototype.h,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
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
