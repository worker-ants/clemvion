## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `isCompletedConversation` 조건 논리가 복잡하고 fallback 분기가 모호함**
- 위치: `result-detail.tsx` — `isCompletedConversation` 계산부
- 상세: 세 번째 조건 `rawOut?.messages != null`은 `innerOutput?.messages`가 이미 있음에도 불구하고 별도로 추가되어 있습니다. 이는 `isWrapped`가 true일 때 `rawOut`의 flat `messages`도 감지하려는 의도인 것 같지만, 이 경우 `innerOutput`이 `rawOut.output`을 가리키게 되어 `rawOut.messages`와 `innerOutput.messages`는 다른 경로를 참조합니다. 의도가 명확하지 않아 향후 수정 시 잘못된 이해로 버그를 유발할 수 있습니다.
- 제안: 조건의 의도를 명확히 주석으로 문서화하거나, 별도 헬퍼 함수 `detectConversationOutput(outputData)`로 추출하여 각 케이스를 명시적으로 처리

---

**[WARNING] `isMultiTurnConversation`과 `isCompletedConversation`의 탐지 로직이 이원화됨**
- 위치: `result-timeline.tsx:68–83` / `result-detail.tsx:322–350`
- 상세: `result-timeline.tsx`의 `isMultiTurnConversation()`과 `result-detail.tsx`의 `isCompletedConversation` 계산은 동일한 도메인 개념(완료된 대화형 출력인지 여부)을 각각 독립적으로 구현하고 있습니다. 두 로직은 감지 조건이 미묘하게 다르며(`interactionType` 체크 포함 여부 등), 향후 출력 포맷이 변경되면 두 곳을 모두 동기화해야 합니다.
- 제안: `conversation-utils.ts` 또는 `output-shape.ts`에 `isConversationOutput(outputData: unknown): boolean` 유틸을 단일 정의하고 두 컴포넌트에서 공유

---

**[WARNING] `rawOut`, `innerOutput`, `innerMeta` 인라인 계산이 `ResultDetail` 함수 본문에 직접 위치**
- 위치: `result-detail.tsx:320–340`
- 상세: output 언래핑 로직(`isWrapped`, `innerOutput`, `innerMeta`)이 이미 `unwrapNodeOutput()` 유틸이 있음에도 불구하고 함수 본문에서 직접 재구현되어 있습니다. `NodeDetailTabs` 내부에서는 `unwrapNodeOutput()`을 사용하면서 부모 함수에서는 동일한 작업을 수동으로 처리하는 불일치가 있습니다.
- 제안: `unwrapNodeOutput()`의 반환값을 활용하거나, `isConversationOutput()` 판단을 `output-shape.ts`로 이전

---

**[INFO] `isLiveNode` 조건 완화로 인한 잠재적 오탐 범위 확대**
- 위치: `result-timeline.tsx:130–132`
- 상세: 기존에는 `result.nodeType === "ai_agent"` 조건이 포함되어 있었으나 제거됨으로써, `waiting_for_input` 상태인 모든 노드가 `isLiveNode = true`가 됩니다. Form, Button 등 다른 `waiting_for_input` 노드들도 대화형 인터페이스가 확장될 가능성이 있습니다.
- 제안: 의도된 변경이라면 인라인 주석으로 명시 (`// 모든 대화형 waiting 노드를 포괄`), 아니라면 `isMultiTurnConversation(result)` 조건을 AND로 추가

---

**[INFO] 테스트에서 SVG 존재 여부로 UI 동작 검증**
- 위치: `result-timeline.test.tsx:112`
- 상세: `container.querySelectorAll("svg")`로 chevron 존재를 검증하는 방식은 다른 SVG 아이콘(StatusIcon 등)과 구분되지 않아 테스트 의도가 불명확합니다. 다른 아이콘이 추가될 경우 false positive가 발생합니다.
- 제안: `aria-label`이나 `data-testid`를 chevron에 추가하거나, 텍스트 기반 어서션(`screen.getByRole("button")` + 클릭 후 expanded 상태 확인)으로 변경

---

**[INFO] 테스트 케이스명의 검증 범위와 실제 어서션 불일치**
- 위치: `result-detail.test.tsx:255`
- 상세: 테스트명은 "renders conversation inspector for completed multi-turn information extractor"이지만 실제 어서션은 `Input` 버튼이 없다는 것(`toBeNull()`)만 확인합니다. ConversationInspector가 실제로 렌더링되었는지는 검증되지 않습니다.
- 제안: `ConversationInspector`의 특징적인 요소(예: 메시지 텍스트, 대화 관련 UI 요소)에 대한 양성 어서션 추가

---

### 요약

이번 변경은 `ai_agent` 타입에 종속되었던 대화형 출력 탐지 로직을 `information_extractor` 등 다른 노드 타입으로 일반화한 것으로, 방향성은 올바릅니다. 그러나 동일한 "대화형 출력인지 판단"하는 로직이 `result-timeline.tsx`와 `result-detail.tsx`에 각각 미묘하게 다른 형태로 이원화된 점이 가장 큰 유지보수성 리스크입니다. 이미 `unwrapNodeOutput()`, `parseHistoryMessages()` 등의 공유 유틸이 있는 코드베이스 패턴을 고려할 때, 대화형 출력 탐지 역시 단일 유틸 함수로 통합하는 것이 일관성과 장기 유지보수성 측면에서 필요합니다. 테스트는 신규 케이스를 적절히 추가했으나, SVG 기반 어서션과 부정 어서션 위주의 검증은 개선 여지가 있습니다.

### 위험도
**MEDIUM**