# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/4-execution-engine.md, diff-base=origin/main)
검토 일시: 2026-06-06

---

## 발견사항

### [WARNING] `spec/data-flow/3-execution.md` §1.3 시퀀스 다이어그램: 구 in-memory fast-path 서술 잔류
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x/§Rationale — PR-B2b(full B3) 완료, `pendingContinuations`/`firstSegmentBarriers`/detach 완전 제거, 모든 재개 = §7.5 rehydration 단일 경로
- **충돌 대상**: `spec/data-flow/3-execution.md` lines 52, 111-115
- **상세**:
  - line 52: `Note over Eng: "멀티턴 AI 는 PR-B2 전까지 in-memory 루프 유지(잠정 fast-path)"` — PR-B2b(full B3)가 2026-06-06 완료돼 이 "잠정" 조건이 충족됐음에도 서술이 미갱신. 현재는 AI 멀티턴도 rehydration 단일 경로다.
  - lines 111-115: `alt 멀티턴 AI 로컬 pendingContinuations hit (잠정 fast path — PR-B2 에서 제거)` / `Eng->>Eng: resolver 호출 → waitForX await 풀림` / `Eng->>Eng: waitForX 직접 invoke(detached drive) + setTimeout 로 resolver fire` — PR-B2b 이후 이 분기 자체가 코드에서 완전히 제거됐다. 시퀀스 다이어그램이 더 이상 존재하지 않는 분기를 살아있는 것으로 묘사.
- **제안**: `spec/data-flow/3-execution.md` §1.3 시퀀스 다이어그램의 `alt 멀티턴 AI ...` 분기를 제거하고, note를 "full B3 완료 — 모든 재개(form/button/AI) = §7.5 rehydration 단일 경로"로 갱신. `detached drive` 서술도 제거.

### [WARNING] `spec/4-nodes/6-presentation/0-common.md` §10.9: `pendingContinuations`·`waitForAiConversation` 루프 기반 서술 잔류
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x/§Rationale — `pendingContinuations` Map, `waitForAiConversation` 장수 루프, `resolvePending` 전부 full B3에서 제거됨
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` lines 393–427
- **상세**:
  - line 393: "`'continue'` listener 는 wrap 된 payload 를 그대로 `resolvePending(executionId, payload)` 로 forward 한다" — `resolvePending`은 full B3에서 삭제됐다. applyContinuation은 이제 직접 `rehydrateAndResume`을 호출한다.
  - lines 397-427: `waitForAiConversation` 루프의 "4 케이스 명시 매칭" 표, `pendingContinuations`에 등록된 resolve 참조, `Phase B 단계 주: 멀티턴 AI(waitForAiConversation) 한정으로 유지` — 이 루프 전체가 PR-B2a(turn-단위 park)로 대체됐다. `processAiResumeTurn`이 단발 turn 처리기로 교체됐고, `waitForAiConversation` 함수 자체가 제거됐다.
  - line 415의 "단계 주" 서술: "멀티턴 AI 도 PR-B2 의 turn-단위 park 전환 시 동일하게 in-memory resolver 를 제거하며, 그때 본 graceful degradation 서술은 재작성된다" — PR-B2가 완료됐으므로 "그때"가 지금이다. 미갱신.
  - line 426: "backend `execution-engine.service.ts` ... `waitForAiConversation` (4 케이스 명시 매칭)" — 구현에서 제거된 함수를 SoT로 참조.
- **제안**: `spec/4-nodes/6-presentation/0-common.md` §10.9의 `waitForAiConversation` 루프 기반 서술을 `processAiResumeTurn` 단발 turn 처리기 모델로 갱신. `resolvePending` 참조 → `rehydrateAndResume`으로 교체. "단계 주" 조건부 서술 제거 후 확정 서술로 교체.

### [WARNING] `spec/5-system/6-websocket-protocol.md` §4.2: `retry_last_turn`의 `waitForAiConversation` 재진입 서술 충돌
- **target 위치**: `spec/5-system/4-execution-engine.md` — `retryLastTurn` 은 `processAiResumeTurn` 경로로 재진입 (장수 루프 없음)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` line 352
- **상세**: "재진입은 live `ExecutionContext` rehydrate + `waitForAiConversation` 재개가 필요한 **execution worker 컨텍스트**에서만 가능하다" — `waitForAiConversation`이 PR-B2a에서 `processAiResumeTurn`으로 교체됐다. retry_last_turn도 worker handoff 후 rehydration → `processAiResumeTurn` 경로를 사용한다. `waitForAiConversation` 참조는 더 이상 정확하지 않다.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.2의 해당 문장에서 `waitForAiConversation` → `processAiResumeTurn(단발 turn 처리기)`로 교체.

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §10.9: `registerContinuationHandlers` `'continue'` listener SoT 참조 불일치
- **target 위치**: 구현 diff — applyContinuation이 직접 rehydrateAndResume 호출로 일원화
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` line 426 — "backend `execution-engine.service.ts` `continueExecution` (wrap) · `registerContinuationHandlers` 의 `'continue'` listener (forward)"
- **상세**: `registerContinuationHandlers`의 `'continue'` listener와 `resolvePending` forward 체인이 full B3에서 제거됐다. `applyContinuation` 자체가 새 SoT이며 직접 `rehydrateAndResume`을 호출한다. 명명된 함수(`registerContinuationHandlers`)가 존재하는지 여부에 따라 단순 명칭 오류 또는 실질 SoT 충돌.
- **제안**: 4-layer SSOT 정렬 목록에서 listener 참조를 `ContinuationExecutionProcessor.applyContinuation → rehydrateAndResume`으로 교체.

### [INFO] `spec/data-flow/3-execution.md` §1.3 주석: "detached drive" + "setTimeout resolver fire" 아키텍처 서술 불일치
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x — driveResumeDetached는 이제 await됨(non-detach). setTimeout 기반 firePayload 스케줄러 제거.
- **충돌 대상**: `spec/data-flow/3-execution.md` line 115: `Eng->>Eng: waitForX 직접 invoke(detached drive) + setTimeout 로 resolver fire`
- **상세**: PR-B2b(full B3) 이후 `driveResumeDetached`는 직접 await되며, setTimeout 기반 firePayload 스케줄러 자체가 삭제됐다. "detached drive"라는 명칭과 setTimeout 참조가 구 아키텍처를 묘사한다.
- **제안**: line 115를 `Eng->>Eng: rehydrateAndResume → driveResumeDetached (await) → 처리기 직접 dispatch`로 교체.

---

## 요약

구현 diff(exec-park D6 full B3)가 `spec/5-system/4-execution-engine.md`에 정확히 반영돼 있으나, 세 개의 연관 spec 파일이 PR-B2b 완료 이전의 "잠정 단계" 서술을 갱신하지 않은 채 남아있다. 가장 중요한 충돌은 `spec/data-flow/3-execution.md`의 시퀀스 다이어그램(살아있는 `pendingContinuations` fast-path 분기 묘사)과 `spec/4-nodes/6-presentation/0-common.md`의 `waitForAiConversation` 루프 기반 `resolvePending` forward 서술이다. 이 두 파일은 제거된 함수를 현재 SoT로 명시하고 있어 후속 개발자가 코드를 읽을 때 오해를 유발한다. `spec/5-system/6-websocket-protocol.md`의 `retry_last_turn` 서술도 `waitForAiConversation` 재진입 참조가 남아있어 동기화가 필요하다. 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌은 발견되지 않았다.

---

## 위험도

MEDIUM
