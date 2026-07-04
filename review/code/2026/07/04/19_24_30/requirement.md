# 요구사항(Requirement) Review

## 검토 대상

`priority 3-tier triggerType threading` (§4.3) — commit `1eefcca12`(feat) + `73af2682c`(ai-review 조치) + `190c4060f`(impl-done consistency 조치), diff base `origin/main`. payload 는 실제 diff 와 스코프 일치(mis-scope 없음 — `git diff origin/main...HEAD --stat` 로 교차검증, 41개 변경 파일 중 코드 6개는 payload 파일 1~6과 정확히 일치).

## 검증 절차

- `execution-run.queue.ts` 의 `EXECUTION_RUN_PRIORITY`/`resolveExecutionRunPriority`/`ExecutionRunTriggerType` 정의 확인.
- `execution-engine.service.ts:3245-3260` 의 `execute()` triggerType 판정 로직과 큐 enqueue 확인.
- `spec/5-system/4-execution-engine.md` §4.3(:415-423), §9.2/§9.3 관련 서술(:408-411), §8 admission gate 서술(:1071, :1090), 큐 카탈로그 표(:1139) 대조.
- `schedules.service.ts` `runNow()`(:245-269) 가 실제로 `{ executedBy: userId }` 로 `execute()` 를 호출하는지(트리거 없음) 확인 — spec 코멘트 "schedule 지금 실행 runNow 는 executedBy 경로" 주장 검증.
- `hooks.service.ts`(webhook §197, chat-channel §629), `schedule-runner.service.ts`(§163) 호출부의 `triggerType` 리터럴 threading 확인.
- `resolveExecutionRunPriority` 의 유일 호출부 확인(execution-engine.service.ts 1곳) → 내부 `undefined→schedule` fallback 이 실질 dead path 인지 검증.
- 관련 unit 테스트(execution-engine.service.spec.ts:3009-3040, hooks.service.spec.ts, schedule-runner.service.spec.ts) 의 3-tier 순서·fallback assertion 확인.

## 발견사항

없음 (no findings).

### 확인된 정합 사항 (기록용, 비발견)

- **manual>webhook>schedule 순서**: `EXECUTION_RUN_PRIORITY = { manual: 1, webhook: 2, schedule: 3 }` (execution-run.queue.ts:27-31) — BullMQ 규약(낮은 숫자=높은 우선순위)과 spec §4.3 표(:422) `manual > webhook > schedule` 서술이 정확히 일치. unit test(`execution-engine.service.spec.ts:3019-3039`)가 3-tier 순서를 명시적으로 assert.
- **executedBy 우선(precedence)**: `execute()` 의 `const triggerType = options?.executedBy ? 'manual' : (options?.triggerType ?? 'webhook')` (execution-engine.service.ts:3249-3251) — `executedBy` 가 존재하면 `triggerType`/`triggerId` 값과 무관하게 무조건 `manual`. `ExecuteOptions` 판별 유니온(:369-400)이 `executedBy` variant 에서 `triggerId?: never`/`triggerType?: never` 로 컴파일 타임에 동시 지정을 차단해 런타임에서 두 값이 충돌할 경로 자체가 없음. spec §9.2/§9.3 서술(:411) "`execute()` 는 executedBy 우선 판정" 과 line-level 일치.
- **runNow = manual**: `schedules.service.ts:263-267` `runNow()` 가 `execute(workflowId, {...}, { executedBy: userId })` 로 호출 — `triggerId` 를 전달하지 않으므로 `executedBy` variant 로 처리돼 `manual` priority 확정. spec 코멘트(execution-engine.service.ts:3245, 4-execution-engine.md:411) "schedule 지금 실행 runNow 는 executedBy 경로라 manual 유지" 주장이 코드로 실증됨.
- **webhook fallback**: `triggerId` 는 있으나 `triggerType` 미전달 시 `options?.triggerType ?? 'webhook'` 로 `'webhook'` fallback (비-HTTP 트리거 방어 의도, JSDoc:388-390 및 execution-engine.service.ts:3247 일치). unit test(`execution-engine.service.spec.ts:3041` 근방 "triggerType 미지정 → webhook fallback")가 fallback 케이스를 명시적으로 검증.
- **호출부 threading 완전성**: `hooks.service.ts` webhook 핸들러(§197) 와 chat-channel 핸들러(§629) 모두 `triggerType: 'webhook'` 리터럴 전달, `schedule-runner.service.ts`(§163)는 `triggerType: 'schedule'` 리터럴 전달 — 3개 실 호출부 모두 안전한 리터럴만 사용해 discriminated union 이 `triggerId` variant 에서 `ExecutionRunTriggerType`(manual 포함, JSDoc 의도보다 넓은 타입) 를 노출하더라도 런타임 오용 경로 없음.
- **payload 분리(§9.3 경계)**: `triggerType` 은 `executionRunQueue.add('execution-run', { executionId, input }, { priority: resolveExecutionRunPriority(triggerType), ... })` 에서 확인되듯 `ExecutionRunJob` payload(`{ executionId, input }`)에는 포함되지 않고 오직 BullMQ `priority` 옵션 계산에만 소비됨 — JSDoc·spec 서술과 정확히 일치.
- **spec 문서 갱신 완료**: `spec/5-system/4-execution-engine.md` §4.1-4.3 상태 배너(:379), §8 admission gate 서술(:1071, :1090), 큐 카탈로그 표(:1139) 모두 "priority 3-tier 구현 완료(2026-07-04)" 로 갱신돼 있어 이전 세션(`review/code/2026/07/04/19_02_17`)에서 지적된 W2/W3/W4(stale 2-tier 서술)가 실제로 해소됨. `plan/in-progress/exec-intake-followups.md:13` 체크박스도 `[x]` 로 반영.
- **fallback 비대칭은 실질 dead path**: `resolveExecutionRunPriority(triggerType: ExecutionRunTriggerType | undefined)` 내부의 `undefined → schedule` fallback(execution-run.queue.ts:39-46)과 `execute()` 의 `?? 'webhook'` fallback 이 다르지만, `resolveExecutionRunPriority` 의 프로덕션 호출부는 `execution-engine.service.ts:3257` 단 1곳뿐이고 그 호출은 항상 `execute()` 에서 이미 resolve 된 값(`'manual' | 'webhook' | 'schedule'`, 결코 `undefined` 아님)을 전달 — 코드 검증 결과 실질적으로 도달 불가능한 분기이며 이전 RESOLUTION 의 "dead path, 기능 영향 없음" 판정이 정확함.

## 요약

`priority 3-tier` (manual>webhook>schedule) 구현은 spec §4.3/§8/§9.3 이 요구하는 우선순위 순서·executedBy 우선 판정·runNow=manual 경로·webhook fallback 을 모두 line-level 로 정확히 충족한다. 이 세션은 이전 ai-review(`19_02_17`)에서 지적된 Warning 4건(주석 merge-artifact, spec 문서 3건 stale 서술)이 후속 커밋(`73af2682c`, `190c4060f`)으로 실제 해소됐음을 코드·spec 교차검증으로 재확인했으며, 신규 발견사항은 없다. discriminated union 의 타입 관대함(`triggerId` variant 의 `triggerType` 이 JSDoc 의도보다 넓음)과 `resolveExecutionRunPriority` 내부 fallback 비대칭은 실 호출부 검증 결과 런타임 무해한 dead code/타입 관대함으로 확인되어 발견사항으로 격상하지 않았다.

## 위험도

NONE

STATUS: SUCCESS
