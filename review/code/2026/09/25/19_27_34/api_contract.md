# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** Swagger `@ApiForbiddenResponse`/`@ApiOperation.description` 문자열을 하드코딩에서 공유 상수(`NOT_A_MEMBER.code`, `ROLE_REQUIRED.*.code`) 보간으로 전환 — 문서-코드 drift 방지 개선, 계약 변경 없음
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:431,446`, `codebase/backend/src/modules/executions/executions.controller.ts:282,311`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71-73,396`
  - 상세: 각 파일에서 `NOT_A_MEMBER`/`ROLE_REQUIRED` 를 import 해 기존에 손으로 적었던 오류 코드 문자열(`NOT_A_MEMBER`, `EDITOR_REQUIRED`, `ADMIN_REQUIRED`, `OWNER_REQUIRED`)을 템플릿 리터럴 보간으로 대체했다. 상수값을 대조한 결과 보간 후 렌더링되는 문자열은 기존 하드코딩 문자열과 완전히 동일하다(`workspace-roles.ts:46,60,63-64`) — 응답 스키마·상태 코드·문서 텍스트 모두 변경 없음. 오히려 가드/서비스가 실제로 던지는 `code` 값과 Swagger 문서가 항상 같은 소스에서 파생되므로, 향후 코드명이 바뀔 때 문서가 자동 동기화되어 API 문서-구현 drift 위험이 줄었다.
  - 제안: 없음(개선 사항으로 확인만).

- **[INFO]** `ADMIN_ROLES` 를 `integrations.service.ts` 로컬 정의(`new Set(['owner','admin'])`)에서 공용 `workspace-roles.ts` 의 `ReadonlySet<string>` 으로 교체
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:16` (import), 로컬 선언 삭제 지점
  - 상세: 파일 내 유일한 사용처(`ADMIN_ROLES.has(role)`, `integrations.service.ts:1568`)는 읽기 전용 멤버십 판정이라 `Set` → `ReadonlySet` 타입 변경이 런타임/컴파일 양쪽에서 문제 없다. 값 집합도 `WORKSPACE_ROLE_LEVEL` 기준 admin(3)/owner(4) 로 동일 — 통합 관리 권한 판정 로직에 실질 변경 없음. 두 서비스(`workspaces.service.ts`, `integrations.service.ts`)가 이제 같은 서열표에서 파생되므로 "한쪽만 바뀌는 날 두 판정이 갈리는" 위험이 줄어드는 구조 개선이다.
  - 제안: 없음.

- **[INFO]** `RouteArgEntry`/`routeArgEntriesMatching` 공통화로 `handlerConsumesWorkspaceId`·`workspaceParamNamesOf` 리팩터링
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` (신규 `routeArgEntriesMatching` 함수, 두 판별 함수 본문)
  - 상세: 두 함수가 각자 갖고 있던 `ROUTE_ARGS_METADATA` 조회 + `Object.values(...).filter(entry => entry?.factory === X)` 골격을 공통 헬퍼로 추출했다. 필터 조건(`entry?.factory === factory`)과 반환 타입이 기존 두 함수의 인라인 타입 캐스팅과 동일해 `@WorkspaceId()`/`@WorkspaceParam()` 리플렉션 판정 결과에 차이가 없다 — `RolesGuard` 가 참조하는 두 판별 함수의 외부 시그니처·반환값 계약은 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** `transferOwnership()` 동시성 docstring 자기-정정 + `throwOwnerTransferRequired()` 응답 조립 방식 변경
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:711-721` (docstring), `:941` (`...ROLE_REQUIRED.owner`)
  - 상세: docstring 은 "두 멤버를 단일 IN 쿼리로 락"이라던 종전 서술을 "요청자→대상 순차 `findOne` 두 번"으로 정정했다(구현은 그대로, 서술만 실측에 맞춤). `throwOwnerTransferRequired()` 의 `ForbiddenException` 페이로드는 `code: ROLE_REQUIRED.owner.code` 단일 필드 대입에서 `{ ...ROLE_REQUIRED.owner, message: '...' }` 스프레드로 바뀌었으나, `ROLE_REQUIRED.owner` 는 `{ code, message }` 두 필드뿐이고 뒤이어 같은 커스텀 `message` 로 덮어쓰므로 최종 응답 바디(`{ code: 'OWNER_REQUIRED', message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.' }`)는 변경 전과 바이트 단위로 동일하다. 클라이언트가 관측하는 403 바디에 영향 없음.
  - 제안: 없음.

- **[INFO]** `workspaces.service.spec.ts` 테스트가 `OWNER_REQUIRED` 403 바디에 `message` 필드 단언을 추가
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1050-1056`
  - 상세: 서비스 계층의 문구('owner 이양은 현재 owner 만 수행할 수 있습니다.')가 `RolesGuard` 의 공용 문구('Owner 권한이 필요합니다.')와 다르다는 것을 테스트로 고정했다 — e2e 에서 403 이 가드/서비스 어느 층에서 났는지 구분하는 근거를 유지하기 위함이며, 이는 기존에도 존재하던 의도된 문구 차이(같은 `code`, 다른 `message`)를 회귀 테스트로 못박은 것이다. 계약 변경 아님.
  - 제안: 없음.

## 요약

이번 변경분은 8개 파일에 걸쳐 있으나 실질은 "경로 워크스페이스 가드" 작업의 후속 정리(리팩터링·문서 정확도 개선)로, 엔드포인트 URL·HTTP 메서드·요청/응답 스키마·페이지네이션·인증/인가 판정 로직·상태 코드 중 어느 것도 바꾸지 않는다. Swagger `@ApiForbiddenResponse` 설명이 하드코딩 문자열에서 실제 오류 코드 상수 보간으로 바뀐 것이 API 문서 관점에서 가장 눈에 띄는 변경이지만, 대조 결과 렌더링 문자열이 종전과 동일해 클라이언트에 노출되는 계약에는 영향이 없고 오히려 문서-구현 drift 를 줄이는 방향의 개선이다. `ADMIN_ROLES` 통합, `routeArgEntriesMatching` 공통화, `transferOwnership` 403 페이로드 조립 방식 변경도 모두 관측 가능한 응답을 바꾸지 않는 내부 정리다. 하위 호환성 문제·breaking change·에러 응답 형식 불일치·요청 검증 공백·RESTful 네이밍 이슈·인증/인가 약화 소지는 발견되지 않았다.

## 위험도

NONE
