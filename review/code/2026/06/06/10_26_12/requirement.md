# 요구사항(Requirement) 리뷰 결과

**리뷰 대상**: PR-B2 — top-level 멀티턴 AI turn-park (`exec-park D4`)
**주요 변경 파일**: `execution-engine.service.ts`, `execution-engine.service.spec.ts`
**리뷰 기준 spec**: `spec/5-system/4-execution-engine.md` §4.x / §6.2 / §7.4 / §7.5 / §Rationale

---

## 발견사항

### **[INFO]** [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §4.x 배너 — PR-B2 완료 반영 필요
- **위치**: `spec/5-system/4-execution-engine.md` line 406 (`구현 메모 — park = 세그먼트 종료 (Phase B, 단계 롤아웃 중)`) 및 line 408 (`재개 경로 — slow-path 일원화`)
- **상세**: 두 배너 모두 "**PR-B2(멀티턴 AI) 미적용**" 으로 기재되어 있으나, 코드는 이미 top-level 멀티턴 AI 의 turn-단위 park(`processAiResumeTurn`) + in-memory resolver 미등록(`firePayload` AI 경로 skip) 을 구현 완료했다. `pendingContinuations`/`firstSegmentBarriers`/`firePayload`/detached 메커니즘은 아직 form/button + nested resume 용으로 잔존(B3 미완)하지만, top-level AI 멀티턴에 한해서는 PR-B2a가 적용됐다. 배너가 구현 현실과 어긋나 독자를 오도한다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md` line 406-408 의 두 배너를 "PR-B2a(top-level 멀티턴 AI turn-park) 완료, PR-B2b(nested D6 + full B3) 미적용" 으로 갱신. project-planner 위임.

---

### **[INFO]** [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §Rationale "단계적 롤아웃" 노트 — PR-B2a 완료 반영 필요
- **위치**: `spec/5-system/4-execution-engine.md` §Rationale line 1271
- **상세**: "**PR-B2(multi-turn AI)**: `runAiConversationLoop` 장수 루프를 turn-단위 park(D4)로 전환하고 — 이때 비로소 … **제거(B3)**된다" 로 기술돼 있어, 마치 PR-B2 가 B3(완전 제거)까지 한 번에 수행하는 것처럼 읽힌다. 실제 구현은 PR-B2a(top-level turn-park만) + PR-B2b(B3 완전 제거, nested D6)로 2분할됐고, plan에도 해당 분할이 명시되어 있다.
- **제안**: 코드 유지 + spec 반영. §Rationale line 1271 에 PR-B2a/B2b 2분할 내용 반영. project-planner 위임.

---

### **[WARNING]** `processAiResumeTurn` — null/undefined payload 의 `action.type` 타입 단언 위험
- **위치**: `execution-engine.service.ts` line 5293 (`const action = payload as ContinuationPayload`)
- **상세**: `payload` 는 `unknown` 타입이며, `driveResumeDetached` 의 호출자(`resumeFromCheckpoint`)가 `opts.payload` 를 그대로 전달한다. `opts.payload` 가 `null` 또는 `undefined`(예: `ai_end_conversation` continuation job 의 payload 없음 케이스) 인 경우, `action.type` 는 `undefined` 가 되어 `if (action.type === 'ai_end_conversation')` 분기 미진입 → unknown type 핸들러(warn + re-park)로 떨어진다. 기능적으로는 graceful(재개 유지)하지만 `ai_end_conversation` 이 payload 없이 도착하는 경우 의도된 종료 처리가 누락된다.
- **스펙 근거**: `spec/5-system/4-execution-engine.md §7.4` 메시지 스키마: `{ type: ContinuationType, executionId, nodeExecutionId, payload?: unknown }` — payload 는 optional. 타입이 `ContinuationType`에 포함된 `cancel`/`ai_end_conversation` 등은 `payload` 없이 도착 가능하다. `endAiConversation` 퍼블리셔가 `type: 'ai_end_conversation'` 을 `ContinuationPayload.type`으로 직접 싣는지 확인 필요.
- **제안**: `processAiResumeTurn` 의 `action` 타입 단언 직전, `payload`가 nullish 인 경우를 먼저 분기하거나, `ai_end_conversation` continuation bus 메시지의 실제 payload 구조를 확인해 `action.type` 가 top-level `type` 필드인지 `payload.type` 필드인지 명시적으로 문서화 또는 방어 처리 추가.

---

### **[WARNING]** `reparkAiResumeTurn` — `handleAiMessageTurn` 의 `_resumeCheckpoint` 갱신 후 `stageDurableResumeSnapshot` 만 수행; NodeExecution outputData 영속 보장 검증 필요
- **위치**: `execution-engine.service.ts` line 5387-5398 (`reparkAiResumeTurn`)
- **상세**: JSDoc 에 "handleAiMessageTurn 가 이미 … NodeExecution.outputData 에 영속" 이라고 기술하나, `handleAiMessageTurn` 의 waiting 분기가 실제로 NodeExecution save 를 수행한 뒤 `reparkAiResumeTurn` 이 호출됨을 전제한다. `reparkAiResumeTurn` 자체는 `stageDurableResumeSnapshot` + `updateExecutionStatus(WAITING_FOR_INPUT, nodeExec)` 만 수행한다. `updateExecutionStatus` 가 `nodeExec` 와 함께 호출되어 NodeExecution 도 save 하는 경로를 사용하므로 문제없지만, `handleAiMessageTurn` waiting 분기의 NodeExecution save 와 `updateExecutionStatus` 의 NodeExecution save 가 이중 저장이 될 수 있다(덮어쓰기라 기능적으로 무해). 그러나 ordering 가정이 암묵적이므로 주석으로 명시하거나 테스트로 보강하면 유지보수성이 향상된다.
- **제안**: `reparkAiResumeTurn` JSDoc 에 "handleAiMessageTurn waiting 분기가 먼저 NodeExecution.outputData(checkpoint) save 완료한 후 본 메서드 호출 전제" 를 명시. 현재 기능 동작에는 문제 없음.

---

### **[INFO]** `processAiResumeTurn` — `ai_end_conversation` 시 `handleAiEndConversation` 이 동기이고 `finalizeAiNode` 가 async인 흐름 정상
- **위치**: `execution-engine.service.ts` line 5296-5307
- **상세**: `handleAiEndConversation` 가 동기 호출이고 바로 `await finalizeAiNode(..., 'COMPLETED')` 를 호출해 대화를 종료한다. finalizeAiNode COMPLETED 분기에서 `savedExecution.status === RUNNING` 이면 NodeExecution만 save 하고 `updateExecutionStatus` 를 skip 한다. `driveResumeDetached` 진입 시 `updateExecutionStatus(RUNNING)` 이 이미 수행됐으므로 이 skip 이 올바르다. 반환값이 `void` 이므로 caller(`driveResumeDetached`)는 aiTurnSignal !== PARK_RELEASED 경로로 그래프 순회를 계속한다. 정상.

---

### **[INFO]** `waitForAiConversation` `'release'` 모드 — `emitAiWaitingForInput` 이전에 `PARK_RELEASED` 반환 가능성 없음 확인
- **위치**: `execution-engine.service.ts` line 4970-5028 (`waitForAiConversation`)
- **상세**: `parkMode === 'release'` 시 `emitAiWaitingForInput` (durable 영속 포함) 를 먼저 호출한 **뒤** `return PARK_RELEASED` 한다. 영속 없이 반환하는 경로가 없다. 재개 무손실 요구사항(spec §6.2) 충족.

---

### **[INFO]** `firePayload` AI 경로 조건부 스킵 — `isAiConversation` 판정 정확성
- **위치**: `execution-engine.service.ts` line 1868-1870
- **상세**: `isAiConversation` 가 `persistedInteractionType === 'ai_conversation' || 'ai_form_render'` 로 판정된다. `ai_form_render` 포함이 spec §7.5 의 multi-turn AI 분기 조건(`isAiConversation && resumeCheckpoint && isCheckpointEligibleNodeType`)과 일관된다. spec §7.4 메시지 타입에 `ai_message`/`ai_end_conversation` 가 포함돼 있어 두 interactionType 모두 해당 payload 로 재개되므로 조건 정확.

---

### **[INFO]** 테스트 변경 — `armSlowPathResume` + `flushResumeDrive` 패턴으로 slow-path 검증 강화
- **위치**: `execution-engine.service.spec.ts` 전반
- **상세**: 옛 테스트는 `flushPromises()` 1-2회로 in-memory resolver 경로를 테스트했으나, PR-B2a 이후 top-level AI turn은 항상 slow-path(rehydration → processAiResumeTurn)를 탄다. 신규 테스트는 `armSlowPathResume`로 DB lookup mock 무장 + `flushResumeDrive`(실제 타이머 플러시)로 detached drive 완료를 기다린다. 이 패턴은 실제 운영 경로를 충실히 재현한다.
  - `§4.x — runExecutionFromQueue` 테스트: `getPendings.has(executionId) === false` 불변식 검증 추가 (bounded memory 가드).
  - W12 unknown 타입, button_click re-park 테스트: `processMultiTurnMessage` 미호출 + terminal emit 부재를 명시 검증.
  - W5 buttonId 경계값 테스트: `runAiConversationLoop` 직접 구동으로 loop 내 button_click 분기를 독립 검증(top-level resume 에서는 processAiResumeTurn 이 처리하고 loop 분기는 nested/retry 경로에만 남음).
  - 기능 완전성 충족.

---

### **[INFO]** `retry_last_turn` 경로는 `processAiResumeTurn` 우회 — 기존 `runAiConversationLoop` 유지 올바름
- **위치**: `execution-engine.service.ts` line 4214 (`applyRetryLastTurn`) → line 4327 (`runAiConversationLoop`)
- **상세**: `retry_last_turn` continuation job 은 spawn 된 RUNNING row 를 대상으로 하며, `applyRetryLastTurn` 이 직접 `runAiConversationLoop` 를 호출한다(`processAiResumeTurn` 경유하지 않음). spec §1.3 / §7.4 "retry_last_turn 은 WAITING 이 아닌 spawn 된 RUNNING row" 설명과 일치. 기능 완전성 충족.

---

## 요약

PR-B2a(top-level 멀티턴 AI turn-단위 park) 구현은 `spec/5-system/4-execution-engine.md` §4.x / §6.2 / §7.4 / §7.5 / §Rationale D4 의 요구사항을 실질적으로 충족한다. 핵심 불변식 — 첫 AI turn park 시 PARK_RELEASED 반환, in-memory resolver 미등록(bounded memory), 후속 turn은 slow-path rehydration → processAiResumeTurn 단발 처리, 대화 계속 시 reparkAiResumeTurn(durable 영속 + WAITING 전이), 대화 종료 시 finalizeAiNode → 그래프 순회 계속 — 이 모두 구현돼 있으며 테스트가 이를 가드한다. Critical 발견 없음. WARNING 2건은 모두 방어적 코드 보강 권고로 기능 버그가 아니다. SPEC-DRIFT 2건(§4.x 배너, §Rationale 단계 롤아웃 노트)은 구현이 올바르고 spec 문서가 현실을 따라오지 못한 누락이며, 코드 수정 대상이 아니라 spec 갱신 대상이다.

## 위험도

LOW

STATUS: OK
