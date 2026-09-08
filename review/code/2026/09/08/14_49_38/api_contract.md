# API 계약(API Contract) 코드 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 매핑이 넓어짐(500→409) — 의도된 수정이며 회귀 테스트로 양방향 고정됨
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`catch()` 메서드, `isPostgresUniqueViolation(exception)` 분기)
  - 상세: `@Catch()` 전수 필터가 처리하는 non-`HttpException` 예외 중 Postgres unique violation(`23505`) 판정 방식이 `isUniqueViolation`(로컬, `err instanceof QueryFailedError` 선행 요구)에서 `isPostgresUniqueViolation`(SoT, `err.code`/`err.driverError.code` 두 표면 모두 검사)으로 바뀌었다. 이로써 TypeORM 이 감싸지 않은 raw 표면으로 올라온 23505 도 이제 **409 `RESOURCE_CONFLICT`** 로 응답한다(종전 500 `INTERNAL_ERROR`). 이 필터는 전역이라 모든 엔드포인트에 적용되는 상태코드 매핑 변경이지만, (1) CHANGELOG 에 blast radius 실측(0 — 현재 요청 경로에 raw query 가 스키마를 직접 치는 자리 없음)이 기록되어 있고, (2) `http-exception.filter.spec.ts` 에 새 테스트 두 건(raw 23505 → 409, raw 23502 는 여전히 500)으로 넓어진 판정이 과도하게 넓어지지 않았음을 회귀 고정했다. 응답 봉투 형식(`error.code`/`message`/`requestId`)은 그대로이고 CWE-209 마스킹(`duplicate key` 원문 미노출)도 유지된다. breaking change 로 보지 않으나, 전역 필터의 상태코드 매핑 확장이라는 성격상 기록해 둔다.
  - 제안: 현재 상태로 충분 — 이미 CHANGELOG 기록 + 회귀 테스트 양방향 고정 완료. 후속 조치 불필요.

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 서버 내부 타입명 변경으로 wire 계약에 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `export type WorkflowVersionDetailProjection = Omit<...>` 선언부, `findOne()` 반환 타입 시그니처
  - 상세: 이 타입은 TypeScript 컴파일 타임 전용이며 실제 JSON 응답 필드 구성(`snapshot`, `creator: { id, name, email }` 등)은 변경되지 않았다. 프런트엔드(`codebase/frontend/src/lib/api/workflows.ts`)의 동명 손-미러 타입 `WorkflowVersionDetail` 은 여전히 별도 선언으로 남아 있으며(공유 타입 패키지화는 이 PR 범위 밖으로 명시), 두 타입의 필드 폭 차이(`creator` optional/nullable vs 3필드 고정, `createdAt` string vs Date)는 이번 변경 이전부터 존재하던 것이고 이번 diff 에서 새로 벌어지지 않았다(양쪽 JSDoc 상호 링크로 계약 차이를 문서화). API 응답 스키마 자체의 하위 호환성 문제 없음.
  - 제안: 추가 조치 불필요. 다만 두 선언이 여전히 손-미러 상태이므로, 다음에 `creator`/`createdAt` 필드를 편집할 때는 반대편 파일도 함께 여는 관례(양쪽 JSDoc 명시)를 유지할 것.

- **[INFO]** `WorkspacesService.listMembers` 응답 wire 계약(6키)은 DB 투영 전환 후에도 동일함을 코드로 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-241` (`listMembers()`)
  - 상세: `relations: ['user']` + JS `.map()` 수동 필드 선택 방식에서 `select: { id, userId, role, joinedAt, user: { id, email, name } }` DB 레벨 투영으로 바뀌었으나, 이후 `.map()` 이 만드는 반환 객체(`{ id, userId, email, name, role, joinedAt }`)는 필드 구성·타입이 그대로다. `GET /:id/members` 를 호출하는 클라이언트 입장에서는 응답 스키마 변화가 없다. 이는 방어 계층을 "검출"에서 "강제"로 올린 내부 보안 강화(민감 컬럼이 애초에 로드되지 않음)이며 API 계약 관점에서는 breaking change 가 아니다.
  - 제안: 없음.

- **[INFO]** 웹훅 트리거 endpointPath 충돌 e2e 테스트가 §1.10 에러 계약(409 + `details` 객체)을 실 DB 경로로 처음 검증
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 신규 `it('B4. ... → 409 RESOURCE_CONFLICT + details.code (§1.10)', ...)`
  - 상세: 종전에는 unit 테스트(`triggers.service.spec.ts`)만 `QueryFailedError` 를 mock 해 `rethrowEndpointPathConflict` 경로를 태웠는데, 이 e2e 는 실제 Postgres `(workspace_id, endpoint_path)` UNIQUE 제약을 두 번째 요청으로 실제로 밟아 409/`RESOURCE_CONFLICT`/`details: { field, code }` 형태를 검증하고 드라이버 원문(`duplicate key`)이 응답에 새지 않는지도 함께 확인한다. 새 엔드포인트나 계약 변경이 아니라 기존 계약의 실측 커버리지 강화이며, 위 전역 필터 변경과는 별도 축(서비스 레벨 `throwIfUniqueViolation`/`rethrowEndpointPathConflict` 경유)이라 서로 다른 경로를 검증한다.
  - 제안: 없음.

- **[INFO]** `integration-oauth.service.ts` 의 constraint 추출 인라인 코드를 `pgErrorConstraint()` 로 교체 — 동작 동등성 확인
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (cafe24/makeshop OAuth 콜백 두 자리, `pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 분기)
  - 상세: 종전 인라인 `(err as ...)?.constraint ?? (err as ...)?.driverError?.constraint` 와 `pg-error.ts` 의 `pgErrorConstraint()` (`e.constraint ?? e.driverError?.constraint`, null/object 가드 후)는 null/undefined 처리를 포함해 동작이 동일함을 소스 대조로 확인했다. `ALREADY_CONNECTED_BY_SERVICE` 409 매핑 동작에 변화 없음 — 순수 리팩터.
  - 제안: 없음.

## 요약

이번 배치(B-1~B-8)에서 실제 API 표면(엔드포인트 URL, 요청/응답 스키마, 인증·인가, 페이지네이션)에 breaking change 는 없다. 유일하게 API 계약과 직결되는 동작 변경은 전역 예외 필터의 Postgres unique-violation 판정을 raw 표면까지 확장해 일부 케이스의 상태코드를 500→409(올바른 방향)로 교정한 것인데, blast radius 0 실측과 회귀 테스트(넓힘 확인 + 과확장 방지 counter-case) 양쪽으로 이미 검증되어 있다. `WorkflowVersionDetail` 개명과 `listMembers` DB 투영 전환은 각각 서버 내부 타입명 변경·방어 계층 강화로, 응답 wire 형식은 그대로임을 코드 레벨에서 직접 확인했다. 신규 e2e(B4)는 기존 §1.10 에러 계약(409 + `details` 객체, 드라이버 원문 미노출)을 실 DB 경로로 처음 검증해 커버리지를 강화한다. 전반적으로 문서화·회귀 테스트가 충실하며 API 계약 관점의 위험 요인은 없다.

## 위험도

NONE
