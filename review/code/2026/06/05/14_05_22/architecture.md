# Architecture Review — memory-autoinject-extend-e102af

Reviewer: architecture-reviewer
Merge base: 9e65f853
Date: 2026-06-05

---

## 발견사항

### [INFO] 공유 유틸의 레이어/책임 경계 — 적절
- 위치: `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts`
- 상세: `injectConversationContext`는 `ThreadReader<Target>` 인터페이스만 의존하고 `ConversationThreadService` 구체 타입을 import하지 않는다. `modules/execution-engine`도 의존하지 않는다. import 목록은 `modules/llm/interfaces/llm-client.interface`(type only), `shared/conversation-thread/conversation-thread.types`(type only), `shared/conversation-thread/thread-renderer`(순수 유틸) 3개가 전부다. 노드 무관한 순수 변환이며 레이어 오염이 없다.
- 제안: 현행 유지.

### [INFO] 기존 `shared/system-context-prefix.ts` 패턴과 일관
- 위치: `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts`, `system-context-schema.ts`
- 상세: `buildConversationContextSchemaFields(orderStart, opts)` 시그니처는 기존 `buildSystemContextSchemaFields(orderStart, group)` 패턴을 그대로 따른다. 두 헬퍼 모두 (1) `nodes/ai/shared/` 위치, (2) `orderStart` 파라미터로 노드별 UI 순서 조정, (3) 3 노드 모두 spread(`...`) 합성, (4) 별도 `.spec.ts` 단위 테스트를 갖는 구조가 동일하다. 신규 패턴이 기존 관례와 일관하다.
- 제안: 현행 유지.

### [INFO] DRY — schema fragment 공유 및 `gateOnManualMemoryStrategy` 분기
- 위치: `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts:49-55`
- 상세: `gateOnManualMemoryStrategy` 옵션은 AI Agent 전용 `visibleWhen` 가드를 opt-in으로 받는 최소 분기다. text_classifier·information_extractor는 `gateOnManualMemoryStrategy` 없이 호출하며 항상 5 필드가 노출된다. AI Agent는 `gateOnManualMemoryStrategy: true`로 기존 동작(manual 전략 시만 노출)을 100% 보존한다. 분기 로직이 schema 헬퍼 내에서 단순 spread(`...manualGate`)로 처리되어 복잡도가 낮다.
- 제안: 현행 유지.

### [INFO] AI Agent의 memoryStrategy 경로는 ai_agent에 캡슐화 유지
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:1477-1498`, `conversation-context-injection.ts:13-15` (JSDoc)
- 상세: `memoryStrategy ∈ {summary_buffer, persistent}` 자동 메모리 경로의 분기 및 처리 코드는 ai-agent.handler.ts 내부에 그대로 남는다. 공유 유틸 `injectConversationContext`는 `manual contextScope` 경로(thread 읽기+주입)만 처리하며 `memoryStrategy` 개념 자체가 없다. JSDoc에 명시적으로 경계가 기술되어 있어 향후 유지보수 시 오해 가능성이 낮다.
- 제안: 현행 유지.

### [WARNING] 상수 중복 정의 — `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N` vs `DEFAULT_CONTEXT_SCOPE_N`
- 위치: `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts:26`, `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts:24`
- 상세: `conversation-context-injection.ts`는 `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N = 20`을 독자 정의한다. `conversation-context-schema.ts`는 `DEFAULT_CONTEXT_SCOPE_N = 20`을 독자 정의한다. 두 상수는 동일 의미이나 injection 모듈이 schema 모듈로부터 import하지 않고 자체 선언한다. 현재 둘 다 20이므로 동작 상 문제는 없으나, `conversation-context-schema.ts`의 값이 변경될 때 `conversation-context-injection.ts`의 값이 함께 변경되지 않으면 런타임에서 lastN 기본값 불일치가 발생한다(schema UI default와 runtime fallback이 달라짐). `ai-agent.schema.ts`는 이미 schema 모듈의 상수를 re-export하는 방식으로 단일 진실을 맞추었는데, injection 모듈만 이 패턴에서 제외되어 있다.
- 제안: `conversation-context-injection.ts`에서 `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N`을 독자 선언하지 않고 `conversation-context-schema.ts`의 `DEFAULT_CONTEXT_SCOPE_N`을 import해 사용한다. 단, `conversation-context-injection.ts`가 schema(zod) 모듈을 import하면 런타임 의존성이 늘어나므로, 대안으로 상수만 별도 `conversation-context-constants.ts`로 분리하고 두 모듈이 공통 참조하는 방법도 있다.

### [WARNING] `excludeFromConversationThread` 스키마에 있으나 text_classifier.pushClassifierTurn에서 미검사
- 위치: `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts:63-79`
- 상세: `buildConversationContextSchemaFields`를 통해 text_classifier와 information_extractor에 `excludeFromConversationThread` 필드가 schema에 추가됐다. `ConversationThreadService.appendInternal`은 `node.config.excludeFromConversationThread`를 `isOptedOut`으로 검사하므로(conversation-thread.service.ts:223-224), service 레이어에서 opt-out이 동작한다. 그러나 `pushClassifierTurn`(text-classifier)과 `pushExtractorTurn`(information-extractor)은 `node.config` 없이 `appendAiAssistantMessage`를 호출하는데, 호출 시 `node.config: context.rawConfig ?? config`를 전달하므로 실제로는 service 내부 `isOptedOut`이 정상 동작한다. 구조적으로는 OK이나, push 메서드의 JSDoc("No-op when the service is absent or when the node opts out via `excludeFromConversationThread`")이 핸들러 내부에서 config가 전달되는지 명시하지 않아 독자가 opt-out 경로를 추적하려면 service까지 내려가야 한다.
- 제안: `pushClassifierTurn` / `pushExtractorTurn` JSDoc에 "opt-out은 service.appendInternal의 isOptedOut이 node.config를 검사해 처리됨"을 한 줄 추가한다. 동작 변경 불필요.

### [INFO] information_extractor multi-turn의 no-inputField 분기에서 context injection 미적용
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:413-428`
- 상세: `!inputField` 분기는 system 메시지만 포함한 messages로 waiting 상태를 반환한다(사용자 첫 메시지 대기). 이 경로에서 `injectConversationContext`가 호출되지 않아 context가 주입되지 않는다. 첫 실제 LLM 호출은 사용자 입력을 받은 이후의 후속 turn에서 이뤄지므로, 그 시점(state.messages 재사용)에는 이미 주입이 완료된 messages가 없는 상태다. 즉 no-inputField → 대기 → 사용자 입력 경로에서는 context injection이 누락된다. 이 경로가 현재 spec 범위인지 명확하지 않다(diff 내 주석에 언급 없음).
- 제안: no-inputField 경로에서도 `injectConversationContext`를 적용해 system 메시지에 context를 주입한 뒤 waiting 상태로 진입하거나, 이 경로의 미지원이 의도된 것임을 주석에 명시한다.

### [INFO] 순환 의존성 없음
- 위치: `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts`
- 상세: 의존 방향: `nodes/ai/shared` → `shared/conversation-thread`(domain types, renderer), `modules/llm/interfaces`(type only). `modules/execution-engine`을 import하지 않는다. 3 핸들러(`ai-agent`, `text-classifier`, `information-extractor`)가 `nodes/ai/shared`를 import하지만, 역방향 참조는 없다. 순환 없음.
- 제안: 현행 유지.

### [INFO] 확장성 — 4번째 AI 노드 추가 시 공유 유틸 재사용 가능
- 위치: `codebase/backend/src/nodes/ai/shared/`
- 상세: `ThreadReader<Target>` 제네릭 인터페이스와 `buildConversationContextSchemaFields(orderStart, opts)` 패턴은 새 AI 노드가 추가될 때 동일한 두 줄 배선(`...buildConversationContextSchemaFields(N)` + `injectConversationContext(...)`)으로 확장 가능하다. memoryStrategy 개념 없는 노드는 opts 없이 호출하면 된다. 현행 구조가 개방-폐쇄 원칙을 잘 따른다.
- 제안: 현행 유지.

---

## 요약

핵심 리팩터링(AI Agent의 `injectThreadContext` 추출 → `shared/conversation-context-injection.ts`)은 SOLID 원칙, 레이어 경계, 응집도 측면에서 적절하게 수행됐다. `ThreadReader<Target>` 최소 인터페이스 설계로 공유 유틸이 `ConversationThreadService` 구체 타입에 의존하지 않으며, 순환 의존성도 없다. `buildConversationContextSchemaFields`는 기존 `buildSystemContextSchemaFields` 패턴을 그대로 답습해 일관성이 높다. AI Agent의 `memoryStrategy` 자동 경로는 ai-agent 내부에 캡슐화 유지됐다. 두 가지 지적 사항이 있다: (1) `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N`과 `DEFAULT_CONTEXT_SCOPE_N`이 동일 값임에도 두 파일에 각각 선언되어 향후 drift 위험이 있고, (2) information_extractor multi-turn의 no-inputField 분기에서 context injection이 미적용된다. 둘 다 현재 동작에는 영향이 없으나 향후 유지보수 시 혼란을 줄 수 있다.

---

## 위험도

LOW

---

BLOCK: NO
