# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정 범위 확대 — raw 표면 `err.code === '23505'` 오류가 이제 전역적으로 500 대신 409 `RESOURCE_CONFLICT` 로 응답
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`isUniqueViolation` 로컬 헬퍼 제거 지점, `import { isPostgresUniqueViolation } from '../db/pg-error';` 추가), `else if (isPostgresUniqueViolation(exception)) {` 분기
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해, TypeORM 이 감싸지 않은 raw 표면(`err.code`)으로 올라오는 unique 위반은 그 분기를 타지 못하고 500 `INTERNAL_ERROR` 로 떨어졌다. 신설 `isPostgresUniqueViolation`(`pg-error.ts`)은 `instanceof` 검사 없이 `err.code ?? err.driverError?.code` 형태만 확인하므로, `GlobalExceptionFilter` 를 거치는 **모든 엔드포인트**의 상태 코드 매핑이 넓어진다. 즉 국소 처리가 없는 임의의 서비스가 raw query 경로로 23505 를 발생시키면 클라이언트가 받는 응답이 500→409 로 바뀐다. 이는 §1.10 계열이 요구하는 방향의 의도된 버그 수정이며, 회귀 테스트(`http-exception.filter.spec.ts` 신설 2건)로 확장(23505→409)과 비확장(23502→500 유지)을 양방향 모두 고정했고, `CHANGELOG.md` 가 "실측한 blast radius 는 0(우리 스키마를 치는 raw query 가 요청 경로에 없음)"이라고 명시해 뒀다. 500 을 재시도 가능(retryable) 신호로 취급하던 기존 클라이언트가 있었다면 이 폭 확대로 동작이 달라질 여지가 이론적으로 있으나, 실측 근거상 현재는 도달 불가능한 경로다.
  - 제안: 조치 불요 — 이미 CHANGELOG 에 기록됨. 향후 이 분기를 다시 넓힐 때(예: 다른 SQLSTATE 추가)는 같은 방식으로 blast-radius 실측과 양방향 회귀 테스트를 남길 것.

- **[INFO]** `WorkspacesService.listMembers` 를 DB 레벨 `select` 투영으로 전환 — 응답 wire 계약(필드명·타입) 불변, breaking change 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`memberRepository.find({ ... select: { id, userId, role, joinedAt, user: { id, email, name } } })`), 반환 매핑은 바로 아래 `.map(...)`
  - 상세: 쿼리가 `relations: ['user']` + 전 컬럼 로드에서 DB 레벨 `select` 투영으로 좁혀졌지만, 이후 `.map()` 이 만들어내는 응답 객체(`id, userId, email, name, role, joinedAt`)는 이전과 동일하다. 클라이언트에 노출되는 wire 계약에는 영향이 없고, `User` 민감 컬럼이 DB 레벨에서부터 로드되지 않도록 하는 방어 심화(검출→강제 전환)다. 직접 확인 결과 컨트롤러/Swagger DTO 는 이 서비스 반환값을 그대로 통과시키므로 응답 스키마 변경 없음.
  - 제안: 없음(확인 사항).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 백엔드 내부 타입 개명 — wire 응답 영향 없음, 순수 명명 충돌 해소
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (타입 선언 및 `findOne` 반환 타입)
  - 상세: 이 타입을 참조하는 자리는 저장소 전체에서 선언·`findOne` 반환 타입 두 곳뿐이며(grep 확인), `workflow-versions.controller.ts` 를 포함해 Swagger DTO 데코레이터나 컨트롤러 응답 타입과 직접 연결되지 않는다 — 즉 OpenAPI 스키마 이름/응답 필드는 이 개명의 영향을 받지 않는다. 프런트엔드의 동명 손-미러 타입(`codebase/frontend/src/lib/api/workflows.ts` `WorkflowVersionDetail`)은 이번 diff 에서 JSDoc 만 갱신되고 필드는 그대로이며, 두 타입의 기존 형태 차이(`creator` optional/nullable vs 3필드 고정, `createdAt` string vs Date)는 이번 PR 이 만든 것이 아니라 이전부터 있던 차이다(백엔드가 더 좁으므로 런타임 방향 위험 없음). 개명의 목적은 정확히 "같은 이름이라 grep 이 두 자리를 같은 선언으로 오인하게 만드는" 반복 오판(3라운드 연속, W3/W5)을 끊는 것이다.
  - 제안: 없음(확인 사항). 두 타입을 실제로 통합하려면 wire 계약(`Date` vs `string`, `creator` nullability) 정합화가 선행돼야 한다는 점이 이미 양쪽 JSDoc 에 문서화돼 있어 추적 가능하다.

- **[INFO]** 트리거 `endpointPath` 409 충돌 경로에 e2e 계약 검증 신설 — 기존 문서화된 §1.10 계약을 실 DB 경로로 처음 고정, 신규 계약 도입 아님
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (`it('B4. 같은 워크스페이스에 같은 endpointPath → 409 RESOURCE_CONFLICT + details.code (§1.10)', ...)`)
  - 상세: `(workspace_id, endpoint_path)` UNIQUE 제약을 실제로 밟아 409 + `error.code === 'RESOURCE_CONFLICT'` + `details === { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 단언하고, 드라이버 원문(`'duplicate key'`)이 응답 바디에 없는지도 함께 확인한다. `spec/5-system/3-error-handling.md` §1.10 과 `spec/2-navigation/2-trigger-list.md` 가 이미 이 정확한 조합을 문서화하고 있어(cross-spec 검토 결과와 일치) 새 계약을 만드는 것이 아니라 기존 계약의 e2e 커버리지 갭(mock 이 실제 드라이버 형태를 대변하는지 확인 못 함)을 메운다. `details` 를 부분 필드가 아니라 객체 전체로 단언해 필드 유실을 잡는 방식도 견고하다.
  - 제안: 없음 — 긍정적 강화.

- **[INFO]** 리뷰 산출물 디렉터리(`review/code/**`, `review/consistency/**`) 신규 파일 다수는 API 코드가 아니라 이전 라운드의 리뷰/일관성 검토 보고서 자체
  - 위치: `review/code/2026/09/08/12_53_08/*.md`, `review/consistency/2026/09/08/{12_21_11,13_22_38}/*.md` 등
  - 상세: 이 파일들은 프로세스 산출물(전 라운드 reviewer 들의 보고서)이며 API 표면·엔드포인트·DTO 를 정의하거나 바꾸지 않는다. API 계약 관점에서 검토할 실질 내용이 없다.
  - 제안: 조치 불요.

## 요약

이번 diff(커밋 `03f665c63`·`9ab43690a`·`05b899d1f`, origin/main 대비)의 API 표면 변경은 실질적으로 두 갈래다. (1) `GlobalExceptionFilter` 가 로컬 `isUniqueViolation`(QueryFailedError-only) 대신 SoT `isPostgresUniqueViolation`/`pgErrorConstraint`(`pg-error.ts`)를 쓰도록 통합되어, raw 표면 23505 오류가 이제 전역적으로 500 대신 409 `RESOURCE_CONFLICT` 로 응답한다 — 상태 코드 매핑이 넓어지는 전역 동작 변경이지만 실측 blast radius 0(현재 이 경로를 타는 raw query 없음), 양방향 회귀 테스트, CHANGELOG 기록이 모두 갖춰져 있어 위험이 낮다. (2) `listMembers` DB 투영 전환과 `WorkflowVersionDetail` 백엔드 개명은 둘 다 wire 응답 스키마·OpenAPI 표면을 바꾸지 않는 내부 리팩터(전자는 방어 심화, 후자는 명명 충돌 해소)다. 신설된 트리거 409 e2e 는 이미 문서화된 §1.10 에러 봉투 계약(코드·`details` 객체·드라이버 원문 비노출)을 실 DB 경로로 검증해 커버리지를 개선했을 뿐 신규 계약을 도입하지 않는다. 하위 호환성·버전 관리·URL/경로 설계·페이지네이션·요청 검증·인증/인가 축에서는 breaking change 나 누락된 검증을 발견하지 못했다.

## 위험도

LOW
