import { BadRequestException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { WorkspaceId } from './workspace.decorator';

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

  it('should return workspace ID from X-Workspace-Id header when no token workspace (fallback)', () => {
    // 토큰 SoT 전환(결정1): 헤더는 request.user.workspaceId 부재 시에만 소비되는 fallback.
    const ctx = createMockContext({
      'x-workspace-id': 'header-workspace-uuid',
    });

    const result = factory(undefined, ctx);
    expect(result).toBe('header-workspace-uuid');
  });

  it('should prefer JWT (token SoT) over X-Workspace-Id header', () => {
    // 종전엔 헤더 우선이었으나 결정1(토큰 단일 진실)로 반전 — jwt.strategy 가 이미
    // activeWorkspaceId→헤더→legacy→personal 순으로 확정한 request.user.workspaceId 를 신뢰.
    const ctx = createMockContext(
      { 'x-workspace-id': 'header-id' },
      { workspaceId: 'jwt-id' },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe('jwt-id');
  });

  it('should return workspace ID from JWT when header is not present', () => {
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
});
