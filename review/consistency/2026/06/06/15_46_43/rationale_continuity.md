# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Target: `spec/5-system/4-execution-engine.md` 범위 구현 diff (테스트 파일)
diff-base: origin/main

---

## 발견사항

### [INFO] detached 드라이브 → awaited 드라이브 전환: 테스트가 Rationale 결정과 정합
- target 위치: `execution-engine.service.spec.ts` — `makeDeadlockGuard` → `makeCompletionGuard` rename, slow-path AI 재개 테스트에서 `turnGate` + `releaseTurn` 게이트 제거
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "park 즉시 해제 + slow-path 일원화 (Phase B)" — PR-B2b full B3 항목: `driveResumeDetached` 를 **await** 하는 방향으로 변경(단발 turn 처리기라 worker deadlock 위험 없음)
- 상세: 이전 테스트(`makeDeadlockGuard`)는 "worker 가 detached drive 를 await 하지 않아야 한다(즉시 반환)"를 검증했다. 새 테스트(`makeCompletionGuard`)는 반대로 "drive 가 await 되어 정상 완결된다"를 검증한다. 이는 Rationale 가 명시한 "옛 detach 모델 폐기 — 단발 turn 이라 worker 슬롯 deadlock 위험 없음"과 일치한다. 번복이지만 Rationale 에 근거가 기록돼 있으므로 무근거 번복이 아니다.
- 제안: 현행 상태 적합. 추가 조치 불필요.

### [INFO] `pendingContinuations` Map 테스트 제거: Rationale 결정과 정합
- target 위치: `execution-engine.service.spec.ts` — `getPendings` 헬퍼 제거, `pendingContinuations.set/get/has/clear` 직접 조작 테스트 다수 제거, `applyCancellation — rejectPending` 경로 테스트 제거
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "B3" 항목: "`pendingContinuations` Map(worker-side fast-path)은 park 가 곧 세그먼트 종료가 되어 불필요해져 제거된다" 및 "full B3 완료: in-memory 머신(`pendingContinuations`·`firstSegmentBarriers` 일가·`firePayload` scheduler·`runAiConversationLoop`·detached) **완전 제거**"
- 상세: 이전 테스트는 `pendingContinuations` Map 에 resolver 를 직접 세팅하거나 조회해 fast-path 동작을 검증했다. Rationale 가 해당 Map 의 완전 제거를 명시했으므로 관련 테스트 제거는 Rationale 연속성에 정합한다.
- 제안: 현행 상태 적합.

### [INFO] `firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` 테스트 제거: Rationale 결정과 정합
- target 위치: `execution-engine.service.spec.ts` — W1 배리어 테스트 3개 제거(재arm settle 테스트·멱등 테스트·background no-op 테스트), 대신 `runExecution 직접 await` 테스트로 교체
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "B1·B2 분리 불가" 항목: "`firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`·`pendingContinuations` Map(worker-side fast-path)은 park 가 곧 세그먼트 종료가 되어 불필요해져 제거된다(B3)"
- 상세: 해당 배리어 API 가 full B3 에서 완전 제거됐으므로 테스트 제거는 정합하다. 새로 추가된 `runExecution 을 직접 await` 테스트가 그 의미 등가 검증을 담당한다.
- 제안: 현행 상태 적합.

### [INFO] `runAiConversationLoop` 직접 구동 테스트 → `processAiResumeTurn` 직접 구동 테스트: Rationale 결정과 정합
- target 위치: `execution-engine.service.spec.ts` — W5 블록: `driveLoopButtonClick` (loop 기동 후 pendingContinuations resolver 주입) → `driveResumeTurn` (processAiResumeTurn 직접 호출) 교체
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "D4 — 멀티턴 turn-단위 park": "`runAiConversationLoop` 의 장수 루프를 **매 turn 입력 대기에서 해제** — 한 turn 처리 = 한 세그먼트" 및 "PR-B2a: `runAiConversationLoop` 장수 루프를 top-level 한정 turn-단위 park(D4)로 전환 — `processAiResumeTurn`(재개 시 단발 turn 처리 + re-park)" 및 full B3 제거 기록
- 상세: 이전 W5 테스트는 `runAiConversationLoop` 장수 루프를 기동하고 `pendingContinuations` resolver 로 button_click 을 주입하는 방식이었다. 이 루프가 Rationale 에 따라 제거됐으므로 `processAiResumeTurn` 단발 처리기를 직접 구동하는 새 테스트로 교체가 정합하다.
- 제안: 현행 상태 적합.

### [INFO] `driveCallStackResume`/`driveResumeFrame`/`injectInvokerOutput` 신규 단위 테스트 추가: Rationale 결정 구현 완료 커버리지
- target 위치: `execution-engine.service.spec.ts` — CRITICAL #1 블록 5+1 케이스 신규 추가
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "exec-park D6 — 중첩 sub-workflow blocking durable 영속": "`driveCallStackResume`/`driveResumeFrame` + frame-by-frame rehydration" 채택, "direct-drive vs `executeInline` 재호출 (W2 SPEC-DRIFT)": `driveCallStackResume` 이 영속된 frames 를 따라 innermost frame 부터 직접 구동(bubble-up) 방식 채택
- 상세: Rationale 가 채택한 `driveCallStackResume` 패턴(innermost frame 직접 구동 → bubble-up → top-level forward)을 Case1·Case2·Case3a/b·Case4·Case5 + W6 가 체계적으로 검증한다. Rationale 에서 기각한 `executeInline` 재호출 방식을 테스트에서도 사용하지 않으므로 기각 대안 재도입 없음.
- 제안: 현행 상태 적합.

### [INFO] `resumeFromCheckpoint` callStack non-null 분기 테스트 추가: Rationale 의 version 가드 원칙 검증
- target 위치: `execution-engine.service.spec.ts` — CRITICAL #2 블록 (C2-a, C2-b, C2-c)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "exec-park D6" 항목: "`version` 가드는 `CALL_STACK_SCHEMA_VERSION`(checkpoint 와 독립)으로 롤링 배포를 방어한다"
- 상세: C2-b 가 `version > CALL_STACK_SCHEMA_VERSION` → `RESUME_INCOMPATIBLE_STATE` 취소 마킹을 검증해 롤링 배포 방어 원칙을 커버한다. 이는 Rationale 에 명시된 version 가드 설계와 완전히 정합한다.
- 제안: 현행 상태 적합.

### [INFO] `executeInline` `_callStack` push/pop 테스트 추가: exec-park D6 설계 원칙 커버
- target 위치: `execution-engine.service.spec.ts` — WARNING #8 블록 (4개 케이스)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "exec-park D6": "`executeInline` park-release + `_callStack` 영속", "`executeInline` 재호출은 frame 마다 `_callStack` push/pop + sub-workflow DB 조회 + 재귀 깊이 증분 등 초기화 비용"
- 상세: 테스트가 invokerNodeId 있을 때 push, 정상 반환 후 pop, 예외 시 finally pop, invokerNodeId 없으면 push 없음을 각각 검증한다. Rationale 의 `_callStack` 관리 원칙을 직접 단위 테스트로 보장한다.
- 제안: 현행 상태 적합.

### [INFO] `isolates body pendingContinuations under bgKey` 테스트 제거: full B3 완료 후 무의미
- target 위치: `execution-engine.service.spec.ts` — `executeBackgroundSubgraph` describe 내 `isolates body pendingContinuations under bgKey` 테스트 제거
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — B3: `pendingContinuations` Map 완전 제거
- 상세: 해당 테스트는 background subgraph 가 `bgKey` 로 resolver 를 격리 등록하고 finally 에서 정리하는 동작을 검증했다. `pendingContinuations` Map 자체가 없어졌으므로 테스트 삭제가 정합하다. bgKey 격리 원칙 자체는 Rationale 에서 명시적으로 기각된 것이 아니라 구현 의존성 제거와 함께 소멸됐다.
- 제안: 현행 상태 적합.

---

## 요약

이번 diff 는 전적으로 테스트 파일(`execution-engine.service.spec.ts`)의 변경이며, `spec/5-system/4-execution-engine.md ## Rationale` 에 기록된 결정들과 높은 연속성을 보인다. 핵심 변경 방향인 (a) detached 드라이브 모델 폐기 → awaited 드라이브로의 전환, (b) `pendingContinuations` Map 및 `firstSegmentBarriers` 일가 완전 제거(full B3), (c) `runAiConversationLoop` 장수 루프 제거 후 `processAiResumeTurn` 단발 처리기로 교체(D4), (d) `driveCallStackResume` / `driveResumeFrame` 기반 frame-by-frame bubble-up rehydration 신규 추가(D6)는 모두 Rationale 에서 명시적으로 채택·결정된 사항이다. 기각된 대안(sticky fast-path, `pendingContinuations` in-memory 이원화, `executeInline` 재호출 방식, per-node task-queue)이 테스트에서 재도입된 흔적은 없다. Rationale 의 invariant(bounded 메모리, 단일 재개 경로, "항상 rehydration" 원칙)를 우회하는 설계도 발견되지 않는다. 전반적으로 Rationale 연속성 관점에서 이상 없음으로 평가한다.

---

## 위험도

NONE
