# 요구사항(Requirement) Review — AiTurnOrchestrator + EngineDriver 추출 (C-1 step2)

리뷰 대상 커밋: `2d363e4b07f7d80710f12dfa8c35b3817b991b07`

---

## 발견사항

### 1. [SPEC-DRIFT] [WARNING] spec/4-nodes/3-ai/1-ai-agent.md §10 — `classifyLlmError` 구현 위치 낡음

- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` line 1098 (§10 retryable 분류 규칙 각주)
- **상세**: spec 본문이 "구현: `ExecutionEngineService.classifyLlmError`" 라고 명시하고 있으나, C-1 step2 추출로 `classifyLlmError` 와 `extractAiTurnErrorPayload` 가 `AiTurnOrchestrator` (private static) 로 이동했다. `ExecutionEngineService` 는 더 이상 이 메서드를 보유하지 않는다. 코드의 이동은 합리적이고 의도적인 리팩터링(god-class 분해)이며 동작은 동일하게 보존됐다.
- **제안**: 코드 유지 + spec 갱신. `spec/4-nodes/3-ai/1-ai-agent.md` §10 각주의 "구현: `ExecutionEngineService.classifyLlmError`" → "구현: `AiTurnOrchestrator.classifyLlmError`(static)" 으로 반영. spec 수정 권한은 `project-planner`.

---

### 2. [SPEC-DRIFT] [WARNING] spec/5-system/4-execution-engine.md — `waitForAiConversation` 소유자 서술 낡음

- **위치**: `spec/5-system/4-execution-engine.md` line 83 (§1.1 Pre-park read-window 비고)
- **상세**: spec 은 `waitForButtonInteraction / waitForFormSubmission / waitForAiConversation` 이 status 를 atomic 전이한다고 나열하면서, `waitForAiConversation` 의 소유 서비스를 암묵적으로 `ExecutionEngineService` 로 간주한다. 이제 `waitForAiConversation` 은 `AiTurnOrchestrator` 에 위치하며, `processAiResumeTurn`, `handleAiResumeTurn`, `handleAiTurnError`, `finalizeAiNode` 도 동일하게 이동했다. 동작 자체는 변하지 않는다(verbatim 이동 + this.driver.X 재배선).
- **제안**: 코드 유지 + spec 갱신. `spec/5-system/4-execution-engine.md` §1.1 비고 및 §7.5 계약 영역에서 이 메서드들이 `AiTurnOrchestrator` 에 위치함을 명시. spec 수정 권한은 `project-planner`.

---

### 3. [INFO] `emitAiWaitingForInput` 의 `turnDebug` 필드 shape — spec §4.4 와 괴리 가능성

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` line 1547-1555
- **상세**: `emitAiWaitingForInput` 에서 `turnDebug: { llmCalls: ((resumeState.turnDebugHistory as unknown[]) ?? [])[0] ?? undefined, metadata: { model, inputTokens, outputTokens } }` 를 emit 한다. 그런데 `turnDebugHistory[0]` 은 turn 전체 entry 객체(index+llmCalls[]+totalDurationMs)이며, `turnDebug.llmCalls` 에 turn entry 전체가 들어간다. spec `spec/5-system/6-websocket-protocol.md §4.4` 의 `ai_message` 형태에서 `llmCalls` 는 배열로 정의되는데 여기서는 오브젝트(turn entry)가 들어가 shape 가 다를 수 있다. 이 `turnDebug` 필드 자체는 첫 turn 진행 신호용으로 추가된 필드이고, `execution.waiting_for_input` 이벤트의 공식 schema 에 `turnDebug` top-level 필드는 spec §4.4 에 명시되어 있지 않아 확인이 어렵다. 테스트에서도 이 필드 shape 을 직접 검증하지 않는다.
- **제안**: `emitAiWaitingForInput` 에서 `turnDebug.llmCalls` 에 turn entry 전체가 아닌 `turnDebugHistory[0]?.llmCalls ?? []` 를 전달하는지 구현 의도를 확인 권고. spec `§4.4` 에 `waiting_for_input` 이벤트의 `turnDebug` 필드 정의가 없으면 INFO 수준으로 보류.

---

### 4. [INFO] `buildConversationConfigFromOutput` — `presentations` 필드 전파 누락 가능성

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` line 1781-1816 (handleAiMessageTurn의 AI_MESSAGE emit)
- **상세**: `handleAiMessageTurn` 의 AI_MESSAGE emit 에서 `nextConv.presentations` 가 있으면 `{ presentations: nextConv.presentations }` 를 전파한다(line 1806-1808). 이는 spec `§4.4` 의 `ai_message.presentations?` 필드와 일치한다. 테스트 spec 파일(`buildConversationConfigFromOutput` suite)에는 `presentations` 필드를 다루는 케이스가 없다 — `buildConversationConfigFromOutput` 에서 `presentations` 를 반환하는지, 어떤 경로에서 세팅되는지에 대한 단위 테스트가 없다. INFO 수준이나, 향후 AI Agent 표현 도구 출력 path 검증 시 보강 권고.

---

### 5. [INFO] `EngineDriver.resolveHasDefaultLlmConfigCached` / `clearLlmDefaultConfigCache` — orchestrator 가 직접 사용 안 함

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` lines 1998-2009
- **상세**: `EngineDriver` 인터페이스 주석에 "(orchestrator 에서 직접 쓰지 않더라도, 엔진 잔류 LLM 캐시 상태에 대한 단일 노출 표면으로 driver 에 둔다.)" 라고 명시됐다. 이 두 메서드는 현재 `AiTurnOrchestrator` 에서 호출되지 않으며, 향후 확장을 위해 인터페이스에 포함된 것이다. 테스트에서 mock 에 포함됐으나 검증하지 않는다. 기능 요구사항상 현재 문제가 없으나, `EngineDriver` 의 표면을 최소화하려는 원칙(PR1 `WORKFLOW_EXECUTOR` 선례)에 비춰 interface 비만을 점검할 시점에 재고 권고. 현재는 INFO.

---

### 6. [INFO] 테스트 — `malformed payload` 케이스 coverage 확장

- **위치**: `ai-turn-orchestrator.service.spec.ts` lines 373-381
- **상세**: `malformed payload(type 부재)` 테스트가 `{ noType: true }` 만 커버한다. `payload = undefined`, `payload = 42`, `payload = 'string'` 처럼 비객체인 경우도 `processAiResumeTurn` 의 malformed guard 에 걸리지만 테스트에 없다. 현재 구현에서는 `typeof payload !== 'object'` 가 비객체를 모두 잡으므로 동작은 올바르다. INFO 수준.

---

## 요약

이번 변경은 `ExecutionEngineService` 의 AI 멀티턴 생명주기 ~1,250줄을 `AiTurnOrchestrator` 로 추출하고 `EngineDriver` 인터페이스를 신설하는 strangler-fig 리팩터링(C-1 step2)이다. **기능 완전성**: 이동 대상 메서드(`waitForAiConversation`, `processAiResumeTurn`, `handleAiResumeTurn`, `handleAiMessageTurn`, `finalizeAiNode`, `reparkAiResumeTurn`, `handleAiEndConversation`, `handleAiTurnError`, `extractAiTurnErrorPayload`)가 verbatim 이동되고 `this.driver.X` 로 재배선됐으며, 엔진 통합 park/resume 테스트는 engine spec 에 잔류해 위임 경로를 가드한다. **에러 시나리오**: `processAiResumeTurn` 의 malformed payload/unknown type/stale button_click 분기, `handleAiTurnError` 의 FAILED finalize 경로, `extractAiTurnErrorPayload` 의 순환참조·비직렬화 객체·null/undefined/비객체 throw 처리 모두 단위 테스트로 충분히 검증된다. **spec fidelity**: 동작 계약(§7.5 rehydration 경로, §10 에러 코드 분류, §4.4 이벤트 필드, §1.3 checkpoint, §4.4.6 source 마커)은 spec 과 line-level 로 일치하며, 검출된 SPEC-DRIFT 2건은 코드가 합리적으로 이동된 반면 spec 본문의 구현 위치 참조가 낡은 것이다. CRITICAL/WARNING 코드 결함은 없고, 모든 코드 변경이 의도한 리팩터링 범위 안에서 동작 보존을 달성한다.

## 위험도

LOW

---

STATUS: SUCCESS
