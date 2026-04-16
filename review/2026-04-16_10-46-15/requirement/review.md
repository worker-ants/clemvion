## 발견사항

### result-detail.tsx

- **[WARNING]** `isCompletedConversation` 조건의 fallback 로직이 과도하게 관대함
  - 위치: `rawOut?.messages != null` 조건
  - 상세: `interactionType` 없이 최상위 레벨에 `messages` 필드만 있어도 대화 노드로 판정됨. HTTP 응답 등 `messages` 키를 반환하는 비-AI 노드가 잘못 분류될 수 있음
  - 제안: fallback 조건을 제거하거나, `nodeCategory === "ai"` 조건을 함께 요구

- **[WARNING]** `isLiveNode` 조건에서 `nodeType` 체크 제거 후 범위가 불필요하게 확장됨 (result-timeline.tsx와 연계)
  - 위치: `result-timeline.tsx` - `isLiveNode` 계산부
  - 상세: `waiting_for_input` 상태인 모든 노드가 live conversation으로 처리됨. Form, Button 대기 노드도 해당될 수 있어 대화 UI가 잘못 표시될 수 있음
  - 제안: `isMultiTurn` 또는 카테고리 조건을 함께 적용: `ctx.isLiveConversation && result.status === "waiting_for_input" && isMultiTurnConversation(result)`

- **[INFO]** `isWrapped` 판별 시 `"meta" in rawOut` 체크 미포함
  - 위치: `result-detail.tsx` - `isWrapped` 계산부
  - 상세: `config`와 `output` 키만으로 wrapped 판별하므로, 우연히 이 두 키를 가진 비-wrapped 출력이 잘못 파싱될 수 있음. `result-timeline.tsx`의 동일 로직은 일관되게 구현됨
  - 제안: 두 파일의 wrapped 판별 로직을 공통 유틸(`output-shape.ts` 등)로 통일

---

### result-detail.test.tsx

- **[WARNING]** `information_extractor` 완료 대화 테스트가 탭 미표시만 검증하고 ConversationInspector 렌더 여부를 검증하지 않음
  - 위치: `"renders conversation inspector for completed multi-turn information extractor"` 테스트
  - 상세: 탭이 없다는 것만 확인하고, 실제로 `ConversationInspector`가 렌더되는지, 메시지가 표시되는지를 검증하지 않아 퇴행 감지력이 낮음
  - 제안: `screen.getByText("My name is Alice")` 또는 `screen.getByText("Got it, Alice.")` 등으로 ConversationInspector의 실제 렌더를 검증

- **[INFO]** `ai_agent` 탭 표시 테스트가 기존 동작의 변화를 검증하는 회귀 테스트로서는 적절하나, 새 `isConversationNode` 로직에서 `ai_agent`가 `interactionType` 없이도 올바르게 탭을 표시하는지 명시적으로 기술하면 의도가 더 명확해짐

---

### result-timeline.test.tsx

- **[WARNING]** 확장 가능한 chevron 존재 여부만 검증하고 실제 클릭 후 대화 항목 펼침 동작을 검증하지 않음
  - 위치: `"shows expandable conversation for multi-turn information extractor"` 테스트
  - 상세: SVG 존재 여부는 구현 세부사항에 의존적이며, 클릭 후 메시지가 실제로 표시되는지를 검증하지 않음
  - 제안: `fireEvent.click`으로 토글 후 `screen.getByText("My name is Alice")` 등 메시지 노출 여부 검증 추가

- **[INFO]** `isLiveNode` 범위 확장에 대한 테스트(form 대기 노드가 live conversation으로 잘못 처리되지 않음)가 없음
  - 위치: result-timeline.test.tsx 전체
  - 제안: `waiting_for_input` + `nodeType: "form"` 조합에서 chevron이 표시되지 않거나 conversation 확장이 발생하지 않음을 검증하는 테스트 추가

---

## 요약

이번 변경은 `ai_agent`에 한정되던 다중 턴 대화 감지 로직을 `information_extractor` 등 다른 AI 노드로 확장한 것으로, 요구사항 방향은 명확하고 핵심 기능은 구현되어 있습니다. 그러나 `isCompletedConversation`의 fallback 조건(`rawOut?.messages != null`)이 과도하게 관대하여 비-AI 노드의 오분류 위험이 있으며, `isLiveNode`에서 `nodeType` 체크 제거로 인해 form/button 대기 노드도 live conversation 노드로 처리될 수 있는 범위 확장 문제가 존재합니다. 테스트는 핵심 케이스를 추가하고 있으나 ConversationInspector의 실제 렌더와 확장 동작 검증이 부족하여 회귀 감지력이 낮습니다. wrapped/unwrapped 판별 로직이 두 파일에 중복 구현되어 있어 공통 유틸 추출도 권장됩니다.

## 위험도

**MEDIUM**