# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` 구현 diff (exec-park D6 / full B3 — PR-B2b)
diff-base: origin/main

---

## 발견사항

### 발견사항 없음 — NONE

이 diff 의 모든 변경은 Rationale 에서 명시적으로 결정하고 문서화한 방향의 **구현 실현**이다.

---

## 상세 확인 항목

### 1. pendingContinuations Map + in-memory fast-path 제거

- target 위치: 테스트 전체 — `getPendings` 헬퍼 삭제, `pendingContinuations.set()` 직접 조작 코드 제거, `applyContinuation` 테스트 재작성
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — "B3: `pendingContinuations` Map(worker-side fast-path)은 park 가 곧 세그먼트 종료가 되어 불필요해져 제거된다"
- 판정: **정합** — Rationale 이 명시한 full B3 제거의 구현 반영이다. 기각된 대안("Map 유지 + sticky fast-path")을 재도입한 것이 아니라 반대로 제거하는 방향이다.

### 2. firstSegmentBarriers / armFirstSegmentBarrier / signalParkBarrier 제거

- target 위치: `describe('runExecutionFromQueue')` 내 배리어 3개 테스트 삭제 → `runExecution` 직접 await 단일 테스트로 대체
- 과거 결정 출처: 동일 Rationale "B3: `firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`·`pendingContinuations` Map … 모두 제거된다"
- 판정: **정합** — 기각된 대안(detached coroutine + 단발 배리어 메커니즘)을 재도입하지 않고 Rationale 결정대로 제거했다.

### 3. driveResumeDetached detach 모델 → await 모델 전환

- target 위치: slow-path 재개 describe 블록 — `makeDeadlockGuard` → `makeCompletionGuard` 이름 변경 및 테스트 의미 변환 ("미반환이어도 worker 즉시 반환" → "await 한 뒤 정상 완결")
- 과거 결정 출처: Rationale "park 즉시 해제 + slow-path 일원화" — "D4 — 단발 turn 처리기(processAiResumeTurn)는 한 세그먼트만 처리하고 반환하므로 worker 슬롯 deadlock 위험이 없다", spec §4.x "구현 메모 — full B3: worker 는 `runExecution` 을 직접 await 한다"
- 판정: **정합** — 옛 detach 모델은 Rationale 에서 설명한 bounded-메모리 목표를 위해 채택됐다가, full B3 에서 단발 turn 처리기 도입으로 deadlock 위험이 없어지면서 await 모델로 교체됐다. 이는 Rationale 의 "D4 단발 turn → worker 슬롯 deadlock 없음" 결론을 코드에 반영한 것이다. Rationale §§4.x 구현 메모("worker 는 `runExecution` 을 직접 await") 가 이미 최종 상태를 기록하고 있다.

### 4. retryLastTurn / applyRetryLastTurn 테스트 삭제

- target 위치: `describe('retryLastTurn')` 7개 테스트 삭제, `describe('applyRetryLastTurn')` 전체 삭제 (구현 변경 diff 기준)
- 과거 결정 출처: Rationale "retryable error 종결 시 `_retryState` 보존 (R1 채택)" 및 "`failed → running` 재진입 전이" — retry 기능 자체는 기각된 안이 아니며 spec 에 여전히 유지된다.
- 잠재 확인 필요: 삭제된 테스트가 "retry 기능을 제거"한 결과인지, 아니면 "리팩터링된 API(`applyRetryLastTurn`)를 다른 describe 블록으로 이전"한 결과인지를 diff 에서 단독으로 확인할 수 없다. 그러나 diff 에서 `driveCallStackResume` / `driveResumeFrame` / `injectInvokerOutput` 을 검증하는 새 describe 블록(CRITICAL #1)이 동일 위치에 추가됐고, exec-park D6 spec 본문(§6.2 `resume_call_stack` 설명, §4.x 구현 메모)이 retry 기능 자체를 유지한다고 명시한다. 따라서 retry 기능 spec 결정(R1) 을 번복하지 않고 **구현 내부 구조 변경에 따른 테스트 재구성**으로 판단한다. 이 자체는 Rationale 위반이 아니다.

### 5. driveCallStackResume / driveResumeFrame / injectInvokerOutput 신규 테스트

- target 위치: `describe('driveCallStackResume / driveResumeFrame / injectInvokerOutput (CRITICAL #1)')` 신규 추가 (5 케이스)
- 과거 결정 출처: Rationale "exec-park D6 — 중첩 sub-workflow blocking durable 영속" — "direct-drive vs `executeInline` 재호출 (W2 SPEC-DRIFT)": `driveCallStackResume` 이 영속된 frames 를 따라 innermost frame 부터 직접 구동(bubble-up)하는 방식이 명시 결정됐고, "`executeInline` 재호출 기각" 이유가 Rationale 에 기록돼 있다.
- 판정: **정합** — 기각된 `executeInline` 재호출 방식이 아닌 `driveResumeFrame` 직접 구동 방식을 검증하는 테스트다. 새 테스트가 Rationale 의 결정을 강화하고 있다.

### 6. isolates body pendingContinuations under bgKey 테스트 삭제

- target 위치: background subgraph describe 내 `isolates body pendingContinuations under bgKey` 테스트 삭제
- 과거 결정 출처: Rationale full B3 — `pendingContinuations` Map 제거. 이 테스트는 bgKey 격리를 Map 에 직접 조작해서 검증했으므로 Map 제거 시 의미 없어진다.
- 판정: **정합** — Map 제거에 따른 자연 삭제이며 background 격리 설계(§3.3 spec) 자체를 기각하는 것이 아니다.

### 7. CALL_STACK_SCHEMA_VERSION 상수 참조 교체

- target 위치: `stageDurableResumeSnapshot` 테스트 — 하드코딩 `1` → `CALL_STACK_SCHEMA_VERSION` 상수 참조
- 과거 결정 출처: spec §6.2 "version 은 `CALL_STACK_SCHEMA_VERSION`(checkpoint 와 독립 — 별도 진화)"
- 판정: **정합** — Rationale 에 기록된 버전 독립 진화 원칙을 강화하는 변경이다.

---

## 요약

이번 diff(exec-park D6 + full B3, PR-B2b)는 `spec/5-system/4-execution-engine.md ## Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` 에서 단계별 롤아웃 계획으로 명시 결정된 내용의 최종 구현이다. 기각된 대안(sticky fast-path · detach coroutine · in-memory pendingContinuations Map · firstSegmentBarriers 배리어 체계 · `executeInline` 재귀 재호출)을 재도입한 부분은 없으며, 합의된 설계 원칙(bounded 메모리 · slow-path 일원화 · direct frame-drive · CALL_STACK_SCHEMA_VERSION 독립)을 따르고 있다. Rationale 연속성 관점의 위반 사항이 발견되지 않았다.

## 위험도

NONE
