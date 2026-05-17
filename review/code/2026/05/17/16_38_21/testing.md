# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `parseHistoryMessages` 자체에 대한 단위 테스트 부재 — 새 hydration 로직의 핵심 의존성
  - 위치: `frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts` 전체, `apply-execution-snapshot.ts:1156`
  - 상세: 변경된 코드에서 `parseHistoryMessages`는 세 가지 outputData shape (구조화 `output.result.messages` / legacy nested `output.messages` / flat `messages`)를 모두 처리한다고 커밋 메시지에 명시되어 있으나, 추가된 4개 테스트는 모두 `output.result.messages` (구조화 envelope) 형태만 사용한다. `parseHistoryMessages` 내부의 legacy nested shape 및 flat shape 분기가 `applyExecutionSnapshot` 연동 경로에서 실제로 동작하는지 검증하는 테스트가 없다.
  - 제안: legacy nested (`output.messages`) 및 flat (`messages`) shape 각각에 대한 통합 케이스를 `apply-execution-snapshot.test.ts`에 추가하거나, `parseHistoryMessages` 함수를 직접 대상으로 하는 단위 테스트 파일을 별도로 확인/추가한다.

- **[INFO]** `meta.turnDebug` 복수 turn 매핑 케이스 미검증
  - 위치: 신규 테스트 "meta.turnDebug 로 assistant 메시지의 model 정보가 attach 됨" (라인 172-230)
  - 상세: 추가된 turnDebug 테스트는 `turnDebug` 배열에 1개 항목, `messages` 배열에 2개(user+assistant) 항목만 담긴 단순 케이스다. 실제 multi-turn 시나리오에서는 `turnDebug[0]` 이 `turnIndex=1` 의 assistant 에, `turnDebug[1]` 이 `turnIndex=2` 의 assistant 에 매핑되어야 하는 패턴이지만, 복수 turn에서 인덱스 매핑이 올바른지 테스트가 없다. 특히 `llmCalls` 배열에 여러 항목이 있을 때 마지막 call의 메타데이터를 선택하는지 여부도 미검증이다.
  - 제안: 4개 메시지(user/assistant/user/assistant)와 `turnDebug` 2개 항목을 갖는 케이스를 추가해 각 assistant 메시지에 올바른 turnDebug가 매핑되는지 검증한다.

- **[INFO]** "빈 messages no-op" 테스트의 단언이 불완전
  - 위치: 신규 테스트 "messages 가 비어있으면 setConversationMessages 호출 안 함" (라인 232-273)
  - 상세: 테스트 주석에 "setConversationMessages 가 호출되면 selectedConversationItemIndex 가 reset 될 수 있으니 보호한다"고 명시하고 있으나, `selectedConversationItemIndex`가 3으로 설정된 후 snapshot 적용 이후에도 여전히 3인지 단언하는 코드가 없다. 즉 테스트가 실제로 보호하고자 하는 side effect를 검증하지 않는다.
  - 제안: `expect(state.selectedConversationItemIndex).toBe(3)` 단언을 테스트 마지막에 추가한다.

- **[INFO]** `beforeEach` 초기화 필드와 실제 store 초기 상태 간 불일치 위험
  - 위치: `apply-execution-snapshot.test.ts` 라인 319-333 (`beforeEach` 블록)
  - 상세: `beforeEach`에서 `conversationMessages: []`와 `selectedConversationItemIndex: null`이 신규로 추가되었다. "덮어쓰기 방지" 테스트(라인 129-133)는 `beforeEach` 이후 `useExecutionStore.setState({ conversationMessages: [...] })`를 다시 호출해 선행 상태를 주입하므로, 이 순서 의존성이 명시적이지 않다. 다른 테스트가 `conversationMessages`를 오염시킨 채 실패하면 순서에 따라 이 테스트가 통과/실패가 달라질 수 있다.
  - 제안: Zustand 스토어 reset이 테스트 간 완전히 격리되는지 확인한다. Zustand `useExecutionStore`의 `beforeEach` setState가 이전 테스트의 state를 완전히 덮어쓰는지, 아니면 병합(merge)하는지 점검하고, 필요하면 `resetStore()` 등 공식 reset 액션을 beforeEach에서 호출하도록 변경한다.

- **[INFO]** `information_extractor` 노드 타입에 대한 `ai_conversation` hydration 케이스 부재
  - 위치: `apply-execution-snapshot.ts:1222` (`inferInteractionTypeFromNodeType`), 테스트 파일 전체
  - 상세: `inferInteractionTypeFromNodeType`에서 `information_extractor` nodeType도 `ai_conversation`으로 추론되나, 신규 hydration 경로 테스트는 `ai_agent` nodeType만 다룬다. 두 노드 타입의 처리 경로가 동일한지 검증되지 않는다.
  - 제안: `nodeType: "information_extractor"` 케이스에 대한 최소한 하나의 hydration 테스트를 추가한다.

- **[INFO]** `waitingConversationConfig` 설정 값 검증 누락
  - 위치: 신규 테스트 4건 전체
  - 상세: `pauseForConversation(waitingNode.nodeId, convConfig ?? null)`이 호출된다는 사실은 `waitingNodeId`와 `waitingInteractionType` 단언으로 간접 검증되나, `waitingConversationConfig` 자체의 값(예: `mode`, `model`, `maxTurns`)이 올바르게 설정되는지 명시적으로 단언하는 테스트가 없다.
  - 제안: 첫 번째 hydration 테스트에서 `expect(state.waitingConversationConfig).toMatchObject({ mode: 'multi_turn', model: 'gpt-4o', maxTurns: 10 })` 형태의 단언을 추가한다.

## 요약

이번 변경에서 추가된 4개의 테스트는 핵심 회귀 시나리오(빈 store hydration, 덮어쓰기 방지, turnDebug attach, 빈 messages no-op)를 명확한 한국어 설명과 함께 잘 커버하고 있으며, `beforeEach`에 `conversationMessages`와 `selectedConversationItemIndex` 초기화가 추가되어 격리성도 개선되었다. 다만 커밋 메시지에서 3가지 outputData shape 처리를 핵심 기능으로 명시한 것에 비해, 테스트는 구조화 envelope 형태(primary shape)만 검증한다. legacy nested/flat shape 경로, 복수 turn turnDebug 매핑, `selectedConversationItemIndex` 보존 단언, `information_extractor` 노드 타입 등 커버리지 갭이 있다. 이들은 버그로 이어질 가능성이 낮은 gap이지만, 향후 `parseHistoryMessages` 내부 로직을 변경할 때 회귀를 감지하지 못할 위험이 있다.

## 위험도

LOW
