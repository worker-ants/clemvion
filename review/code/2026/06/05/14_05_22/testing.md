# Testing Review — contextScope A2 (memory-autoinject-extend)

Reviewer: testing sub-agent
Diff base: 9e65f853..HEAD — `codebase/`

---

## CRITICAL

없음.

---

## WARNING

### W1 — `mapTurnsToChatMessages` 의 `presentation_user` / `ai_tool` / `system` / default 분기가 공유 유틸 spec 에서 단독 테스트되지 않음

- **위치**: `codebase/backend/src/nodes/ai/shared/conversation-context-injection.spec.ts` 전체, `conversation-context-injection.ts:65–97`
- **상세**: `mapTurnsToChatMessages` 는 이번 PR 로 `ai-agent.handler.ts` private 함수에서 공유 유틸로 `export` 승격되었다. 그러나 `conversation-context-injection.spec.ts` 는 `appendAiUserMessage` / `appendAiAssistantMessage` 만 시드하므로 `presentation_user` (form 제출, `[from <label>]` prefix), `ai_tool` (toolCallId 전파), `system` turn, `default` fallback 분기를 단독으로 검증하지 않는다.
  - 리팩터 이전에는 `ai-agent.thread.spec.ts` 의 `seedThreadFromOtherNode` 가 `appendPresentationInteraction` → `presentation_user` 경로를 E2E 수준으로 검증했다(line 242). 이 테스트는 변경되지 않아 regression 은 현재 간접 보장됨. 그러나 공유 함수로 승격된 이상, 해당 분기에 대한 단독 단위 테스트가 공유 spec 에 있어야 한다.
  - `ai_tool` 분기(`toolCallId` 전파)는 아무 spec 파일에서도 `mapTurnsToChatMessages` 직접 호출 경로로 검증되지 않는다. `ai-agent.thread.spec.ts` 의 `includeToolTurns=true` 케이스(line 429)는 push 경로이며, inject 경로로 `ai_tool` turn 이 `mapTurnsToChatMessages` 를 통과하는 케이스는 테스트 없음.
- **제안**: `conversation-context-injection.spec.ts` 에 `mapTurnsToChatMessages` 직접 호출 단위 테스트(또는 `appendPresentationInteraction` + `appendAiToolResult` 로 시드한 `injectConversationContext` 케이스)를 추가하여 `presentation_user`, `ai_tool`, `system`, `default` 분기를 커버한다.

---

### W2 — `information-extractor` 의 multi-turn **미설정 시 기존 동작 불변(회귀)** 케이스 누락

- **위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.thread.spec.ts:110–224`
- **상세**: `multi-turn first entry contextScope=thread injects…` 케이스(line 188)는 inject 활성 경로만 핀한다. single-turn 에는 `'single-turn contextScope default (none) leaves messages unchanged (regression)'` 케이스(line 166)가 존재하지만, multi-turn 에는 **`contextScope` 미설정 시 기존 2-message 구조가 유지되는지** 확인하는 대칭 회귀 케이스가 없다. `information-extractor.handler.ts:437` 의 multi-turn 첫 진입 `injectConversationContext` 호출이 noop 경로에서 messages 를 변조하지 않음을 독립적으로 보장할 수 없다.
- **제안**: `InformationExtractorHandler — ConversationThread inject (contextScope, A2)` describe 에 `'multi-turn first entry contextScope default (none) leaves messages unchanged (regression)'` 케이스를 추가한다.

---

### W3 — `text-classifier` 및 `information-extractor` 에서 `meta.contextInjection` 에코 테스트 전무

- **위치**: `text-classifier.thread.spec.ts:136–244`, `information-extractor.thread.spec.ts:110–224`
- **상세**: `ai-agent.thread.spec.ts:545` 의 `'emits meta.contextInjection echo when scope is active'` 케이스처럼, `text-classifier` / `information-extractor` 도 `contextScope != 'none'` 시 `meta.contextInjection` 을 output 에 에코해야 한다는 spec 약속(spec/4-nodes/3-ai/0-common.md §10)이 있다. 그런데 두 핸들러 코드를 확인하면 `injected.injection` 을 meta 에 echo 하는 코드 자체가 없다(`text-classifier.handler.ts:179–191`, `information-extractor.handler.ts:226–237` — `.messages` 만 사용). 즉 구현 갭이 있으며, 테스트도 이 동작을 검증하지 않는다.
- **제안**: (1) 두 핸들러에서 `injected.injection.appliedScope !== 'none'` 이면 `meta.contextInjection` 을 에코하는 코드 추가. (2) 각 thread.spec 에 ai-agent 와 동일한 구조의 메타 에코 케이스를 추가한다.

---

## INFO

### I1 — `contextScopeN=0` 클램핑 케이스가 공유 유틸 spec 에 없음 (ai-agent 에만 존재)

- **위치**: `conversation-context-injection.spec.ts` 전체
- **상세**: `ai-agent.thread.spec.ts:514` 는 `contextScopeN=0 → Math.max(1, 0) = 1` 클램핑을 검증한다. 이 로직은 `injectConversationContext` 내부(`conversation-context-injection.ts:155–161`)에 있으므로 공유 spec 에 있는 것이 적절하다. 현재 공유 spec 의 `'contextScope=lastN respects contextScopeN'` 케이스(line 151)는 N=2 정상 경로만 커버한다.
- **제안**: 공유 spec 에 `'contextScopeN=0 clamps to 1'` 케이스를 추가하고, ai-agent 의 해당 케이스를 통합 또는 참조 주석 처리하여 중복을 줄인다.

### I2 — `target: undefined` no-op 경로 미테스트

- **위치**: `conversation-context-injection.spec.ts` 전체, `conversation-context-injection.ts:133`
- **상세**: `injectConversationContext` 는 `!args.target` 시 noop 을 반환한다(line 133). `reader: undefined` no-op(line 82)과 달리 `target: undefined` 경로는 spec 에서 테스트하지 않는다. 실운영에서는 핸들러가 `context` 를 항상 넘기므로 위험도는 낮으나, public API 로 export 된 함수이므로 문서화 목적의 케이스가 있어야 한다.
- **제안**: `'missing target → no-op'` 케이스를 `conversation-context-injection.spec.ts` 에 추가한다.

### I3 — `droppedTurns` / `totalInjectedChars` 필드 단독 검증 없음

- **위치**: `conversation-context-injection.spec.ts` 전체, `conversation-context-injection.ts:186–189`
- **상세**: `ConversationContextInjectionResult.injection` 은 `droppedTurns` / `totalInjectedChars` 를 포함하지만 spec 에서 이 필드를 명시 검증하는 케이스가 없다. `applyCap` 이 실제로 turn 을 잘라내는 경우(대량 시드 후 cap 초과)에 대한 테스트가 없어 디버그 정보의 정확성을 보장하지 못한다.
- **제안**: thread-renderer 의 `applyCap` 은 별도 테스트가 있다면 INFO 수준으로 유지. 없다면 `injectConversationContext` spec 에 cap 초과 케이스를 추가한다.

### I4 — `text-classifier.thread.spec` 의 inject describe 에 `system_text` 모드 케이스 없음

- **위치**: `codebase/backend/src/nodes/ai/text-classifier/text-classifier.thread.spec.ts:136–244`
- **상세**: inject describe 의 3개 케이스 모두 `contextInjectionMode: 'messages'` 만 사용한다. `system_text` 모드(systemPrompt 에 append)는 공유 유틸 spec 으로 커버되지만, text-classifier 의 handler 경로(injected.messages 를 requestPayload 에 넘기는 경로)에서 system_text 를 통한 system message 변형이 실제로 chat 에 전달되는지는 handler-level 에서 확인되지 않는다.
- **제안**: text-classifier inject describe 에 `contextInjectionMode: 'system_text'` 케이스(systemPrompt 에 thread 텍스트가 포함되는지 확인) 추가를 고려한다.

---

## 요약

테스트 구조 자체는 공유 유틸 spec / 두 노드 thread spec 이 모두 신규 추가되어 커버리지 방향이 올바르다. 회귀 기준(contextScope=none, 미설정 시 noop)도 단일 turn 에 대해서는 양 노드 모두 핀하고 있다. 다만 세 가지 유의미한 갭이 존재한다: (1) `mapTurnsToChatMessages` 의 `presentation_user` / `ai_tool` 분기가 공유 유틸 단위 테스트에서 직접 검증되지 않으며, (2) `information-extractor` multi-turn 회귀 케이스(기본값=noop)가 누락되었고, (3) `text-classifier` 와 `information-extractor` 모두 `meta.contextInjection` 에코 코드가 핸들러에 없고 테스트도 없어 spec 약속과 구현 사이에 갭이 있다. 이 세 항목은 WARNING 수준으로 분류하며, 특히 W3 는 핸들러 코드 자체의 구현 누락을 수반하므로 테스트 추가 전 구현 보완이 선행되어야 한다.

---

## 위험도

MEDIUM

---

BLOCK: NO
