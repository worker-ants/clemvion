# Cross-Spec 일관성 검토 — priority 3-tier (`triggerType` threading), impl-done 2차

## 검토 대상

- 구현 완료: `execute()` 가 `ExecuteOptions.triggerType`(`webhook`/`schedule`, `manual`은 `executedBy`로 판정)을
  받아 `resolveExecutionRunPriority(triggerType)`에 threading. 호출부 3곳 — `hooks.service.ts`(webhook,
  chat-channel 두 지점 모두 `triggerType: 'webhook'`) · `schedule-runner.service.ts`(cron 자동 발화,
  `triggerType: 'schedule'`). `schedules.service.ts::runNow`(사용자 "지금 실행")는 의도적으로 미변경
  (`executedBy` variant 유지 → `manual` priority).
- 코드 근거(절대경로, HEAD 워킹트리):
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L369-404(`ExecuteOptions`
    판별 유니온에 `triggerType` 추가), L3242-3260(`triggerType = options?.executedBy ? 'manual' :
    (options?.triggerType ?? 'webhook')` → `resolveExecutionRunPriority` 호출)
  - `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` L20-46(`EXECUTION_RUN_PRIORITY`
    `manual:1/webhook:2/schedule:3`, `ExecutionRunTriggerType`, `resolveExecutionRunPriority` — 이전 리뷰
    (18_33_09)가 확인한 대로 이미 3-tier로 구현·테스트되어 있었고, 이번 커밋은 호출부 threading만 추가), L131-134
    (`ExecutionRunJob` payload = `{executionId, input?}` — `triggerType` 미포함, spec 주장과 일치)
  - `codebase/backend/src/modules/hooks/hooks.service.ts` diff(두 `execute()` 호출부 모두 `triggerType: 'webhook'`)
  - `codebase/backend/src/modules/schedules/schedule-runner.service.ts` diff(`triggerType: 'schedule'`)
  - `codebase/backend/src/modules/schedules/schedules.service.ts::runNow` — diff 없음(`executedBy` 유지 확인)
  - `codebase/backend/src/modules/executions/utils/execution-trigger.ts` L12-20 — `ExecutionTriggerSource`
    (5-way: `manual/schedule/webhook/subworkflow/unknown`, 실행 이력 표시용) vs 신규
    `ExecutionRunTriggerType`(3-way, priority 계산 전용) 별개 확인
- 관련 spec: `spec/5-system/4-execution-engine.md` §4.2/§4.3/§8/§9.3(diff), `spec/data-flow/3-execution.md`(diff),
  `spec/data-flow/10-triggers.md`(diff), `spec/1-data-model.md` §2.8 Trigger(변경 없음, 이번 diff 범위 밖),
  `plan/in-progress/exec-intake-followups.md`(체크박스 완료 반영 확인).

## 발견사항

- **[INFO] 배너 정합성 — §4.3/§8/§9.3 세 지점 + data-flow 2개 문서가 동일 사실(구현 완료 2026-07-04)을
  일관되게 서술**
  - target 위치: `spec/5-system/4-execution-engine.md` §4(L411 PR1 메모), §8(L1068, L1087, L1090), §9.3(L1136)
  - 충돌 대상: `spec/data-flow/3-execution.md`(priority 절), `spec/data-flow/10-triggers.md`(execution-run
    job 표)
  - 상세: 5개 지점 모두 "manual(1) > webhook(2) > schedule(3)", "`ExecuteOptions.triggerType` threading",
    "`executedBy` 우선 판정", "구현 완료 2026-07-04"라는 동일 사실을 반복 서술하며 상호 모순이 없다. 코드
    (`execute()` L3249-3251, `resolveExecutionRunPriority`)와도 정확히 일치 — 이전 소스(18_33_09 리뷰)가
    지적한 "구현 시 오인 방지" 사항(runNow 제외, chat-channel도 webhook)이 실제 구현에 정확히 반영됐다.
    실질 충돌 없음, 확인용 INFO.
  - 제안: 없음.

- **[INFO] `Execution.triggerSource`(5-way, 표시용) vs 신규 `triggerType`(3-way, priority 전용) 네이밍
  근접 — 문서가 이미 명시적으로 구분**
  - target 위치: `spec/5-system/4-execution-engine.md` §4.2(L411) 괄호 각주 "본 `triggerType` 은 priority
    계산 전용 — 실행 이력 표시용 `Execution.triggerSource` 5-way 와는 별개 필드"
  - 충돌 대상: `codebase/backend/src/modules/executions/utils/execution-trigger.ts`
    (`ExecutionTriggerSource = manual|schedule|webhook|subworkflow|unknown`)
  - 상세: 두 필드 모두 "트리거 종류"를 다루지만 값 집합(3-way vs 5-way)과 목적(BullMQ priority 계산 vs 실행
    이력 UI 표시)이 다르다. 이번 diff는 이 구분을 스펙 본문에 명시적으로 각주로 남겨 향후 독자의 혼동을
    선제 차단했다 — 데이터 모델 충돌 없음(둘 다 `spec/1-data-model.md`의 컬럼이 아니라 애플리케이션 레벨
    파생/입력값). 등급 근거: 실질 리스크는 낮으나 두 유사 명칭 enum이 같은 모듈 경계(execution-engine/executions)
    안에 공존하므로 추후 리팩터링 시 grep 오인 가능성이 있어 INFO로 기록.
  - 제안: 없음(이미 각주로 충분히 완화됨). 향후 두 필드 중 하나를 리네임할 계획이 생기면 이 각주를 갱신.

- **[INFO] `plan/in-progress/` 잔존 문서 2건이 "priority 3-tier는 Planned/제외" 라는 이제는 stale한 서술을
  그대로 보유**
  - target 위치: (target 문서 자체 아님 — 인접 plan 문서)
  - 충돌 대상: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`(L14, L21, L37, L56 — "priority 3-tier
    제외/후속", "manual>트리거 2-tier 유지"), `plan/in-progress/spec-update-execution-engine-pr4.md`(L32 —
    "우선순위 3-tier는 여전히 Planned로 유지")
  - 상세: 두 문서는 각각 PR2b·PR4 시점에는 정확한 서술이었으나(그 시점엔 3-tier가 실제로 미구현), 이번
    PR(`impl-priority-3tier`)로 3-tier가 구현 완료되면서 두 문서의 해당 문장이 현재 상태와 어긋나게 됐다.
    두 문서 모두 `plan/in-progress/`에 남아 있어(완료 이관 안 됨) 신규 독자가 참조 시 "3-tier 미구현"이라는
    오래된 인상을 받을 수 있다. 다만 이들은 `spec/`이 아니라 `plan/`(작업 추적) 문서이므로 cross-spec
    CRITICAL/WARNING 대상은 아니며, spec 본문(§4.3/§8/§9.3)은 이미 정확히 갱신되어 있어 실질 SoT 충돌은
    없다.
  - 제안: 두 plan 문서가 아직 `in-progress`에 남아 있는 이유(잔여 작업 존재 여부)를 확인해, 완료됐다면
    `plan/complete/`로 이관하거나 최소한 해당 문장에 "(2026-07-04 이후 완료 — 상세는 exec-intake-followups.md)"
    각주를 추가. plan-lifecycle 관할이라 본 checker의 직접 수정 대상은 아님.

## 요약

이번 구현(`impl-priority-3tier-e3aa70`)은 이전 spec-only 리뷰(18_33_09)가 사전에 정확히 스코핑한 좁은
threading 변경 — `resolveExecutionRunPriority`(이미 3-tier로 구현되어 있던 함수)에 정확한 `triggerType`
인자를 공급하는 작업 — 을 그대로 실행에 옮겼다. `execution-engine.service.ts`의 실제 판정 로직
(`executedBy` 우선 → `manual`, 그 외 `options.triggerType ?? 'webhook'`)과 호출부 3곳(webhook·chat-channel·
cron-schedule)의 threading, `runNow` 의도적 제외가 모두 spec(§4.3/§8/§9.3) 및 data-flow 2개 문서(3-execution,
10-triggers)의 서술과 코드 사실 양쪽에서 정확히 일치한다. `ExecutionRunJob` payload에 `triggerType`을 싣지
않는다는 spec 주장, `Execution.triggerSource`(5-way, 표시용)와의 별개 필드 구분도 코드로 검증됐다. 데이터
모델(`spec/1-data-model.md` §2.8 Trigger)·RBAC·API 계약·상태 전이·계층 책임 어느 관점에서도 이번 diff와
모순되는 변경은 없다(이 영역들 자체가 이번 PR의 diff 범위 밖). 유일한 잔여 사항은 `plan/in-progress/`에
남아 있는 2건의 구 계획 문서가 이제는 stale한 "3-tier Planned" 서술을 보유한다는 INFO 수준 관찰이며,
이는 spec 자체의 모순이 아니라 plan lifecycle 정리 대상이다.

## 위험도

LOW

BLOCK: NO

Critical: 0
Warning: 0

STATUS: SUCCESS
