# Testing Review

## 발견사항

### [WARNING] AiMemoryManager 전용 단위 테스트 파일 없음
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (신규 398줄 클래스)
- 상세: `AiConditionEvaluator` 추출(M-1 1단계)에는 `ai-condition-evaluator.spec.ts` 가 전용 단위 테스트로 신설됐다. 이번 M-1 2단계에서 추출한 `AiMemoryManager` 는 동형 패턴임에도 `ai-memory-manager.spec.ts` 가 존재하지 않는다. 현재 커버리지는 전적으로 `ai-agent.memory.spec.ts` 가 `AiAgentHandler` 를 통해 간접적으로 검증하는 통합 경로에만 의존한다. 핸들러를 끼지 않고 `AiMemoryManager` 인스턴스만 직접 테스트하는 단위 격리 경로가 없다.
- 제안: `ai-memory-manager.spec.ts` 를 신설해 `resolveMemoryStrategy`, `injectMemoryContext`, `scheduleMemoryExtraction` 을 `AiMemoryManager` 인스턴스 직접 호출로 테스트한다. `AiConditionEvaluator` 선례(`ai-condition-evaluator.spec.ts`)와 동형 구조로 작성하면 된다.

### [INFO] 간접 커버리지는 충분히 넓다
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts`
- 상세: `ai-agent.memory.spec.ts` 는 1628줄, 30개 이상의 케이스로 `summary_buffer`/`persistent`/`manual` 3전략, single-turn/multi-turn, recall fallback, snapshot 격리, AGM-08 증분 추출, M1 dedup-drop watermark, AGM-10 TTL, W7 경계값, C1 회귀, summaryModelConfigId/extractionModelConfigId 분리, thread service 미주입 graceful degrade 등 핵심 동작 경로를 빈틈 없이 커버한다. `ai-agent.memory.spec.ts` 는 refactor 이전의 핸들러 private 메서드를 테스트하던 시절과 동일한 통합 인터페이스를 유지하므로 **회귀 테스트로서의 유효성은 보존된다**.

### [INFO] resolveMemoryStrategy 경계값: 알 수 없는 문자열 → manual 폴백 케이스 미포함
- 위치: `ai-memory-manager.ts` `resolveMemoryStrategy`, `ai-agent.memory.spec.ts`
- 상세: 현재 테스트는 `memoryStrategy` 미설정(`undefined`)과 `'manual'` 명시를 각각 커버하지만, 알 수 없는 문자열(`'unknown_strategy'` 등)을 넣었을 때 `manual` 로 폴백하는 경로는 테스트되지 않는다. 이 분기는 3줄 로직이고 회귀 위험이 낮지만, 전용 단위 테스트를 추가하면 명세가 명확해진다.
- 제안: `resolveMemoryStrategy('unknown_value')` → `'manual'` 케이스를 단위 테스트(또는 신설 `ai-memory-manager.spec.ts`)에 추가.

### [INFO] injectMemoryContext system 메시지 없는 messages 배열 경로 미검증
- 위치: `ai-memory-manager.ts` `injectMemoryContext` (messages 모드 분기, `systemIdx = -1` → `insertAt = 0`)
- 상세: `messages` 배열에 `role: 'system'` 메시지가 없을 때 `insertAt = 0` 로 꼬리를 맨 앞에 splice 하는 경로가 있다. 현재 테스트는 시스템 메시지를 항상 포함하는 컨텍스트로만 실행되므로 이 경로는 커버되지 않는다.
- 제안: 신설 단위 테스트에서 `messages: []` 또는 `messages: [{ role: 'user', content: '...' }]` (system 없음) 케이스를 추가.

### [INFO] Mock 적절성 — AiAgentHandler 통합 테스트 내 llmService mock 은 실용적
- 위치: `ai-agent.memory.spec.ts` `beforeEach` mock 설정
- 상세: `mockLlmService.chat` 를 `jest.fn().mockResolvedValue(...)` 으로 교체하고 summary 콜과 main 콜을 `mockResolvedValueOnce` 체이닝으로 분리하는 방식은 실제 LLM 호출 순서와 인자를 검증하는 데 충분하다. `scheduleExtraction` mock 이 `boolean` 을 반환해 watermark 전진 여부를 검증하는 패턴도 `sharedScheduleMemoryExtraction` 의 실제 반환 타입과 일치한다.

### [INFO] 테스트 격리 — 각 테스트가 makeContext() 로 독립 ExecutionContext 생성
- 위치: `ai-agent.memory.spec.ts` 전반
- 상세: `conversationThreadService = new ConversationThreadService()` 를 `beforeEach` 에서 새로 생성하고, `makeContext()` 가 매 호출마다 독립 `conversationThread` 객체를 반환하므로 테스트 간 상태 누적 문제는 없다. 단, multi-turn 시나리오에서 `state` 변수를 `let` 으로 선언하고 재할당하는 패턴은 의도적 설계이며 격리에 위반되지 않는다.

## 요약

`AiMemoryManager` 추출은 behavior-preserving refactor 로 동작 보존 불변식을 유지한다. 기존 `ai-agent.memory.spec.ts` 가 핸들러를 통한 1628줄 통합 테스트로 30개 이상 케이스를 커버하므로 회귀 안전망은 사실상 유지된다. 단, `AiConditionEvaluator` 추출(M-1 1단계)에는 `ai-condition-evaluator.spec.ts` 전용 단위 테스트가 신설됐는데 `AiMemoryManager` 에는 동형 전용 파일이 없다는 선례 불일치가 주된 갭이다. `resolveMemoryStrategy` 미지 문자열 폴백, `injectMemoryContext` system 메시지 없는 messages 배열 두 경로가 직접 단위 테스트로 커버되지 않는다. 이는 CI 차단 수준이 아니라 기술 부채로, 전용 `ai-memory-manager.spec.ts` 신설로 해소할 수 있다.

## 위험도
LOW
