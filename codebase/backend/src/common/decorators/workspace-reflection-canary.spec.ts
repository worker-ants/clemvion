import { INestApplication } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { WorkspaceId, WorkspaceParam } from './workspace.decorator';
import {
  assertWorkspaceIdReflectionWorks,
  countWorkspaceConsumingRoutes,
  WorkspaceIdReflectionBrokenError,
} from './workspace-reflection-canary';

/** `@WorkspaceId()` 를 실제로 쓰는 라우트 두 개 + 안 쓰는 라우트 하나. */
class WorkspaceScopedController {
  list(@WorkspaceId() _workspaceId: string) {}
  create(@WorkspaceId() _workspaceId: string, _body?: unknown) {}
  ping() {}
}

/** 경로로 워크스페이스를 받는 라우트 하나 + 헤더 컨텍스트도 함께 받는 라우트 하나. */
class PathScopedController {
  update(@WorkspaceParam('id') _id: string) {}
  both(@WorkspaceId() _ctx: string, @WorkspaceParam('id') _id: string) {}
}

/** 워크스페이스와 무관한 전역 API (예: `system-status`). */
class GlobalController {
  overview() {}
}

const methodNamesOf = (prototype: object) =>
  Object.getOwnPropertyNames(prototype).filter((n) => n !== 'constructor');

describe('countWorkspaceConsumingRoutes', () => {
  it('@WorkspaceId() 소비와 @WorkspaceParam() 소비를 따로 세고, 둘 다 쓰는 라우트는 합계에 한 번 넣는다', () => {
    expect(
      countWorkspaceConsumingRoutes(
        [WorkspaceScopedController, PathScopedController, GlobalController],
        methodNamesOf,
      ),
    ).toEqual({ requestContext: 3, pathParam: 2, total: 4 });
  });

  it('소비 라우트가 없으면 전부 0', () => {
    expect(
      countWorkspaceConsumingRoutes([GlobalController], methodNamesOf),
    ).toEqual({ requestContext: 0, pathParam: 0, total: 0 });
  });

  it('클래스가 아닌 값·프로토타입 없는 값은 건너뛴다 (throw 하지 않는다)', () => {
    // 부트 단계에서 컨트롤러 목록에 예기치 않은 값이 섞여도 캐너리 자체가 죽으면
    // 진단 불가한 부팅 실패가 된다 — 세기는 계속하고 판정은 개수로만 한다.
    expect(
      countWorkspaceConsumingRoutes(
        [undefined, null, 42, 'nope', () => {}, WorkspaceScopedController],
        methodNamesOf,
      ).total,
    ).toBe(2);
  });
});

describe('assertWorkspaceIdReflectionWorks', () => {
  function appWith(controllerClasses: unknown[]): INestApplication {
    const discovery = {
      getControllers: () => controllerClasses.map((metatype) => ({ metatype })),
    };
    const scanner = { getAllMethodNames: methodNamesOf };
    return {
      get: (token: unknown) => {
        if (token === DiscoveryService) return discovery;
        if (token === MetadataScanner) return scanner;
        throw new Error('unexpected token');
      },
    } as unknown as INestApplication;
  }

  it('소비 라우트를 인식하면 합계를 돌려주고 두 개수를 따로 남긴다', () => {
    const logged: string[] = [];
    const count = assertWorkspaceIdReflectionWorks(
      appWith([
        WorkspaceScopedController,
        PathScopedController,
        GlobalController,
      ]),
      { log: (m: string) => logged.push(m) },
    );
    expect(count).toBe(4);
    // 앞 절반은 spec 이 인용하는 문구다(`1-auth.md` §부트 캐너리 — «현재 인식 개수의 SoT 는 부팅 로그»).
    expect(logged.join('\n')).toContain('@WorkspaceId() 소비 라우트 3건 인식');
    expect(logged.join('\n')).toContain(
      '@WorkspaceParam() 소비 라우트 2건 인식',
    );
  });

  it('경로 소비 라우트만 있어도 인식한 것이다 — throw 하지 않는다', () => {
    expect(
      assertWorkspaceIdReflectionWorks(appWith([PathScopedController]), {
        log: () => {},
      }),
    ).toBe(2);
  });

  /**
   * 이 테스트가 캐너리의 존재 이유다. reflection 이 깨지면 개수가 0 이 되고, 그때
   * **부팅이 멈춰야** 한다 — 통과시키면 `RolesGuard` 가 워크스페이스 라우트를 전역 API 로
   * 오판해 멤버십 검증을 건너뛴다(cross-tenant 재발).
   */
  it('하나도 인식하지 못하면 throw 해 부팅을 멈춘다 (fail-closed)', () => {
    expect(() =>
      assertWorkspaceIdReflectionWorks(appWith([GlobalController])),
    ).toThrow(WorkspaceIdReflectionBrokenError);
  });

  it('컨트롤러가 아예 없어도 throw 한다 — 빈 목록을 정상으로 보면 안 된다', () => {
    // discovery 가 어떤 이유로 빈 목록을 돌려주는 상황(모듈 스캔 실패 등)도
    // "검증 대상 0건" 이지 정상이 아니다.
    expect(() => assertWorkspaceIdReflectionWorks(appWith([]))).toThrow(
      WorkspaceIdReflectionBrokenError,
    );
  });

  it('throw 메시지가 원인 후보와 진입점을 담는다', () => {
    // 이 예외는 부팅 로그에 한 줄로 남는 유일한 단서다 — 운영자가 그 줄만 보고
    // 어디서부터 볼지 알 수 있어야 한다.
    try {
      assertWorkspaceIdReflectionWorks(appWith([]));
      fail('should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('handlerConsumesWorkspaceId');
      expect(message).toContain('workspaceParamNamesOf');
      expect(message).toContain('cross-tenant');
    }
  });
});
