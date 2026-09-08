# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정이 넓어져, 이전에 500 으로 마스킹되던 raw 표면 23505 오류가 이제 전역적으로(모든 엔드포인트) 409 `RESOURCE_CONFLICT` 로 응답한다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`} else if (isPostgresUniqueViolation(exception)) {`)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해, `err.code`(driver wrap 이 얕은 raw 표면) 만 있는 23505 오류는 500 `INTERNAL_ERROR` 로 떨어졌다. 신설 `isPostgresUniqueViolation`(`codebase/backend/src/common/db/pg-error.ts:28`)은 `instanceof` 없이 `err.code ?? err.driverError?.code` 구조만 보므로, 이 분기는 `GlobalExceptionFilter` 를 거치는 **모든** 엔드포인트에 적용된다 — 국소 처리가 없는 임의의 서비스가 raw query 로 23505 를 발생시키면 응답 코드가 500→409 로 바뀐다. 이는 스펙(§1.10 계열)이 요구하는 방향의 **의도된 수정**이고 회귀 테스트(`http-exception.filter.spec.ts:127-159`)로 양방향(23505 → 409 / non-23505 → 500)을 고정했으며, plan(`plan/in-progress/spec-followups-batch-b.md` B-3)이 "현재 blast radius ~0(우리 스키마를 치는 raw query 가 요청 경로에 없음)"이라고 명시한다. 다만 상태 코드가 전역적으로 바뀌는 변경이므로, 500 을 재시도 대상으로 처리하던 기존 클라이언트가 있다면 동작 차이가 생길 수 있다는 점은 배포 노트에 남길 가치가 있다.
  - 제안: 현재 조치로 충분. 필요하면 릴리스 노트/체인지로그에 "전역 unique-violation 매핑 확장(raw 표면 포함)" 한 줄만 남겨 두면 향후 회귀 조사 시 참조점이 된다.

- **[INFO]** `listMembers` 를 DB 레벨 `select` 투영으로 전환 — 응답 스키마(필드 이름·타입)는 그대로 유지되어 API 계약 변경 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` (select 절 추가), 반환 매핑은 `:233-240`
  - 상세: 쿼리가 `relations: ['user']` + 전체 컬럼 로드에서 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 좁혀졌지만, 이후 `.map()` 이 만들어내는 응답 객체(`id, userId, email, name, role, joinedAt`)는 변경 전과 동일하다. 클라이언트에 노출되는 wire 계약에는 영향이 없고, `User` 민감 컬럼이 DB 레벨에서부터 로드되지 않도록 강제하는 방어 심화(검출→강제 전환)다. API 계약 관점에서는 breaking change 아님.
  - 제안: 없음(확인 사항).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 백엔드 타입 개명은 순수 내부 식별자 변경, wire 응답에 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69`(선언), `:152`(`findOne` 반환 타입)
  - 상세: 저장소 전체에서 이 타입을 참조하는 자리는 선언·`findOne` 반환 타입 두 곳뿐이며(grep 확인, `.spec.ts` 제외), Swagger DTO 데코레이터나 컨트롤러 응답 타입과 직접 연결되지 않는다. 프런트엔드의 동명 미러 타입(`codebase/frontend/src/lib/api/workflows.ts` `WorkflowVersionDetail`)은 이번 diff 에서 JSDoc 만 갱신되고 필드는 그대로다. 두 타입의 형태 차이(`creator` optional/nullable vs 3필드 고정, `createdAt` string vs Date)는 이번 PR 이 만든 것이 아니라 기존에 이미 있던 차이이며, 백엔드가 더 좁으므로 런타임 오류 방향의 위험은 없다.
  - 제안: 없음(확인 사항). 두 타입을 실제로 합치려면 wire 계약(`Date` vs `string`, nullable 여부) 정합화가 선행돼야 한다는 점만 문서에 이미 명시돼 있어 향후 추적 가능.

- **[INFO]** 트리거 `endpoint_path` 409 충돌 경로에 e2e 계약 검증 신설 — §1.10 wire 형태(상태 코드·`error.code`·`details.field`/`details.code`·드라이버 원문 비노출)를 실 DB 경로로 고정
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213`
  - 상세: 단위 테스트가 mock 하던 드라이버 에러 형태(제약 이름·SQLSTATE)를 실 UNIQUE 제약을 밟는 경로로 재확인한다. `dup.body.error.details` 를 `{ field, code }` **객체 전체**로 단언하고(부분 필드 단언이 아님) `JSON.stringify(dup.body)` 에 `'duplicate key'` 가 없는지 함께 검사 — 에러 응답 형식 일관성·정보 누출 방지(CWE-209) 축을 모두 잡는 견고한 계약 테스트다.
  - 제안: 없음 — API 계약 검증 강화로 긍정적.

## 요약

이번 diff 의 API 표면 변경은 크게 두 갈래다. (1) `GlobalExceptionFilter` 가 로컬 `isUniqueViolation`(QueryFailedError-only) 대신 저장소 SoT `isPostgresUniqueViolation`/`pgErrorConstraint`(`pg-error.ts`)를 쓰도록 통합되어, raw 표면 23505 오류가 이제 모든 엔드포인트에서 500 대신 409 `RESOURCE_CONFLICT` 로 일관되게 응답한다 — 현재 실제로 이 경로를 타는 raw query 가 없어 즉시 영향은 없지만, 상태 코드가 바뀌는 전역적 동작 변경이므로 문서화 가치가 있다. (2) `listMembers` DB 투영 전환과 `WorkflowVersionDetail` 백엔드 개명은 둘 다 wire 응답 스키마를 바꾸지 않는 내부 리팩터(전자는 방어 심화, 후자는 이름 충돌 해소)다. 신설된 트리거 409 e2e 는 실 DB 경로로 §1.10 에러 봉투 계약(코드·`details` 객체·비노출)을 검증해 커버리지를 개선한다. 하위 호환성·버전 관리·URL/페이지네이션·인증인가 축에서는 breaking change 나 누락된 검증을 찾지 못했다.

## 위험도

LOW
