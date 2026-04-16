# Code Review Resolution

## WARNING 이슈 조치

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `isLiveNode` 범위 과도 확장 | `isMultiTurn` 조건을 AND로 추가하여 대화형 노드만 라이브 대화 노드로 처리되도록 복원 |
| 2 | `rawOut?.messages` fallback 과포함 | 해당 fallback 조건 제거. `interactionType === "ai_conversation"` 체크만 유지 |
| 3 | 대화형 출력 탐지 로직 이원화 | `output-shape.ts`에 `isConversationOutput()` 공통 유틸 함수 추출. `result-timeline.tsx`와 `result-detail.tsx` 모두 이 함수 사용하도록 통일 |
| 4 | `unwrapNodeOutput` 미활용, 인라인 언래핑 | `isConversationOutput()` 내부에서 `unwrapNodeOutput()` 활용. `result-detail.tsx`의 인라인 언래핑 로직 제거 |
| 5 | SVG 카운트 기반 테스트 단언 취약 | 클릭 후 메시지 내용 노출 검증(`fireEvent.click` + `getByText`)으로 교체. 🤖 이모지 존재 확인 추가 |
| 6 | ConversationInspector 렌더 포지티브 단언 부재 | `getByText("My name is Alice")` 포지티브 단언 추가 |
| 7 | `conversationConfig` 경로 미검증 | `isConversationOutput` 유틸에서 `conversationConfig` 경로도 처리 |
| 8 | `isLiveNode` 회귀 테스트 부재 | `waiting_for_input` + `form` 노드에서 🤖 미표시 검증 테스트 추가 |

## INFO 이슈 조치

| # | 발견사항 | 조치 |
|---|----------|------|
| 5 | `queryByRole`/`queryByText` 혼용 | `queryByText`로 통일 |
| 6 | 테스트 fixture 실제 모델명 하드코딩 | `"test-model"`로 교체 |

## 미조치 사항 (INFO)

- JSDoc/인라인 주석 추가: `isConversationOutput` 함수에 이미 충분한 JSDoc 작성됨. 추가 주석은 불필요
- Zod 런타임 검증: 기존 코드베이스와 동일한 패턴이므로 본 변경 범위 외
- `output.interactionType` 경로 테스트: 해당 경로는 `isConversationOutput` 유틸 내부에서 커버됨
