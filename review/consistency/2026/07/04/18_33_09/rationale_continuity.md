# Rationale 연속성 검토 — priority 3-tier (triggerType threading)

- 검토 모드: `--impl-prep`, scope=`spec/5-system/`
- 대상 작업: `plan/in-progress/exec-intake-followups.md` "priority 3-tier (webhook/schedule 세분화)" — `ExecuteOptions.triggerType` 옵셔널 필드 신설 + `execute()` 호출부 3-tier 우선순위 threading
- 검증 항목: (1) `schedules.runNow`(수동 즉시실행) = manual priority 유지 결정, (2) `ExecuteOptions.triggerType` 옵셔널 확장이 기존 Rationale 과 모순 없는지

## 발견사항

- **[INFO]** priority 3-tier 는 이미 Rationale 에 forward-declared 된 후속 — 신규 도입이 아님
  - target 위치: `plan/in-progress/exec-intake-followups.md` L13 "priority 3-tier (webhook/schedule 세분화)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → `### 동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)` 마지막 항 "**priority 3-tier 분리**: `ExecuteOptions.triggerType` threading 은 ExecuteOptions·trigger payload·queue option 3레이어 변경이라 cap gate 와 직교 → 별도 후속 PR 로 분리해 각 리뷰 집중(사용자 결정)."
  - 상세: 이 항목은 "기각된 대안의 재도입"이 아니라, PR2b 범위 결정 시점에 사용자가 명시적으로 **범위 밖으로 분리**하며 남긴 예고된 후속이다. `plan/in-progress/exec-intake-followups.md` 도 "PR2b 후속 (#801 RESOLUTION 기록)" 섹션에 동일 항목을 그대로 옮겨 추적 중이라 plan↔spec Rationale 간 정합이 맞다. `4-execution-engine.md` §4.3 "우선순위" 행("BullMQ job priority 로 manual > webhook > schedule")도 이미 3-tier 라벨을 목표로 명시해뒀고 §4.1 상단 구현 상태 메모에도 "우선순위 3-tier(webhook/schedule 세분화)만 여전히 Planned" 로 동일하게 기술되어 있다 — 3곳(§4.1 상태 메모·§4.3 표·§Rationale)이 서로 모순 없이 "2-tier 구현 완료 + 3-tier Planned"를 일관되게 가리킨다.
  - 제안: 별도 조치 불요. 구현 착수 시 새 Rationale 항목을 추가할 필요도 없다 — 이미 결정·예고된 후속이므로 구현 완료 후에는 §4.1/§4.3/§Rationale 의 "Planned" 표기만 해제(구현 완료 동기화)하면 된다.

- **[INFO]** `schedules.runNow` = manual priority 유지는 3개 문서에 걸쳐 일관되게 고정된 invariant — 이번 threading 작업이 반드시 보존해야 할 전제
  - target 위치: 계획된 구현(`ExecuteOptions.triggerType` 신설 + `resolveExecutionRunPriority(triggerType)`)이 참조할 판정 로직
  - 과거 결정 출처(3중 교차 확인):
    1. `spec/5-system/4-execution-engine.md` §6.1.1 "**Schedule '지금 실행'**: 사용자가 수동으로 즉시 실행 버튼을 누른 경우는 Manual 경로와 동일하게 `{ executedBy: userId }` 로 호출 — 출처는 `manual`."
    2. `spec/2-navigation/3-schedule.md` L135/L147 — `POST /api/schedules/:id/run-now` "즉시 실행 (manual 라벨로 기록)", `SchedulesService.runNow` → `executed_by = userId` → 출처 `manual`.
    3. `spec/2-navigation/14-execution-history.md` §2.4 "Trigger 출처 분류" 표 — 판정 우선순위가 표의 **위에서 아래 순서**이며, `manual`(= `executed_by != null`) 행이 `schedule`/`webhook`(= `trigger_id` 기반 `Trigger.type` 매칭) 행보다 **먼저** 온다. 즉 `executedBy` 존재가 `trigger_id`/`Trigger.type` 보다 우선한다는 것이 명시적 invariant.
  - 상세: `Trigger.type` enum 자체는 `webhook / schedule / manual` 세 값이지만(`1-data-model.md §2.8`), "지금 실행" 버튼으로 발화된 실행은 (schedule 트리거에 연결돼 있어도) `trigger_id` 만으로 분류되지 않고 `executedBy` 가 채워지므로 `manual` 로 분류된다 — 이는 우연이 아니라 §2.4 표의 판정 우선순위 규칙이 강제하는 결과다. `exec-intake-followups.md` L13 의 구현 메모("`ExecuteOptions.triggerType` 필드 신설 + execute() 호출부에서 `trigger.type`/`executedBy` **로 결정**해 전달")도 이 두 신호를 함께 참조하겠다고 명시해, `executedBy` 우선 판정을 이미 계승할 준비가 되어 있다.
  - 제안: 구현 시 `resolveExecutionRunPriority(triggerType)` 에 넘길 `triggerType` 값 자체를 **`executedBy` 존재 여부를 우선 반영해 도출**하도록(예: `executedBy` 있으면 무조건 `manual`, 없을 때만 `trigger.type` 참조) 명시적으로 코드/spec 화할 것을 권장한다. 만약 구현이 `Trigger.type` 컬럼값만으로 3-tier priority 를 매기고 `executedBy` 를 무시한다면(예: schedule 트리거 FK 가 있다는 이유로 `runNow` 를 `schedule` priority 로 강등), 이는 위 3개 문서가 공유하는 invariant 를 우회하는 설계가 되어 CRITICAL 로 격상될 사안이다. 현재 계획 문구(§exec-intake-followups.md L13)는 이 위험을 인지하고 있는 것으로 보이나, spec §4.3 우선순위 표에 "`triggerType` → priority 매핑" 이라고만 적혀 있어 `executedBy` 우선 규칙이 §4.3 자체에는 명시돼 있지 않다 — 구현 착수 시 §4.3 표 비고에 "runNow 등 `executedBy` 존재 케이스는 `Trigger.type` 과 무관하게 `manual` priority" 한 줄을 보강하면 향후 회귀를 예방할 수 있다(권장, 차단 아님).

- **[INFO]** `ExecuteOptions` 옵셔널 확장 자체는 기존 타입 설계 원칙과 충돌 없음
  - target 위치: `spec/5-system/4-execution-engine.md` §6.1.1 `ExecuteOptions` 타입 정의(L736-741)와 그 아래 안내문(L744)
  - 과거 결정 출처: 동일 절 L744 — "실제 `ExecuteOptions` 유니온에는 모드별 메타데이터 필드가 더 있으며 각자의 spec 이 SoT" (re-run 의 `reRunOf`/`chainId`/`dryRun`, webhook 의 `sourceIp`/`responseCode`, 단일 노드 실행의 `singleNodeId`/`previousExecutionId` 등 이미 옵셔널 필드로 계속 확장돼 온 전례)
  - 상세: `ExecuteOptions` 는 문서가 스스로 "공통 옵션만 보이는 예시 블록"이라고 선언하며 모드별 옵셔널 필드 확장을 이미 반복적으로 허용해온 구조다. `triggerType` 옵셔널 필드 추가는 이 기존 확장 패턴과 형태적으로 동일하며, 특정 Rationale 이 금지한 필드 형태(예: "payload 미포함" 원칙)와도 충돌하지 않는다 — 오히려 §4.1 PR1 구현 메모(L411)가 "`triggerType` 은 payload 에 싣지 않는다... payload 포함은 PR2(triggerType threading) 예정" 이라고 이미 이 필드의 미래 위치를 예고해뒀다.
  - 제안: 없음. 확장 자체는 문제 없음.

## 요약

이번 작업(priority 3-tier / `ExecuteOptions.triggerType` threading)은 기존 spec Rationale 이 **명시적으로 예고하고 범위를 분리해둔 후속**이며, 기각된 대안의 재도입이나 무근거 결정 번복에 해당하지 않는다. `schedules.runNow` 의 manual priority 유지는 `4-execution-engine.md` §6.1.1·`2-navigation/3-schedule.md`·`2-navigation/14-execution-history.md` §2.4 세 문서가 "executedBy 우선 판정"이라는 동일한 invariant 를 공유하며 뒷받침하고 있고, 계획 문서(`exec-intake-followups.md`)의 구현 메모도 이 신호(`trigger.type`/`executedBy`)를 함께 참조하겠다고 밝혀 계승 의도가 확인된다. `ExecuteOptions` 옵셔널 필드 확장 패턴도 기존 관례와 합치한다. 유일한 개선 여지는 §4.3 우선순위 표 자체에 "executedBy 우선" 규칙을 명문화해 향후 구현/리뷰에서 `Trigger.type` 단독 판정으로 회귀하지 않도록 하는 INFO 성격의 보완 제안이며, 이는 차단 사유가 아니다.

## 위험도

LOW

BLOCK: NO

Critical: 0
Warning: 0
Info: 3

STATUS: SUCCESS
