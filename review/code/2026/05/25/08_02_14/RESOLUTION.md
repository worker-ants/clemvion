# RESOLUTION — 08_02_14

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C5 | 코드 (testing) | c5d9d698 | `continuation-execution.processor.spec.ts` 신규 — 5개 dispatch 분기 + ack-and-discard + default exhaustiveness 검증 |
| W1 | 코드 (side_effect) | c5d9d698 | `void this.engine.applyCancellation(executionId)` fire-and-forget 의도 명시 + async 전환 시 await 복원 TODO 코멘트 |
| W4 | 코드 (architecture) | c5d9d698 | WS gateway 4개 핸들러 — `result.jobId === null` → `!result.queued` (ContinuationPublishResult.queued 추상화 사용) |
| W19 | 코드 (security) | c5d9d698 | `rehydrateAndResume` RehydrationError logger — structured params 사용, internal identifiers (executionId / nodeExecutionId / status) 를 메시지 본문에서 제거 |
| W20 | 코드 (security) | c5d9d698 | WS gateway 4개 핸들러 — `'Continuation enqueue failed (Redis unavailable)'` → `'Continuation could not be queued. Please try again.'` |
| W22 | 코드 (documentation) | c5d9d698 | `ContinuationPublishResult` JSDoc — `queued: false ↔ jobId: null` 불변 조건 명시 |
| W23 | 코드 (documentation) | c5d9d698 | `resumeFromCheckpoint` JSDoc — 'setImmediate 즉시 fire' → 'setImmediate polling 최대 50회' |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4777 passed)
- e2e   : 통과 (119/119)

## 보류·후속 항목

이하 항목은 본 PR 범위 외 follow-up plan 으로 이관 추적:

### 중위 우선순위 (후속 PR 권장)
- W2: `resumeFromCheckpoint` / `runExecution` graph build 코드 중복 — private helper 추출 (~30 LoC)
- W3: `forwardRef` 순환 의존성 (Processor ↔ EngineService) — `IContinuationDispatcher` 인터페이스 추출
- W12-W15: rehydration / WS gateway 추가 분기 단위 테스트
- W16-W18: 핸들러 4개 중복 리팩토링 / `resumeFromCheckpoint` 책임 분리 / 통합 테스트 setup 분리
- W21: `on()` no-op stub 잔존 — 다음 phase 에서 `registerContinuationHandlers()` 와 함께 완전 제거

### 낮은 우선순위 (follow-up plan)
- W5: WS gateway `queued` ack 필드 spec §4.2 추가 보강 (`executionId`/`success: false` 케이스 미명시)
- W6: `isNodeExecutionWaiting` 의 `__no_node_exec__` 처리 의미 spec 미기술
- W7: `cancelWaitingExecution` 반환 타입 일관성
- W8: `setImmediate` polling at-least-once race (BullMQ idempotency + isNodeExecutionWaiting 가드로 현재 보호됨)
- W9-W11, W24: `_executedNodes` 직접 교체 / `on()` 잔존 호출자 / `continueX` 반환 타입 변경 호출자 / `getLockClient` race

### INFO (자동 수정 대상 아님)
- I1: `NO_NODE_EXEC_SENTINEL` 상수화
- I2: `rehydrateContext` N+1 쿼리
- I3-I17: follow-up

### False Positive (수정 없음)
- C1, C2, C3, C4, C6: spec Phase 0 에서 이미 보강 완료 (BullMQ §7.4/§7.5, WS §4.2 `queued` 필드)
