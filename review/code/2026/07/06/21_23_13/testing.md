### 발견사항

- **[WARNING]** `NotificationsService.findByBackgroundRun` / `notify`·`createMany` 의 `backgroundRunId` 처리에 대한 직접 unit 테스트 부재
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` (`findByBackgroundRun`, `notify`, `createMany`), `codebase/backend/src/modules/notifications/notifications.service.spec.ts`
  - 상세: `findByResource(resourceType, resourceId)` → `findByBackgroundRun(backgroundRunId)` 로 리네임/시그니처 변경되었고, `notify`/`createMany` 는 `entry.backgroundRunId` 를 조건부로 `row.backgroundRunId` 에 세팅하는 신규 분기(`if (entry.backgroundRunId) row.backgroundRunId = entry.backgroundRunId;`)가 추가됐다. 그러나 `notifications.service.spec.ts` 전체(771줄)에 `findByBackgroundRun`, `backgroundRunId` 관련 테스트가 하나도 없다. 이 함수는 오직 `background-runs.service.spec.ts` 의 mock(`notificationsService.findByBackgroundRun = jest.fn()...`)을 통해 간접적으로만 "호출 여부"가 검증되고, 실제 `repository.find({ where: { backgroundRunId }, order: { createdAt: 'ASC' } })` 쿼리 빌드 로직이나 `notify`/`createMany` 가 `backgroundRunId` 를 emit payload/DB row 에 실제로 반영하는지는 검증되지 않는다. WS emit payload(`emitNotificationEvent`)에 `backgroundRunId` 가 포함되는지 여부(REST 미노출 의도와 일치하는지)도 미검증.
  - 제안: `notifications.service.spec.ts` 에 (1) `findByBackgroundRun` 이 `where: { backgroundRunId }` 로 repo.find 를 호출하는 테스트, (2) `notify`/`createMany` 에 `backgroundRunId` 를 전달했을 때 저장 row 에 반영되고 emit payload 에는 (의도대로 노출되지 않는지 또는 노출되는지) 명시적으로 검증하는 테스트를 추가.

- **[WARNING]** `background-execution.processor.ts` 의 `dispatchFailureNotification` — `workflowId` 가 빈 문자열/undefined 인 엣지 케이스 미검증
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (`resourceId: data.workflowId`), `background-execution.processor.spec.ts`
  - 상세: 변경 전에는 `hasRunId = !!data.backgroundRunId` 로 fallback 분기가 있었으나, 변경 후 `resourceId` 는 무조건 `data.workflowId` 다. `workflowId` 가 항상 존재한다는 전제(주석에 명시)가 코드베이스 전역에서 보장되는지 테스트로 뒷받침되지 않는다. 만약 `job.data.workflowId` 가 예기치 않게 빈 문자열이면 여전히 잘못된 딥링크(`/workflows/`)가 생성될 수 있는데, 이 경계 케이스에 대한 테스트가 없다.
  - 제안: `workflowId` 보장 전제가 타입 레벨(non-optional)로 강제되는지 확인하고, 필요시 방어적 테스트(빈 workflowId 케이스) 또는 타입 주석 추가.

- **[INFO]** `background_run_id` 컬럼에 대한 DB 레벨 회귀 테스트는 e2e 1곳에만 존재 — unit 레벨에서 엔티티/DTO 매핑 검증 없음
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts` (`backgroundRunId` 컬럼 추가), `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts`
  - 상세: DTO 주석은 "REST 응답에는 노출하지 않는다"고 명시하나, 이를 강제하는 테스트(예: `NotificationDto` 매핑 함수가 `backgroundRunId` 를 실제로 제외하는지 검증하는 unit test)가 보이지 않는다. Entity 컬럼은 추가됐지만 DTO 변환 계층에서 필드를 명시적으로 drop 하는 로직이 diff 에 보이지 않아, 매핑이 whitelist 방식(수동 필드 나열)인지 spread 방식인지에 따라 실수로 노출될 위험이 있다.
  - 제안: notification → DTO 변환 함수를 찾아 `backgroundRunId` 가 응답에 없음을 assert 하는 회귀 테스트 1건 추가 권장 (whitelist 매핑이면 낮은 우선순위, spread 매핑이면 CRITICAL 로 격상).

- **[INFO]** e2e 테스트(`background-monitoring.e2e-spec.ts`, `execution-failed-notification.e2e-spec.ts`)의 폴링 기반 대기 로직은 테스트 가독성·안정성 면에서는 양호하나 최대 대기시간(15초/20초) 하드코딩으로 인해 flaky 가능성 존재
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts` (L927-936), `codebase/backend/test/execution-failed-notification.e2e-spec.ts` (`pollExecutionStatus`, `pollNotifications`)
  - 상세: 신규 e2e (`execution-failed-notification.e2e-spec.ts`)는 `execution_failed` 발사 경계(top-level만 발사, background 격리 시 미발사)를 실 인프라로 검증하는 좋은 회귀 테스트다. 다만 두 e2e 파일 모두 CI 환경 부하에 따라 timeout 이 발생할 수 있는 폴링 구조이며, 이는 기존 패턴을 따른 것이라 이번 변경이 새로 도입한 리스크는 아니다.
  - 제안: 특별한 조치 불요, 기존 컨벤션 유지가 합리적.

- **[INFO]** 리네임된 테스트 케이스 설명이 실제 동작을 명확히 반영 — 가독성 양호
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.spec.ts` (L149 `'keeps workflow deep-link and omits attribution when backgroundRunId is empty (legacy NodeExecution)'`)
  - 상세: 테스트명과 각 assertion 옆 한글 주석이 "딥링크는 항상 workflow", "attribution 은 backgroundRunId 있을 때만" 을 명확히 구분해 표현하고 있어 의도 파악이 쉽다. `entries[0].backgroundRunId` 를 `toBeUndefined()` 로 검증한 것도 옛 legacy(빈 문자열) 케이스에서 `|| undefined` 변환이 제대로 동작함을 정확히 커버한다.
  - 제안: 없음 (긍정 사례로 기록).

- **[INFO]** `background-runs.service.spec.ts` mock 시그니처 변경은 실제 서비스 시그니처와 1:1 대응하여 mock-실제 괴리 없음
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (L62, L109, L471, L489)
  - 상세: `findByResource` → `findByBackgroundRun` 리네임에 맞춰 mock 타입·호출 인자(`toHaveBeenCalledWith('bg-run-id')`, 기존 2-arg에서 1-arg로 축소)가 일관되게 갱신됐다. Mock 이 실제 시그니처와 정확히 일치해 회귀 테스트로서 유효하다.
  - 제안: 없음.

### 요약
이번 변경은 `background_failed` 알림의 딥링크(workflow)와 attribution(backgroundRunId) 분리라는 선존 결함 수정을 migration(V107) + entity + service 계층에 걸쳐 일관되게 반영했고, processor/background-runs 관련 기존 unit 테스트와 e2e 테스트가 새 계약(resource_type=workflow, resource_id=workflow.id, backgroundRunId 별도 필드)에 맞춰 정확히 갱신되었으며 신규 e2e(`execution-failed-notification.e2e-spec.ts`)로 execution_failed 발사 경계까지 실 인프라 검증을 추가한 점은 테스트 커버리지 측면에서 긍정적이다. 다만 이번 diff 의 핵심 신규 로직인 `NotificationsService.findByBackgroundRun`/`notify`·`createMany` 의 `backgroundRunId` 조건부 세팅 분기 자체는 해당 서비스의 unit spec 파일에서 직접 테스트되지 않고 소비자(`background-runs.service.spec.ts`)의 mock 을 통해서만 간접 검증되는 커버리지 갭이 있으며, DTO 계층에서 `backgroundRunId` 가 REST 응답에 노출되지 않음을 보장하는 회귀 테스트도 보이지 않는다. 두 갭 모두 CRITICAL 은 아니지만 이 PR 의 핵심 변경 지점(NotificationsService)에 대한 직접 커버리지 부재이므로 후속 보강이 바람직하다.

### 위험도
LOW
