import { INestApplication, Logger } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { handlerConsumesWorkspaceId } from './workspace.decorator';

/**
 * `handlerConsumesWorkspaceId` 가 **아직 동작하는지** 부팅 시 1회 확인한다.
 *
 * ## 왜 필요한가 — 실패 방향이 fail-open 이다
 *
 * 그 함수는 `@nestjs/common` 의 비공개 export `ROUTE_ARGS_METADATA` 와 **함수 identity
 * 비교**에 의존한다. 이 가정은 세 가지로 깨질 수 있다:
 *
 * - Nest 내부 메타데이터 저장 포맷 변경 (`@nestjs/*` 는 caret 이라 minor/patch 로도 온다)
 * - 핸들러를 감싸는 데코레이터 도입으로 `Function.name` 소실
 * - 빌드 단계의 minify/mangle
 *
 * 깨지면 `handlerConsumesWorkspaceId` 가 **모든 라우트에 대해 false** 를 돌려주고,
 * `RolesGuard` 는 `@Roles()` 없는 라우트를 "워크스페이스와 무관한 전역 API" 로 판정해
 * 멤버십 검증을 **조용히 건너뛴다** — `#1103` 이 통째로 닫은 cross-tenant 결함 클래스가
 * 그대로 되살아난다. 런타임에 조용히 새는 것보다 **배포가 멈추는 편이 낫다.**
 *
 * ## 무엇을 단언하나 — 라우트 목록이 아니라 "0건이 아님"
 *
 * 특정 라우트 목록을 하드코딩하면 그 라우트가 정당하게 사라질 때 오탐으로 깨지고,
 * 결국 목록을 지우는 압력이 된다. 대신 **등록된 전 컨트롤러를 훑어 소비 라우트 수를 세고
 * 0 이면 throw** 한다. 이 저장소에는 그런 라우트가 다수 있으므로(2026-08-09 실측 **142건**
 * — 캐너리 자신이 부팅 로그에 남긴 값이다) 0 은 "reflection 이 통째로 깨졌다" 는 뜻이다.
 *
 * > **다른 곳의 "73건" 과 혼동하지 말 것 — 그쪽이 이 수의 부분집합이다.**
 * > `roles.guard.ts` 와 `spec/data-flow/12-workspace.md` 의 73건은 HTTP 라우트 222건 중
 * > `@WorkspaceId()` 를 소비하면서 **`@Roles()` 가 없는** 서브셋으로, `#1103` 이 닫은
 * > cross-tenant 결함 클래스의 크기다. 캐너리가 세는 것은 `@Roles()` 유무와 **무관한**
 * > `@WorkspaceId()` 소비 라우트 전체라 그 상위집합이다. 종전 이 주석은 상위집합 자리에
 * > 서브셋 수치를 적어 두 수를 뭉갰다(`#1108` 2차 impl-done INFO 2).
 *
 * 부분 파손(일부 라우트만 인식 실패)은 이 단언이 못 잡는다 — 대신 개수를 로그로 남겨
 * 급락이 눈에 띄게 한다. 알려진 한계라 숨기지 않고 적어 둔다.
 *
 * ## `SetMetadata` + `Reflector` 로 옮기지 않은 이유
 *
 * 그쪽이 공식 확장점이지만, `@WorkspaceId()` 사용처마다 별도 마커를 달아야 한다 —
 * `spec/data-flow/12-workspace.md` §Rationale 이 **명시적으로 기각한** "라우트별 opt-in
 * 마커" 패턴이고, 이 저장소는 그 누락을 이미 두 번 겪었다. 캐너리는 호출부에 아무것도
 * 요구하지 않으면서 같은 위험을 닫는다 (2026-08-09 `--impl-prep` rationale_continuity
 * WARNING #2).
 *
 * `assertProductionConfig` 에 합치지 않고 별도 부트 단계로 둔 것도 의도다 — 저쪽은
 * "production 환경변수" 축이고 이쪽은 환경과 무관한 구조 불변식이다 (동 세션 INFO #2).
 */

/** 부팅을 멈추는 사유. 메시지가 곧 운영자에게 남는 유일한 단서라 원인·영향을 함께 적는다. */
export class WorkspaceIdReflectionBrokenError extends Error {
  constructor() {
    super(
      '[SECURITY] `@WorkspaceId()` 소비 라우트를 하나도 인식하지 못했습니다. ' +
        'RolesGuard 는 이 판별에 기대어 멤버십 검증 대상을 좁히므로, 이 상태로 기동하면 ' +
        '`@Roles()` 없는 워크스페이스 라우트가 멤버십 검증을 건너뜁니다(cross-tenant). ' +
        '원인 후보: @nestjs/* 업그레이드로 ROUTE_ARGS_METADATA 포맷 변경 · 핸들러를 감싸는 ' +
        '데코레이터 도입으로 Function.name 소실 · 빌드 minify. ' +
        'common/decorators/workspace.decorator.ts 의 handlerConsumesWorkspaceId 를 먼저 보세요.',
    );
    this.name = 'WorkspaceIdReflectionBrokenError';
  }
}

/**
 * 주어진 컨트롤러 클래스들에서 `@WorkspaceId()` 를 소비하는 라우트 수를 센다.
 *
 * **판별은 `handlerConsumesWorkspaceId` 를 그대로 호출**한다 — 여기서 reflection 을
 * 다시 구현하면 캐너리가 진짜 소비자가 아니라 자기 복제본을 검사하게 되어, 정작 막으려던
 * 파손을 통과시킨다.
 */
export function countWorkspaceIdConsumingRoutes(
  controllerClasses: unknown[],
  methodNamesOf: (prototype: object) => string[],
): number {
  let count = 0;
  for (const cls of controllerClasses) {
    if (typeof cls !== 'function') continue;
    const prototype: unknown = (cls as { prototype?: unknown }).prototype;
    if (!prototype || typeof prototype !== 'object') continue;
    for (const methodName of methodNamesOf(prototype)) {
      const handler: unknown = (prototype as Record<string, unknown>)[
        methodName
      ];
      if (typeof handler !== 'function') continue;
      if (handlerConsumesWorkspaceId(cls as object, handler)) count++;
    }
  }
  return count;
}

/**
 * 부트 단계. 인식된 라우트가 0 이면 throw 해 기동을 멈춘다(fail-closed).
 *
 * @returns 인식된 소비 라우트 수 (호출부가 로그·관측에 쓴다)
 */
export function assertWorkspaceIdReflectionWorks(
  app: INestApplication,
  logger: Pick<Logger, 'log'> = new Logger('WorkspaceIdReflection'),
): number {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  // `metatype` 은 `Function | Type<any> | null` 이다. 아래 카운터가 값 하나하나를 다시
  // 검사하므로 여기서는 null 만 떨궈 목록을 넘긴다 — 타입 술어로 좁히려 하면
  // `object` 가 `Function` 에 배정 불가라 tsc 가 거부한다(빌드에서만 드러남).
  const controllerClasses: unknown[] = discovery
    .getControllers()
    .map((wrapper) => wrapper.metatype);

  const count = countWorkspaceIdConsumingRoutes(
    controllerClasses,
    (prototype) => scanner.getAllMethodNames(prototype),
  );

  if (count === 0) throw new WorkspaceIdReflectionBrokenError();

  // 부분 파손은 위 단언이 못 잡는다 — 개수를 남겨 급락이 눈에 띄게 한다.
  logger.log(
    `@WorkspaceId() 소비 라우트 ${count}건 인식 — RolesGuard 멤버십 검증 대상 판별 정상.`,
  );
  return count;
}
