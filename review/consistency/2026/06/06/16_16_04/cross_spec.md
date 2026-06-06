# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
대상: `spec/5-system/4-execution-engine.md` 구현 변경 (exec-park D6 full B3 — PR-B2b)
diff-base: origin/main
검토일: 2026-06-06

---

## 발견사항

### [WARNING] retryLastTurn / applyRetryLastTurn 단위 테스트 전면 제거 — 스펙 규정 동작의 테스트 커버리지 소실

- target 위치: diff — `describe('retryLastTurn (_retryState consume + spawn)')` 및 `describe('applyRetryLastTurn (multi-turn loop re-entry)')` 블록 전체 삭제
- 충돌 대상: `spec/5-system/4-execution-engine.md §1.3 (보존 예외 — _retryState)`, `§1.1 failed→running 상태 전이`, `spec/5-system/6-websocket-protocol.md §4.2 execution.retry_last_turn`, `spec/4-nodes/3-ai/1-ai-agent.md §7.9`
- 상세: spec 은 `retryLastTurn`(consumer-side: `_retryState` TTL 검증 + atomic consume + 새 NodeExecution spawn + `RETRY_STATE_NOT_FOUND` / `NODE_NOT_RETRYABLE` / `RETRY_TOO_EARLY` 에러 코드)과 `applyRetryLastTurn`(worker-side: spawn 된 row `_retryState` seed → `processAiResumeTurn` 재진입 → graph 진행)을 명시적으로 정의하고 있다. 실제 서비스 코드(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`)에 `retryLastTurn`(line 4264)과 `applyRetryLastTurn`(line 4472)이 그대로 존재함에도 불구하고, 이 PR 에서 해당 기능의 단위 테스트가 전량 삭제됐다. `driveCallStackResume`/`driveResumeFrame` 등 신규 테스트로 대체됐으나, 이들은 별개 기능(중첩 call-stack rehydration)이어서 retry 경로를 커버하지 않는다. `failed→running` 상태 전이(spec §1.1), `_retryState` TTL/idempotency(spec §1.3), WS ack 에러 코드(spec §6.4)의 회귀 보호가 사라진 상태다.
- 제안: `retryLastTurn`·`applyRetryLastTurn` 단위 테스트를 별도 `describe` 블록으로 복원하거나, 삭제가 의도된 리팩터(예: 두 메서드가 실제로 제거됐거나 이름이 변경된 경우)라면 spec/6-websocket-protocol §4.2 / spec/5-system/4-execution-engine §1.3 도 함께 갱신해야 한다.

---

### [WARNING] driveResumeDetached docstring — 'detach 호출' 서술이 실제 awaited 구현과 불일치

- target 위치: diff 코드 내부 주석 변화 — `applyContinuation` → `rehydrateAndResume` 경로 설명에서 "detach" 표현 제거
- 충돌 대상: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 1815-1822 docstring ("§7.5 rehydration — `resumeFromCheckpoint` 가 setup 후 `void` 로(detach) 호출…"), `spec/5-system/4-execution-engine.md §4 구현 메모 line 406` ("detached coroutine … 제거됐다") 및 `§7.5 line 893` ("`driveResumeDetached`(top-level, awaited)")
- 상세: spec §7.5 line 893 은 이미 "`driveResumeDetached`(top-level, **awaited**)"로 서술하고 있고, 실제 호출부(line 1798)도 `await this.driveResumeDetached(...)` 로 변경됐다. 그러나 `driveResumeDetached` 메서드 자체의 JSDoc(line 1815-1822)은 여전히 "setup 후 `void` 로(detach) 호출" / "continuation worker 의 `process()` 는 본 메서드 완료를 기다리지 않고 즉시 반환" 으로 옛 detach 모델을 설명한다. 이는 spec 이 아닌 코드 내 주석의 stale 이지만, cross-spec 검토에서도 spec §4 구현 메모와 코드 JSDoc 가 상충되므로 명시한다.
- 제안: `driveResumeDetached` JSDoc 을 "worker 가 직접 await 한다 — 단발 turn 처리기(processXResumeTurn)가 한 세그먼트만 처리하고 반환하므로 deadlock 위험 없음" 으로 갱신. spec §4 구현 메모는 이미 최신 상태로 일치.

---

### [INFO] pendingContinuations / firstSegmentBarriers / armFirstSegmentBarrier / settleFirstSegment / signalParkBarrier / runAiConversationLoop / firePayload 테스트 전면 제거 — 스펙 full B3 제거 선언과 일치

- target 위치: diff — 위 6종 in-memory 머신 관련 테스트 블록 및 헬퍼(`getPendings`, `stubWaitForX`, `makeDeadlockGuard`) 삭제
- 충돌 대상: `spec/5-system/4-execution-engine.md §4 구현 메모 line 406` ("in-memory 머신(`pendingContinuations`/`firstSegmentBarriers` 일가/`firePayload` scheduler/`runAiConversationLoop` 장수 루프/detached)은 **완전 제거(full B3)**됐다")
- 상세: spec 이 full B3 완료를 명시적으로 선언하고 있으며, 해당 in-memory 머신이 실제로 제거됐음을 구현 코드가 확인한다. 테스트 삭제는 spec 의 "완전 제거" 선언과 정합하므로 충돌 없음. `makeDeadlockGuard` → `makeCompletionGuard` 로의 이름 변경도 spec §7.5 "worker 가 직접 await, 단발 turn 처리" 의미를 올바르게 반영한다.

---

### [INFO] CALL_STACK_SCHEMA_VERSION / ParkReleaseSignal 임포트 추가 — spec 데이터 모델·타입 계약과 일치

- target 위치: diff 상단 `import { CALL_STACK_SCHEMA_VERSION } from '../../shared/execution-resume/resume-call-stack.types'` / `import { ParkReleaseSignal } from '../../shared/execution-resume/park-release-signal'`
- 충돌 대상: `spec/5-system/4-execution-engine.md §6.2 / §7.5 / §Rationale(exec-park D6)`, `spec/1-data-model.md §2.13 resume_call_stack`
- 상세: `CALL_STACK_SCHEMA_VERSION = 1` 은 `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts:48` 에 정의되어 있고 spec §6.2 / §7.5 의 버전 가드 계약과 일치한다. `ParkReleaseSignal` 을 catch 하고 흡수(return)하는 Case 5 테스트는 spec §7.5 "forward 도중 새 blocking 노드가 fresh park 하면 `ParkReleaseSignal` 을 throw 하고 `runNodeDispatchLoop` 가 `{parked:true}` 로 흡수해 세그먼트가 종료된다" 와 일치. 충돌 없음.

---

### [INFO] driveCallStackResume / driveResumeFrame / injectInvokerOutput 신규 단위 테스트 5종 — 스펙 §7.5 frame-by-frame 재진입 계약과 일치

- target 위치: diff — `describe('driveCallStackResume / driveResumeFrame / injectInvokerOutput (CRITICAL #1)')` 5개 케이스
- 충돌 대상: `spec/5-system/4-execution-engine.md §7.5 '중첩 sub-workflow 재개 — resume_call_stack frame-by-frame 재진입 (exec-park D6)'`
- 상세: spec §7.5 Case 1("innermost frame 완료 → top-level 완료 → COMPLETED"), Case 2("2-depth bubble-up + invoker output 주입"), Case 3("parked → 즉시 return"), Case 4("에러 → finalizeResumedExecutionOutcome 경로"), Case 5("ParkReleaseSignal catch 흡수") 의 5가지 시나리오가 spec §7.5 의 a/b 단계·bubble-up 루프·파생 완결 규칙과 정합한다. frames.length===0 방어 가드(W6) 도 spec 버전 가드 패턴과 일관된다. 충돌 없음.

---

### [INFO] stageDurableResumeSnapshot 테스트 신규 추가 — spec §6.2 park commit (e) resume_call_stack 영속과 일치

- target 위치: diff — `it('stageDurableResumeSnapshot stages resume_call_stack from context._callStack ...')` 및 `it('stageDurableResumeSnapshot sets resume_call_stack=null for top-level park ...')`
- 충돌 대상: `spec/5-system/4-execution-engine.md §6.2`, `spec/1-data-model.md §2.13 resume_call_stack`
- 상세: top-level park(중첩 깊이 0 또는 `_callStack`이 빈 배열)에서 `resume_call_stack=NULL`, 중첩 park 에서 `{version: CALL_STACK_SCHEMA_VERSION, frames:[...]}` 직렬화는 spec §6.2 "top-level park(중첩 깊이 0)는 `NULL`" 과 일치한다. frame 의 얕은 복사(pop mutation 격리)도 spec 의 스냅샷 영속 의미와 부합한다. 충돌 없음.

---

### [INFO] processAiResumeTurn W5 테스트 재설계 — runAiConversationLoop 에서 processAiResumeTurn 으로의 이관 반영

- target 위치: diff — `describe('W5 — processAiResumeTurn 방어 가드 ...')` 재설계 (driveLoopButtonClick → driveResumeTurn, runAiConversationLoop → processAiResumeTurn 직접 구동)
- 충돌 대상: `spec/5-system/4-execution-engine.md §4 구현 메모`, `spec/4-nodes/3-ai/1-ai-agent.md §7` (runAiConversationLoop 장수 루프 관련)
- 상세: spec §4 구현 메모 line 1276 이 "PR-B2a(top-level 멀티턴 AI): `runAiConversationLoop` 장수 루프를 turn-단위 park(D4)로 전환" 을 명시하고, PR-B2b full B3 에서 `runAiConversationLoop` 가 완전 제거됐다고 선언한다. W5 테스트가 `runAiConversationLoop` 직접 구동 → `processAiResumeTurn` 직접 구동으로 전환한 것은 spec 과 일치한다. 다만 `ai_agent.md §7` 에 `runAiConversationLoop` 관련 서술이 남아 있다면 동기화 필요 — 본 검토 범위에서는 직접 확인하지 못했으나 INFO 수준의 동기화 권장 항목으로 기록한다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md §7` 에서 `runAiConversationLoop` 언급이 있으면 "turn-단위 park(`processAiResumeTurn`) 으로 대체" 를 주석 처리할 것.

---

## 요약

이번 변경(exec-park D6 full B3 — PR-B2b)은 `spec/5-system/4-execution-engine.md §4 구현 메모·§7.5·§6.2` 에 2026-06-06 기준으로 명시된 최종 상태(park = 세그먼트 종료, in-memory 머신 완전 제거, call-stack 영속 + frame-by-frame rehydration 일원화)와 전반적으로 일치한다. `driveCallStackResume`/`driveResumeFrame`/`stageDurableResumeSnapshot` 등 신규 테스트는 spec §7.5·§6.2 계약을 정확히 반영하고, `pendingContinuations`/`firstSegmentBarriers`/`runAiConversationLoop` 등 삭제된 테스트는 spec full B3 제거 선언과 부합한다. 주요 경고(WARNING)는 두 가지다: (1) `retryLastTurn`/`applyRetryLastTurn` 단위 테스트가 삭제됐으나 실제 서비스 코드에 해당 메서드가 존재하고 spec §1.3·§6-websocket-protocol §4.2 에 명시된 `_retryState` 소비·spawn·에러 코드 계약의 회귀 보호가 소실됐다. (2) `driveResumeDetached` JSDoc 이 옛 detach 모델("void 로 호출")을 그대로 유지해 실제 `await` 호출 및 spec §7.5 "awaited" 서술과 불일치한다.

## 위험도

MEDIUM
