---
worktree: exec-limits-refactor-ef170a
started: 2026-07-04
owner: developer
spec_impact:
  - none
---

# exec-limits 리팩터 묶음 (ARCH#4·ARCH#6·MAINT#9) — 동작 보존

`exec-intake-followups.md` "곁들임 INFO 리팩터 묶음" 중 **execution-limits 응집 관련 3건**. ai-review 누적 INFO. 전부 동작 보존(문자열/값/로직 무변경 — MAINT#9 만 문서화된 strict 계약으로 정합).

## 스코프 결정: ARCH#5 는 별도 후속으로 분리

ARCH#5(engine 에러코드 레이어 분리)는 **`nodes/core/error-codes.ts` 의 공용 `ErrorCode`(모든 노드 핸들러+엔진 소비)를 재편**하는 모듈 경계 리팩터로, (a) 파일 분리 vs in-file 그룹핑 설계 결정, (b) 하드코딩 엔진 문자열(`EXECUTION_QUEUE_WAIT_TIMEOUT`·`WORKER_HEARTBEAT_TIMEOUT`) enum 편입 + 소비처 import 리다이렉트를 수반한다. blast radius·리뷰 집중을 위해 본 저위험 묶음과 분리 — `exec-intake-followups.md` 에 ARCH#5 후속 항목으로 남긴다.

## 항목

- **ARCH#4** — `resolveExecutionRunWorkerConcurrency` + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`(+JSDoc)를 `queues/execution-run.queue.ts` → `execution-limits.ts` 이관(동시성 한도 로직 응집). import 갱신: `execution-run.processor.ts`·`system-status.constants.ts`. 테스트 이관: `execution-run.queue.spec.ts` 의 해당 describe → `execution-limits.spec.ts`. 순수 함수(process.env only)라 순환 의존 없음.
- **ARCH#6** — `execution-limits.ts` 파일 JSDoc 을 PR2a 한정 서술에서 **모듈 경계 서술**(전 resolve* 한도 파서 응집)로 확장.
- **MAINT#9** — `system-status.constants.ts` 의 continuation concurrency 를 inline `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1`(loose)에서 기존 canonical `resolveContinuationWorkerConcurrency()`(strict, 이미 존재) 재사용으로 통일. executionRun 은 이미 canonical resolver 사용 — 둘 다 canonical 로 일원화. 비정수 env 의 edge 동작이 loose-accept → 문서화된 fallback(1)로 정합(계약 준수, spec §11/env 표 "비정수→1" 이미 명시).

## 체크리스트

- [x] impl-prep consistency (spec/5-system/) — 5/5 BLOCK: NO (23_21_53)
- [x] TDD: ARCH#4 테스트 execution-run.queue.spec → execution-limits.spec 이관. MAINT#9 strict 파싱은 기존 resolveContinuationWorkerConcurrency own-spec 이 커버(delegate).
- [x] 구현 (ARCH#4 이관 + ARCH#6 모듈 JSDoc + MAINT#9 canonical resolver 재사용)
- [x] TEST WORKFLOW (lint·unit·build·e2e(235))
- [x] ai-review (23_38_59 9-reviewer Critical/Warning 0) + impl-done consistency (23_38_26 5/5 BLOCK: NO)
- [x] PR
