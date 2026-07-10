# 재검증 (testing) — WARNING#1(resume state.* 조립 미검증) 해소 확인

## 발견사항

이번 회차에서는 CRITICAL/WARNING 급 결함을 발견하지 못했다. 검증 과정과 근거는 다음과 같다.

- **[INFO]** 신규 resume 테스트가 `state.* → llmContext` 조립을 실값으로 왕복 검증함을 실측 확인
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts:395~466` (`'multi-turn resume: summary 압축 chat 이 재주입된 state.* 를 llm_usage_log llmContext 로 채운다 …'`)
  - 상세: 프로덕션 배선을 코드 추적으로 확인했다.
    1. `AiTurnExecutor.processMultiTurnMessage` 내부 `const executionId = state.executionId as string | undefined;` (`ai-turn-executor.ts:2563`) → `applyMultiTurnTurnMemory({..., executionId})` 호출(`:2582~2591`).
    2. `applyMultiTurnTurnMemory` 는 `llmContext: { workflowId: state.workflowId, executionId, nodeExecutionId: state.nodeExecutionId }` 를 조립해 `memoryManager.injectMemoryContext` 에 전달(`:2298~2302`).
    3. `AiMemoryManager.injectMemoryContext` 는 `args.llmContext` 를 그대로 `buildSummaryBufferUpdate({..., llmContext})` 로 forward(`ai-memory-manager.ts:252~254`).
    4. `buildSummaryBufferUpdate` 는 `llmService.chat(config, params, llmContext)` 의 **3번째 위치 인자**로 그대로 전달(`agent-memory-injection.ts:382~391`).
    테스트는 `handler.execute()` 로 실제 `_resumeState` 를 얻은 뒤(`state.workflowId/executionId/nodeExecutionId` 를 엔진 재주입값으로 override) `processMultiTurnMessage` 를 호출하고 `mockLlmService.chat.mock.calls[0][2]` 를 직접 단언한다 — 4개 레이어를 실제로 통과한 값을 검증하므로 caller 리터럴 forwarding 만 보는 종전 `ai-memory-manager.spec.ts` 테스트와 달리 **end-to-end**.
  - 결론: 직전 WARNING이 지적한 갭(=resume 경로 미검증, single-turn 과 비대칭)이 해소됐다.

- **[INFO]** `calls[0]` 이 요약(압축) chat 이라는 전제와 `summarized:true` 단언의 보장력을 뮤테이션 테스트로 실측 검증
  - 위치: `ai-agent.memory.spec.ts:453~465`
  - 상세: (a) 코드 추적상 `applyMultiTurnTurnMemory`(요약 chat, `injectMemoryContext` 내부에서 발생)가 메인 턴 `llmService.chat` 호출(`ai-turn-executor.ts:2620`)보다 먼저 실행되므로 `calls[0]`=요약, `calls[1]`=메인이 코드 구조상 보장된다. multi-turn 첫 `execute()` 호출(초기 `waiting_for_input` 빌드)은 LLM 콜을 발생시키지 않음(코드에 `chat(` 호출 없음, 기존 `ai-turn-executor.spec.ts:382` 회귀로도 별도 고정)도 확인. (b) `expect(meta.memory).toMatchObject({strategy:'summary_buffer', summarized:true})` 단언이 `calls[0][2]` 단언보다 **먼저** 실행되므로, 압축이 실제로 발생하지 않으면(예: `memoryTokenBudget` 조정 실수·seed turn 부족) 이 단언에서 먼저 실패해 후속 call-index 단언이 거짓 통과(false positive)할 위험을 차단한다.
  - 검증 방법: 실제로 `ai-turn-executor.ts` 의 `llmContext: {...}` 조립을 `llmContext: undefined` 로, 그리고 별도로 `nodeExecutionId: state.nodeExecutionId` → `nodeExecutionId: state.nodeId` (테스트 docstring 이 명시한 정확히 그 회귀 클래스, 커밋 `2db810893`) 로 각각 mutate 후 `npx jest ai-agent.memory.spec.ts -t "multi-turn resume"` 재실행 — 두 mutation 모두 신규 테스트가 정확한 diff 로 실패시킴을 확인(`nodeExecutionId: "agent-1"` vs 기대 `"ne-resume-row"` 등). 원본 복원 후 전체 스위트(54개) 재통과 확인.

- **[INFO]** `ai-memory-manager.spec.ts` `threadFake.updateSummaryState` 추가는 신규 forwarding 테스트에 필요한 최소 변경이며 기존 테스트에 영향 없음
  - 위치: `ai-memory-manager.spec.ts:31~32`
  - 상세: `injectMemoryContext` 는 `update.summarized && args.target` 일 때만 `conversationThreadService.updateSummaryState(...)` 를 호출한다(`ai-memory-manager.ts:243~257` 부근). `origin/main` 기준 이 spec 파일의 기존 테스트 중 `memoryTokenBudget` 을 좁히거나 대용량 turn 을 seed 한 케이스가 없어(`grep` 확인) 압축이 실제 트리거된 적이 없었고, 따라서 이 mock 부재가 기존 테스트를 깨지 않았다. 신규 forwarding 테스트(§1.3, `:304~350`)만 실제로 압축을 트리거하므로 해당 mock 이 필요해졌다. 부수효과 없는 no-op mock으로 안전하게 추가됨.
  - 참고: 이 테스트(`ai-memory-manager.spec.ts`)는 여전히 "manager 레이어 forwarding 계약"만 검증하도록 스코프가 정정됐고, 실값 조립 검증 책임은 `ai-agent.memory.spec.ts` 로 명확히 이관됐다는 주석 정정도 diff 에 포함되어 있다 — 두 스펙의 책임 분담이 코드와 일치한다.

- **[INFO]** single-turn 대칭 테스트(`compresses oldest turns...`)도 동일 패턴으로 보강됨 (WARNING 범위 밖이나 확인)
  - 위치: `ai-agent.memory.spec.ts:531~594`
  - 상세: `makeContext({ nodeExecutionId: 'ne-row-1' })` 로 실제 `context.nodeExecutionId` 를 채우고 `calls[0][2]` 를 단언 — resume 경로와 대칭적으로 single-turn 요약 chat attribution 도 실값 검증. 회귀 없음, 정상 통과.

- **[INFO]** 재검증 범위 밖(회귀 없음 확인용 참고) — 메인(비요약) resume chat 의 attribution
  - 위치: `ai-turn-executor.spec.ts:504~530` (`'does not count condition tools toward toolCalls...'`, `secondCallCtx` 단언, ai-review INFO#3 기존 커밋)
  - 상세: 이번 diff 대상은 아니지만, resume 턴의 "메인" chat 호출(`ai-turn-executor.ts:2614~2618`) 쪽 `state.* → llmContext` 조립은 이 기존 테스트가 이미 실값 검증 중임을 확인했다. 즉 resume 경로의 두 chat 호출 지점(요약/메인) 모두 이제 실값 커버리지를 갖는다.

## 요약

직전 WARNING(multi-turn resume 경로의 `state.workflowId`/`state.nodeExecutionId` → 요약 압축 chat `llmContext` 조립이 실값 미검증)은 이번 diff 로 완전히 해소됐다고 판단한다. 신규 `ai-agent.memory.spec.ts` 테스트는 실제 `handler.execute()` 산출 `_resumeState` 를 기반으로 엔진 재주입(`buildRetryReentryState`)을 시뮬레이션하고, `applyMultiTurnTurnMemory → injectMemoryContext → buildSummaryBufferUpdate → llmService.chat` 4개 레이어를 관통하는 실값을 `calls[0][2]` 로 직접 단언한다. `calls[0]`=요약 콜이라는 전제는 코드 구조(요약 호출이 메인 호출보다 선행)와 `meta.memory.summarized:true` 선행 단언으로 이중 보장되며, 뮤테이션 테스트(정상 배선 제거·`nodeId`↔`nodeExecutionId` 스왑)로 테스트가 실제로 실패함을 실측했다 — 과약속이나 vacuous pass 가 아니다. `ai-memory-manager.spec.ts` 의 `threadFake.updateSummaryState` 추가 및 주석 정정도 스코프가 정확하고 부작용이 없다. 관련 스펙 전체(54 tests) 그린.

## 위험도
NONE
