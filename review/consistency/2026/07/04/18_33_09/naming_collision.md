# 신규 식별자 충돌 검토 — priority 3-tier (`ExecuteOptions.triggerType`)

검토 모드: `--impl-prep` (구현 착수 전), scope=`spec/5-system/`
실제 구현 대상: `plan/in-progress/exec-intake-followups.md` 의 "priority 3-tier (webhook/schedule 세분화)" 항목 — `ExecuteOptions` 에 `triggerType` 필드 신설 + `execute()` 호출부에서 `resolveExecutionRunPriority(triggerType)` 로 threading.

> 참고: 전달된 `_prompts/naming_collision.md` payload 는 `spec/5-system/1-auth.md`·`10-graph-rag.md`·루트 corpus 문서 위주로 구성되어 있고 실제 대상 파일인 `spec/5-system/4-execution-engine.md`(§4.3/§8, PR1 잔여 TODO 지점)는 payload 안에 포함돼 있지 않았다. 이에 따라 저장소 원본(`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md §2.8`, `spec/data-flow/3-execution.md`, `codebase/backend/src/modules/execution-engine/**`, `plan/in-progress/exec-intake-followups.md`)을 직접 조회해 실제 신규 식별자 충돌 여부를 검토했다.

## 발견사항

- **[INFO]** `ExecuteOptions.triggerType` — 사전 배선된(pre-wired) 계획된 식별자, 충돌 없음
  - target 신규 식별자: `ExecuteOptions.triggerType` (신설 예정 필드, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:367-394` 유니온 타입에 추가될 예정)
  - 기존 사용처: 같은 이름의 **지역 변수**가 이미 `execution-engine.service.ts:3242`(`const triggerType = options?.executedBy ? 'manual' : 'webhook';`)와 `queues/execution-run.queue.ts:40`(`resolveExecutionRunPriority(triggerType: ExecutionRunTriggerType | undefined)`)에 존재. 값 어휘(`manual`/`webhook`/`schedule`)는 `spec/1-data-model.md §2.8 Trigger.type` enum 과 완전히 일치하도록 **의도적으로 맞춰 설계**되어 있다(`execution-run.queue.ts:24-25` 주석: "값은 `Trigger.type` enum 어휘를 그대로 사용한다 (naming collision 회피)").
  - 상세: 이는 충돌이 아니라 **의도된 재사용**이다. PR1 단계에서 이미 `EXECUTION_RUN_PRIORITY` 상수·`ExecutionRunTriggerType` 타입·`resolveExecutionRunPriority()` 함수가 3-tier 값을 받을 준비가 완료돼 있고(`execution-run.queue.ts:27-46`), `execution-engine.service.ts:3239` 의 `TODO(PR2): trigger type threading — ExecuteOptions 에 triggerType 필드 추가 시` 주석이 정확히 이 필드명을 예고하고 있다. `plan/in-progress/exec-intake-followups.md` 도 동일 식별자(`ExecuteOptions.triggerType`)로 항목을 기술한다. 즉 spec·코드·plan 3곳이 동일 이름을 동일 의미로 이미 합의한 상태 — 신규 도입 시 그대로 채택하면 된다.
  - 제안: 변경 불필요. 필드 신설 시 기존 지역 변수(`execution-engine.service.ts:3242`)를 `options?.triggerType` 참조로 대체(또는 fallback 유지)하는 리팩터만 수행하면 된다.

- **[INFO]** 프런트엔드 `TriggerType` (`"webhook" | "schedule" | "manual"`) 과 백엔드 `ExecutionRunTriggerType` — 동일 값 집합, 별도 네임스페이스
  - target 신규 식별자: 없음(참고용 — `triggerType` 필드 도입 시 타입 참조 후보)
  - 기존 사용처: `codebase/frontend/src/lib/types/trigger.ts:9` `export type TriggerType = "webhook" | "schedule" | "manual";` vs `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:33` `export type ExecutionRunTriggerType = keyof typeof EXECUTION_RUN_PRIORITY`.
  - 상세: 두 타입 모두 `Trigger.type` 값 집합을 그대로 반영하며 이름만 다르다(프런트 `TriggerType` vs 백엔드 `ExecutionRunTriggerType`). frontend/backend 는 별도 패키지·컴파일 단위이고 `codebase/packages/` 공유 패키지에는 `TriggerType` 참조가 없어 실질 컴파일 충돌은 없다. 다만 새 `ExecuteOptions.triggerType` 필드의 타입을 `ExecutionRunTriggerType` 대신 별도로 재정의하면 3번째 동의어가 늘어날 수 있다.
  - 제안: `ExecuteOptions.triggerType` 필드 타입은 기존 `ExecutionRunTriggerType`(`execution-run.queue.ts`)을 그대로 import 해 재사용 — 신규 타입 별칭을 만들지 말 것 (일관성 INFO, 차단 아님).

- **[INFO]** 큐 payload(`ExecutionRunJob`)에 `triggerType` 미포함 상태 유지 여부는 이번 필드 신설과 별개 확인 필요
  - target 신규 식별자: 없음(설계 확인 사항)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:411` "**triggerType 은 payload 에 싣지 않는다** … PR2(triggerType threading) 예정" / `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:131-134` `ExecutionRunJob { executionId; input?; }` (필드 없음).
  - 상세: 이 항목은 이름 충돌이 아니라 "값이 어디서 계산되는가"의 설계 확인이다 — `resolveExecutionRunPriority(triggerType)`는 **enqueue 시점**(`options`로부터 즉시 계산해 BullMQ `priority` 옵션에만 반영)에 호출되는 것으로 이미 설계돼 있고 job payload 자체에 필드를 싣지 않는다. 새 필드 도입 시 이 경계를 그대로 유지하면 `ExecutionRunJob` 스키마 변경(및 §9.2 `exec:run:seq` 관련 재검토) 자체가 불필요하다.
  - 제안: 구현 시 `ExecutionRunJob` 인터페이스에 `triggerType` 을 추가하지 말 것(기존 스코프 경계 유지) — naming collision 은 아니나 인접 리스크로 기록.

## 요약

이번 target(priority 3-tier, `ExecuteOptions.triggerType`)이 새로 도입하려는 식별자는 이미 PR1 단계에서 `EXECUTION_RUN_PRIORITY`/`ExecutionRunTriggerType`/`resolveExecutionRunPriority()` 형태로 코드에 선배선되어 있고, spec(`4-execution-engine.md` §4.2/§4.3, `data-flow/3-execution.md` §1.1)·plan(`exec-intake-followups.md`)·코드 주석(`TODO(PR2)`) 3곳이 동일 이름·동일 값 어휘(`Trigger.type` enum 재사용)로 이미 합의돼 있다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 6개 관점 전수 검색 결과 **다른 의미로 이미 쓰이는 동일 식별자는 발견되지 않았다** — 유일하게 주의할 점은 프런트엔드 `TriggerType` 과의 동의어 중복(별 네임스페이스라 실충돌 아님, INFO)과 `ExecutionRunJob` payload 범위를 건드리지 않도록 하는 설계 경계 유지뿐이다.

## 위험도

NONE

BLOCK: NO
Critical: 0
Warning: 0

STATUS: SUCCESS
