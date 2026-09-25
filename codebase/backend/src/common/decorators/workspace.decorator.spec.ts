import { BadRequestException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import {
  WorkspaceId,
  WorkspaceParam,
  handlerConsumesWorkspaceId,
  workspaceParamNamesOf,
} from './workspace.decorator';
import {
  DECOY_WS,
  HEADER_WS,
  TOKEN_WS,
} from '../__test-utils__/workspace-id-fixtures';

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
      { 'x-workspace-id': HEADER_WS },
      { workspaceId: TOKEN_WS },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe(HEADER_WS);
  });

  it('should prefer header over JWT workspaceId (header-first, RolesGuard 와 동일)', () => {
    // 하위호환: X-Workspace-Id 헤더가 있으면 토큰 클레임(user.workspaceId)보다 우선한다.
    // RolesGuard 도 동일 header-first 규칙이라 두 곳의 워크스페이스 컨텍스트가 일관된다.
    const ctx = createMockContext(
      { 'x-workspace-id': HEADER_WS },
      { workspaceId: TOKEN_WS },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe(HEADER_WS);
  });

  it('should return workspace ID from JWT (token 활성 워크스페이스) when header is not present', () => {
    const ctx = createMockContext({}, { workspaceId: TOKEN_WS });

    const result = factory(undefined, ctx);
    expect(result).toBe(TOKEN_WS);
  });

  it('should throw VALIDATION_ERROR (400) when X-Workspace-Id is not UUID-shaped', () => {
    // `WORKSPACE_ID_REQUIRED`(부재)와 **다른 코드**다 — 여기서는 값이 있고 형식이 틀렸다.
    // 종전에는 이 값이 그대로 DB 로 흘러가 500 INTERNAL_ERROR 로 마스킹됐다.
    let caught: unknown;
    expect(() => {
      try {
        factory(
          undefined,
          createMockContext(
            { 'x-workspace-id': 'not-a-uuid' },
            { workspaceId: TOKEN_WS },
          ),
        );
      } catch (err) {
        caught = err;
        throw err;
      }
    }).toThrow(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
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
      { 'x-workspace-id': [HEADER_WS, DECOY_WS] } as unknown as Record<
        string,
        string
      >,
      { workspaceId: TOKEN_WS },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe(HEADER_WS);
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

/**
 * 경로로 워크스페이스를 받는 파라미터의 바인딩 — `RolesGuard` 가 이 팩토리를 identity 로 인식해
 * 등록 이름의 경로 값을 인가 대상으로 쓴다(`spec/data-flow/12-workspace.md` §Rationale
 * "경로 파라미터 워크스페이스도 가드가 본다").
 */
describe('WorkspaceParam decorator', () => {
  class PathController {
    byId(@WorkspaceParam('id') _id: string) {}
  }

  const entry = Object.values(
    Reflect.getMetadata(ROUTE_ARGS_METADATA, PathController, 'byId') as Record<
      string,
      {
        factory: (data: unknown, ctx: unknown) => unknown;
        data: unknown;
        pipes: unknown[];
      }
    >,
  )[0];

  function ctxWithParams(params: Record<string, string> | undefined) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ params, headers: {} }) }),
    };
  }

  it('등록 이름의 경로 값을 돌려준다', () => {
    expect(entry.data).toBe('id');
    expect(entry.factory('id', ctxWithParams({ id: HEADER_WS }))).toBe(
      HEADER_WS,
    );
  });

  it('등록 이름이 아닌 경로 값은 읽지 않는다', () => {
    expect(
      entry.factory('id', ctxWithParams({ workspaceId: HEADER_WS })),
    ).toBeUndefined();
  });

  it('경로 파라미터가 아예 없으면 undefined — 뒤의 ParseUUIDPipe 가 400 을 낸다', () => {
    expect(entry.factory('id', ctxWithParams(undefined))).toBeUndefined();
  });

  /**
   * 가드는 경로 값의 **형식만** 보고 형식이 아니면 판정 없이 넘긴다 — 그 뒤를 받는 것이 이 파이프다.
   * 호출부가 파이프를 따로 적게 두면 빠뜨린 자리에서 형식 파손 값이 서비스까지 흘러 22P02(500)가 된다.
   */
  it('ParseUUIDPipe 가 내장돼 있다 — 호출부가 파이프를 빠뜨릴 수 없다', () => {
    expect(entry.pipes).toHaveLength(1);
    expect(entry.pipes[0]).toBeInstanceOf(ParseUUIDPipe);
  });
});

describe('workspaceParamNamesOf', () => {
  class Routes {
    byId(@WorkspaceParam('id') _id: string) {}
    byOtherName(@WorkspaceParam('workspace') _ws: string) {}
    twoParams(
      @WorkspaceParam('a') _a: string,
      @WorkspaceParam('b') _b: string,
    ) {}
    headerAndPath(
      @WorkspaceId() _ctx: string,
      @WorkspaceParam('id') _id: string,
    ) {}
    headerOnly(@WorkspaceId() _ctx: string) {}
    plainParam(@Param('id') _id: string) {}
    nothing() {}
  }

  const namesOf = (handler: (...args: never[]) => unknown) =>
    workspaceParamNamesOf(Routes, handler).slice().sort();

  it('@WorkspaceParam 의 등록 이름을 돌려준다', () => {
    expect(namesOf(Routes.prototype.byId)).toEqual(['id']);
    expect(namesOf(Routes.prototype.byOtherName)).toEqual(['workspace']);
  });

  it('한 핸들러에 여럿이면 전부 돌려준다 — 가드가 하나만 보고 나머지를 흘리지 않게', () => {
    expect(namesOf(Routes.prototype.twoParams)).toEqual(['a', 'b']);
  });

  it('@WorkspaceId() 는 경로 소비가 아니다', () => {
    expect(namesOf(Routes.prototype.headerOnly)).toEqual([]);
    expect(namesOf(Routes.prototype.headerAndPath)).toEqual(['id']);
  });

  it('평범한 @Param 은 인식하지 않는다 — 그 자리는 저장소 가드 workspace-param-binding 이 막는다', () => {
    expect(namesOf(Routes.prototype.plainParam)).toEqual([]);
  });

  it('소비가 없거나 메타데이터가 없으면 빈 배열', () => {
    expect(namesOf(Routes.prototype.nothing)).toEqual([]);
    class Empty {
      noop() {}
    }
    expect(workspaceParamNamesOf(Empty, Empty.prototype.noop)).toEqual([]);
  });

  it('메서드명이 없는(익명) 핸들러는 빈 배열 — handlerConsumesWorkspaceId 와 같은 규칙', () => {
    function namedForNow(_ws: string) {
      return _ws;
    }
    Object.defineProperty(namedForNow, 'name', { value: '' });
    expect(workspaceParamNamesOf(Routes, namedForNow)).toEqual([]);
  });

  it('두 판별은 서로의 팩토리를 세지 않는다', () => {
    expect(handlerConsumesWorkspaceId(Routes, Routes.prototype.byId)).toBe(
      false,
    );
    expect(
      handlerConsumesWorkspaceId(Routes, Routes.prototype.headerAndPath),
    ).toBe(true);
  });
});
