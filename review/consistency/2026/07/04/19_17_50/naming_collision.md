# 신규 식별자 충돌 검토 — priority 3-tier (`ExecutionRunTriggerType` / `ExecuteOptions.triggerType`)

## 검토 범위 안내

전달받은 payload(`_prompts/naming_collision.md`)는 `spec/5-system/` 전체를 아우르는 대형 검색 코퍼스(인증·Graph RAG·overview·data-model·cafe24 등 다수 무관 섹션 포함) 였고, 정작 이번 target 식별자(`ExecutionRunTriggerType`, `ExecuteOptions.triggerType`)는 그 파일 안에서 단 한 줄도 등장하지 않았다. 이는 orchestrator 측 diff/target 번들링 오류로 보인다(잘못된 corpus 첨부).

호출자 프롬프트에 명시된 컨텍스트("new identifier `ExecutionRunTriggerType` usage + `ExecuteOptions.triggerType` field vs `Execution.triggerSource`")를 근거로, impl-done 규약에 따라 **워킹트리 절대경로**(`/Volumes/project/private/clemvion/.claude/worktrees/impl-priority-3tier-e3aa70`)에서 실제 코드·spec·diff(`origin/main...HEAD`)를 직접 확인해 검토를 수행했다.

## 확인한 사실관계

- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:20-33` — `EXECUTION_RUN_PRIORITY = { manual:1, webhook:2, schedule:3 }`, `export type ExecutionRunTriggerType = keyof typeof EXECUTION_RUN_PRIORITY`. 주석: "값은 `Trigger.type` enum(`spec/1-data-model.md §2.8`) 어휘를 그대로 사용한다 (naming collision 회피)". 이 파일은 이번 diff(`origin/main...HEAD`) 대상이 아니라 이전 PR(exec-intake-queue)에서 이미 존재.
- 이번 diff(`git diff origin/main...HEAD`, 커밋 `1eefcca12`+`73af2682c`)는 `ExecuteOptions.triggerType?: ExecutionRunTriggerType` 필드 추가 + `execution-engine.service.ts` 의 `execute()` 판정 로직(`executedBy` 우선 → `manual`, 아니면 `options.triggerType ?? 'webhook'`) + `hooks.service.ts`(`triggerType: 'webhook'` 2곳) + `schedule-runner.service.ts`(`triggerType: 'schedule'`) 호출부 threading + `spec/5-system/4-execution-engine.md` 문서 갱신만 포함. 범위가 작고 명확하다.
- `spec/5-system/4-execution-engine.md:392,411` — 코드 주석과 동일하게 "본 `triggerType` 은 priority 계산 전용 — 실행 이력 표시용 `Execution.triggerSource` 5-way 와는 별개 필드" 를 **명시적으로 문서화**하고 있다. `execution-engine.service.ts:392-397` 에도 동일 취지 주석(`⚠️ 실행 이력 표시용 파생 필드 Execution.triggerSource(5-way)와 다른 별개 필드`)이 있다.
- 기존 `Execution.triggerSource` (`codebase/backend/src/modules/executions/utils/execution-trigger.ts:12-20`) 는 `['manual','schedule','webhook','subworkflow','unknown']` 5종 — 실행 이력 화면 표시용 파생 필드(DTO `triggerSource`). `dashboard.service.ts`/`executions.service.ts`/`execution-response.dto.ts`/`dashboard-response.dto.ts` 에서 사용.
- 기존 `__triggerSource` (엔진 내부 마커, `spec/4-nodes/7-trigger/0-common.md`, `hooks.service.ts`/`schedule-runner.service.ts`/`workflows.controller.ts` 등) 는 `'manual'|'webhook'|'schedule'` 3종 — 트리거 노드 input payload 마커. `triggerType` 과 값 집합은 겹치지만(3종 vs 3종) 레이어·목적이 다르고, 소스 코드 상 두 필드명이 물리적으로 인접하는 지점(`hooks.service.ts` 197행 `__triggerSource: 'webhook'` / 200행 `triggerType: 'webhook'`)에도 각각 인라인 주석이 붙어 있어 혼동 방지 조치가 되어 있다.
- `Trigger.type` (`spec/1-data-model.md §2.8`, DB enum) = `webhook / schedule / manual` — `ExecutionRunTriggerType` 이 그대로 재사용하는 원본 어휘.
- 프론트엔드에 `TriggerType` (`codebase/frontend/src/lib/types/trigger.ts:9`) = `"webhook" | "schedule" | "manual"` 이 이미 존재 — `Trigger.type` 의 프론트엔드 미러. 이름이 `ExecutionRunTriggerType` 과 유사(`TriggerType` vs `...TriggerType`)하지만, `ExecutionRunTriggerType` 은 백엔드 `execution-engine` 모듈 내부 전용 타입이며 어떤 공개 API DTO/frontend 코드에도 노출되지 않는다(grep 확인 — frontend/DTO 어디에도 `ExecutionRunTriggerType` 미참조).
- 이번 PR 은 이미 `/ai-review` 1 회전을 거쳐 W1~W4 조치(커밋 `73af2682c`)가 반영된 상태다.

## 발견사항

- **[INFO]** `ExecutionRunTriggerType` / 프론트 `TriggerType` 명명 근접
  - target 신규 식별자: `ExecutionRunTriggerType` (`codebase/backend/.../execution-run.queue.ts:33`)
  - 기존 사용처: `codebase/frontend/src/lib/types/trigger.ts:9` `TriggerType = "webhook" | "schedule" | "manual"`
  - 상세: 두 타입 모두 `Trigger.type` 어휘(webhook/schedule/manual)를 공유하지만 레이어가 다르다(백엔드 priority 계산 전용 vs 프론트엔드 Trigger 엔티티 미러). 이름이 `...TriggerType` 접미어를 공유해 문서·리뷰에서 혼동 가능성이 있으나, `ExecutionRunTriggerType` 이 모듈 경계를 넘어 노출되지 않으므로 실질 충돌은 아니다.
  - 제안: 조치 불요. 필요시 두 타입 모두 "동일 어휘 재사용, 별개 정의"라는 취지의 주석이 이미 있으므로(코드/spec 양쪽) 현행 유지로 충분.

- **[INFO]** `triggerType` / `Execution.triggerSource` / `__triggerSource` 3-way 명명 계열
  - target 신규 식별자: `ExecuteOptions.triggerType`
  - 기존 사용처: `Execution.triggerSource` (5-way, `spec/2-navigation/14-execution-history.md`), `__triggerSource` (3-way 내부 마커, `spec/4-nodes/7-trigger/0-common.md`)
  - 상세: 세 식별자 모두 "트리거 관련" 이라는 점에서 이름이 유사군을 이루지만, 의미역(priority 계산 전용 vs 화면 표시 5-way vs 노드 input 마커)과 값 집합(3종 vs 5종 vs 3종)이 다르다. 이미 spec(`4-execution-engine.md:411`, `14-execution-history.md:511`)과 코드 주석(`execution-engine.service.ts:392`) 양쪽에서 "별개 필드" 임을 명시적으로 교차 참조하고 있어 CRITICAL/WARNING 급 충돌로 보지 않는다.
  - 제안: 조치 불요. 향후 4번째 유사 필드를 추가할 경우 동일한 교차 참조 주석 관행을 유지할 것을 권장.

CRITICAL/WARNING 급 발견사항 없음 — 요구사항 ID, API endpoint, 이벤트명, 환경변수, 파일 경로 관점에서도 이번 diff 범위 내 신규 충돌 없음(`ExecuteOptions.triggerType` 은 공개 API DTO 필드가 아니라 내부 서비스 옵션이며, 새 endpoint/env var/queue 이름 도입 없음).

## 요약

이번 target 은 `ExecuteOptions.triggerType`(신규 optional 필드) 과 이를 소비하는 `ExecutionRunTriggerType`(선행 PR 에서 이미 정의된 타입) 을 threading 하는 범위가 작은 변경이며, 실제 코드·spec 을 직접 대조한 결과 명명 충돌은 발견되지 않았다. 오히려 구현측이 사전에 "naming collision 회피" 를 명시한 주석을 남기고, `Execution.triggerSource`/`__triggerSource` 와의 의미 차이를 spec·코드 양쪽에 교차 문서화해 두어 신규 식별자 충돌 관점에서 모범적으로 처리된 사례다. `ExecutionRunTriggerType` 과 프론트엔드 `TriggerType` 간 이름 근접은 INFO 수준으로만 기록한다. 참고로 전달받은 payload 파일 자체는 target 내용을 담고 있지 않아 실제 검토는 워킹트리 코드/스펙 직접 대조로 대체 수행했다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
