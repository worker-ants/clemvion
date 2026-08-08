import { BadRequestException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { WorkspaceId, handlerConsumesWorkspaceId } from './workspace.decorator';

// NestJS param decorators store their factory in metadata and cannot be
// called directly in tests. We extract the factory via Reflect to unit-test it.
function getParamDecoratorFactory() {
  class TestController {
    test(@WorkspaceId() _workspaceId: string) {}
  }

  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'test',
  );

  const key = Object.keys(metadata)[0];

  return metadata[key].factory;
}

describe('WorkspaceId decorator', () => {
  const factory = getParamDecoratorFactory();

  function createMockContext(headers: Record<string, string>, user?: unknown) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers, user }),
      }),
    };
  }

  // 워크스페이스 컨텍스트 부재 시: 예외 타입 + canonical code 를 단일 factory
  // 호출로 함께 단언한다. (이중 호출 패턴은 첫 toThrow 가 실패하면 code 단언을
  // 건너뛰므로, error 를 캡처해 재던지는 방식으로 두 단언을 모두 보장한다.)
  function expectWorkspaceIdRequired(
    ctx: ReturnType<typeof createMockContext>,
  ) {
    let caught: unknown;
    expect(() => {
      try {
        factory(undefined, ctx);
      } catch (err) {
        caught = err;
        throw err;
      }
    }).toThrow(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' }),
    );
  }

  it('should return workspace ID from X-Workspace-Id header', () => {
    const ctx = createMockContext(
      { 'x-workspace-id': 'header-workspace-uuid' },
      { workspaceId: 'jwt-workspace-uuid' },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe('header-workspace-uuid');
  });

  it('should prefer header over JWT workspaceId (header-first, RolesGuard 와 동일)', () => {
    // 하위호환: X-Workspace-Id 헤더가 있으면 토큰 클레임(user.workspaceId)보다 우선한다.
    // RolesGuard 도 동일 header-first 규칙이라 두 곳의 워크스페이스 컨텍스트가 일관된다.
    const ctx = createMockContext(
      { 'x-workspace-id': 'header-id' },
      { workspaceId: 'jwt-id' },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe('header-id');
  });

  it('should return workspace ID from JWT (token 활성 워크스페이스) when header is not present', () => {
    const ctx = createMockContext({}, { workspaceId: 'jwt-workspace-uuid' });

    const result = factory(undefined, ctx);
    expect(result).toBe('jwt-workspace-uuid');
  });

  it('should throw WORKSPACE_ID_REQUIRED when no workspace ID is available', () => {
    expectWorkspaceIdRequired(createMockContext({}, {}));
  });

  it('should throw WORKSPACE_ID_REQUIRED when X-Workspace-Id header is an empty string (falsy)', () => {
    expectWorkspaceIdRequired(createMockContext({ 'x-workspace-id': '' }, {}));
  });

  it('should throw WORKSPACE_ID_REQUIRED when user is undefined', () => {
    expectWorkspaceIdRequired(createMockContext({}));
  });

  it('should throw WORKSPACE_ID_REQUIRED when user is null', () => {
    expectWorkspaceIdRequired(createMockContext({}, null));
  });

  it('should take the first value when X-Workspace-Id is duplicated (array) — resolveRequestWorkspaceContext 공유', () => {
    // RolesGuard 와 동일한 `resolveRequestWorkspaceContext` 헬퍼를 쓰므로 배열 헤더 정규화가
    // 두 곳에서 일치해야 한다 (2026-08-08 ai-review ARCHITECTURE WARNING).
    const ctx = createMockContext(
      { 'x-workspace-id': ['victim-ws', 'decoy-ws'] } as unknown as Record<
        string,
        string
      >,
      { workspaceId: 'own-ws' },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe('victim-ws');
  });
});

/**
 * `RolesGuard` 가 "이 핸들러가 `@WorkspaceId()` 를 실제로 쓰는가" 를 reflection 으로
 * 판별하는 데 쓰는 헬퍼. 2026-08-08 e2e 회귀(`system-status.e2e-spec.ts`) — `@Roles()` 도
 * `@WorkspaceId()` 도 안 쓰는 전역 API 에까지 헤더 검증이 새는 것을 막는 근거.
 */
describe('handlerConsumesWorkspaceId', () => {
  class WithWorkspaceId {
    scoped(@WorkspaceId() _workspaceId: string) {}
  }

  class WithoutWorkspaceId {
    global() {}
  }

  it('@WorkspaceId() 를 쓰는 핸들러는 true', () => {
    expect(
      handlerConsumesWorkspaceId(
        WithWorkspaceId,
        WithWorkspaceId.prototype.scoped,
      ),
    ).toBe(true);
  });

  it('@WorkspaceId() 를 안 쓰는 핸들러는 false', () => {
    expect(
      handlerConsumesWorkspaceId(
        WithoutWorkspaceId,
        WithoutWorkspaceId.prototype.global,
      ),
    ).toBe(false);
  });

  it('메서드명이 없는(익명) 핸들러는 false — fail-closed 아닌 "검증 대상 아님" 쪽으로', () => {
    function namedForNow(_ws: string) {
      return _ws;
    }
    Object.defineProperty(namedForNow, 'name', { value: '' });
    expect(handlerConsumesWorkspaceId(WithWorkspaceId, namedForNow)).toBe(
      false,
    );
  });

  it('클래스에 아예 등록된 라우트 메타데이터가 없으면 false', () => {
    class Empty {
      noop() {}
    }
    expect(handlerConsumesWorkspaceId(Empty, Empty.prototype.noop)).toBe(false);
  });
});
