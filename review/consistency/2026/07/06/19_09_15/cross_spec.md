### 발견사항

- **[CRITICAL]** `execution_failed`/`schedule_failed` 의 `resource_id` 가 알림 팝오버 딥링크 계약(`resource_id = workflow id`)과 불일치
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 — `execution_failed` 행 "resource_type='execution'(§2.1 — `background_failed` 옛 fallback 과 키공간 공유)", `schedule_failed` 행 (resource_id 명시 없이 §2.1 흐름을 따름). 실제 구현 `ExecutionEngineService.dispatchExecutionFailedNotification`(`execution-engine.service.ts`)이 `resourceId: execution.id`, `ScheduleRunnerService.dispatchScheduleFailedNotification`(`schedule-runner.service.ts`)이 `resourceId: scheduleId` 로 발사.
  - 충돌 대상: `spec/2-navigation/_layout.md` §3.1 알림 팝오버 라우팅 표 (라인 117-121) — `execution_failed`·`background_failed`·`schedule_failed` 3종을 묶어 "`/workflows/<resource_id>` (**resource_id = workflow id**)" 로 명시. 그리고 이 계약을 그대로 소비하는 `codebase/frontend/src/lib/notifications/href.ts` (라인 38-40 주석: "resourceId 가 워크플로우 id 임에 의존한다 — backend NotificationsService 가 resourceId=workflowId 로 채워서 보냄").
  - 상세: `_layout.md` 의 딥링크 계약은 세 타입 모두 `resource_id` 를 **workflow id** 로 가정하지만, 실제로는:
    - `execution_failed` → `resourceId=execution.id` (execution id, workflow id 아님)
    - `schedule_failed` → `resourceId=scheduleId` (schedule id, workflow id 아님)
    - `background_failed` → `resourceId=backgroundRunId`(있으면) 또는 `executionId`(fallback) — 이 또한 workflow id 가 아님(이 부분은 본 PR 이전부터 존재하던 기존 코드지만, 동일 표에 함께 묶여 있어 표 자체가 이미 stale 이었음을 방증).

    결과적으로 알림 팝오버에서 이 세 type 을 클릭하면 프런트 `href.ts` 가 `/workflows/${resourceId}` 를 생성하고, `resourceId` 는 execution/schedule/backgroundRun id 이므로 `GET /api/workflows/:id` 가 해당 id 로 워크플로우를 찾지 못해 404 로 귀결된다(SAFE_ID 패턴 자체는 통과하므로 폴백 처리 없이 잘못된 URL 로 이동). 프런트 단위테스트(`href.spec.ts`)도 `resourceId: "wf-1"` 처럼 워크플로우 id 를 흉내 낸 mock 만 사용해 실제 백엔드 값(execution/schedule id)과의 불일치를 검증하지 않는다 — 회귀가 은폐된 상태.
  - 제안: 다음 중 하나로 정합화해야 한다.
    (a) **백엔드 변경** — `execution_failed`/`schedule_failed`/`background_failed` 발사 시 `resourceId` 를 workflow id 로 채우고, 필요하면 execution/schedule id 는 `metadata` 등 별도 필드로 부가 정보를 실어 `findByResource` 조회는 계속 execution/backgroundRun 단위로 유지, 또는
    (b) **spec+frontend 변경(권장, downscope 적음)** — `spec/2-navigation/_layout.md` §3.1 표를 갱신해 `execution_failed`→`/workflows/<workflowId 파생 불가 시 폴백>` 대신 **실제 resource(execution/schedule)** 로 라우팅하도록 명시하고, `href.ts`/라우트를 `/workflows/:id/executions/:executionId`(execution 존재), 스케줄 상세 등 실제 resource_id 종류에 맞는 경로로 수정. 이 경우 `href.spec.ts` 도 실제 backend id 종류를 반영하도록 갱신.
    어느 쪽이든 `8-notifications.md` §1.1 과 `_layout.md` §3.1 양쪽에 선택한 계약을 명시하고 서로 참조하게 해 재발을 막는다.

- **[INFO]** `background_failed` 딥링크 stale 은 본 PR 범위 밖의 기존 결함(참고용)
  - target 위치: 해당 없음 (target 문서가 `background_failed` 행을 신규 변경하지 않음, §1.1 표에서 기존 서술 유지)
  - 충돌 대상: `spec/2-navigation/_layout.md` §3.1, `background-execution.processor.ts`(`resourceType = hasRunId ? 'background_run' : 'execution'`)
  - 상세: 위 CRITICAL 과 동일한 계약 위반이 `background_failed` 에도 이미 존재했다(이 PR 이전부터). 본 PR 이 이 결함을 만들지는 않았지만, 같은 표의 나머지 두 항목(`execution_failed`/`schedule_failed`)이 동일 패턴으로 추가되며 문제가 확산됐다. CRITICAL 수정 시 3종을 함께 정리할 것을 권고.
  - 제안: 위 CRITICAL 제안과 함께 일괄 수정.

### 요약

target 문서(`spec/data-flow/8-notifications.md`)가 신규로 문서화한 `execution_failed`/`schedule_failed`/`team_invite` 알림 발사 로직 자체는 데이터 모델(§2.19 `Notification`, V001/V052/V070 CHECK 제약에 이미 존재하는 enum 값 재사용), API 계약(`notify()`/`createMany()` 시그니처), 채널 정책(`spec/2-navigation/9-user-profile.md` §5.1 "인앱+이메일" ↔ `channel='both'`), 상태 머신(§3 알림 상태 전이) 측면에서는 기존 spec 과 잘 정합한다. 그러나 새로 발사되는 `execution_failed`/`schedule_failed` 의 `resource_id` 값(execution id / schedule id)이 `spec/2-navigation/_layout.md` 의 알림 팝오버 딥링크 계약("resource_id = workflow id")과 정면으로 어긋나, 실제 프런트 `href.ts` 가 잘못된 `/workflows/<id>` URL 을 생성해 클릭 시 404 로 귀결되는 구조적 결함을 새로 확산시킨다. 이는 두 spec 문서가 같은 도메인 엔티티(알림 리소스 attribution)에 대해 서로 다른 사실을 전제하는 전형적 Cross-Spec 데이터 모델 충돌이며, 기존에 `background_failed` 에 잠재해 있던 동일 결함이 이번 변경으로 다른 두 타입까지 확대된 것으로 보인다.

### 위험도
CRITICAL
