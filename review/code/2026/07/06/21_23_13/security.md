# 보안(Security) 코드 리뷰

대상: 알림 파이프라인 PR3 후속 하드닝 (`background_failed` 딥링크/attribution 컬럼 분리, migration V107) —
`codebase/backend/migrations/V107__notification_background_run_id.sql`,
`background-execution.processor.ts`(+spec), `notifications.service.ts`, `notification.entity.ts`,
`notification-response.dto.ts`, `background-runs.service.ts`(+spec), `executions.module.ts`,
신규 e2e `execution-failed-notification.e2e-spec.ts` / `background-monitoring.e2e-spec.ts` 갱신,
plan 문서 3건, consistency 리뷰 산출물 4건.

## 발견사항

- **[INFO]** 에러 메시지 새니타이징 유지 및 defense-in-depth 양호
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` `sanitizeErrorMessage()` (변경 없음, 컨텍스트 확인)
  - 상세: stack trace 패턴 제거, `CONNECTION_STRING_PATTERN`으로 postgres/redis/mongodb/mysql URI 마스킹, 길이 제한(500자) 모두 기존 로직 그대로 유지되며 이번 diff(딥링크/attribution 분리)로 인한 회귀가 없다. `WebsocketService.sanitizePayloadForWs`의 키 기반 마스킹과 이중 방어 구조도 유지.
  - 제안: 없음 — 그대로 유지.

- **[INFO]** `background_run_id`가 REST 응답(DTO)에 노출되지 않도록 명시적으로 배제됨
  - 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts`, `codebase/backend/src/modules/notifications/entities/notification.entity.ts` 주석
  - 상세: 신규 컬럼 `backgroundRunId`가 `NotificationDto`(공개 REST 응답)에는 필드로 추가되지 않고, `background-runs.service.ts`의 `BackgroundRunNotificationDto`(별도 모니터링 응답)로만 노출된다. 내부 attribution 키를 불필요하게 외부에 노출하지 않는 최소 노출 원칙을 지킨 설계로 정보 노출 관점에서 양호하다.
  - 제안: 없음.

- **[INFO]** `findByBackgroundRun` 자체는 workspace 미스코프 쿼리이나, 호출 경로 상위에서 소유권 검증 유지
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` `findByBackgroundRun()`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `getBackgroundRun()` → `fetchNotifications()`
  - 상세: `findByBackgroundRun(backgroundRunId)`는 `workspaceId`/`userId` 필터 없이 `backgroundRunId` 단일 조건으로 조회한다. 그러나 호출자인 `BackgroundRunsService.getBackgroundRun()`은 이 조회 이전에 `verifyExecutionAccess(executionId, userWorkspaceId)`로 워크스페이스 소유권을 검증하고, `findBackgroundNodeExecution(executionId, backgroundRunId)`가 `backgroundRunId`를 해당 `executionId`(이미 검증된)에 속하는 것으로 한정하므로 IDOR(수평 권한 상승)로 이어지지 않는다. 이는 이번 diff 이전(`findByResource`)에도 동일하게 존재하던 패턴이며, 리팩터링(V107)이 이 보장을 깨지 않았음을 확인했다.
  - 제안: 방어 심층화 관점에서 장기적으로 `findByBackgroundRun`에 `workspaceId`를 옵션 파라미터로 추가해 서비스 계층에서도 이중 검증하는 것을 고려할 수 있으나, 현재 호출 경로가 유일하고 검증되어 있어 필수는 아니다(향후 새 호출자 추가 시 재검토 권고).

- **[INFO]** 마이그레이션(V107) 자체의 보안 리스크 없음
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql`
  - 상세: nullable 컬럼 + WHERE 부분 인덱스로 SQL 인젝션·권한 문제 소지 없음. 컬럼/인덱스명 상수 리터럴이며 사용자 입력이 DDL에 개입하지 않는다. `COMMENT ON COLUMN` 문구도 정적 문자열.
  - 제안: 없음.

- **[INFO]** e2e 테스트의 SQL 쿼리는 파라미터 바인딩(`$1`, `$2`, …) 사용, 인젝션 우려 없음
  - 위치: `codebase/backend/test/execution-failed-notification.e2e-spec.ts`, `codebase/backend/test/background-monitoring.e2e-spec.ts`
  - 상세: 신규/변경된 `db.query(...)` 호출 모두 파라미터화된 쿼리(`$1`, `$2`, `$3`)를 사용하며 문자열 결합으로 SQL을 조립하지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전체 diff
  - 상세: 신규 코드·마이그레이션·테스트 어디에도 API 키, 비밀번호, 토큰 등이 하드코딩되지 않았다. e2e 테스트는 `registerAndLogin` 헬퍼로 매 테스트마다 고유 계정을 생성해 사용한다.
  - 제안: 없음.

## 요약

이번 변경은 `notification` 테이블에 nullable `background_run_id` UUID 컬럼(+ 부분 인덱스)을 추가해 알림의 "딥링크 타깃(workflow)"과 "per-run attribution 키(backgroundRunId)"를 분리하는 리팩터링으로, 신규 인젝션·인증/인가 우회·시크릿 노출 벡터를 만들지 않는다. 신규 컬럼은 공개 REST DTO에서 명시적으로 제외되어 최소 노출 원칙을 지켰고, per-run attribution 조회(`findByBackgroundRun`)는 그 자체로는 워크스페이스 스코프가 없지만 호출 경로 상위(`verifyExecutionAccess` + `findBackgroundNodeExecution`)에서 소유권 검증이 유지되어 IDOR로 이어지지 않음을 확인했다. 에러 메시지 새니타이징(스택트레이스·커넥션 스트링 마스킹) 로직도 변경 없이 보존됐다. 마이그레이션과 e2e 테스트의 SQL은 모두 파라미터 바인딩을 사용해 인젝션 우려가 없다. 전반적으로 보안 관점에서 문제될 사항은 발견되지 않았다.

## 위험도

NONE
