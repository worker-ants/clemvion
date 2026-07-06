# 신규 식별자 충돌 검토 결과

대상: `spec/data-flow/8-notifications.md` (impl-prep) + 착수 plan `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` PR3 (`notif-firing-sources-547d5c`, `execution_failed`/`schedule_failed`/`team_invite` 신규 발사 소스)

## 발견사항

- **[WARNING]** `execution_failed` 알림의 `resource_type='execution'` 이 `background_failed` 의 옛 fallback 값과 같은 키 공간을 재사용
  - target 신규 식별자: PR3 설계 (`plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md:20`) 의 `execution_failed` → `resource=execution/executionId` (notification.resource_type='execution', resource_id=executionId)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:169-173` — `background_failed` 알림이 `backgroundRunId` 가 없는 옛 NodeExecution 케이스에서 `resourceType = 'execution'`, `resourceId = data.executionId` 로 fallback 발사. 같은 (resource_type, resource_id) 쌍이 이미 다른 `type` 값(`background_failed`)으로 존재.
  - 상세: 두 케이스 모두 `type` 컬럼으로는 구분되므로 즉각적인 데이터 오염은 아니지만, `NotificationsService.findByResource(resourceType, resourceId)` (`notifications.service.ts:51`) 로 "이 실행에 대한 알림 전체"를 조회하는 소비자가 생기면 `resourceType='execution'` 값 하나로 의미가 다른 두 알림 계열(옛 background 실패 fallback vs 신규 top-level execution 실패)이 섞인다. 현재 유일한 `findByResource` 소비처인 `background-runs.service.ts:395-402` 는 `resourceType='background_run'` 으로만 조회하도록 이미 스코프를 좁혀 놨고 주석에 "옛 (resource_type='execution') 알림은 본 API 범위 밖" 이라고 명시했지만, 이는 옛 fallback 값 하나만 염두에 둔 서술이라 PR3 의 신규 `execution_failed` 도 같은 값을 쓴다는 사실이 그 주석·spec 어디에도 반영돼 있지 않다.
  - 제안: PR3 구현 시 (a) spec §1.1 `execution_failed` 행 및 §2.1 Postgres 매핑 표에 `resource_type='execution'` 을 명시적으로 기재하고, (b) `background-execution.processor.ts:169` 주석과 `background-runs.service.ts:395` 주석에 "신규 `execution_failed` 도 동일 `resource_type='execution'` 값을 쓴다" 는 사실을 상호 참조로 남겨 향후 `findByResource('execution', ...)` 소비자가 두 계열을 혼동하지 않게 한다. 필요하면 신규 발사분은 `resource_type='execution_run'` 처럼 구분된 값을 쓰는 대안도 검토.

- **[INFO]** `schedule` / `workspace_invitation` `resource_type` 값은 신규이나 `notification.resource_type` 이 자유 문자열(varchar, CHECK 없음)이라 충돌 없음
  - target 신규 식별자: PR3 의 `schedule_failed` → `resource_type='schedule'`, `team_invite` → `resource_type='workspace_invitation'` (`plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md:21-22`)
  - 기존 사용처: 코드베이스 전체에서 `resourceType: 'schedule'` / `'workspace_invitation'` 사용 이력 없음 (audit-logs 도메인은 `resourceType: 'integration' | 'workspace' | 'user' | 'alert_rule' | 'auth_config'` 등 별도 값 공간, `notification.entity.ts` 의 `resource_type` 은 자유 varchar(50)라 컬럼 자체 충돌 불가).
  - 상세: 별도 도메인(audit_log vs notification)의 `resourceType` 이 우연히 다른 값을 쓰고 있을 뿐 스키마상 강제된 enum 이 아니라 실질 충돌 없음.
  - 제안: 없음 (참고용 기록).

- **[INFO]** `execution_failed` / `schedule_failed` / `team_invite` `notification.type` 값은 이미 V052/V070 CHECK 제약 whitelist 에 등록돼 있어 마이그레이션 불요, 신규 도입 아님
  - target 신규 식별자: 위 3개 type 값
  - 기존 사용처: `codebase/backend/migrations/V070__notification_type_alert_breach.sql` 의 whitelist 10개 값에 이미 포함, `spec/1-data-model.md:719` §2.19 Notification.type enum 에도 이미 열거, `spec/data-flow/8-notifications.md:73-76` §1.1 표에도 이미 "미구현 (Planned)" 행으로 선재.
  - 상세: PR3 는 "미발사(Planned)" 상태를 "발사(구현됨)" 로 전환하는 것으로, 이름 자체는 신규가 아니다. 충돌 없음.
  - 제안: 없음.

- **[INFO]** `!parentExecutionId` 게이트 필드는 기존 실행 엔진 필드 재사용, 신규 식별자 아님
  - target 신규 식별자: PR3 설계의 `!parentExecutionId` 게이트 (`plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md:20`)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3847,3950` 에 `parentExecutionId` 필드가 이미 존재(sub-workflow/background 하위 실행 표시용).
  - 상세: 새 이름을 만들지 않고 기존 필드를 조건절에 재사용하는 것으로 충돌 여지 없음.
  - 제안: 없음.

- **[INFO]** `NotificationsModule` 은 순환 의존 없이 이미 `MailModule` 을 import 하고 있어 PR3 의 3개 서비스(execution-engine/schedule-runner/workspace-invitations)에서 DI 하는 것 자체는 이름 충돌 없음
  - target 신규 식별자: 없음 (기존 `NotificationsService` DI 확장뿐)
  - 기존 사용처: `codebase/backend/src/modules/notifications/notifications.module.ts:17`
  - 상세: 신규 클래스/토큰명 도입이 아니므로 본 관점에서는 해당 없음. 참고로만 기록.
  - 제안: 없음.

## 요약

target spec 문서(`8-notifications.md`) 자체는 `execution_failed`/`schedule_failed`/`team_invite` 세 타입명·CHECK whitelist 값을 이전 커밋에서 이미 선재시켜 두었고 이번 구현 착수(PR3)는 그 "Planned" 배지를 해제하는 것이라 타입명 레벨의 신규 ID 충돌은 없다. 다만 구현 세부 설계(plan 파일)에서 `execution_failed` 알림에 배정하려는 `resource_type='execution'` 값이, `background_failed` 알림이 옛 NodeExecution 호환을 위해 이미 쓰고 있는 동일 `resource_type='execution'` fallback 값과 같은 (resource_type, resource_id) 키 공간을 공유하게 되어, 향후 `findByResource('execution', executionId)` 류 조회가 도입되면 서로 다른 의미의 알림 계열이 뒤섞일 잠재 위험이 있다(현재는 유일한 `findByResource` 소비처가 `background_run` 스코프로 한정돼 있어 즉각적 오작동은 없음). 나머지(스케줄/초대 리소스 타입, 게이트 필드, 모듈 DI)는 자유 문자열이거나 기존 필드 재사용이라 충돌 없음.

## 위험도

LOW
