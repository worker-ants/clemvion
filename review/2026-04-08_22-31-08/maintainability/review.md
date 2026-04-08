## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] 조건 처리 로직 3중 중복 (단일 회전/다중 회전 첫 턴/다중 회전 메시지)**
- 위치: `ai-agent.handler.ts` — `executeSingleTurn`, `executeMultiTurn` (첫 턴 루프), `processMultiTurnMessage` 내 툴콜 처리 루프
- 상세: 아래 구조가 세 곳에 동일하게 반복됨:
  1. `classifyToolCalls()` 호출
  2. condition-only 분기 → `extractConditionReason` + 조기 반환
  3. mixed/normal 분기 → assistant 메시지 push → 툴콜 순회하며 condition 여부에 따라 deferral/실제 실행 메시지 push
  4. 다시 `llmService.chat` 호출
- 제안: 이 루프 몸체를 별도 private 메서드(`processToolCallLoop`)로 추출하고 세 위치에서 공유. `buildConditionOutput`은 이미 공유되어 있으나 루프 내부 로직이 누락됨

---

**[WARNING] `executeSingleTurn`의 조건 트리거 결과 구조가 `buildConditionOutput` 결과 구조와 불일치**
- 위치: `ai-agent.handler.ts:162–196` vs `buildConditionOutput` 메서드
- 상세: `executeSingleTurn`에서는 조건 트리거 시 `metadata.inputTokens / outputTokens / totalTokens`를 직접 구성하지만, `buildConditionOutput`은 `totalInputTokens / totalOutputTokens`를 받아 `totalTokens`를 합산. 필드명이 다름 (`inputTokens` vs `totalInputTokens`). 소비자가 두 경로 중 어느 것으로 응답받느냐에 따라 다른 필드명을 처리해야 함
- 제안: `executeSingleTurn`도 `buildConditionOutput`을 호출하도록 통일하거나, 단일 결과 인터페이스 타입을 정의

---

**[WARNING] 한국어 하드코딩 문자열**
- 위치: `ai-agent.handler.ts` — `buildConditionSystemPromptSuffix` (`[조건 안내] 대화 중 ...`), 조건 deferral 툴 응답 (`'확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.'`)
- 상세: LLM 프롬프트와 툴 응답 메시지가 한국어로 고정되어 있어 다국어 환경이나 영어 모델 사용 시 예상치 못한 동작 가능성이 있음. 특히 시스템 프롬프트 suffix는 LLM의 판단 품질에 직접 영향
- 제안: 상수로 분리하거나 config에서 locale을 받도록 설계. 최소한 상수로 파일 상단에 추출하여 변경 위치를 단일화

---

**[WARNING] `ToolCall` 인터페이스가 LLM 클라이언트 인터페이스와 중복 정의**
- 위치: `ai-agent.handler.ts:11–15`
- 상세: `ToolCall` 인터페이스가 핸들러 파일 내에 로컬로 정의되어 있고, `llm-client.interface` 에서 이미 유사한 타입이 있을 가능성이 높음. 실제로 `result.toolCalls`를 `ToolCall[]`로 캐스팅하는 부분이 다수 존재해 타입 안전성이 실질적으로 보장되지 않음
- 제안: LLM 클라이언트 인터페이스에 `ToolCall` 타입을 정의하고 재사용. `as ToolCall[]` 캐스팅 대신 `ChatResponse` 타입에 `toolCalls` 필드를 구체화

---

**[INFO] `buildTools`가 config를 통째로 받는 대신 필요한 파라미터를 직접 받아야 함**
- 위치: `ai-agent.handler.ts` — `buildTools(config: Record<string, unknown>)`
- 상세: 메서드 시그니처에서 어떤 config 필드를 사용하는지 알 수 없음. 현재 `toolNodeIds`, `toolOverrides`, `conditions`를 내부에서 추출하는데, 이는 호출 시점에서 이미 추출된 변수들이 존재하는 상황에서 재추출하는 구조
- 제안: `buildTools(toolNodeIds: string[], toolOverrides: ..., conditions: ConditionDef[])` 형태로 명시적 파라미터 시그니처 사용

---

**[INFO] `classifyToolCalls` 내 `Infinity` 초기값 패턴**
- 위치: `ai-agent.handler.ts` — `classifyToolCalls` 메서드
- 상세: `lowestIndex = Infinity`로 시작하여 `idx < lowestIndex` 비교는 동작은 정확하나, `conditionToolCalls[0]` 이 있을 때 `conditions.findIndex`를 바로 활용하는 방식(`reduce` 또는 `Math.min`)이 더 의도를 명확히 표현함
- 제안: `conditions.findIndex(c => conditionToolCalls.some(ctc => ctc.name === c.id))` 패턴으로 단순화 가능

---

**[INFO] `custom-node.tsx` — `ai_agent` 조건 포트 로직이 `switch` 케이스 포트 로직과 구조적으로 동일하나 별도 분기로 처리됨**
- 위치: `custom-node.tsx:36–62`
- 상세: `switch`와 `ai_agent` 모두 동적 포트를 config에서 파생하는 패턴인데, 각각 별도 if 블록으로 처리. 노드 타입이 늘어날수록 `useMemo` 블록이 길어질 가능성이 있음
- 제안: 동적 포트 계산 로직을 노드 정의 레이어(`node-definitions`)에 `getOutputPorts(type, config)` 함수로 이동하여 컴포넌트에서 분리 (즉각 조치가 필요한 수준은 아님)

---

**[INFO] 테스트에서 `ResultTimeline` props 반복 inline 구성**
- 위치: `result-timeline.test.tsx` — 6개 `render()` 호출 전체
- 상세: `conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false}`가 모든 테스트에 중복됨
- 제안: `defaultProps` 헬퍼 객체를 테스트 상단에 정의하고 스프레드 사용

---

### 요약

전반적으로 기능 구현은 명확하고 테스트 커버리지도 충분하나, **조건 처리 툴콜 루프가 세 곳에 거의 동일하게 중복**되어 있어 향후 조건 로직 변경 시 세 위치를 모두 수정해야 하는 유지보수 부담이 가장 큰 문제다. `executeSingleTurn`의 조건 결과 구조가 `buildConditionOutput`과 불일치하는 점은 소비자 코드에서 숨은 버그를 유발할 수 있다. 한국어 하드코딩 문자열은 국제화보다는 LLM 품질 일관성 측면에서 상수화가 권장된다. 나머지 항목은 코드 명확성 개선 수준의 INFO 이슈다.

### 위험도
**MEDIUM**