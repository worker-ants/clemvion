# Cross-Spec 일관성 검토 — priority 3-tier (`triggerType` threading)

## 검토 대상

- 구현 예정: `execute()` 가 `ExecuteOptions` 를 통해 `triggerType`(`manual`/`webhook`/`schedule`)을 받아
  `resolveExecutionRunPriority(triggerType)` 에 그대로 threading. webhook·schedule 호출부가
  `trigger.type` 을 전달.
- 관련 SoT: `spec/5-system/4-execution-engine.md` §4.2(PR1 jobId·triggerType 구현 메모) / §4.3(수평 확장,
  우선순위 표) / §8(동시성 cap, admission gate 절 중 "priority 3-tier 는 별도 후속" 서술), `spec/1-data-model.md`
  §2.8 Trigger(`type` enum), `spec/data-flow/3-execution.md`(priority 설명), `spec/data-flow/10-triggers.md`
  (execution-run job 설명), `plan/in-progress/exec-intake-followups.md`(추적 항목).
- 코드 현황 확인: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  (`ExecuteOptions` 판별 유니온, `execute()` L3164-3254, TODO(PR2) 주석), `.../queues/execution-run.queue.ts`
  (`EXECUTION_RUN_PRIORITY`, `resolveExecutionRunPriority` — 이미 3-tier 구현·테스트 완료), `hooks.service.ts`
  (webhook·chat-channel 두 `execute()` 호출부, 둘 다 `trigger` 엔티티 보유), `schedule-runner.service.ts`
  (cron 발화, `{ triggerId: schedule.triggerId }`), `schedules.service.ts`(`runNow`, `{ executedBy: userId }`),
  `executions/utils/execution-trigger.ts`(`deriveExecutionTrigger` — 이미 `execution.trigger.type` 참조 선례).

## 발견사항

- **[INFO] `resolveExecutionRunPriority` 는 이미 3-tier로 구현/테스트되어 있음 — 남은 갭은 호출부 threading 뿐**
  - target 위치: 계획 서술("execute() 는 triggerType 을 ExecuteOptions 로 threading")
  - 충돌 대상: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` L27-46,
    `execution-run.queue.spec.ts`
  - 상세: `EXECUTION_RUN_PRIORITY`/`resolveExecutionRunPriority`/`ExecutionRunTriggerType` 은 이미
    `manual=1 < webhook=2 < schedule=3` 3-tier 로 구현되어 유닛 테스트도 통과 중이다. `execute()` 내부에서만
    `const triggerType = options?.executedBy ? 'manual' : 'webhook'` (L3242) 로 2-tier 로 뭉개고 있다.
    즉 이번 작업은 "3-tier 알고리즘 신설"이 아니라 "이미 있는 3-tier 함수에 정확한 인자를 공급"하는
    좁은 threading 작업이다 — spec §4.2 PR1 구현 메모의 TODO(PR2) 주석과 정확히 일치하므로 스펙-코드
    정합성 자체는 이미 맞다. 구현 시 이 사실을 재발명(다른 우선순위 상수·다른 매핑 함수 신설)하지
    않도록 주의.
  - 제안: 없음(정보 확인용). `resolveExecutionRunPriority` 재사용, 신규 매핑 로직 추가 금지.

- **[INFO] `Trigger.type` 어휘(`webhook`/`schedule`/`manual`)와 `ExecutionRunTriggerType`
  (`manual`/`webhook`/`schedule`) 키가 이미 1:1 정렬**
  - target 위치: `ExecuteOptions.triggerId` variant → `triggerType` 필드 신설 예정 지점
  - 충돌 대상: `spec/1-data-model.md` §2.8 Trigger(`type` enum: `webhook / schedule / manual`),
    `execution-run.queue.ts` L24-31 주석("값은 `Trigger.type` enum 어휘를 그대로 사용")
  - 상세: 어휘 충돌 없음 — `Trigger.type` 의 3개 값이 `EXECUTION_RUN_PRIORITY` 키와 정확히 대응한다.
    다만 `Trigger.type` 은 `manual` 값도 이론상 가질 수 있는 enum 이나(§2.8 표), 실제 `manual` 타입
    Trigger row 가 존재하는지는 `4-nodes/7-trigger/1-manual-trigger.md` 확인 필요 — `execute()`
    판별 유니온에서 `manual` 은 `executedBy` variant(트리거 없음)로만 분류되므로, `triggerId` variant
    에서 `trigger.type === 'manual'` 인 경우가 실제로 발생하는지(예: 수동 트리거 노드를 가진 워크플로우가
    schedule/webhook 경로로 호출되는 등)는 스펙상 명확히 배제되어 있지 않다. threading 구현 시
    `triggerId` variant 의 `triggerType` 타입을 `'webhook' | 'schedule'` 로 좁힐지, `Trigger.type` 전체
    (`'webhook'|'schedule'|'manual'`)를 받아들일지 결정이 필요하다 — 현재 판별 유니온 설계(주석 L362-365)와
    의미가 겹치므로 타입 정의 시 주의.
  - 제안: `ExecuteOptions` 의 `triggerId` variant 에 `triggerType?: 'webhook' | 'schedule'` 로 좁혀 정의하고,
    `resolveExecutionRunPriority` 에는 `options?.executedBy ? 'manual' : options?.triggerType` 형태로
    전달 — 판별 유니온의 "executedBy/triggerId 상호배타" 불변식과 자연스럽게 합성된다.

- **[INFO] `runNow`(schedule "즉시 실행") 는 `executedBy` variant 로 분류되어 계속 `manual` priority 를
  받음 — 의도된 동작이나 3-tier 문서 서술과 이름이 어긋날 여지**
  - target 위치: `ExecuteOptions.executedBy` variant, threading 범위
  - 충돌 대상: `codebase/backend/src/modules/schedules/schedules.service.ts` L263-266(`runNow`)
  - 상세: `runNow` 는 스케줄을 사용자가 수동으로 즉시 실행시키는 API(`POST .../run-now` 류)이며 현재도
    `{ executedBy: userId }` 로 `execute()` 를 호출한다 — `deriveExecutionTrigger` 도 이를 `manual` 로
    분류한다(§execution-trigger.ts L55-59, `parentExecutionId` 다음으로 `executedBy` 우선). 이는 threading
    대상(`trigger.type` 전달)이 아니라 기존에도 `manual` 취급이었으므로 **회귀는 아니다**. 다만 "webhook/schedule
    호출부가 trigger.type 전달" 이라는 이번 작업 설명만 보면 `schedules` 모듈의 두 호출부(cron 자동 발화
    `schedule-runner.service.ts` vs 사용자 "지금 실행" `schedules.service.ts`) 중 하나만 대상이라는 점이
    잘 드러나지 않는다 — 구현자가 `runNow` 도 `triggerId` 로 바꿔야 한다고 오인하면 "즉시 실행"의 최우선
    순위(`manual`)가 `schedule` 로 격하되는 실질적 회귀가 발생한다.
  - 제안: 구현 시 `schedules.service.ts::runNow` 는 **변경 대상에서 명시적으로 제외**(계속 `executedBy`)하고,
    `schedule-runner.service.ts::process`(cron 자동 발화, `{ triggerId: schedule.triggerId }`)만
    `triggerType: 'schedule'` 을 추가하도록 plan/PR 설명에 범위를 명확히 기술.

- **[INFO] chat-channel 인바운드도 동일 `triggerId` variant 경로 — `trigger.type` 은 항상 `'webhook'`**
  - target 위치: threading 대상 호출부 목록
  - 충돌 대상: `codebase/backend/src/modules/hooks/hooks.service.ts` L614-635(chat-channel 새 실행 시작),
    `spec/1-data-model.md` §2.8 Trigger 주석("chat-channel 은 별도 type 이 아니라 webhook 트리거의
    `config.chatChannel` 변형")
    `spec/5-system/15-chat-channel.md`
  - 상세: `hooks.service.ts` 에는 webhook 트리거(L195)와 chat-channel 트리거(L614) 두 개의 `execute()`
    호출부가 있고 둘 다 `{ triggerId: trigger.id, ... }` 형태다. chat-channel 트리거의 `Trigger.type` 은
    spec상 `webhook` 이므로(별도 `chat_channel` enum 값 없음) `trigger.type` 을 그대로 전달하면 자동으로
    `webhook` priority 를 받는다 — 데이터 모델과 정합. 별도 분기 코드 불필요, 두 호출부 모두 동일하게
    `triggerId: trigger.id, triggerType: trigger.type` 을 추가하면 충분.
  - 제안: 없음(정합 확인). 구현 시 두 호출부(webhook·chat-channel) 모두 동일 패턴 적용 확인.

- **[INFO] EIA(External Interaction API)는 `execute()` 를 호출하지 않음 — threading 범위 밖 확인**
  - target 위치: 과제 설명의 "EIA/execute path" 언급
  - 충돌 대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts`
  - 상세: EIA 는 `continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`
    만 호출하며 이들은 신규 job 을 enqueue 하지 않는 재개(continuation) 경로다(§7.4 `execution-continuation`
    큐, 별도 priority 체계 없음 — 이 큐는 우선순위 개념이 spec 에 없다). 따라서 EIA 는 이번 priority 3-tier
    threading 의 대상이 아니며, "EIA/execute path" 라는 표현은 실행을 "시작"하는 execute() 경로가 아니라
    EIA 가 트리거하는 최초 webhook 발화(hooks.service.ts L195, EIA 전용 트리거도 결국 webhook 타입)를
    가리키는 것으로 해석해야 스펙과 합치한다.
  - 제안: 리뷰/PR 설명에서 "EIA" 언급 시 continuation 경로(비대상)와 최초 webhook 발화(대상)를 구분해
    명시 — 향후 리뷰어 혼선 방지.

## 요약

`resolveExecutionRunPriority` 3-tier 함수 자체와 `Trigger.type` 어휘(`webhook`/`schedule`/`manual`)는 이미
spec·코드 양쪽에서 정확히 정의·정렬되어 있고, 이번 작업은 그 함수에 정확한 `triggerType` 인자를 공급하는
좁은 threading 변경이다. 진짜 cross-spec 모순(CRITICAL/WARNING 급)은 발견되지 않았다 — `spec/5-system/4-execution-engine.md`
§4.2/§4.3, `spec/1-data-model.md` §2.8, `spec/data-flow/3-execution.md`, `spec/data-flow/10-triggers.md`,
`plan/in-progress/exec-intake-followups.md` 가 서로 같은 목표·같은 어휘로 이 갭을 기술하고 있다. 다만 실제
호출부가 4곳(webhook, chat-channel, cron schedule, schedule runNow)으로 나뉘어 있고 이 중 `runNow`는
의도적으로 `manual` 로 남아야 하는 예외이므로, 구현 범위를 "webhook·chat-channel·cron-schedule 발화 3곳만
`trigger.type` 을 추가 threading, `runNow`는 그대로 `executedBy` 유지"로 명확히 하는 것이 유일한 실질
액션 아이템이다(INFO 등급 — spec 자체 모순이 아니라 구현 시 오인 방지용 안내).

## 위험도

LOW

BLOCK: NO

Critical: 0
Warning: 0

STATUS: SUCCESS
