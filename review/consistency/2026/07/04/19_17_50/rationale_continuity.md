# Rationale 연속성 검토 — priority 3-tier (manual>webhook>schedule)

## 검토 범위

- target: `spec/5-system/4-execution-engine.md` (diff vs `origin/main`, §4.2/§4.3/§8/§9.3 우선순위 3-tier 서술 갱신)
- 대조 코드: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`ExecuteOptions`, `execute()`), `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`(`resolveExecutionRunPriority`), `codebase/backend/src/modules/schedules/schedules.service.ts`(`runNow`), `codebase/backend/src/modules/schedules/schedule-runner.service.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts`
- 대조 Rationale: `spec/5-system/4-execution-engine.md` `## Rationale` 전체(특히 "per-node task queue → execution-level intake 큐", "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)")
- 참고 커밋 이력: `5eabbfc0d`(PR2b spec, priority 3-tier 명시적 제외) → `1eefcca12`(본 구현, triggerType threading) → `73af2682c`(ai-review 조치)

## 발견사항

이번 변경이 기존 Rationale 에서 기각한 대안을 재도입하거나 합의 원칙을 위반하는 지점은 발견되지 않았다. 주요 확인 근거:

- **PR2b 시점의 명시적 스코프 분리가 그대로 존중됨**: PR2b Rationale(§Rationale "동시성 cap admission gate")은 "priority 3-tier 분리: `ExecuteOptions.triggerType` threading 은 ExecuteOptions·trigger payload·queue option 3레이어 변경이라 cap gate 와 직교 → 별도 후속 PR 로 분리해 각 리뷰 집중(사용자 결정)"이라고 **명시적으로 후속 예고**했다(`spec/5-system/4-execution-engine.md:1537`, 커밋 `5eabbfc0d` "priority 3-tier 제외"). 본 target 은 그 예고된 후속을 정확히 그 스코프(`ExecuteOptions.triggerType` threading)로 구현했고, §379/§1071/§1090/§1139 에 "구현 완료(2026-07-04, triggerType threading)"로 갱신하며 완료 사실을 기록했다 — "결정의 무근거 번복"에 해당하지 않는다(예고된 후속의 이행이지 번복이 아님).
- **`executedBy` 우선판정 · `runNow`=manual invariant**: `ExecuteOptions` 판별 유니온(`execution-engine.service.ts:368-403`)이 `executedBy`/`triggerId`(+`triggerType`) 동시 truthy 를 컴파일 타임 차단하고, `execute()`(`:3249-3251`)가 `options?.executedBy ? 'manual' : (options?.triggerType ?? 'webhook')` 로 executedBy 우선을 코드로 강제한다. `schedules.service.ts:263-267` 의 `runNow`는 `__triggerSource: 'schedule'`이면서 `{ executedBy: userId }`만 전달해 우선순위는 `manual`로 판정되고, 트리거 출처 표시(`Execution.triggerSource`)와 priority 계산용 `triggerType`이 **별개 필드**라는 spec 서술(§4.2 PR1 메모 · `execution-engine.service.ts:392` 주석)과 정확히 일치한다. 이는 §Rationale 의 "in-process 세그먼트 = 실행 1건" 등 기존 아키텍처 불변식과 충돌하지 않는다.
- **webhook fallback**: 호출부(hooks.service.ts, schedule-runner.service.ts)는 각각 `triggerType: 'webhook'` / `'schedule'`을 명시 전달하므로 실제 운영 경로에서 fallback 분기(`options?.triggerType ?? 'webhook'`)가 발화하는 경우는 "triggerId 는 있으나 triggerType 미전달"인 호출부 누락 상황 방어용이다. 이는 `resolveExecutionRunPriority(undefined)` 가 최저 우선순위 `schedule` 를 반환하는 것과 표면적으로 다른 값이지만(§4.3 PR1 메모: "미전달 시 `webhook` fallback" vs `execution-run.queue.ts:36`: "미상/누락은 가장 낮은 우선순위(schedule)로 둔다"), 실제로 `execute()` 는 `resolveExecutionRunPriority` 호출 **이전에** `triggerType` 을 이미 `'webhook'` 으로 확정해 넘기므로 `resolveExecutionRunPriority` 의 `undefined` 분기는 현재 유일한 호출 경로(`execute()`)에서는 도달하지 않는 방어적 코드다. 두 fallback 값의 불일치 자체는 Rationale 위반은 아니나 문서 정합성 관점의 잠재 혼선 소지가 있어 아래 INFO 로 남긴다.
- **discriminated union 및 mutual exclusivity**: 이 설계는 §Rationale 에 기록된 기존 원칙(예: "판별 유니온으로 실행 트리거 메타데이터의 동시 truthy 방지") 과 부합하며, 과거 결정을 뒤집는 지점이 없다.
- **per-node task queue 관련 무관성 확인**: priority 계산은 여전히 `execution-run` 큐 job 단위(§4.2 "execution-level 세그먼트")에서만 이뤄지고, per-node task queue 기각 결정(§Rationale "per-node task queue → execution-level intake 큐")과 무관하게 세그먼트 단위 우선순위 그대로 유지된다 — 기각 대안의 재도입 없음.

- **[INFO]** `resolveExecutionRunPriority(undefined)` 의 fallback 값(`schedule`, 최저 우선순위)과 spec §4.3 PR1 메모의 "미전달 시 `webhook` fallback" 서술이 문면상 다른 값을 가리킴
  - target 위치: `spec/5-system/4-execution-engine.md` §4.2 PR1 구현 메모(diff 라인, "미전달 시 `webhook` fallback") 및 §8 admission gate 절 동일 서술
  - 과거 결정 출처: 해당 문구 자체가 이번 diff 의 신규 추가분이라 "기존 Rationale" 충돌은 아니며, 코드 내부(`execution-run.queue.ts:36` 주석 "미상/누락은 가장 낮은 우선순위(schedule)로 둔다")와의 자기-정합성 문제
  - 상세: `execute()` 가 `triggerType` 을 `resolveExecutionRunPriority` 호출 전에 이미 `'webhook'` 으로 확정하므로 실제 동작은 spec 서술(webhook fallback)과 일치하고 회귀는 없다. 다만 `resolveExecutionRunPriority` 함수 자체의 방어적 fallback(`schedule`)이 "다른 값을 다른 곳에서 저마다 최종 fallback으로 표방"하는 모양새라, 향후 이 함수가 `execute()` 이외 경로(예: 신규 producer)에서 `triggerType=undefined` 로 직접 호출되면 spec 서술과 다른(schedule) 값이 나올 수 있다.
  - 제안: `execution-run.queue.ts` 의 주석을 "이 함수는 방어적 최종 fallback이며 실제 호출 경로(`execute()`)는 이미 `'webhook'` 으로 확정해 전달하므로 도달하지 않는다"로 명확히 하거나, spec §4.3/§8 서술에 "함수 자체의 내부 방어 fallback 은 `schedule`(더 보수적)이며 `execute()` 호출부 레벨의 fallback 은 `webhook`" 임을 한 문장으로 구분해 두 fallback 계층의 관계를 명시. Critical/Warning 은 아니며 문서 정합성 보완 수준.

## 요약

본 변경은 PR2b(§Rationale "동시성 cap admission gate")에서 사용자 결정으로 명시적으로 스코프 분리·예고했던 "priority 3-tier(`ExecuteOptions.triggerType` threading)" 후속을 정확히 그 스코프대로 구현한 것으로, 기각된 대안의 재도입이나 합의 원칙 위반, 무근거 번복은 발견되지 않았다. `executedBy` 우선판정과 `runNow`→`manual` 불변식은 코드(`ExecuteOptions` 판별 유니온, `schedules.service.ts runNow`)로 명확히 강제되며 spec 서술과 일치한다. 유일한 관찰 사항은 "webhook fallback"(spec 서술)과 "schedule fallback"(`resolveExecutionRunPriority` 내부 방어 코드)이라는 두 계층의 fallback 값이 문면상 다르게 보이는 점으로, 실질적으로는 현재 유일한 호출 경로가 이를 사전에 해소하므로 동작 회귀는 없고 INFO 수준의 문서 명확화 제안에 그친다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS