import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles, RolesGuard, ROLES_KEY } from './roles.guard';
import { WorkspaceId, WorkspaceParam } from '../decorators/workspace.decorator';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';
import {
  DECOY_WS,
  HEADER_WS,
  NIL_WS,
  OTHER_WS,
  SAME_WS,
  TOKEN_WS,
  VICTIM_WS,
} from '../__test-utils__/workspace-id-fixtures';

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
  /** 라우트 경로 파라미터(`request.params`) — 가드는 파이프보다 먼저 돌아 **원문**을 본다. */
  params?: Record<string, string>;
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
        params: opts.params ?? {},
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

class MultiRoleTarget {
  /** 여러 역할이면 가장 낮은 역할이 요구다 — 선언 순서와 무관. */
  @Roles('owner', 'editor')
  ownerOrEditor() {}

  /** `viewer` 는 멤버십과 같다. */
  @Roles('viewer')
  viewerOnly() {}
}

/**
 * 워크스페이스를 **경로**로 받는 라우트 — `workspaces.controller.ts` 14곳 · 전환 1곳의 모양.
 * 가드는 `@WorkspaceParam` 의 등록 이름으로 `request.params` 를 읽는다.
 */
class PathTarget {
  memberPath(@WorkspaceParam('id') _id: string) {
    return _id;
  }

  @Roles('admin')
  adminPath(@WorkspaceParam('id') _id: string) {
    return _id;
  }

  @Roles('owner')
  ownerPath(@WorkspaceParam('id') _id: string) {
    return _id;
  }

  otherName(@WorkspaceParam('workspace') _ws: string) {
    return _ws;
  }

  /** `@Roles()` 는 경로 워크스페이스 **각각**에 대해 판정한다 — 둘 모두에서 충족해야 통과. */
  @Roles('admin')
  twoPathsAdmin(
    @WorkspaceParam('a') _a: string,
    @WorkspaceParam('b') _b: string,
  ) {
    return _a + _b;
  }

  twoPaths(@WorkspaceParam('a') _a: string, @WorkspaceParam('b') _b: string) {
    return _a + _b;
  }

  @Roles('admin')
  adminPathAndHeader(
    @WorkspaceId() _ctx: string,
    @WorkspaceParam('id') _id: string,
  ) {
    return _id;
  }
}

/** 가드 거부의 본문 — 메시지는 서비스 계층(`workspaces.service.ts`)과 같은 한국어다. */
const GUARD_FORBIDDEN = {
  NOT_A_MEMBER: '워크스페이스 멤버가 아닙니다.',
  EDITOR_REQUIRED: 'Editor 이상의 권한이 필요합니다.',
  ADMIN_REQUIRED: 'Admin 이상의 권한이 필요합니다.',
  OWNER_REQUIRED: 'Owner 권한이 필요합니다.',
} as const;
type GuardForbiddenCode = keyof typeof GUARD_FORBIDDEN;

/**
 * 거부를 **한 번의 호출**로 캡처해 타입과 본문을 함께 단언한다 — 아래 `expectValidationError` 와
 * 같은 이유다(두 번 부르면 첫 단언이 실패했을 때 둘째가 조용히 건너뛰어진다).
 *
 * 종전 가드는 거부를 `false` 로 돌려줘 전역 필터가 기본값 `FORBIDDEN` 을 채웠다. 이제 코드를 싣고
 * 던진다 — `resolves.toBe(false)` 로 남은 단언은 코드 없는 두 자리(미인증 · 컨텍스트 부재)뿐이다.
 */
async function expectForbidden(
  pending: Promise<boolean>,
  code: GuardForbiddenCode,
): Promise<void> {
  const outcome = await pending.then(
    (value) => ({ rejected: false as const, value }),
    (err: unknown) => ({ rejected: true as const, err }),
  );
  expect(outcome).toMatchObject({ rejected: true });
  const { err } = outcome as { err: unknown };
  expect(err).toBeInstanceOf(ForbiddenException);
  expect((err as ForbiddenException).getResponse()).toEqual({
    code,
    message: GUARD_FORBIDDEN[code],
  });
}

describe('RolesGuard', () => {
  const reflector = new Reflector();

  /**
   * `memberRole` 이 객체면 워크스페이스별 역할이다(없는 키는 비멤버) — 가드가 **어느 워크스페이스로**
   * 조회했는지가 결과를 가르게 해, 경로 값 대신 헤더 · 토큰 값을 조회하는 회귀를 관측 가능하게 만든다.
   */
  function buildGuard(
    memberRole: string | null | Record<string, string | null>,
  ) {
    const getMemberRole = jest.fn((workspaceId: string) =>
      Promise.resolve(
        memberRole !== null && typeof memberRole === 'object'
          ? (memberRole[workspaceId] ?? null)
          : memberRole,
      ),
    );
    const workspaces = { getMemberRole } as unknown as WorkspacesService;
    return { guard: new RolesGuard(reflector, workspaces), getMemberRole };
  }

  /** 헤더 · 토큰 컨텍스트 라우트의 역할 계층. 거부 코드는 **라우트가 요구하는 최소 역할**의 것이다. */
  async function expectRoleOutcome(
    handler: (...args: unknown[]) => unknown,
    role: string,
    rejection: GuardForbiddenCode | null,
  ) {
    const { guard } = buildGuard(role);
    const pending = guard.canActivate(
      makeContext({
        userId: 'u1',
        headerWorkspaceId: SAME_WS,
        tokenWorkspaceId: SAME_WS,
        handler,
      }),
    );
    if (rejection === null) await expect(pending).resolves.toBe(true);
    else await expectForbidden(pending, rejection);
  }

  describe('역할 계층 — @Roles("editor") 라우트', () => {
    it.each([
      ['owner', null],
      ['admin', null],
      ['editor', null],
      ['viewer', 'EDITOR_REQUIRED'],
    ] as const)('memberRole=%s → 거부 코드 %s', async (role, rejection) => {
      await expectRoleOutcome(
        RolesTarget.prototype.editorOnly,
        role,
        rejection,
      );
    });
  });

  describe('역할 계층 — @Roles("admin") 라우트', () => {
    it.each([
      ['owner', null],
      ['admin', null],
      ['editor', 'ADMIN_REQUIRED'],
      ['viewer', 'ADMIN_REQUIRED'],
    ] as const)('memberRole=%s → 거부 코드 %s', async (role, rejection) => {
      await expectRoleOutcome(RolesTarget.prototype.adminOnly, role, rejection);
    });
  });

  describe('역할이 여럿이면 가장 낮은 역할이 요구다 — @Roles("owner", "editor")', () => {
    it.each([
      ['owner', null],
      ['admin', null],
      ['editor', null],
      // 선언 순서의 첫 역할(owner)이 아니라 가장 낮은 역할(editor)의 코드다.
      ['viewer', 'EDITOR_REQUIRED'],
    ] as const)('memberRole=%s → 거부 코드 %s', async (role, rejection) => {
      await expectRoleOutcome(
        MultiRoleTarget.prototype.ownerOrEditor,
        role,
        rejection,
      );
    });
  });

  it('@Roles("viewer") 는 멤버십과 같다 — viewer 멤버는 통과', async () => {
    await expectRoleOutcome(
      MultiRoleTarget.prototype.viewerOnly,
      'viewer',
      null,
    );
  });

  /**
   * 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 다 — 비멤버에게 «editor 권한이 필요하다» 는
   * 틀린 진술이다(`spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" 규칙 (나)).
   */
  it.each([
    ['editor', RolesTarget.prototype.editorOnly],
    ['admin', RolesTarget.prototype.adminOnly],
    ['viewer', MultiRoleTarget.prototype.viewerOnly],
  ] as const)(
    '비멤버는 @Roles("%s") 라우트에서도 NOT_A_MEMBER',
    async (_label, handler) => {
      const { guard } = buildGuard(null);
      await expectForbidden(
        guard.canActivate(
          makeContext({ userId: 'u1', tokenWorkspaceId: TOKEN_WS, handler }),
        ),
        'NOT_A_MEMBER',
      );
    },
  );

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
        headerWorkspaceId: VICTIM_WS,
        tokenWorkspaceId: TOKEN_WS,
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
      await expectForbidden(guard.canActivate(ctx), 'NOT_A_MEMBER');
      // 멤버십을 **실제로 조회했는지** 단언한다 — 우연히 거부된 것이 아님을 고정.
      expect(getMemberRole).toHaveBeenCalledWith(VICTIM_WS, 'attacker');
    });

    it('멤버가 헤더로 전환 + @Roles() 없음(@WorkspaceId() 사용) → 통과', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: OTHER_WS,
        tokenWorkspaceId: TOKEN_WS,
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
    });

    it('비멤버 + @Roles("editor") → NOT_A_MEMBER (EDITOR_REQUIRED 가 아니다)', async () => {
      const { guard } = buildGuard(null);
      const ctx = makeContext({
        userId: 'attacker',
        headerWorkspaceId: VICTIM_WS,
        tokenWorkspaceId: TOKEN_WS,
        handler: RolesTarget.prototype.editorOnly,
      });
      await expectForbidden(guard.canActivate(ctx), 'NOT_A_MEMBER');
    });
  });

  describe('헤더가 없으면 재검증하지 않는다 (jwt.strategy 가 이미 검증)', () => {
    it('헤더 부재 + @Roles() 없음(@WorkspaceId() 사용) → 통과, getMemberRole 미호출', async () => {
      const { guard, getMemberRole } = buildGuard('viewer');
      const ctx = makeContext({
        userId: 'u1',
        tokenWorkspaceId: TOKEN_WS,
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
        headerWorkspaceId: SAME_WS,
        tokenWorkspaceId: SAME_WS,
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
        tokenWorkspaceId: TOKEN_WS,
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).toHaveBeenCalledWith(TOKEN_WS, 'u1');
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
        headerWorkspaceId: VICTIM_WS,
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    // 아래 두 거부는 **코드가 없다**(`false` → 필터 기본값 FORBIDDEN). 도달 경로가 없어 코드 부여
    // 결정의 범위 밖이다 — `JwtAuthGuard` 가 먼저 401 을 내고, 토큰은 가입 직후에도 personal
    // 워크스페이스를 갖는다(`12-workspace.md` §Rationale "가드 거부의 오류 코드" 마지막 문단).
    it('미인증 + @Roles() → 거부 (코드 없음)', async () => {
      const { guard } = buildGuard('owner');
      const ctx = makeContext({
        headerWorkspaceId: HEADER_WS,
        handler: RolesTarget.prototype.editorOnly,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });

    it('미인증 + 경로 워크스페이스 + @Roles() → 거부 (코드 없음) · 조회 없음', async () => {
      const { guard, getMemberRole } = buildGuard('owner');
      const ctx = makeContext({
        params: { id: SAME_WS },
        handler: PathTarget.prototype.adminPath,
        controllerClass: PathTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      expect(getMemberRole).not.toHaveBeenCalled();
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

    it('워크스페이스 컨텍스트 없음 + @Roles() → 거부 (코드 없음)', async () => {
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
        headerWorkspaceId: [VICTIM_WS, DECOY_WS],
        tokenWorkspaceId: TOKEN_WS,
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
      await expectForbidden(guard.canActivate(ctx), 'NOT_A_MEMBER');
      expect(getMemberRole).toHaveBeenCalledWith(VICTIM_WS, 'attacker');
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
        headerWorkspaceId: NIL_WS,
        tokenWorkspaceId: TOKEN_WS,
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
        tokenWorkspaceId: TOKEN_WS,
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
        headerWorkspaceId: VICTIM_WS,
        tokenWorkspaceId: TOKEN_WS,
        handler: undecorated,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
    });

    /**
     * 위 케이스들만으로는 **early-return 이 검증을 건너뛴 것**과 **검증이 돌았는데 통과한
     * 것**을 구별하지 못한다 — 쓰인 헤더값이 전부 형식상 유효해서 어느 쪽이든 결과가
     * 같기 때문이다(ai-review 2차 WARNING #6, vacuous). 형식 자체가 깨진 값을 쓰면 두
     * 갈래가 갈린다: 검증이 돌았다면 400 이 나고, 건너뛰었다면 조용히 통과한다.
     *
     * 즉 이 테스트가 GREEN 이라는 것은 `handlerConsumesWorkspaceId` 단축이 **헤더를
     * 읽기 전에** 걸렸다는 관측 가능한 증거다. 단축을 뒤로 옮기는 리팩터가 있으면 RED.
     */
    it('형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다 — 단축이 헤더 파싱보다 먼저다', async () => {
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'not-a-uuid',
        tokenWorkspaceId: TOKEN_WS,
        handler: GlobalRouteTarget.prototype.globalRoute,
        controllerClass: GlobalRouteTarget,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getMemberRole).not.toHaveBeenCalled();
    });
  });

  /**
   * `resolveRequestWorkspaceContext` 가 던지는 400 을 **프로덕션에서 가장 먼저 통과하는
   * 지점이 이 가드**다(전역 `APP_GUARD` 라 파라미터 데코레이터보다 앞선다). util·데코레이터
   * 스위트가 각각 그 계약을 고정하고 있어도, 가드가 그 예외를 삼키거나 `false`(403)로
   * 바꿔버리면 클라이언트가 받는 응답이 달라진다 (ai-review 2차 WARNING #5).
   */
  describe('형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다', () => {
    // 캡처-재던지기 **1회 호출**. 이웃 두 스펙이 같은 이유로 이 형태를 쓴다 —
    // `rejects.toThrow` 용 1회 + `getResponse()` 용 1회로 나누면 첫 단언이 실패했을 때
    // 두 번째가 조용히 건너뛰어져 code 단언이 vacuous 해진다 (ai-review 3차 WARNING #1:
    // 같은 커밋이 다른 파일에서 기각한 패턴을 여기서만 되살렸다는 자기모순 지적).
    async function expectValidationError(ctx: ExecutionContext) {
      const { guard } = buildGuard('owner');
      let caught: unknown;
      await expect(
        (async () => {
          try {
            return await guard.canActivate(ctx);
          } catch (err) {
            caught = err;
            throw err;
          }
        })(),
      ).rejects.toThrow(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      );
    }

    it('@WorkspaceId() 라우트 (@Roles() 없음)', async () => {
      await expectValidationError(
        makeContext({
          userId: 'u1',
          headerWorkspaceId: 'not-a-uuid',
          tokenWorkspaceId: TOKEN_WS,
          handler: WorkspaceScopedTarget.prototype.workspaceScoped,
          controllerClass: WorkspaceScopedTarget,
        }),
      );
    });

    it('@Roles() 라우트 — 선재 결함이던 경로다(개정 전 가드도 여기서 500 이었다)', async () => {
      await expectValidationError(
        makeContext({
          userId: 'u1',
          headerWorkspaceId: 'not-a-uuid',
          tokenWorkspaceId: TOKEN_WS,
          handler: RolesTarget.prototype.editorOnly,
        }),
      );
    });

    it('403(비멤버)이 아니라 400 이다 — 두 실패를 뭉개면 클라이언트가 구분할 수 없다', async () => {
      // `canActivate` 가 `false` 를 돌려주면 Nest 가 403 을 낸다. 형식 오류를 그렇게
      // 처리하면 "멤버가 아니다" 와 "요청이 잘못됐다" 가 같은 응답이 된다.
      const { guard, getMemberRole } = buildGuard(null);
      const ctx = makeContext({
        userId: 'u1',
        headerWorkspaceId: 'not-a-uuid',
        tokenWorkspaceId: TOKEN_WS,
        handler: WorkspaceScopedTarget.prototype.workspaceScoped,
        controllerClass: WorkspaceScopedTarget,
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
      // DB 까지 가지 않고 끊겼는지 — 이것이 22P02(500 마스킹)를 막는 지점이다.
      expect(getMemberRole).not.toHaveBeenCalled();
    });
  });

  /**
   * 경로로 워크스페이스를 받는 라우트(`@WorkspaceParam`) — 2026-09-25 전에는 가드가 이 값을 보지 않아
   * 서비스 계층 검사에만 기댔고, `@Roles('owner')` 가 붙은 `transferOwnership` 조차 **헤더 · 토큰의
   * 워크스페이스**를 검사했다(`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도
   * 가드가 본다").
   */
  describe('경로 워크스페이스(@WorkspaceParam)가 인가 대상이다', () => {
    function pathContext(
      handler: (...args: unknown[]) => unknown,
      params: Record<string, string>,
      extra: { headerWorkspaceId?: string; tokenWorkspaceId?: string } = {},
    ) {
      return makeContext({
        userId: 'u1',
        params,
        handler,
        controllerClass: PathTarget,
        ...extra,
      });
    }

    it('헤더 · 토큰 워크스페이스의 owner 여도 경로 워크스페이스의 비멤버면 NOT_A_MEMBER', async () => {
      const { guard, getMemberRole } = buildGuard({ [SAME_WS]: 'owner' });
      await expectForbidden(
        guard.canActivate(
          pathContext(
            PathTarget.prototype.memberPath,
            { id: OTHER_WS },
            { headerWorkspaceId: SAME_WS, tokenWorkspaceId: SAME_WS },
          ),
        ),
        'NOT_A_MEMBER',
      );
      expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
      expect(getMemberRole).not.toHaveBeenCalledWith(SAME_WS, 'u1');
    });

    it('경로 값은 토큰이 검증한 적 없다 — @Roles() 없고 헤더도 없어도 멤버십을 조회한다', async () => {
      const { guard, getMemberRole } = buildGuard({ [OTHER_WS]: 'viewer' });
      await expect(
        guard.canActivate(
          pathContext(PathTarget.prototype.memberPath, { id: OTHER_WS }),
        ),
      ).resolves.toBe(true);
      expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
    });

    it('@Roles("owner") 는 경로 워크스페이스에 대해 판정한다 — 토큰 워크스페이스의 owner 는 통과 근거가 아니다', async () => {
      // transferOwnership 의 종전 결함 모양: 토큰 워크스페이스(SAME)의 owner 라 가드를 통과했다.
      const { guard } = buildGuard({ [SAME_WS]: 'owner', [OTHER_WS]: 'admin' });
      await expectForbidden(
        guard.canActivate(
          pathContext(
            PathTarget.prototype.ownerPath,
            { id: OTHER_WS },
            { tokenWorkspaceId: SAME_WS },
          ),
        ),
        'OWNER_REQUIRED',
      );
    });

    it.each([
      ['owner', null],
      ['admin', null],
      ['editor', 'ADMIN_REQUIRED'],
      ['viewer', 'ADMIN_REQUIRED'],
      [null, 'NOT_A_MEMBER'],
    ] as const)(
      '@Roles("admin") 경로 라우트 — 경로 워크스페이스 역할 %s → 거부 코드 %s',
      async (role, rejection) => {
        const { guard } = buildGuard({ [OTHER_WS]: role });
        const pending = guard.canActivate(
          pathContext(PathTarget.prototype.adminPath, { id: OTHER_WS }),
        );
        if (rejection === null) await expect(pending).resolves.toBe(true);
        else await expectForbidden(pending, rejection);
      },
    );

    it.each([
      ['owner', null],
      ['admin', 'OWNER_REQUIRED'],
      [null, 'NOT_A_MEMBER'],
    ] as const)(
      '@Roles("owner") 경로 라우트 — 경로 워크스페이스 역할 %s → 거부 코드 %s',
      async (role, rejection) => {
        const { guard } = buildGuard({ [OTHER_WS]: role });
        const pending = guard.canActivate(
          pathContext(PathTarget.prototype.ownerPath, { id: OTHER_WS }),
        );
        if (rejection === null) await expect(pending).resolves.toBe(true);
        else await expectForbidden(pending, rejection);
      },
    );

    it('등록된 이름의 경로 값을 본다 — 다른 이름의 경로 값이 아니다', async () => {
      const { guard, getMemberRole } = buildGuard({ [SAME_WS]: 'owner' });
      await expectForbidden(
        guard.canActivate(
          pathContext(PathTarget.prototype.otherName, {
            id: SAME_WS,
            workspace: OTHER_WS,
          }),
        ),
        'NOT_A_MEMBER',
      );
      expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
    });

    // 비멤버를 양쪽 자리에 한 번씩 둔다 — 한쪽 순서만 있으면 «첫째만» 또는 «마지막만» 보는 회귀
    // 중 하나가 살아남는다(`review/code/2026/09/25/16_39_25` testing WARNING).
    it.each([
      ['뒤', { a: SAME_WS, b: OTHER_WS }],
      ['앞', { a: OTHER_WS, b: SAME_WS }],
    ])(
      '경로 워크스페이스가 여럿이면 전부 본다 — 비멤버가 %s 자리여도 거부',
      async (_label, params: Record<string, string>) => {
        const { guard, getMemberRole } = buildGuard({ [SAME_WS]: 'owner' });
        await expectForbidden(
          guard.canActivate(pathContext(PathTarget.prototype.twoPaths, params)),
          'NOT_A_MEMBER',
        );
        expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
      },
    );

    it.each([
      ['둘 다 admin 이상', { [SAME_WS]: 'owner', [OTHER_WS]: 'admin' }, null],
      [
        '뒤(b)가 editor',
        { [SAME_WS]: 'owner', [OTHER_WS]: 'editor' },
        'ADMIN_REQUIRED',
      ],
      // 미달을 반대 자리에도 둔다 — 한 자리만 있으면 «첫째에만 역할 적용» 뮤턴트가 메타데이터 순서에 따라
      // 살아남는다(실측: 그 자리만 있을 때 SURVIVED).
      [
        '앞(a)이 editor',
        { [SAME_WS]: 'editor', [OTHER_WS]: 'owner' },
        'ADMIN_REQUIRED',
      ],
    ] as const)(
      '경로 워크스페이스가 여럿이면 @Roles() 요구를 각각에 적용한다 — %s',
      async (_label, roles, rejection) => {
        const { guard } = buildGuard(roles);
        const pending = guard.canActivate(
          pathContext(PathTarget.prototype.twoPathsAdmin, {
            a: SAME_WS,
            b: OTHER_WS,
          }),
        );
        if (rejection === null) await expect(pending).resolves.toBe(true);
        else await expectForbidden(pending, rejection);
      },
    );

    it('경로 워크스페이스가 여럿이고 전부 멤버면 각각 조회한 뒤 통과', async () => {
      const { guard, getMemberRole } = buildGuard({
        [SAME_WS]: 'owner',
        [OTHER_WS]: 'viewer',
      });
      await expect(
        guard.canActivate(
          pathContext(PathTarget.prototype.twoPaths, {
            a: SAME_WS,
            b: OTHER_WS,
          }),
        ),
      ).resolves.toBe(true);
      expect(getMemberRole).toHaveBeenCalledTimes(2);
      expect(getMemberRole).toHaveBeenCalledWith(SAME_WS, 'u1');
      expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
    });

    describe('헤더 컨텍스트까지 소비하는 핸들러(@WorkspaceId + @WorkspaceParam)', () => {
      it('헤더 워크스페이스의 멤버십도 검증한다 — 헤더 위조 비멤버면 NOT_A_MEMBER', async () => {
        const { guard } = buildGuard({ [OTHER_WS]: 'admin' });
        await expectForbidden(
          guard.canActivate(
            pathContext(
              PathTarget.prototype.adminPathAndHeader,
              { id: OTHER_WS },
              { headerWorkspaceId: VICTIM_WS, tokenWorkspaceId: TOKEN_WS },
            ),
          ),
          'NOT_A_MEMBER',
        );
      });

      it('@Roles() 요구는 경로 워크스페이스에 대한 것이다 — 헤더 워크스페이스는 멤버십만 본다', async () => {
        const { guard } = buildGuard({
          [OTHER_WS]: 'admin',
          [VICTIM_WS]: 'viewer',
        });
        await expect(
          guard.canActivate(
            pathContext(
              PathTarget.prototype.adminPathAndHeader,
              { id: OTHER_WS },
              { headerWorkspaceId: VICTIM_WS, tokenWorkspaceId: TOKEN_WS },
            ),
          ),
        ).resolves.toBe(true);
      });

      /**
       * 경로 값이 형식 불량이면 경로 판정(역할 포함)은 건너뛰고 헤더 멤버십만 본다 — 핸들러는
       * `@WorkspaceParam` 내장 `ParseUUIDPipe` 가 400 으로 끊으므로 돌지 않는다. 헤더 쪽 검사까지
       * 건너뛰면 헤더 위조가 그 400 보다 먼저 통과로 읽히는 순서가 생긴다.
       */
      it('경로 값이 형식 불량이면 역할 판정 없이 헤더 멤버십만 본다', async () => {
        const member = buildGuard({ [VICTIM_WS]: 'viewer' });
        await expect(
          member.guard.canActivate(
            pathContext(
              PathTarget.prototype.adminPathAndHeader,
              { id: 'not-a-uuid' },
              { headerWorkspaceId: VICTIM_WS, tokenWorkspaceId: TOKEN_WS },
            ),
          ),
        ).resolves.toBe(true);
        expect(member.getMemberRole).toHaveBeenCalledTimes(1);
        expect(member.getMemberRole).toHaveBeenCalledWith(VICTIM_WS, 'u1');

        const outsider = buildGuard(null);
        await expectForbidden(
          outsider.guard.canActivate(
            pathContext(
              PathTarget.prototype.adminPathAndHeader,
              { id: 'not-a-uuid' },
              { headerWorkspaceId: VICTIM_WS, tokenWorkspaceId: TOKEN_WS },
            ),
          ),
          'NOT_A_MEMBER',
        );
      });

      it('경로 워크스페이스의 역할이 미달이면 헤더 워크스페이스의 owner 여도 거부', async () => {
        const { guard } = buildGuard({
          [OTHER_WS]: 'editor',
          [VICTIM_WS]: 'owner',
        });
        await expectForbidden(
          guard.canActivate(
            pathContext(
              PathTarget.prototype.adminPathAndHeader,
              { id: OTHER_WS },
              { headerWorkspaceId: VICTIM_WS, tokenWorkspaceId: TOKEN_WS },
            ),
          ),
          'ADMIN_REQUIRED',
        );
      });
    });

    /**
     * Nest 는 가드 → 파이프 순이라 가드가 받는 경로 값은 검증 전 원문이다. 가드는 헤더와 같은
     * `isUuidShaped` 로 형식만 보고, 형식이 아니면 판정하지 않고 넘긴다 — `@WorkspaceParam` 에 내장된
     * `ParseUUIDPipe` 가 400 을 내고 핸들러는 돌지 않는다.
     */
    describe('가드는 파이프보다 먼저 돈다 — 형식만 본다', () => {
      it.each([
        ['형식이 아닌 값', { id: 'not-a-uuid' }],
        ['경로 값 부재', {}],
      ])(
        '%s → 판정 없이 넘긴다(@Roles("admin") 라우트여도) · 조회 없음',
        async (_label, params: Record<string, string>) => {
          const { guard, getMemberRole } = buildGuard(null);
          await expect(
            guard.canActivate(
              pathContext(PathTarget.prototype.adminPath, params),
            ),
          ).resolves.toBe(true);
          // 조회했다면 22P02 → 500 마스킹이다(`common/utils/uuid.ts`).
          expect(getMemberRole).not.toHaveBeenCalled();
        },
      );

      it('형식은 맞지만 RFC 밖인 nil UUID 는 조회해 403 이다 — 종전 ParseUUIDPipe 400 에서 바뀐 자리', async () => {
        const { guard, getMemberRole } = buildGuard(null);
        await expectForbidden(
          guard.canActivate(
            pathContext(PathTarget.prototype.memberPath, { id: NIL_WS }),
          ),
          'NOT_A_MEMBER',
        );
        expect(getMemberRole).toHaveBeenCalledWith(NIL_WS, 'u1');
      });

      it('형식이 깨진 X-Workspace-Id 헤더는 경로 라우트에서 400 을 내지 않는다 — 헤더를 쓰지 않는다', async () => {
        const { guard, getMemberRole } = buildGuard({ [OTHER_WS]: 'viewer' });
        await expect(
          guard.canActivate(
            pathContext(
              PathTarget.prototype.memberPath,
              { id: OTHER_WS },
              { headerWorkspaceId: 'not-a-uuid', tokenWorkspaceId: TOKEN_WS },
            ),
          ),
        ).resolves.toBe(true);
        expect(getMemberRole).toHaveBeenCalledTimes(1);
        expect(getMemberRole).toHaveBeenCalledWith(OTHER_WS, 'u1');
      });
    });
  });

  /**
   * 미등록 역할 문자열은 서열 0 이라 요구가 **사라지는** 방향(멤버면 통과)으로 샌다 — 그래서 `@Roles`
   * 의 인자는 역할 이름 유니온이다. jest 는 타입을 지우므로 이 단언은 런타임이 아니라 build 단계의
   * 타입체크 ratchet(`tsconfig.json` 이 spec 을 포함한다)이 본다: 시그니처가 `string[]` 로 넓어지면
   * 아래 `@ts-expect-error` 가 «쓰이지 않는 지시어» 오류가 되어 ratchet 이 늘어난다.
   */
  it('@Roles 는 등록된 역할 이름만 받는다 (타입 — build 의 타입체크 ratchet 이 본다)', () => {
    // @ts-expect-error — 미등록 역할 문자열은 컴파일 오류다
    const decorate = Roles('superadmin');
    expect(typeof decorate).toBe('function');
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
