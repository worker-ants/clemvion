# Testing Review — AiTurnOrchestrator + EngineDriver 추출 (C-1 step2)

대상 파일:
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` (신설)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (신설)
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` (신설)
- `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` (수정)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (수정)

---

## 발견사항

### [INFO] 테스트 존재 여부 — 신규 서비스에 대한 스펙 파일이 적절히 신설됨
- 위치: `ai-turn-orchestrator.service.spec.ts` 전체
- 상세: `AiTurnOrchestrator` 추출과 동시에 56개 테스트(신설 스펙)가 함께 제출됐고, 기존 엔진 스펙의 park/resume 통합 테스트는 위임 경유로 잔류해 행동 보증이 유지된다. 전체 unit 통과 수가 351/7049로 보고됐다.
- 제안: 없음(적절히 처리됨)

### [INFO] W5 단위 테스트 이동 — 적절한 재위치
- 위치: `execution-engine.service.spec.ts` L5228~5331 (삭제), `ai-turn-orchestrator.service.spec.ts` L263~381 (추가)
- 상세: `processAiResumeTurn` 방어 가드(unknown type slice / stale button_click)가 올바르게 orchestrator 스펙으로 relocate됐다. 삭제된 블록과 추가된 블록의 케이스 집합은 동일하며, 추가로 `malformed payload(type 부재)` 케이스가 신설됐다.
- 제안: 없음

### [INFO] extractAiTurnErrorPayload 테스트 이동 — 올바른 재위치
- 위치: `execution-engine.service.spec.ts` L6035~6234 (삭제), `ai-turn-orchestrator.service.spec.ts` L388~619 (추가)
- 상세: static private 메서드가 `AiTurnOrchestrator`로 이동함에 따라 `extract()` 함수 내부의 캐스팅 대상이 `ExecutionEngineService`에서 `AiTurnOrchestrator`로 정확히 교체됐다. 테스트 케이스 수와 내용은 동일하게 보존됐다.
- 제안: 없음

### [WARNING] handleAiMessageTurn — 직접 단위 테스트 부재
- 위치: `ai-turn-orchestrator.service.ts` L1597~1882 (`handleAiMessageTurn` private 메서드)
- 상세: `handleAiMessageTurn`은 LLM 호출 결과 분기(waiting_for_input / terminal / FAILED), nodeExec persist, AI_MESSAGE emit, EXECUTION_WAITING_FOR_INPUT emit, contextService 부재 graceful exit 등 여러 복잡한 분기를 포함한다. 그러나 신설 스펙에는 이 메서드를 직접 검증하는 단위 테스트가 없다. 현재 커버리지는 `processAiResumeTurn`을 통한 간접 경로(ai_message action 분기)로만 커버된다.
- 특히 누락된 분기:
  1. `contextService.getContext(contextKey)` 가 null 반환 시 graceful exit (`ended: true, finalStatus: 'FAILED'`) — L1684~1692
  2. `nodeExec`가 null일 때 DB persist skip + warn 로그 — L1760~1765
  3. `nodeExecutionRepository.save` 실패 시 error 로그 후 계속 진행 — L1750~1759
  4. `source: 'form_submitted'` 경로의 메시지 직렬화(JSON.stringify) 검증 — L1329~1331
- 제안: `handleAiMessageTurn`에 대한 직접 단위 테스트 추가. 특히 (1) contextService absent → finalStatus FAILED, (2) nodeExec null → warn+skip, (3) save throw → error+continue 분기 테스트를 작성할 것.

### [WARNING] emitAiWaitingForInput — 단위 테스트 부재
- 위치: `ai-turn-orchestrator.service.ts` L1425~1557 (`emitAiWaitingForInput` private 메서드)
- 상세: 이 메서드는 첫 turn park의 핵심이며, `isCheckpointEligibleNodeType` 조건부 checkpoint 영속, `structuredOutputCache` 기반 conversationConfig 구성, `pendingFormToolCall` 동봉(`ai_form_render` 분기), `withInteractionMeta` 적용, emit payload shape 등 복잡한 로직을 포함한다. 신설 스펙에 직접 검증 케이스가 없다.
- `waitForAiConversation` 테스트도 없음 — `processAiResumeTurn` 테스트에서 `ai_end_conversation` 분기를 검증하지만, 첫 turn park 경로는 엔진 스펙의 통합 테스트에만 의존한다.
- 제안: `emitAiWaitingForInput`에 대한 단위 테스트 추가. 최소한 (1) `ai_form_render` interactionType 분기 + `pendingFormToolCall` 동봉, (2) checkpoint 미대상 노드 타입에서 `_resumeCheckpoint` 미삽입, (3) `nodeExec=null` graceful pass-through 케이스를 커버할 것.

### [INFO] handleAiTurnError / handleAiEndConversation — 간접 커버
- 위치: `ai-turn-orchestrator.service.ts`
- 상세: `handleAiEndConversation`은 `processAiResumeTurn → ai_end_conversation` 분기 테스트에서 간접 커버된다. `handleAiTurnError`는 직접 단위 테스트가 없으나, `handleAiMessageTurn` 내부에서만 호출되며 error payload 추출은 `extractAiTurnErrorPayload` 단위 테스트가 커버한다. 허용 가능한 수준.
- 제안: `handleAiTurnError`의 `finalStatus: 'FAILED'` 반환 및 error emit 검증은 `handleAiMessageTurn` 직접 테스트 추가 시 함께 커버 가능.

### [INFO] EngineDriver mock의 적절성
- 위치: `ai-turn-orchestrator.service.spec.ts` L95~113 (`makeMockDriver`)
- 상세: `makeMockDriver`가 EngineDriver 인터페이스의 9개 멤버를 모두 모킹하며, `contextKeyOf`는 실제 엔진과 동일 의미(`ctx._contextKey ?? ctx.executionId`)로 구현됐다. 실제 동작과의 괴리가 최소화됐다.
- 제안: 없음

### [INFO] 테스트 격리 — 적절함
- 위치: `ai-turn-orchestrator.service.spec.ts` L123~143 (`beforeEach`)
- 상세: 각 테스트에서 `handlerRegistry`, `contextService`, `driver`, `mockEventEmitter`, `mockNodeExecutionRepo`를 새로 생성해 테스트 간 상태 오염을 방지한다. `handlerRegistry.register`가 여러 테스트에서 동일 type('ai_agent')으로 호출되지만, `beforeEach`에서 인스턴스가 새로 생성되므로 독립성이 유지된다.
- 제안: 없음

### [WARNING] engine spec에서 logger spy 대상 변경 후 warnSpy.mockRestore() 누락 가능성
- 위치: `execution-engine.service.spec.ts` L5589~5664 (W10/W11 블록의 warnSpy)
- 상세: 엔진 스펙에서 W10/W11 테스트의 logger spy 대상이 `service.logger` → `aiTurnOrchestrator.logger`로 교체됐다. 해당 스펙 블록에서 `warnSpy.mockRestore()` 호출이 올바르게 유지됐는지 diff에서 확인할 수 없으나, 누락 시 다른 테스트의 logger mock이 오염될 수 있다.
- 제안: W10/W11 테스트 블록에서 `warnSpy.mockRestore()`가 `afterEach` 또는 테스트 말미에 호출되는지 확인. `jest.restoreAllMocks()`를 `afterEach`에 추가하면 방어적으로 해결 가능.

### [INFO] `as never` 캐스팅 패턴 — 허용 가능한 수준
- 위치: `execution-engine.service.spec.ts` L11743, L11781 (`makeCtx` 반환값 `as never`)
- 상세: `handleAiResumeTurn`의 시그니처가 `ResumeTurnContext`를 요구하나, 테스트 헬퍼 `makeCtx`의 반환 타입이 좁아 `as never` 캐스팅을 사용했다. 타입 안전성이 낮지만, 런타임 값은 올바르게 전달되며 기존 패턴의 연장선이다.
- 제안: 장기적으로 `makeCtx`의 반환 타입을 `ResumeTurnContext`와 호환되도록 개선할 것을 권장하나, 이번 PR 범위 외.

### [INFO] handleAiResumeTurn 정상 경로 테스트에서 contextService spy 복원 누락
- 위치: `execution-engine.service.spec.ts` 'handleAiResumeTurn: 정상 → _resumeState seed' 테스트 블록
- 상세: `setOutputSpy`가 `aiTurnOrchestrator.contextService.setNodeOutput`을 spy하며 `mockImplementation(() => undefined)`으로 대체한다. `mockRestore()` 또는 `jest.restoreAllMocks()` 없이는 같은 `aiTurnOrchestrator` 인스턴스를 재사용하는 다른 테스트에서 setNodeOutput이 no-op이 될 수 있다. 그러나 각 `beforeEach`에서 `aiTurnOrchestrator`를 재생성하는 상위 describe 블록에서 실행된다면 격리된다. 해당 테스트가 top-level describe 내부의 별도 TestingModule을 사용하는 경우라면 인스턴스 재사용 여부를 확인해야 한다.
- 제안: spy 사용 후 `mockRestore()`를 명시적으로 호출하거나 `afterEach`에서 `jest.restoreAllMocks()`를 적용할 것.

### [INFO] 순수 변환 헬퍼 테스트 — 적절한 커버리지
- 위치: `ai-turn-orchestrator.service.spec.ts` L627~1039 (`buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `buildConversationConfigFromOutput` describe 블록)
- 상세: 이 함수들은 `execution-engine.service.ts`에 정의·export되고 AI 멀티턴 emit 도메인이라 orchestrator spec에 모은 것은 적절하다. 케이스 집합이 기존 엔진 스펙에서 그대로 이동됐고, `buildAiMessageDebugFromResumeState — null/mutation guards` 블록이 추가됐다(shallow-copy 보장). 커버리지 품질이 양호하다.
- 제안: 없음

---

## 요약

C-1 step2 리팩터링에서 AI 멀티턴 생명주기가 `AiTurnOrchestrator`로 추출되면서, 신설 스펙 파일(56개 케이스)과 엔진 스펙 수정이 함께 제출됐다. EngineDriver mock의 설계가 실제 엔진 동작을 충실히 반영하고, W5/extractAiTurnErrorPayload/순수 변환 헬퍼 테스트가 올바르게 재위치됐으며 테스트 격리도 적절하다. 다만 핵심 private 메서드인 `handleAiMessageTurn`과 `emitAiWaitingForInput`에 대한 직접 단위 테스트가 부재하여, 각각 4~5개의 복잡한 분기(contextService absent graceful exit, nodeExec null warn+skip, save throw recover, ai_form_render pendingFormToolCall 등)가 통합 경로에만 의존하거나 전혀 커버되지 않는 상태다. 이 두 메서드는 AI 멀티턴 lifecycle의 park 및 turn 처리 경로의 핵심이므로 보완 테스트가 필요하다.

---

## 위험도

MEDIUM
