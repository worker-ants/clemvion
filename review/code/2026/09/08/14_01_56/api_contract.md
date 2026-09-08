# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정 범위가 넓어져, raw 표면(`err.code`, `QueryFailedError` 로 감싸이지 않은) 23505 오류가 이제 전역적으로 500 대신 409 `RESOURCE_CONFLICT` 로 응답한다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` 함수 `catch()` 의 `else if (isPostgresUniqueViolation(exception))` 분기(구 `isUniqueViolation` 제거, `pg-error.ts` 의 `isPostgresUniqueViolation` 로 교체)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 선행 요구해 `err.driverError.code` 표면만 봤다. 신규 `isPostgresUniqueViolation`(`codebase/backend/src/common/db/pg-error.ts`)은 `err.code ?? err.driverError?.code` 두 표면을 모두 본다. `@Catch()` 데코레이터가 전 엔드포인트에 걸리므로 이 판정 확장은 **국소 처리가 없는 모든 서비스**에 적용된다 — raw query 로 23505 를 내는 경로가 생기면 응답이 500→409 로 바뀐다. 분기 순서상 `HttpException` 검사가 먼저이므로 기존 명시적 4xx 응답과 충돌하지 않고, `err.code` 는 정확히 `'23505'` 문자열 일치만 보므로 오탐 폭이 넓지 않다(회귀 테스트로 `23502` 는 여전히 500 임을 확인). CHANGELOG(`## Unreleased`)가 "실측한 blast radius 는 0"(현재 요청 경로에서 이 표면을 타는 raw query 없음)이라고 명시하고 있고, 새 회귀 테스트(`http-exception.filter.spec.ts`)가 양방향(23505→409 / non-23505→500)을 고정한다. 하위 호환성 관점에서 이론상 상태 코드가 바뀌는 전역 변경이지만, 옳은 방향(스펙 §1.10 계열이 요구하는 409)으로의 버그 수정이고 현재 영향받는 실제 호출부가 없다는 점이 문서화·측정돼 있다.
  - 제안: 현재 조치로 충분. `pg-error.ts` 를 SoT 로 통합한 취지가 이 필터에도 적용된 것이므로 추가 조치는 불요.

- **[INFO]** `listMembers` DB `select` 투영 전환 — 응답 wire 계약(필드 이름·개수·타입)은 변경 없음, breaking change 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `listMembers` (find 옵션에 `select` 절 추가), 반환 매핑은 바로 아래 `.map((m) => ({...}))`
  - 상세: 쿼리가 `relations: ['user']` + 전체 컬럼 로드에서 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 좁혀졌지만, `.map()` 이 만드는 응답 객체(`id, userId, email, name, role, joinedAt`)는 변경 전과 동일한 6키다. `relations`+`select` 조합이 유지돼 여전히 단일 조인 쿼리이므로 N+1 도 아니다. 클라이언트 노출 계약에는 영향이 없고, `User` 민감 컬럼이 DB 레벨에서부터 로드되지 않도록 강제하는 방어 심화(검출→강제 전환)다.
  - 제안: 없음(확인 사항).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 백엔드 내부 타입 개명 — wire 응답에 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의 타입 선언(`export type WorkflowVersionDetailProjection = ...`)과 `findOne()` 반환 타입 시그니처
  - 상세: 저장소 전체에서 이 타입을 참조하는 자리는 선언·`findOne` 반환 타입 두 곳뿐(grep 으로 확인, `.spec.ts` 제외)이며 Swagger DTO 데코레이터(`@ApiProperty`/`@ApiResponse({ type: ... })`)나 컨트롤러 응답 타입과 직접 연결되지 않는다 — 순수 TS 내부 식별자다. 프런트엔드의 동명 미러 타입(`codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail`)은 이번 diff 에서 JSDoc 만 갱신되고 필드는 그대로다. 두 타입의 형태 차이(`creator` optional/nullable vs 3필드 고정, `createdAt` string vs Date)는 이번 PR 이전부터 있던 차이이며, 백엔드가 더 좁으므로 런타임 방향의 위험은 없다.
  - 제안: 없음(확인 사항). 두 타입을 실제로 합치려면 wire 계약(nullable 여부·`Date` vs `string`) 정합화가 선행돼야 한다는 점은 문서에 이미 명시돼 있다.

- **[INFO]** 트리거 `endpoint_path` 409 충돌 경로에 e2e 계약 검증 신설 — §1.10 wire 형태를 실 DB 경로로 고정, spec SoT 와 대조 일치
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` 의 `it('B4. 같은 워크스페이스에 같은 endpointPath → 409 RESOURCE_CONFLICT + details.code (§1.10)', ...)`
  - 상세: `dup.body.error.details` 를 `{ field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` **객체 전체**로 단언하고 드라이버 원문(`'duplicate key'`)이 응답 JSON 어디에도 없는지도 함께 검사한다. `spec/5-system/3-error-handling.md` §1.10 이 정확히 이 매핑(top-level `code`=`RESOURCE_CONFLICT` 유지, 세부 사유는 `details.field`/`details.code`)을 SoT 로 규정하고 있어, 테스트 기대값과 spec 이 정확히 일치함을 직접 대조 확인했다. 기존 단위 테스트가 mock 하던 드라이버 에러 형태가 실제와 일치하는지 검증하지 못했던 갭을 메운다.
  - 제안: 없음 — API 계약 검증 강화로 긍정적.

- **[INFO]** `integration-oauth.service.ts` 의 constraint 추출 로직을 `pgErrorConstraint()` 헬퍼로 교체 — 추출 순서·null coalescing 동일, 동작 변경 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — cafe24 설치 경로와 makeshop 설치 경로 두 곳 (`isPostgresUniqueViolation(err) && pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 조건문)
  - 상세: 종전 `err.constraint ?? err.driverError?.constraint` 손-작성 추출을 `pgErrorConstraint(err)` 단일 호출로 교체했고, 헬퍼 구현이 정확히 같은 순서(`e.constraint ?? e.driverError?.constraint`)를 쓴다. 두 callsite 의 회귀 스펙이 flat/wrapped 두 표면 모두를 `it.each` 로 커버해 409 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`/`MAKESHOP_ALREADY_CONNECTED` 매핑이 유지됨을 확인했다.
  - 제안: 없음.

## 요약

이번 diff 의 API 표면 변경은 두 갈래다. (1) `GlobalExceptionFilter` 가 로컬 `isUniqueViolation`(QueryFailedError 선행 요구) 대신 저장소 SoT `isPostgresUniqueViolation`/`pgErrorConstraint` 를 쓰도록 통합되어, raw 표면 23505 오류가 전역적으로 500 대신 409 `RESOURCE_CONFLICT` 로 응답하게 됐다 — `HttpException` 분기가 우선하고 코드 일치가 정확한 문자열 비교라 오탐 폭이 넓지 않으며, 실측 blast radius 0(현재 그 경로를 타는 raw query 없음)·양방향 회귀 테스트로 뒷받침된 의도된 버그 수정이다. (2) `listMembers` DB 투영 전환과 `WorkflowVersionDetail` 백엔드 개명은 둘 다 wire 응답 스키마(필드 이름·개수·타입)를 바꾸지 않는 내부 리팩터다(전자는 방어 심화, 후자는 Swagger 와 무관한 내부 타입 이름 충돌 해소). 신설된 트리거 409 e2e 는 `spec/5-system/3-error-handling.md` §1.10 SoT 와 대조해 정확히 일치하는 에러 봉투 계약(코드·`details` 객체·비노출)을 실 DB 경로로 검증해 커버리지를 개선했다. 하위 호환성·버전 관리(이 저장소는 명시적 API 버전 접두사를 쓰지 않는 unversioned REST 이며 이번 diff 가 그 전제를 바꾸지 않음)·URL 설계·페이지네이션·인증/인가 축에서는 breaking change 나 누락된 검증을 찾지 못했다.

## 위험도

LOW
