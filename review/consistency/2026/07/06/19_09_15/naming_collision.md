# 신규 식별자 충돌 검토 — spec/data-flow/8-notifications.md

## 발견사항

- **[CRITICAL]** `execution_failed` / `schedule_failed` 의 `resource_id` 필드값이 기존 딥링크 소비처와 의미 충돌
  - target 신규 식별자: `execution_failed` 알림의 `resourceId = execution.id` (`execution-engine.service.ts` `dispatchExecutionFailedNotification`), `schedule_failed` 알림의 `resourceId = scheduleId` (`schedule-runner.service.ts` `dispatchScheduleFailedNotification`)
  - 기존 사용처:
    - `spec/2-navigation/_layout.md:120` — "`execution_failed` · `background_failed` · `schedule_failed` | `/workflows/<resource_id>` (**resource_id = workflow id**)"
    - `codebase/frontend/src/lib/notifications/href.ts` (`case "execution_failed": case "background_failed": case "schedule_failed":`) 주석: "resourceId 가 **워크플로우 id** 임에 의존한다 (backend NotificationsService 가 resourceId=workflowId 로 채워서 보냄)"
  - 상세: 프런트 팝오버 딥링크 라우팅(`_layout.md` §3.1, `href.ts`)은 `execution_failed`/`schedule_failed`/`background_failed` 3종 모두 `resource_id` 를 **workflow id** 로 전제하고 `/workflows/<resource_id>` 로 이동시킨다. 그러나 target 이 구현한 두 dispatcher 는 `resourceType='execution'`/`resource_id=execution.id`, `resourceType='schedule'`/`resource_id=scheduleId` 를 채운다 — workflow id 가 아니다. 즉 같은 필드 `resource_id` 가 "라우팅 소비처가 기대하는 의미(workflow id)"와 "발사 측이 실제로 채우는 의미(execution/schedule id)"로 **분화되어 충돌**한다. 실사용 시 알림 클릭 → `/workflows/<execution-uuid 또는 schedule-uuid>` 로 이동 → 존재하지 않는 workflow id 라 404/오작동. (`background_failed` 도 코드 상 `resourceId=backgroundRunId ?? executionId` 로 이미 동일한 기존 결함을 갖고 있어, target 이 새로 만든 문제라기보다 기존 패턴을 답습·확산시킨 것 — 다만 target PR 이 이 필드를 두 번 더 같은 방식으로 채워 충돌 범위를 넓혔다.)
  - 제안: 다음 중 하나로 정합화. (a) 세 dispatcher 모두 `resource_id` 를 실제로 `workflow.id` 로 채우고, "실행/스케줄 상세로 보내고 싶다"는 요구는 title/message 텍스트로만 전달 (라우팅 계약을 문서 그대로 준수). (b) `resource_id` 의미를 "실행/스케줄 id"로 확정하고 `_layout.md` §3.1 표 + `href.ts` 를 `/workflows/<workflowId>/executions/<resource_id>` 또는 `/schedules?...` 형태로 갱신 — 이 경우 `resourceType` 별 분기(`execution` vs `schedule` vs `background_run`)로 라우팅 세분화 필요. 이번 target 커밋 범위에서 최소한 `spec/2-navigation/_layout.md` §3.1 표의 "resource_id = workflow id" 주석과 `8-notifications.md` §1.1 의 실제 필드값 중 하나를 수정해 두 문서 간 모순을 없애야 한다.

- **[INFO]** `resource_type='execution'` 키 공간이 `background_failed` 옛 fallback과 공유됨 — 이미 문서 내 인지·완화됨
  - target 신규 식별자: `execution_failed` 의 `resourceType='execution'`
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` 가 `hasRunId` 가 false 인 경우(구 fallback) `resourceType`(background_failed 경로)에 `executionId` 를 쓸 수 있음(§2.1 코멘트) — 동일 `(resource_type='execution', resource_id=<uuid>)` 키공간을 두 type 이 부분적으로 공유
  - 상세: target 문서(§1.1 execution_failed 행, §2.1 `findByResource` 주석)가 이미 "`background_failed` 옛 NodeExecution fallback 도 동일 값을 쓰므로 향후 `findByResource('execution', …)` 도입 시 두 계열이 같은 키공간을 공유함에 주의"라고 명시적으로 인지·기록하고 있어 신규 미인지 충돌은 아님. 다만 현재 소비처(`background-runs.service`)가 `background_run` 스코프로 한정돼 있어 당장 실질 충돌은 없다.
  - 제안: 별도 조치 불요 — 향후 `findByResource('execution', …)` 를 새 소비처가 도입할 때 이 노트를 참조하도록 유지.

## 요약

target 이 활성화한 알림 `type` 값(`execution_failed`/`schedule_failed`/`team_invite`)과 dispatcher 메서드명(`dispatchExecutionFailedNotification`/`dispatchScheduleFailedNotification`/`dispatchTeamInviteNotification`)은 모두 기존 DB CHECK 화이트리스트(V052/V070)·`1-data-model.md`·`_layout.md` 딥링크 표·`9-user-profile.md §5.1` 채널 표에 이미 예약되어 있던 식별자를 그대로 재사용한 것으로, ID/타입명 자체의 신규 충돌은 없다. 그러나 실제 필드 값 레벨에서 하나의 CRITICAL 충돌이 발견됐다 — `execution_failed`/`schedule_failed` 가 채우는 `resource_id`(execution id / schedule id)가 프런트 딥링크 라우팅 계약(`_layout.md` §3.1, `href.ts`)이 명시적으로 전제하는 "resource_id = workflow id" 의미와 어긋나, 알림 클릭 시 잘못된 workflow 상세 경로로 이동하는 실사용 결함으로 이어질 수 있다. 이 외 `resource_type='execution'` 키공간 공유는 이미 문서 내에서 인지·기록된 사항이라 추가 조치가 필요 없다.

## 위험도
HIGH
