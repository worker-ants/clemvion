# Cross-Spec 일관성 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (구현 착수 전 검토, --impl-prep)
검토 일시: 2026-05-17

---

### 발견사항

- **[WARNING]** `execution.submit_message` / `execution.end_conversation` 커맨드가 AI Agent 전용으로 기술되어 있으나 Information Extractor multi-turn 도 동일 커맨드를 사용해야 함
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §4.2` — `processMultiTurnMessage(userMessage, _resumeState)` 와 `endMultiTurnConversation(_resumeState, endReason)` 진입점 정의
  - 충돌 대상:
    - `spec/3-workflow-editor/3-execution.md §8` — `execution.submit_message` / `execution.end_conversation` 설명이 `AI Agent Multi Turn` 전용으로만 표기됨
    - `spec/5-system/6-websocket-protocol.md §4.4` — `interactionType: "ai_conversation"` payload 의 `nodeType` 예시가 `ai_agent` 만 존재; Information Extractor multi-turn 에 대한 `conversationConfig` / `conversationThread` 동봉 여부 미정의
    - `spec/5-system/4-execution-engine.md §7 continuation bus` — `continueAiConversation` / `endAiConversation` 핸들러가 `ai_agent` 만 언급
  - 상세: Information Extractor `multi_turn` 모드는 `waiting_for_input`/`resumed` 상태 전이와 `processMultiTurnMessage` / `endMultiTurnConversation` 인터페이스를 AI Agent 와 동일하게 사용한다. 그러나 execution spec 과 WebSocket protocol spec 에서 이 커맨드들은 "AI Agent Multi Turn" 전용으로 명시되어 있어 구현자가 Information Extractor 에도 동일 경로를 연결해야 함을 인식하지 못할 수 있다. `nodeType: "information_extractor"` 일 때 `execution.waiting_for_input` payload 내 `conversationConfig` 구조가 명시되어 있지 않다.
  - 제안: `spec/3-workflow-editor/3-execution.md §8` 의 `execution.submit_message` / `execution.end_conversation` 설명을 "AI Agent 및 Information Extractor Multi Turn에서 사용자 메시지 전송/종료"로 갱신. `spec/5-system/6-websocket-protocol.md §4.4` 에 `nodeType: "information_extractor"` 케이스 추가(또는 공통 `ai_conversation` interactionType 의 범위를 명시).

---

- **[WARNING]** Information Extractor `multi_turn` 종결 포트 `completed` 가 `execution.end_conversation` 처리 흐름에서의 매핑이 불분명
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §4.2` — `endMultiTurnConversation(_resumeState, endReason)` 이 `user_ended` / `max_turns` / `error` 포트로 라우팅
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7 continuation bus` — `endAiConversation` 이 AI Agent 의 `user_ended` / `max_turns` 포트 라우팅을 위한 핸들러로만 기술
  - 상세: AI Agent 종결 포트는 `user_ended` / `max_turns` / `{condition.id}` / `error` 이고, Information Extractor 종결 포트는 `completed` / `user_ended` / `max_turns` / `error` 이다. 엔진의 `endAiConversation` 디스패처가 두 노드 타입의 서로 다른 종결 포트 셋을 처리할 수 있도록 구성되어야 하는데, 현재 execution-engine spec 에는 이 차이가 기술되지 않았다.
  - 제안: `spec/5-system/4-execution-engine.md` 의 AI multi-turn 종결 섹션에 노드 타입별 종결 포트 매핑 테이블(ai_agent vs information_extractor) 을 추가. 또는 핸들러 인터페이스 설명에 "노드 타입에 따른 분기" 를 명시.

---

- **[WARNING]** Information Extractor `multi_turn` 의 `max_retries` 에러 경로가 `execution.end_conversation` 진입점을 경유하지 않으나 엔진 레벨 기술에서 이를 다루지 않음
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §4.2 §5.6` — `MAX_COLLECTION_RETRIES_EXCEEDED` 는 `runTurnWithCollectionRetries` 내부에서 `forcedEnd: 'max_retries'` 를 설정해 `error` 포트로 직행 (사용자 커맨드 없이 내부 종결)
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7` — AI multi-turn 종결은 `continueAiConversation` / `endAiConversation` 의 두 경로로만 기술되어 있음. 핸들러 내부 동기 종결 경로(`waitingForInput` 재진입 없이 ended 로 직행) 의 엔진 처리가 누락
  - 상세: `max_retries` 초과 시 `processMultiTurnMessage` 내부에서 `waiting_for_input` 없이 `ended(error)` 로 직행한다. 엔진이 이 경우 `_resumeState` 를 정리하고 `continuationPromise` 를 resolve 해야 하는데, 엔진 spec 이 이 경로를 다루지 않는다.
  - 제안: `spec/5-system/4-execution-engine.md` 에 "핸들러 내부 동기 종결(resumed 상태에서 waiting_for_input 없이 ended 반환)" 케이스를 명시하고 엔진의 처리 방식을 기술.

---

- **[INFO]** `spec/5-system/6-websocket-protocol.md §4.4` 의 `conversationConfig` 구조가 AI Agent waiting_for_input 출력 구조와 미세 차이
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` — `output.result.message` (현재 turnAssistant 응답), `output.result.messages` (누적), `output.result.turnCount`, `output.result.maxTurns`
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4` — `conversationConfig` 내의 `message`, `messages`, `turnCount`, `maxTurns` 필드 구조
  - 상세: AI Agent spec 의 §7.4 `waiting_for_input` 출력은 2026-05-17 D6 결정으로 `output.result.*` 단일 경로로 통일됐다(옛 top-level `output.messages` 등 폐기). WebSocket protocol spec 의 `conversationConfig` 예시는 이 변경을 반영하고 있으나, payload 를 노드 `output_data` 에서 직접 매핑하는지 아니면 엔진이 별도로 직렬화하는지가 불명확하다. spec 간 동기화 여부 확인이 필요하다.
  - 제안: `spec/5-system/6-websocket-protocol.md §4.4` 에 `conversationConfig` 의 출처(노드 output_data의 어떤 경로를 그대로 사용하는지 아니면 엔진 재직렬화인지) 를 명시.

---

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 의 Conversation Thread 재주입 단계 번호(1.5, 1.7, 2.5)가 비정수이며 Information Extractor 의 동일 흐름과 표기 방식이 다름
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` — 단계 번호 `1.5`, `1.7`, `2.5` (소수점 접미사)
  - 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md §4.1` — turn push 및 context 주입이 서술형 설명으로만 기술되고 단계 번호 없음
  - 상세: AI Agent 와 Information Extractor 의 Conversation Thread 연동 절차가 동일 인터페이스를 공유하지만 표기 방식이 달라 구현 참조 시 혼란 가능. 일관성 관점이므로 구현 차단 수준은 아님.
  - 제안: 두 문서 중 하나의 방식으로 표기를 통일하거나, `0-common.md §10` 에 공통 절차를 정의하고 각 노드는 "공통 §10 절차 참조" 로만 위임.

---

- **[INFO]** `spec/4-nodes/3-ai/2-text-classifier.md §5.1` 의 `meta.llmCalls` 필드가 `0-common.md §6 토큰 회계` 표와 명명 불일치
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md §5.1, 5.2, 5.3` — `meta.llmCalls` 필드 (배열)
  - 충돌 대상: `spec/4-nodes/3-ai/0-common.md §6 토큰 회계` — `meta.turnDebug` 필드 정의 (AI Agent 공통). Information Extractor §5.1 도 `meta.turnDebug` 사용
  - 상세: Text Classifier 는 `meta.llmCalls` (배열)를, AI Agent / Information Extractor 는 `meta.turnDebug` (턴 단위 래퍼) 를 사용한다. Text Classifier 는 single-turn 전용이라 turn 개념이 없어 `turnDebug` 가 아닌 `llmCalls` 직접 노출이 의도적일 수 있으나 `0-common.md §6` 표에 이 차이가 명시되어 있지 않다. 구현자가 `meta.turnDebug` 를 Text Classifier 에도 적용할 오해의 여지가 있다.
  - 제안: `0-common.md §6` 표에 "Text Classifier 는 `meta.llmCalls` (직접 배열), AI Agent / Information Extractor 는 `meta.turnDebug` (turn 래퍼)" 구분 행을 추가.

---

### 요약

`spec/4-nodes/3-ai/` 의 세 노드 spec 은 공통 규약(`0-common.md`)·CONVENTIONS·외부 spec 참조 구조 모두 내적으로 정합하다. CRITICAL 수준의 모순은 발견되지 않았다. 다만 Information Extractor `multi_turn` 이 AI Agent 와 동일한 WebSocket 커맨드(`execution.submit_message` / `execution.end_conversation`) 와 엔진 continuation bus(`continueAiConversation` / `endAiConversation`) 를 공유해야 함이 `spec/3-workflow-editor/3-execution.md` 와 `spec/5-system/6-websocket-protocol.md` 에 아직 반영되어 있지 않아 (WARNING 2건), 구현 시 두 노드의 multi-turn 라우팅을 동일 경로에서 처리하도록 엔진 spec 선행 갱신이 필요하다. 나머지 이슈(WARNING 1건, INFO 3건)는 명명 불일치 및 edge case 기술 보완으로 구현을 직접 차단하지는 않는다.

### 위험도

MEDIUM
