# Side Effect Review — memory-autoinject-extend-e102af

**대상**: `git diff 9e65f853..HEAD -- codebase/`
**날짜**: 2026-06-05
**검토자**: side-effect reviewer

---

## CRITICAL

없음.

---

## WARNING

- **[WARNING] information-extractor single-turn: `system_text` 모드에서 `injected.finalSystemPrompt` 미사용**
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L226-237
  - 상세: `injectConversationContext` 가 `system_text` 모드로 실행될 때 두 값을 반환한다: `injected.messages`(시스템 메시지 content 갱신됨)와 `injected.finalSystemPrompt`(확장된 문자열). handler는 `singleTurnMessages = injected.messages` 만 취하고 `injected.finalSystemPrompt` 는 버린다. LLM 호출에는 `messages[0].content` 가 이미 갱신된 systemPrompt 를 담고 있어 **LLM 입력은 정확하다**. 그러나 해당 핸들러의 `metadata.output` 이나 후속 디버그 echo 에서 `finalSystemPrompt` 를 별도로 기록한다면 stale 값이 남게 된다. text-classifier 도 동일 패턴(L191 `injected.messages` 만 사용).
  - ai-agent는 `singleTurnInjection.finalSystemPrompt` 를 `finalSystemPrompt` 변수에 할당해 이후 모든 경로에서 사용함 — 신규 노드들은 해당 변수를 사용하지 않음.
  - 제안: `injected.finalSystemPrompt` 를 지역 변수로 받아 향후 디버그 로그 / output echo 에 일관되게 사용할 준비를 해 두거나, 현재 사용처가 없음을 주석으로 명시한다.

- **[WARNING] information-extractor multi-turn: `system_text` 모드에서 `injected.finalSystemPrompt` 미사용 (멀티턴)**
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L429-450
  - 상세: multi-turn 경로도 `.messages` 만 취한다 (`const messages: ChatMessage[] = injectConversationContext(...).messages`). single-turn과 동일하게 LLM 입력 자체는 올바르지만 `finalSystemPrompt` 가 소비되지 않는다.

---

## INFO

- **[INFO] ai-agent `injectThreadContext` delegate 동치 검증: PASS**
  - 신규 `injectConversationContext` 공유 유틸이 기존 `injectThreadContext` 인라인 로직과 100% 동일함을 확인했다.
  - `scope: none` / 서비스 미주입 / target 없음 → noopMeta 동일.
  - `scope: thread` → `getThreadExcludingNode` 호출, `allTurns.length === 0` 분기, `applyCap`, `messages` 모드 splice 삽입 위치(systemIdx+1) 모두 보존.
  - `scope: lastN` → `Math.max(1, contextScopeN ?? DEFAULT)` 로직 동일. `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N = 20` 이 기존 `DEFAULT_CONTEXT_SCOPE_N = 20` 과 동치이며, ai-agent.schema 의 re-export (`export const DEFAULT_CONTEXT_SCOPE_N = SHARED_DEFAULT_CONTEXT_SCOPE_N`) 로 schema default 와 runtime fallback 드리프트 불가.
  - `system_text` 모드 → `renderThreadAsSystemText`, `newSystemPrompt` 조립, messages 배열 내 system entry 미러링 동일.
  - `mapTurnsToChatMessages` 이전: private 함수 → 공개 export. 동작(source: 'injected' 후처리, switch 분기, toolCalls/toolCallId 조건부 spread) 완전 보존.
  - `appliedScope` echo(auto strategy 시 'none' 으로 재기록)는 ai-agent 호출부 L1517-1519 에서 여전히 수행 — 공유 유틸로 옮긴 이후에도 불변.

- **[INFO] ai-agent schema fragment 동치 검증: PASS**
  - `buildConversationContextSchemaFields(37, { gateOnManualMemoryStrategy: true })` 호출로 생성되는 5 필드의 order(37–41), label, widget, default, options, visibleWhen, hint 모두 기존 inline 정의와 동일함을 확인.
  - `excludeFromConversationThread` 는 기존 ai-agent 에서도 `visibleWhen` 가드가 없었고, 신규 fragment 에서도 `...manualGate` spread 없이 생성됨 — 동치.
  - `buildSystemContextSchemaFields(42)` 위치 변화 없음 (기존 line 478 → 현재 line 410, 인자값 42 동일).

- **[INFO] DEFAULT_CONTEXT_SCOPE_N 이중 선언**
  - `shared/conversation-context-schema.ts` 의 `DEFAULT_CONTEXT_SCOPE_N = 20` 과 `shared/conversation-context-injection.ts` 의 `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N = 20` 이 별도로 선언됨. 두 파일이 독립적으로 fallback 값을 정의하고 있어 미래 값 변경 시 한 쪽만 수정하는 실수 가능성 존재. 현재는 schema default(zod `.default(DEFAULT_CONTEXT_SCOPE_N)`)와 handler runtime fallback(`DEFAULT_CONVERSATION_CONTEXT_SCOPE_N`)이 동일값(20)을 참조하므로 기능상 문제 없음. ai-agent.schema 는 schema 쪽 값을 re-export 해 handler runtime fallback도 해소하면 더 단순해진다.
  - 위치: `conversation-context-schema.ts:24`, `conversation-context-injection.ts:26`

- **[INFO] information-extractor.component.ts — `conversationThreadService` 신규 주입**
  - 기존에는 `new InformationExtractorHandler(deps.llmService)` 단일 인자였고, 이번 변경으로 `deps.conversationThreadService` 가 추가됨. `HandlerDependencies` 인터페이스에 이미 optional 필드로 정의되어 있고(`node-component.interface.ts:327`), handler 생성자도 optional로 선언(`private readonly conversationThreadService?`) — 기존 테스트/레거시 경로 회귀 없음.

- **[INFO] text-classifier / information-extractor UI order 이동**
  - `systemContext` 관련 필드(includeSystemContext, systemContextSections)가 text-classifier 에서 order 9,10 → 14,15 로, information-extractor 에서 10,11 → 15,16 으로 이동. 프론트엔드 `schema-form.tsx` 는 `a.order - b.order` relative sort 로만 사용하고 절대값에 의존하지 않으므로 기능 회귀 없음. UI 그룹 내 순서가 "contextScope 계열 먼저, systemContext 나중" 으로 바뀌는 것은 의도된 레이아웃 변경.

- **[INFO] `mapTurnsToChatMessages` public export — 의도하지 않은 API 노출 가능성**
  - 기존에는 `ai-agent.handler.ts` 의 module-private 함수였으나 이제 `shared/conversation-context-injection.ts` 의 named export 가 됨. 내부 구현 세부사항이 공개 표면에 올라왔으나, 테스트에서만 직접 호출되며 외부 서비스/모듈이 의존할 가능성은 낮다.

---

## 요약

이번 변경은 ai-agent 의 `injectThreadContext` 내부 로직을 `shared/conversation-context-injection.ts` 로 추출하고 text-classifier·information-extractor 에 동일 경로를 연결하는 리팩터링이다. ai-agent 동작(contextScope none/thread/lastN, messages/system_text 모드, applyCap, self-node 제외, appliedScope echo, memoryStrategy 분기)은 delegate 호출 전후로 완전히 동치임을 코드 레벨에서 확인했다. schema fragment 또한 5 필드 order/label/visibleWhen/default 가 기존과 동일하다. 주목할 부작용은 두 신규 노드에서 `system_text` 모드 시 `injected.finalSystemPrompt` 를 소비하지 않는 패턴인데, LLM 호출에는 `messages[0].content` 를 통해 올바른 값이 이미 전달되므로 기능상 오류는 아니나 future-proof 관점에서 미사용 반환값이 방치된 형태다.

---

## 위험도

LOW

BLOCK: NO
