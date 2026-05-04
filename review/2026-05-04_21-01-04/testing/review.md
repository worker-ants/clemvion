### 발견사항

- **[INFO]** 3개 이상의 도구 호출이 포함된 툴 루프 케이스 미커버
  - 위치: `llm-call-trace.test.ts` 신규 테스트 (`tool loop` describe block)
  - 상세: 추가된 테스트는 2-call tool loop만 검증한다. `callIndexByTurn` Map 로직이 N≥3 케이스에서도 올바르게 0, 1, 2, …를 할당하는지 확인하는 케이스가 없다.
  - 제안: `assistant × 3` (중간에 tool message 2개 포함) 픽스처를 추가해 `callIndexInTurn: 0, 1, 2`를 검증

- **[INFO]** null 페이로드 어시스턴트 메시지가 섞인 툴 루프 미커버
  - 위치: `fromConversationMessages` 구현(`llm-call-trace.ts:106-108`)
  - 상세: `requestPayload == null && responsePayload == null` 인 어시스턴트 항목은 `continue`로 카운터 갱신 없이 건너뛴다. 해당 항목이 툴 루프 중간에 끼어들 때 이후 호출의 `callIndexInTurn`이 올바르게 연속되는지 테스트가 없다.
  - 제안: null-payload assistant → valid assistant → valid assistant 순서의 픽스처로 카운터 건너뜀 검증 추가

- **[INFO]** 복수 턴 × 복수 호출 조합 케이스 미커버
  - 위치: 전체 `extractLlmCalls` fallback 경로
  - 상세: 기존 "falls back to conversationMessages" 테스트는 턴당 1호출이다. `turnIndex` 별로 카운터가 독립 초기화되는지 (`Map.get` 기본값 0 동작) 확인하는 다중-턴 × 다중-호출 케이스가 없다.
  - 제안: turnIndex 1→2개 호출, turnIndex 2→1개 호출 픽스처를 추가해 각 턴의 `callIndexInTurn`이 0부터 독립적으로 시작됨을 검증

- **[INFO]** `labelForCall` 단일-호출 케이스(fallback 경로)의 `"응답"` 레이블 미검증
  - 위치: 신규 테스트 끝부분 / `labelForCall` 로직 `llm-call-trace.ts:142`
  - 상세: 기존 `labelForCall` describe 블록에는 단일 호출 레이블 테스트가 있지만, fallback 경로(conversationMessages)로부터 추출한 단일 호출에 대해 `"Turn N · 응답"` 레이블이 렌더되는지 통합 검증이 없다.
  - 제안: fallback 단일 호출 픽스처에서 `labelForCall` 결과를 `"Turn 1 · 응답"` 으로 단언

---

### 요약

신규 테스트는 버그의 핵심 회귀 시나리오(동일 턴 2-call tool loop에서 `callIndexInTurn` 중복)를 정확히 검증하며, 픽스처 구성·단언 표현·코멘트 모두 명확하다. 기존 테스트들도 변경 후 유효하다(`callIndexInTurn: 0` 단일 호출 케이스는 Map이 빈 상태에서 `?? 0`을 반환하므로 동일하게 동작). 다만 3+ 호출 루프, null-payload 인터리빙, 복수 턴×복수 호출 조합 등의 엣지 케이스는 커버되지 않는다. 구현 자체는 단순해 실제 버그 발생 가능성은 낮으나, 테스트로 보증된 범위가 좁아 향후 수정 시 회귀를 놓칠 여지가 있다.

### 위험도

**LOW**