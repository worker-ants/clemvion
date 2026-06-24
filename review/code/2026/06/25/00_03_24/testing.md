# 테스트(Testing) 코드 리뷰

## 발견사항

- **[INFO]** 신규 추출 private 메서드 3종에 대한 직접 단위 테스트 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts`
  - 상세: `buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection` 세 메서드가 `private` 로 선언되어 있어 직접 호출 불가하다. 현재 `executeSingleTurn` 단위 테스트 2건(plain text 응답·eventEmitter 없음)이 간접 커버하지만, 각 메서드의 개별 책임(§11.4 ordering 조립·ai_user push timing·memoryStrategy 분기)은 직접 검증되지 않는다. 행위 보존 리팩토링이므로 기존 테스트가 회귀 보호를 제공하지만, private 메서드 단위 커버는 공개 인터페이스 테스트에 완전히 의존한다.
  - 제안: 허용 가능 수준. 다만 향후 `buildSingleTurnSystemPrompt`에 로직이 추가될 때를 대비해 §11.4 ordering 을 직접 단언하는 `executeSingleTurn` 테스트(KB 있는 경우 `KB_TOOL_GUIDANCE` 포함 여부, conditions 있는 경우 suffix 포함 여부, presentationTools 있는 경우 `PRESENTATION_TOOLS_GUIDANCE` 포함 여부)를 `ai-turn-executor.spec.ts` 에 추가하면 회귀 방지가 강화된다.

- **[WARNING]** `buildSingleTurnSystemPrompt` 의 §11.4 ordering 브랜치 커버리지 갭
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `buildSingleTurnSystemPrompt` 메서드, `ai-turn-executor.spec.ts` `executeSingleTurn` describe 블록
  - 상세: 현재 `executeSingleTurn` 테스트는 `knowledgeBases: []` 와 `conditions: []` 만 사용한다. 실제 `buildSingleTurnSystemPrompt` 내부의 세 조건 분기(`knowledgeBases.length > 0` → KB_TOOL_GUIDANCE 추가, `conditions.length > 0` → condition suffix 추가, `config.presentationTools.length > 0` → PRESENTATION_TOOLS_GUIDANCE 추가)는 executor spec 에서 전혀 테스트되지 않는다. 이 세 경로는 `ai-agent.handler.spec.ts` 에서 handler 경유로 간접 커버되나, executor 레벨 격리 테스트가 없다. 이번 리팩토링으로 세 브랜치가 하나의 메서드 안에 응집되었으므로, 이 메서드에 변경이 생길 경우 회귀 탐지 경로가 handler spec 에만 의존하게 된다.
  - 제안: `ai-turn-executor.spec.ts` 의 `executeSingleTurn` describe 에 다음 케이스 추가를 권장한다: (1) `knowledgeBases: ['kb-1']` 전달 시 `llmService.chat` 호출 messages 의 system content 에 `KB_TOOL_GUIDANCE` 식별 문자열 포함 여부 단언, (2) `conditions: [{...}]` 전달 시 condition suffix 포함 여부, (3) `presentationTools: ['render_table']` 전달 시 `PRESENTATION_TOOLS_GUIDANCE` 포함 여부.

- **[INFO]** `buildSingleTurnMessages` 의 `ai_user` push 타이밍 회귀 테스트 부재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts`
  - 상세: spec §6.1 단계 1.7 과 consistency 검토 INFO-3 이 지적한 `ai_user` push 가 LLM 호출 전에 단 1회 발생해야 한다는 불변식이 테스트로 고정되어 있지 않다. `conversationThreadService` 가 미주입 상태(`undefined`)로 테스트가 실행되므로 thread push 자체가 no-op degrade 된다. 실제 `pushAiThreadTurn` 호출 타이밍 회귀를 잡으려면 mock service 주입이 필요하다.
  - 제안: `conversationThreadService` mock 을 주입한 executor fixture 를 만들어 `executeSingleTurn` 호출 후 `appendAiUserMessage` 가 정확히 1회, `llmService.chat` 이전에 호출됐는지 jest mock 호출 순서로 검증하는 테스트 추가.

- **[INFO]** `applySingleTurnMemoryInjection` 의 `memoryStrategy` 비-manual 분기 executor 레벨 테스트 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts`
  - 상세: `executor` 는 `AiMemoryManager(mockLlmService, undefined, undefined)` 로 초기화되어 `summary_buffer`·`persistent` 전략은 실제 동작이 불가(agentMemoryService 미주입 → graceful degrade)하다. `applySingleTurnMemoryInjection` 내 `memoryStrategy !== 'manual'` 분기(`this.memoryManager.injectMemoryContext` 호출 경로)는 executor spec 에서 완전히 커버되지 않는다.
  - 제안: `ai-agent.memory.spec.ts` 에 `summary_buffer` 전략 경로가 이미 커버되어 있다면 현재 수준은 허용 가능. 없다면 `AiMemoryManager.injectMemoryContext` mock 을 주입한 간접 테스트 추가를 고려.

- **[INFO]** `buildSingleTurnMessages` 의 빈 `userPrompt`/`systemPrompt` 엣지 케이스 미테스트
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts`
  - 상세: `buildSingleTurnMessages` 는 `userPrompt` 가 빈 문자열이면 user 메시지를 messages 에 추가하지 않고 `pushAiThreadTurn` 도 호출하지 않는다. `finalSystemPrompt` 가 빈 경우도 동일하다(system 메시지 미추가 분기). 이 두 엣지 케이스는 executor spec 에서 명시적으로 테스트되지 않는다. 현재 테스트는 두 필드 모두 값이 있는 happy path 만 다룬다.
  - 제안: executor spec 에 `userPrompt: ''` 및 `systemPrompt: ''` 케이스를 추가해 `llmService.chat` 에 전달되는 messages 배열에 해당 role 항목이 없음을 단언.

- **[INFO]** `llmService.chat` mock 이 전달된 messages 내용을 검증하지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` `beforeEach`
  - 상세: `mockLlmService.chat` 는 호출 여부(`toHaveBeenCalledTimes`)만 확인하고, 실제로 전달된 `messages` 배열 내용을 단언하지 않는다. 새 private 메서드들이 messages 를 조립하는 로직을 담당하게 되었으므로, 메시지 조립 결과가 잘못되어도 현재 테스트는 통과할 수 있다.
  - 제안: `buildSingleTurnSystemPrompt` / `buildSingleTurnMessages` 결과를 검증하는 테스트를 추가할 때 `expect(mockLlmService.chat).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([...]) }), ...)` 형태의 messages 내용 단언을 포함할 것.

- **[INFO]** 테스트 격리 양호 — 기존 테스트 회귀 위험 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 전반
  - 상세: `beforeEach` 에서 모든 mock 이 재설정되고, 각 `describe` 블록이 자체 fixture factory 를 보유한다. `buildExecutor` helper 가 매 테스트마다 새 인스턴스를 생성하므로 테스트 간 상태 누출 위험이 없다. 기존 테스트(473건 포함 7388건)가 PR 후에도 PASS 함이 커밋 메시지에서 확인된다.

## 요약

이번 변경은 `executeSingleTurn` 의 setup 단계를 3개 private 메서드로 추출한 behavior-preserving 리팩토링이다. 기존 단위 테스트(7388건, e2e 214건 PASS)가 회귀 보호를 제공하며 테스트 격리·mock 구조에는 문제가 없다. 주요 커버리지 갭은 `buildSingleTurnSystemPrompt` 의 §11.4 ordering 세 분기(KB_TOOL_GUIDANCE, condition suffix, PRESENTATION_TOOLS_GUIDANCE)가 executor 레벨에서 테스트되지 않는다는 점이다 — 현재 handler spec 에서는 간접 커버되므로 즉각적인 회귀 위험은 낮으나, executor 를 직접 변경할 때 탐지 능력 부족이 드러날 수 있다. `ai_user` push timing invariant, 빈 프롬프트 엣지 케이스, 비-manual memoryStrategy 분기 등 추가 보강 포인트도 존재한다.

## 위험도

LOW
