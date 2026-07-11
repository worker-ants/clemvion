# 테스트(Testing) 리뷰 — ai-usage-attribution-hardening

## 발견사항

- **[CRITICAL]** 커버리지 갭이 실제 attribution 버그를 놓치고 있음 — single-turn AI Agent 의 롤링 요약 압축 chat 에서 `workflowId`/`nodeExecutionId` 가 항상 NULL 로 남는다
  - 위치:
    - `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:294-298` (`injectMemoryContext` 의 `llmContext` 구성 — `args.config.workflowId`/`args.config.nodeExecutionId` 를 읽음)
    - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1149-1164` (`applySingleTurnMemoryInjection` → `injectMemoryContext` 호출부, single-turn 경로는 `config` 로 **raw 노드 config**(`executeSingleTurn(_input, config, context)` 의 `config` 그대로)를 전달함)
  - 상세: `ai-memory-manager.ts` 의 주석은 "workflowId/nodeExecutionId 는 config(=resume state, 엔진 buildRetryReentryState 가 주입)에서 읽는다. 첫 턴 등 미주입 시 undefined→NULL" 이라고 명시한다. 이 전제는 **multi-turn resume 호출부**(`applyMultiTurnTurnMemory`, `ai-turn-executor.ts:2275` `config: state`)에서만 성립한다. `state` 는 엔진이 `workflowId`/`nodeExecutionId` 를 주입하는 resume state 이기 때문이다.
    그러나 **single-turn 호출부**(`ai-turn-executor.ts:1149`)에서는 `config` 파라미터가 사용자가 작성한 노드 config(`executeSingleTurn(_input, config, context)`) 그대로 전달된다. `ai-agent.schema.ts` 를 grep 해도 `workflowId`/`nodeExecutionId` 필드는 config 스키마에 존재하지 않는다 — 즉 `args.config.workflowId`/`args.config.nodeExecutionId` 는 single-turn 경로에서 **항상** `undefined` 다.
    반면 같은 스코프에 `context: ExecutionContext` 가 이미 있고, `ExecutionContext.workflowId`(필수) / `ExecutionContext.nodeExecutionId`(엔진이 dispatch 직전 항상 주입, `node-handler.interface.ts:32-51`) 는 실제 값을 갖고 있다. 이 값이 `injectMemoryContext` 로 전달되지 않는다.
    또한 `memoryStrategy` 필드는 `ai-agent.schema.ts` 상 `mode`(single/multi turn) 로 게이팅되지 않는다(`maxTurns` 만 `visibleWhen: mode=multi_turn`) — 즉 single-turn AI Agent 노드에서도 `summary_buffer`/`persistent` 전략과 실제 롤링 요약 압축(다른 노드가 채운 워크플로-스코프 ConversationThread 를 압축)이 정상적으로 발생할 수 있는 살아있는 코드 경로다. 따라서 이 버그는 이론적 사각지대가 아니라 실제로 도달 가능하다.
    이 gap 은 어떤 테스트로도 드러나지 않는다: `agent-memory-injection.spec.ts` 의 신규 테스트는 `llmContext` 를 **명시적으로 호출자가 만들어 전달**하는 시나리오만 검증하고(즉 `buildSummaryBufferUpdate` 가 받은 인자를 그대로 forward 하는지만 확인), `ai-memory-manager.spec.ts` / `ai-agent.memory.spec.ts` 어느 쪽도 실제 요약 chat 호출의 3번째 인자(`llmContext`)를 assert 하지 않는다(아래 WARNING 참조). `ai-agent.memory.spec.ts` 는 `context.workflowId = 'wf-1'`(22-23행)을 이미 fixture 로 갖고 있고 single-turn `summary_buffer`/`persistent` 통합 테스트를 다수 보유하므로(`describe('summary_buffer (single-turn)')` 등), 이 gap 을 잡기 위한 재료는 이미 갖춰져 있다.
  - 제안: (a) 구현 수정 — `injectMemoryContext` 시그니처에 `workflowId`/`nodeExecutionId` 를 `config` 파생이 아니라 명시 파라미터로 받도록 바꾸고, single-turn 호출부는 `context.workflowId`/`context.nodeExecutionId` 를, multi-turn 호출부는 `state.workflowId`/`state.nodeExecutionId` 를 각각 전달하게 한다. (b) 테스트 — `ai-agent.memory.spec.ts` 의 기존 single-turn `summary_buffer`/`persistent` 압축 트리거 테스트 중 하나에 `mockLlmService.chat.mock.calls[<summaryCallIdx>][2]` 를 assert 하는 한 줄을 추가해 `workflowId: 'wf-1'` 이 실제로 전달되는지 고정한다(현재는 이 assertion이 없어 회귀를 못 잡는다). 본 PR 이 "노드 내부 실행 유일 잔여 갭 해소"를 목표로 명시하는 만큼, single-turn 경로가 실제로 해소되었는지 검증 없이는 목표 미달성 가능성이 있다.

- **[WARNING]** `AiMemoryManager.injectMemoryContext` 의 `llmContext` 유도 로직 자체가 unit/integration 어느 레벨에서도 직접 검증되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` (`llmFake()` 헬퍼, 1-31행 / `describe('injectMemoryContext', ...)` 182-400행)
  - 상세: `llmFake()` 는 `{ resolveConfig: jest.fn() }` 만 제공하고 `chat` 을 제공하지 않는다. `injectMemoryContext` 의 모든 기존 테스트는 `threadFake([], [])`(빈 turns)를 쓰거나 짧은 텍스트만 써서 `buildSummaryBufferUpdate` 의 "예산 이하 → LLM 미호출" 분기만 타도록 구성되어 있다 — 즉 실제로 `llmService.chat` 이 호출되는 압축 경로(이번 diff 가 `llmContext` 를 새로 배선한 바로 그 경로)는 이 spec 파일에서 단 한 번도 실행되지 않는다. 만약 새 테스트를 시도해도 `llmFake()` 에 `chat` 이 없어 `TypeError` 로 즉시 실패하므로(fail-loud 자체는 긍정적이나), 현재는 그 경로를 아예 회피하고 있다.
  - 제안: `llmFake()` 에 `chat: jest.fn().mockResolvedValue({ content: 'S', usage: {...}, model: 'm', finishReason: 'stop' })` 를 추가하고, 큰 turns 배열로 예산을 초과시켜 요약이 실제 트리거되는 케이스를 최소 1개 추가한다. 그 케이스에서 `chat.mock.calls[0][2]` 이 `{ workflowId: args.config.workflowId, executionId: args.executionId || undefined, nodeExecutionId: args.config.nodeExecutionId }` 와 일치하는지 직접 검증한다. 이 테스트가 있었다면 위 CRITICAL 항목(single-turn config 에 workflowId 부재)이 `undefined` 로 나오는 것을 즉시 잡아냈을 것이다.

- **[INFO]** `agent-memory-injection.spec.ts` 신규 테스트는 `llmContext` **명시 전달** 케이스만 커버 — `llmContext` 생략(undefined) 시 `chat` 호출에 실제로 무엇이 전달되는지(3번째 인자 `undefined`)를 고정하는 회귀 테스트는 없음
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts:1927-1965`("compresses oldest turns...") 는 `llmContext` 를 전달하지 않고 압축을 트리거하지만 `llm.chat.mock.calls[0][2]` 를 assert 하지 않는다.
  - 상세: `BuildSummaryBufferArgs.llmContext` 의 doc 주석은 "미전달 시 NULL(기존 동작)"을 명시적 계약으로 서술한다. 이 계약(=하위호환: `llmContext` 생략 시 `llmService.chat(..., undefined)` 로 호출되어야 함)을 고정하는 테스트가 없으면, 향후 리팩터링에서 `llmContext ?? {}` 같은 실수가 들어가도(빈 객체를 3번째 인자로 넘기는 등) 감지되지 않는다.
  - 제안: 저비용 보강 — 기존 "compresses oldest turns..." 테스트(2708행 부근)에 `expect(llm.chat.mock.calls[0][2]).toBeUndefined();` 한 줄만 추가하면 충분하다.

- **[INFO]** 파일 2 (`ai-turn-executor.ts`) 의 B1 변경은 순수 컴파일타임 하드닝(명시 타입 주석 `LlmCallContext`)이라 런타임 동작 변화가 없음 — 신규 런타임 테스트는 불필요하며, 기존 `ai-turn-executor.spec.ts:445` (`passes llmContext (workflowId/executionId/nodeExecutionId row PK) to the resume-turn LLM chat`)가 회귀 안전망으로 그대로 유효하다. 다만 이 변경의 목적(필드 오탈자를 excess-property check 로 **컴파일 타임**에 잡는 것)은 test suite(jest) 가 아니라 `tsc` 빌드 게이트로만 검증되므로, plan 의 "TEST WORKFLOW" 에 `backend build(tsc) 0 errors`가 별도 항목으로 명시되어 있는 것은 적절하다. type-level 테스트(`// @ts-expect-error` 로 오탈자 필드 주입 시 컴파일 실패를 명시적으로 고정하는 테스트)는 선택 사항으로만 제안한다.

## 요약

이번 diff 는 두 갈래다: (1) `ai-turn-executor.ts` 의 순수 타입 하드닝(B1)은 런타임 불변이라 기존 테스트로 충분히 회귀 방지되고, `agent-memory-injection.spec.ts` 에 추가된 신규 unit 테스트는 `buildSummaryBufferUpdate` 가 전달받은 `llmContext` 를 `llm.chat` 3번째 인자로 정확히 forward 한다는 것을 잘 검증한다. 그러나 (2) 이번 PR 의 핵심 목표인 "AI Agent 자동 메모리 롤링 요약 압축의 attribution 배선"(`ai-memory-manager.ts` 의 `llmContext` **유도** 로직)은 어떤 테스트로도 실행되지 않는다 — `ai-memory-manager.spec.ts` 의 mock 이 `chat` 을 아예 제공하지 않아 압축 트리거 경로가 spec 에서 회피되고 있고, 풍부한 통합 테스트를 가진 `ai-agent.memory.spec.ts` 도 요약 chat 호출의 3번째 인자를 한 번도 assert 하지 않는다. 이 커버리지 공백을 코드 추적으로 메워본 결과, single-turn AI Agent 실행 경로에서는 `injectMemoryContext` 에 전달되는 `config` 가 (resume state 가 아니라) 순수 노드 config 여서 `workflowId`/`nodeExecutionId` 필드가 애초에 존재하지 않는다는 실제 기능 버그를 발견했다 — 즉 이번 PR 이 명시적으로 "해소했다"고 주장하는 잔여 attribution 갭이 multi-turn resume 경로에서만 닫히고 single-turn 경로에서는 여전히 열려 있을 가능성이 높다. 이는 테스트 부재가 실제 결함을 은폐한 전형적 사례이며, plan 문서의 테스트 항목(`agent-memory-injection.spec` 단위 테스트 하나만 명시)이 이 구조를 정확히 반영한다 — 통합 레벨 assertion 이 계획에도 애초에 없었다.

## 위험도

HIGH
