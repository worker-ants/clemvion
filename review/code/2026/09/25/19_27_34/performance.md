# 성능(Performance) 리뷰 — 경로 워크스페이스 가드 후속 (2026-09-25)

## 발견사항

- **[INFO]** `routeArgEntriesMatching` 공용화 이후에도 요청당 `Reflect.getMetadata` 가 두 번 호출된다
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:64-80` (`routeArgEntriesMatching`), 호출부는 `codebase/backend/src/common/guards/roles.guard.ts:152,155` (`handlerConsumesWorkspaceId` · `workspaceParamNamesOf`, 이 파일은 이번 diff 대상은 아니지만 새 헬퍼의 유일한 소비자)
  - 상세: 이번 diff 는 두 판별 함수가 각자 갖고 있던 `Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName)` 호출을 `routeArgEntriesMatching` 한 곳으로 합쳤지만, `RolesGuard.canActivate` 는 여전히 `handlerConsumesWorkspaceId` 와 `workspaceParamNamesOf` 를 **각각** 호출하므로 같은 `(controllerClass, methodName)` 키에 대해 동일한 메타데이터를 요청마다 두 번 조회한다. `ROUTE_ARGS_METADATA` 객체 자체가 핸들러당 파라미터 수(보통 1~6개) 만큼만 존재해 절대 비용은 미미하지만, 헬퍼를 공용화한 김에 한 번의 조회 결과를 두 판별에 재사용할 여지가 생겼다.
  - 제안: 급하지 않음. 필요 시 `routeArgEntriesMatching` 을 "메타데이터 1회 조회 → 두 팩토리로 각각 filter" 형태로 바꾸거나, 가드 쪽에서 한 번 조회한 `argsMetadata` 를 두 판별에 넘기도록 시그니처를 확장하면 중복 조회를 없앨 수 있다.

- **[INFO]** `handlerConsumesWorkspaceId` 가 `.some()`(첫 매치에서 단락) 대신 `.filter().length > 0`(전량 순회)으로 바뀜
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:103-106`
  - 상세: 리팩터 전 `handlerConsumesWorkspaceId` 는 `Object.values(argsMetadata).some((entry) => entry?.factory === extractWorkspaceId)` 로 첫 매치에서 즉시 반환했다. 공용 헬퍼 `routeArgEntriesMatching` 은 배열 전체를 `filter` 로 순회한 뒤 길이를 비교하므로, 매치가 배열 앞쪽에 있어도 나머지 파라미터까지 훑는다. `ROUTE_ARGS_METADATA` 항목 수는 핸들러 시그니처의 파라미터 개수(실무상 한 자릿수)로 상한이 명확해 실측 영향은 없다.
  - 제안: 코드 정리 목적의 트레이드오프로 그대로 두어도 무방. 극단적으로 파라미터가 많은 핸들러가 생기면 `.some()` 기반 판별 전용 오버로드를 고려.

- 그 외 파일들(`workspace-roles.ts` 의 `ADMIN_ROLES`/`ROLE_REQUIRED` 문서화·`auth.controller.ts`·`executions.controller.ts`·`workspaces.controller.ts` 의 Swagger `description` 템플릿 리터럴 치환·`integrations.service.ts` 의 로컬 `ADMIN_ROLES` → 공유 상수 치환·`workspaces.service.ts` 의 `throwOwnerTransferRequired` 본문을 `{ code, message }` 스프레드로 바꾼 것)는 전부 **모듈 로드 시점(데코레이터 적용 시점) 1회성 계산**이거나 상수 재배치이며, 요청 경로의 알고리즘 복잡도·쿼리 횟수·메모리 사용에 영향이 없다. `workspaces.service.ts` 의 `transferOwnership` 락 순서(워크스페이스 → 요청자 멤버십 → 대상 멤버십 순차 3회 조회)는 이번 diff 로 **새로 도입된 것이 아니라** 기존 구현을 정확히 서술하도록 docstring 만 정정한 것이다(diff 자체가 이를 명시: "구현부터 순차 `findOne` 두 번이었다") — 실행 경로 변경 없음.

## 요약

이번 변경 세트는 워크스페이스 역할/거부 상수(`workspace-roles.ts`)를 여러 서비스·컨트롤러가 공유하도록 정리하고, Swagger 설명 문자열을 상수 보간으로 바꾸고, 두 파라미터-리플렉션 판별 함수의 공통 골격을 추출한 리팩터링이다. 모든 신규/변경 로직이 요청당 상수 시간(작은 고정 크기 객체 순회, 문자열 보간)이거나 모듈 로드 시 1회 실행되는 코드이며, DB 호출 패턴이나 락 순서 등 실제 동시성/쿼리 로직은 그대로 유지된 채 문서만 실측에 맞춰 정정됐다. 유일하게 주목할 점은 공용 헬퍼화로 인해 요청마다 `Reflect.getMetadata` 가 (판별 함수 2개만큼) 두 번 호출된다는 것인데, 대상 메타데이터가 매우 작아 실질적 영향은 없다. 전반적으로 성능 관점에서 회귀나 새로운 병목은 없다.

## 위험도
NONE
