### 발견사항

- **[INFO]** 인라인 주석의 레이블 예시가 실제 동작과 불일치
  - 위치: `llm-call-trace.ts:103` — `fromConversationMessages` 함수 위 주석
  - 상세: 주석에 `"호출 1/N · 2/N · …"` 형식으로 쓰여 있지만, 실제 `labelForCall`이 생성하는 레이블은 `"Turn 1 · 호출 1/2"` 형식임. `·` 구분 방식이 다르고, 쉼표 없이 슬래시(·)로 이어붙이는 예시는 독자에게 오해를 줄 수 있음.
  - 제안: `// tool loop 한 턴 내에 assistant 호출이 여럿일 때 각각 순번을 부여해 "Turn 1 · 호출 1/2", "Turn 1 · 호출 2/2" 형식으로 구별되도록 한다.` 로 수정.

- **[INFO]** 테스트 주석의 오류 메시지 예시 표기 오류
  - 위치: `llm-call-trace.test.ts:124-127` — 새 테스트 케이스 상단 주석
  - 상세: `"호출 1/2 / 2/2"` 로 표기되어 있으나 실제 기대값은 `"Turn 1 · 호출 1/2"`, `"Turn 1 · 호출 2/2"` 이며, 슬래시(`/`) 구분자는 잘못된 형식임.
  - 제안: `// "Turn 1 · 호출 1/2" / "Turn 1 · 호출 2/2"` 또는 `` `"Turn 1 · 호출 1/2"`, `"Turn 1 · 호출 2/2"` `` 로 수정.

- **[INFO]** `LlmCallTrace.callIndexInTurn` JSDoc이 0-based만 언급, 동작 보장 범위 미기재
  - 위치: `llm-call-trace.ts:14` — `callIndexInTurn` 필드 주석
  - 상세: 현재 `/** Index among assistant calls within the same turn (0-based). */` 인데, fallback 경로(`fromConversationMessages`)에서 tool loop를 처리한다는 보장이 추가된 만큼, "fallback 경로에서도 동일하게 순번 보장됨"을 명시하면 소비자 코드에서 가정을 명확히 할 수 있음.
  - 제안: `/** Index among assistant calls within the same turn (0-based). Guaranteed sequential for both _turnDebugHistory and fallback conversation messages (including tool-loop turns). */`

- **[INFO]** `extractLlmCalls` JSDoc의 fallback 설명이 tool loop 케이스를 누락
  - 위치: `llm-call-trace.ts:55-62` — `extractLlmCalls` 함수 JSDoc
  - 상세: `"per-assistant requestPayload/responsePayload already attached by the WS event handler. Each matching assistant item becomes one LlmCallTrace"` 까지 설명하지만, 동일 턴에 복수 assistant 메시지가 올 수 있고 `callIndexInTurn`이 올바르게 순번화된다는 사실을 언급하지 않음.
  - 제안: 마지막 설명 줄에 `When multiple assistant items share a turn (tool loop), each gets a distinct callIndexInTurn.` 추가.

---

### 요약

실제 버그 수정 자체는 명확하고 테스트도 잘 커버되어 있다. 다만 인라인 주석과 테스트 주석에서 레이블 형식 예시가 실제 출력과 다르게 표기되어 있어 향후 유지보수 시 독자에게 혼선을 줄 수 있고, 공개 인터페이스(`LlmCallTrace`, `extractLlmCalls`)의 JSDoc이 이번 변경으로 보장된 새 동작(tool loop 지원)을 반영하지 않고 있다. 전반적으로 문서 누락보다는 부정확한 예시와 부분적 JSDoc 갱신 누락이 주된 이슈다.

### 위험도

**LOW**