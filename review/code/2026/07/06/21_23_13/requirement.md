# 요구사항(Requirement) Review — 알림 background_run_id attribution 분리 (V107)

## 발견사항

- **[WARNING]** `background_run_id` 가 "REST 응답 미노출 내부 전용 컬럼" 이라는 주석/DTO 설명이 실제 직렬화 동작과 불일치
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:718-723` (주석),
    `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts:34` (주석),
    `codebase/backend/src/modules/notifications/notifications.controller.ts` (`findAll`/`markAsRead` 핸들러),
    `codebase/backend/src/modules/notifications/notifications.service.ts:60-125` (`findAll`/`markAsRead` 가 raw `Notification` 엔티티 반환)
  - 상세: `NotificationDto` 클래스에는 의도적으로 `backgroundRunId` 필드를 넣지 않았고 주석·spec-update draft(`plan/in-progress/spec-update-notifications-background-run-id.md`)도 "내부 전용 컬럼, REST 응답 미노출"이라 명시한다. 그러나 `NotificationsController`/`NotificationsService.findAll`/`markAsRead` 는 TypeORM `Notification` 엔티티 인스턴스를 그대로 반환하며, 코드베이스 전역에 `ClassSerializerInterceptor` 나 다른 DTO 매핑 계층이 없다(확인: `grep -rn "ClassSerializerInterceptor" codebase/backend/src` 결과 0건). `@ApiOkPaginatedResponse`/`@ApiOkWrappedResponse` 는 Swagger 문서화 데코레이터일 뿐 런타임 필드 필터링을 하지 않는다. 따라서 실제 JSON 응답에는 `backgroundRunId` 가 그대로 노출된다. (다만 WS `notification.new` 이벤트(`emitNew`, notifications.service.ts:418-427)는 명시적 필드 매핑이라 이 채널은 실제로 누출되지 않는다 — 문제는 REST GET 경로에 한정.)
  - 이는 이번 PR 의 신규 회귀가 아니라 **모듈에 기존하던 패턴**(다른 raw 엔티티 필드들도 동일하게 이미 노출 중)이지만, 이번 변경이 "내부 전용, 비노출"이라는 새 문서/의도를 추가하면서 실제로 그 의도를 강제하는 코드(직렬화 계층)를 추가하지 않아 **의도와 구현 간 괴리**가 발생한다. 기능 저해는 없음(민감정보 아님, UUID 값 하나) — 심각도는 낮으나 spec-update draft 의 "REST 미노출" 서술은 사실과 다르므로 그대로 spec 에 반영되면 spec 도 부정확해진다.
  - 제안: (a) `ClassSerializerInterceptor` + `@Exclude`/`@Expose` 도입까지는 과하다면 최소한 `findAll`/`markAsRead` 응답을 `NotificationDto` 로 명시적으로 매핑(예: `plainToInstance` 또는 수동 매핑 함수)하거나, (b) spec-update draft·주석에서 "REST 응답 미노출" 표현을 "현재 응답 DTO 계약(`NotificationDto`)에는 미포함, 다만 런타임상 raw 필드 직렬화 여부는 별도 확인 필요"로 완화. 이번 PR 스코프에서 반드시 고쳐야 하는 CRITICAL 은 아니지만, spec 반영 전에 정정 권고.

- **[INFO]** `spec/data-flow/8-notifications.md` §1.1(`background_failed` 행, L67)·§2.1(L89 attribution 조회 행) 및 `spec/1-data-model.md §2.19`(L722-723 필드 표), `spec/4-nodes/1-logic/12-background.md §8.2`(L248) 는 여전히 구코드 서술(`resource_type='background_run'`/`findByResource` 단일 표면, `background_run_id` 컬럼 부재)을 유지하고 있어 코드와 spec 본문이 현재 line-level 로 불일치한다.
  - 이는 `[SPEC-DRIFT]` 가 아니라 **의도적으로 아직 미반영 상태**로 취급해야 한다 — `plan/in-progress/spec-update-notifications-background-run-id.md` 가 정확히 이 5개 갱신 대상(§2.1/§1.1/Rationale/§2.19/12-background §8.2)을 이미 열거하고 planner 위임을 명시했으며, `notif-hardening-followups.md` 체크리스트도 "spec-update draft → planner 위임" 을 완료로 표시했다. 즉 코드가 옳고 spec 미반영은 다음 단계(`project-planner`)로 이미 정확히 큐잉되어 있다.
  - 상세 확인: `spec/data-flow/8-notifications.md:67` (`background_failed` 행에 resource_type/resource_id/attribution 계약 없음), `:89` (`findByResource` 로 표기, 실제는 `findByBackgroundRun`), `spec/1-data-model.md:722-723`(background_run_id 필드 없음), `spec/4-nodes/1-logic/12-background.md:248`(attribution 방식 미서술).
  - 제안: 코드 변경 불필요. `project-planner` 가 `spec-update-notifications-background-run-id.md` 의 flip 항목 5건을 실행하면 해소.

- **[INFO]** `spec/2-navigation/_layout.md §3.1` (L120) 은 이미 `execution_failed`·`background_failed`·`schedule_failed` 모두 `resource_id = workflow id` 딥링크 계약을 명시하고 있고, 프론트 `codebase/frontend/src/lib/notifications/href.ts` 역시 이미 이 세 타입을 동일하게 `/workflows/<resourceId>` 로 라우팅한다. 즉 본 PR 은 프론트/딥링크 spec 을 바꾸지 않고 백엔드가 그 기존 계약을 뒤늦게 만족시키는 방향 — 코드가 spec 을 따라잡는 정상적 결함 수정이다 (spec 변경 불요).

## 검증 결과 (통과)

- `background-execution.processor.ts`: `dispatchFailureNotification` 이 `resourceType: 'workflow'`/`resourceId: data.workflowId` 를 항상 채우고 `backgroundRunId: data.backgroundRunId || undefined` 로 빈 문자열(legacy NodeExecution)을 `undefined` 로 정규화 → `NotificationsService.notify/createMany` 의 `if (entry.backgroundRunId)` 트루시 체크와 맞물려 컬럼이 `NULL` 로 정확히 남는다. `BackgroundExecutionJob.workflowId` 는 `string`(non-optional, `background-execution.queue.ts:35`) 이므로 "workflowId 는 항상 존재" 주장이 타입 레벨로 보증됨 — 엣지 케이스(옛 NodeExecution, backgroundRunId 빈 문자열) 처리 정확.
- `NotificationsService.findByBackgroundRun`/`notify`/`createMany`: `findByResource` 잔존 호출부 없음(`grep -rn "findByResource" codebase/backend/src` 0건 확인) — dual-write / 참조 누락 없음.
- `notification.entity.ts`/migration V107: nullable UUID 컬럼 + partial index, `ADD COLUMN`+`CREATE INDEX` 동봉 근거(신규 컬럼 전량 NULL) 타당. `V047` 인덱스와의 네이밍 유사성도 주석으로 명확히 구분.
- unit/e2e 테스트(`background-execution.processor.spec.ts`, `background-runs.service.spec.ts`, `background-monitoring.e2e-spec.ts`, 신규 `execution-failed-notification.e2e-spec.ts`)가 새 계약(딥링크=workflow, attribution=background_run_id, 옛 fallback 제거)을 정확히 반영. `execution-failed-notification.e2e-spec.ts` 는 `!parentExecutionId` 게이트(Background 본문 실패 시 `execution_failed` 미발사)까지 통합 검증 — spec L71 (`execution_failed` 행의 `!parentExecutionId` 서술)과 line-level 일치.
- 마이그레이션 채번(V107)이 최신(V106) 다음으로 충돌 없음.
- TODO/FIXME/HACK/XXX 주석 없음. 미완성 표시 없음(단, tracker `notif-hardening-followups.md` 항목 3 은 "결정 대기"로 명시적 OPEN 상태 — 이번 PR 범위 밖이라고 스스로 밝히고 있어 은폐된 미완성이 아님).

## 요약

핵심 변경(딥링크 resource_type/resource_id=workflow 와 attribution 전용 `background_run_id` 컬럼 분리)은 기존 결함(팝오버 클릭 시 404)을 정확히 겨냥했고, 프로세서·서비스·엔티티·마이그레이션·테스트(unit+e2e) 전 계층에서 일관되게 구현되어 있으며 엣지 케이스(빈 backgroundRunId, legacy NodeExecution)도 정확히 처리한다. `_layout.md §3.1` 딥링크 계약과도 line-level 로 정합한다. 다만 `background_run_id` 를 "REST 응답 미노출 내부 전용" 이라고 주석·spec-update draft 에 명시했음에도 실제로는 `NotificationsController`/`NotificationsService.findAll`/`markAsRead` 가 raw 엔티티를 그대로 반환해(직렬화 필터 계층 부재) 해당 필드가 REST 응답에 그대로 노출될 개연성이 있어 의도-구현 간 괴리가 있다 — 기능·보안상 치명적이진 않으나 spec 반영 전 정정을 권고한다. `spec/data-flow/8-notifications.md §1.1/§2.1`, `spec/1-data-model.md §2.19`, `spec/4-nodes/1-logic/12-background.md §8.2` 는 아직 구코드 서술 상태이나, 이는 plan(`spec-update-notifications-background-run-id.md`)이 이미 정확히 큐잉한 후속 작업이라 결함이 아니다.

## 위험도
LOW
