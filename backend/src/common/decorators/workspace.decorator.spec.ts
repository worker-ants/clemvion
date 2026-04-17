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

  it('should return workspace ID from X-Workspace-Id header', () => {
    const ctx = createMockContext(
      { 'x-workspace-id': 'header-workspace-uuid' },
      { workspaceId: 'jwt-workspace-uuid' },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe('header-workspace-uuid');
  });

  it('should prefer header over JWT workspaceId', () => {
    const ctx = createMockContext(
      { 'x-workspace-id': 'header-id' },
      { workspaceId: 'jwt-id' },
    );

    const result = factory(undefined, ctx);
    expect(result).toBe('header-id');
  });

  it('should return workspace ID from JWT when header is not present', () => {
    const ctx = createMockContext({}, { workspaceId: 'jwt-workspace-uuid' });

    const result = factory(undefined, ctx);
    expect(result).toBe('jwt-workspace-uuid');
  });

  it('should throw BadRequestException when no workspace ID is available', () => {
    const ctx = createMockContext({}, {});

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when user is undefined', () => {
    const ctx = createMockContext({});

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when user is null', () => {
    const ctx = createMockContext({}, null);

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });
});
