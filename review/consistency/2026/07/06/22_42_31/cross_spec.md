### 발견사항

- **[WARNING]** `spec/data-flow/8-notifications.md` §1.1/§2.1 이 신규 `background_run_id` 컬럼·`findByBackgroundRun` 메서드를 반영하지 않아 코드와 모순
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 (`background_failed` 행), §2.1 (`notification` 적재 컬럼 목록·"리소스 attribution 조회" 행)
  - 충돌 대상: `codebase/backend/migrations/V107__notification_background_run_id.sql`, `codebase/backend/src/modules/notifications/notifications.service.ts` (`findByBackgroundRun`), `codebase/backend/src/modules/notifications/entities/notification.entity.ts` (`backgroundRunId` 컬럼)
  - 상세: 현재 target 문서(HEAD 기준, 이번 PR 에서 diff 없음)는 여전히 "`background_failed`" 행에 딥링크/attribution 계약을 명시하지 않고, §2.1 "리소스 attribution 조회" 행이 `SELECT WHERE resource_type=? AND resource_id=?` (`NotificationsService.findByResource`) 로 서술한다. 그러나 실제 코드는 `findByResource` 를 완전히 제거하고 `findByBackgroundRun(backgroundRunId)` 로 교체했으며, `notification` 테이블에 `background_run_id UUID` 컬럼이 신설됐다(migration V107). `spec/1-data-model.md §2.19` Notification 필드 표에도 `background_run_id` 행이 없다. 문서만 보면 "attribution 은 resource_type/resource_id 로 조회한다"는 옛 계약이 유효한 것처럼 보이지만, 코드는 이미 별도 컬럼으로 분리됐다 — 이 상태로 spec 만 읽는 사람은 background-runs 모니터링 API 의 attribution 동작을 오해한다.
  - 제안: 이미 `plan/in-progress/spec-update-notifications-background-run-id.md` 로 planner 위임이 명시돼 있고 체크리스트도 구체적이다(§2.1/§1.1/Rationale/§2.19/`4-nodes/1-logic/12-background.md §8.2` 5개 갱신 대상). 코드가 이미 배포 가능한 상태이므로 drift 창을 최소화하려면 해당 spec-update plan 을 신속히 착수해 병합할 것을 권고. 그 전까지는 CRITICAL 로 격상하지 않는 이유: (a) 딥링크 라우팅 계약의 SoT 인 `spec/2-navigation/_layout.md §3.1` 은 이미 `background_failed` → `resource_id=workflow id` 로 정의돼 있어 신규 코드와 **일치**하고, 실제로 이번 코드는 그 기존 계약을 어기던 선존 결함(딥링크 404)을 고치는 방향이다. (b) 갭이 은폐된 것이 아니라 개발자가 커밋 메시지·plan 파일에 명시적으로 기록해 추적 중이다.

- **[INFO]** `spec/4-nodes/1-logic/12-background.md §8.2` 모니터링 API `notifications` 필드 설명이 attribution 메커니즘을 언급하지 않음
  - target 위치: (target 문서 자체에는 해당 없음 — 연관 spec) `spec/4-nodes/1-logic/12-background.md` §8.2 (`notifications` 필드 설명, "본 backgroundRun 와 연관된 알림")
  - 충돌 대상: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`fetchNotifications` → `findByBackgroundRun`)
  - 상세: 직접적 모순은 아니지만(어떤 컬럼으로 조회하는지 명시하지 않았을 뿐), 위 spec-update plan 체크리스트에 이미 이 문서 갱신이 포함돼 있어 중복 확인 차 기록.
  - 제안: 위 WARNING 과 동일 plan 에서 함께 처리.

- **[INFO]** DTO Swagger 주석의 `resourceType` 값 목록(`workflow`, `integration`, `workspace_invitation`)이 `spec/1-data-model.md §2.19` 의 축약 서술("workflow, integration 등")과 표현 granularity 가 다름
  - target 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts` (`resourceType` 필드 주석, 이번 PR 갱신분)
  - 충돌 대상: `spec/1-data-model.md §2.19` (`resource_type | String? | 관련 리소스 유형 (workflow, integration 등)`)
  - 상세: 실질 모순은 아님 — data-model 표는 원래도 예시 나열("등")이라 신규 값 추가와 직접 충돌하지 않는다. `workspace_invitation` 값 자체는 이번 PR 신규가 아니라 기존 `workspace-invitations.service.ts` 에서 이미 쓰이던 값이라(diff 범위 밖), 이번 PR 의 DTO 주석 정확화가 오히려 spec 과의 표현 격차를 좁히는 방향.
  - 제안: 조치 불요. 위 spec-update plan 진행 시 `resource_type` 예시 목록을 3종(workflow/integration/workspace_invitation)으로 통일하면 더 정확해짐(선택).

### 요약

이번 PR(`hopeful-wozniak-a22f76`, migration V107 + background_failed 딥링크/attribution 분리 + execution_failed 발사 버그 2건 수정)은 target spec 문서(`spec/data-flow/8-notifications.md`)를 전혀 갱신하지 않았다(diff 확인 결과 origin/main 대비 spec 변경 없음). 그 결과 코드(신규 `background_run_id` 컬럼, `findByBackgroundRun` 메서드, `resourceType='workflow'` 통일)와 target 문서(옛 `findByResource(resource_type, resource_id)` 서술)가 어긋난다. 다만 이 갭은 은폐된 것이 아니라 커밋 메시지와 `plan/in-progress/spec-update-notifications-background-run-id.md`(구체적 5개 항목 체크리스트, planner 위임 명시)로 이미 추적되고 있으며, 딥링크 라우팅 계약의 실질 SoT 인 `spec/2-navigation/_layout.md §3.1` 은 신규 코드와 이미 일치한다(오히려 이번 코드가 §3.1 계약 위반이던 선존 결함을 해소). 따라서 데이터 모델/API 계약/상태 전이/RBAC/계층 책임 어느 관점에서도 "두 영역이 서로 다른 진실을 주장해 충돌"하는 CRITICAL 은 없고, "문서 미갱신으로 인한 정의 격차 — 명시적 후속 작업 필요"에 해당하는 WARNING 1건과 부수 INFO 2건으로 판단한다.

### 위험도
LOW
