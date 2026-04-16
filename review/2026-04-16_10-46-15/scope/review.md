### 발견사항

- **[WARNING]** `isLiveNode` 조건에서 노드 타입 가드 제거
  - 위치: `result-timeline.tsx`, `isLiveNode` 계산부
  - 상세: 기존 `result.nodeType === "ai_agent"` 조건이 제거되어 `waiting_for_input` 상태의 **모든 노드**가 라이브 대화 노드로 처리됩니다. `form`, `carousel` 같은 프레젠테이션 노드도 `isLiveConversation=true` 상태에서는 대화 확장 UI가 적용될 수 있습니다.
  - 제안: `isMultiTurnConversation(result)` 조건을 추가하여 실제로 대화형 노드인 경우에만 `isLiveNode`를 활성화하도록 보완. 예: `ctx.isLiveConversation && result.status === "waiting_for_input" && isMultiTurnConversation(result)`

- **[WARNING]** `isCompletedConversation`의 과도한 폴백 조건
  - 위치: `result-detail.tsx`, `isCompletedConversation` 계산부
  - 상세: `rawOut?.messages != null` 조건이 마지막 fallback으로 포함되어 있어, `messages` 필드를 가진 임의의 노드 출력이 대화 뷰로 렌더링될 수 있습니다. 이는 `interactionType` 기반 판별보다 범위가 훨씬 넓습니다.
  - 제안: `rawOut?.messages != null` 폴백을 제거하고 `interactionType === "ai_conversation"` 조건만 유지하거나, `mode === "multi_turn"` 등 명시적인 구분자를 사용.

- **[INFO]** 기존 인라인 주석 삭제
  - 위치: `result-detail.tsx` diff 내 `-` 줄
  - 상세: `// Check for completed multi-turn conversation (history mode)`, `// Determine if tabs should be shown:` 등 맥락 설명 주석이 제거되었습니다. 기능 변경에 따른 자연스러운 조정이나, 새 로직에 대한 주석이 없어 가독성이 낮아졌습니다.
  - 제안: 새 로직(`isWrapped`, `isConversationNode`)에 대한 간략한 설명 주석 추가.

- **[INFO]** `result-timeline.test.tsx` 테스트의 약한 assertion
  - 위치: `result-timeline.test.tsx` — `"shows expandable conversation"` 테스트
  - 상세: `container.querySelectorAll("svg").length > 0` 조건은 SVG 아이콘이 하나라도 있으면 통과합니다. 상태 아이콘 등 다른 SVG도 이미 존재하므로 이 테스트는 chevron 렌더링 여부를 실질적으로 검증하지 못합니다.
  - 제안: `ChevronRight`/`ChevronDown` 아이콘을 특정할 수 있는 `data-testid`나 `aria-label`을 활용하거나, 클릭 후 확장 여부를 assertion하는 방식으로 보완.

---

### 요약

이번 변경의 핵심 의도는 `ai_agent`에 국한되어 있던 멀티턴 대화 UI 지원을 `information_extractor` 등 다른 노드 타입으로 일반화하는 것으로, 방향 자체는 올바릅니다. 그러나 `isLiveNode` 조건에서 노드 타입 가드를 완전히 제거한 부분과 `rawOut?.messages != null` 폴백 조건은 의도보다 넓은 범위에 영향을 줄 수 있는 과도한 일반화입니다. 특히 `form`이나 `carousel` 같은 프레젠테이션 노드가 라이브 실행 중 대화 UI로 잘못 렌더링될 가능성이 있으며, 이는 기존 동작에 대한 암묵적 회귀(regression)입니다.

### 위험도
**MEDIUM**