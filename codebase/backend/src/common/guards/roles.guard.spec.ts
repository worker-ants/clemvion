import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles, RolesGuard, ROLES_KEY } from './roles.guard';
import { WorkspaceId } from '../decorators/workspace.decorator';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

/**
 * `tokenWorkspaceId` 는 `jwt.strategy` 가 **멤버십 검증 후** 채운
 * `request.user.workspaceId` 다 — 그래서 이 값만 쓰는 경로는 재검증이 불요하다.
 * `headerWorkspaceId` 는 클라이언트가 보낸 `X-Workspace-Id` 로 **무검증**이다.
 * 두 값을 분리해 모델링하는 것이 이 스위트의 핵심 — 종전 헬퍼는 헤더만 모델링해
 * "헤더가 토큰을 덮어쓴다" 는 이 결함의 재현 조건을 표현할 수 없었다.
 *
 * `controllerClass` — `RolesGuard.handlerConsumesWorkspaceId` 는 `ROUTE_ARGS_METADATA` 를
 * "실제 데코레이터가 붙은 클래스" 기준으로 조회한다. 기본값(매 호출 새 익명 `class Dummy{}`)은
 * 어떤 메서드도 `@WorkspaceId()` 로 데코레이트되지 않은, 즉 "워크스페이스와 무관한 라우트"를
 * 모델링한다 — `GlobalRouteTarget` 과 동치. `@WorkspaceId()` 를 실제로 쓰는 라우트를
 * 모델링하려면 `WorkspaceScopedTarget` 을 명시로 넘긴다.
 */
function makeContext(opts: {
  userId?: string;
  headerWorkspaceId?: string | string[];
  tokenWorkspaceId?: string;
  handler?: (...args: unknown[]) => unknown;
  controllerClass?: object;
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
    getClass: () => opts.controllerClass ?? class Dummy {},
  } as unknown as ExecutionContext;
}

class RolesTarget {
  @Roles('editor')
  editorOnly() {}

  @Roles('admin')
  adminOnly() {}
}

/**
 * `@Roles()` 없이 `@WorkspaceId()` 만 쓰는 라우트 — 이 결함(cross-tenant, 73건)이 실제로
 * 살던 형태다. `workspaceScoped` 자체는 테스트에서 호출되지 않는다 — `@WorkspaceId()` 를
 * 붙였다는 사실만으로 `ROUTE_ARGS_METADATA` 에 팩토리가 등록되고,
 * `handlerConsumesWorkspaceId` 가 그 등록을 reflection 으로 확인한다.
 */
class WorkspaceScopedTarget {
  workspaceScoped(@WorkspaceId() _workspaceId: string) {
    return _workspaceId;
  }
}

/**
 * `@Roles()` 도 `@WorkspaceId()` 도 안 쓰는 워크스페이스-무관 전역 API(예: `system-status`).
 * 2026-08-08 e2e 회귀(`system-status.e2e-spec.ts`) 재현 — FE 가 습관적으로 붙이는
 * `X-Workspace-Id` 헤더가 이런 라우트까지 막지 않아야 한다.
 */
class GlobalRouteTarget {
  globalRoute() {}
}

/** 순수 함수 핸들러 — `@Roles()`·`@WorkspaceId()` 어느 쪽 데코레이터도 없음(레거시 별칭). */
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
    it('비멤버가 헤더로 타 워크스페이스를 지정 + @Roles() 없음(@WorkspaceId() 사용) → 거부', async () => {
      const { guard, getMemberRole } = buildGuard(null); // 비멤버
      const ctx = makeContext({
        userId: 'attacker',
        headerWorkspaceId: 'victim-ws',
        tokenWorkspaceId: 'own-ws',
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      // 멤버십을 **실제로 조회했는지** 단언한다 — 우연히 false 가 된 것이 아님을 고정.
      expect(getMemberRole).toHaveBeenCalledWith('victim-ws', 'attacker');
    });

    it('멤버가 헤더로 전환 + @Roles() 없음(@WorkspaceId() 사용) → 통과', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'other-ws',
        tokenWorkspaceId: 'own-ws',
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
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
    it('헤더 부재 + @Roles() 없음(@WorkspaceId() 사용) → 통과, getMemberRole 미호출', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        tokenWorkspaceId: 'own-ws',
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
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
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
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

    it('워크스페이스 컨텍스트 없음 + @Roles() 없음(@WorkspaceId() 사용) → 통과', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({
        userId: 'u1',
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
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
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      expect(getMemberRole).toHaveBeenCalledWith('victim-ws', 'attacker');
    });
  });

  /**
   * `handlerConsumesWorkspaceId` 회귀 가드 — 2026-08-08 e2e 회귀
   * (`system-status.e2e-spec.ts`, `review/code/2026/08/08/20_53_48`) 재현.
   *
   * `@Roles()` 도 `@WorkspaceId()` 도 안 쓰는 라우트는 워크스페이스와 무관한 전역 API다.
   * FE `apiClient` 가 모든 요청에 습관적으로 `X-Workspace-Id` 헤더를 붙이므로
   * (`lib/api/client.ts`), 이 예외가 없으면 그 헤더가 토큰 클레임과 다를 때마다
   * 워크스페이스와 무관한 엔드포인트까지 불필요하게 멤버십 재검증·403 을 받는다.
   */
  describe('@Roles() 도 @WorkspaceId() 도 안 쓰는 라우트는 헤더와 무관하게 통과', () => {
    it('비멤버 워크스페이스로 헤더가 위조돼도(전역 API) 통과 — getMemberRole 미호출', async () => {
      const { guard, getMemberRole } = buildGuard(null); // 비멤버
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: '00000000-0000-0000-0000-000000000000',
        tokenWorkspaceId: 'own-ws',
        handler: GlobalRouteTarget.prototype.globalRoute,
        controllerClass: GlobalRouteTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      // 검증 대상 자체가 아니므로 DB 왕복이 없어야 한다 — "무조건 조회" 로 회귀하면 RED.
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    it('헤더 없이 토큰의 활성 워크스페이스만 있어도 통과 — getMemberRole 미호출', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({
        userId: 'u1',
        tokenWorkspaceId: 'own-ws',
        handler: GlobalRouteTarget.prototype.globalRoute,
        controllerClass: GlobalRouteTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    it('undecorated(순수 함수) 핸들러도 동일하게 통과 — 레거시 별칭 경로 확인', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'victim-ws',
        tokenWorkspaceId: 'own-ws',
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
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
