## 성능 코드 리뷰

### 발견사항

---

**[INFO]** `result-detail.tsx` — 렌더링마다 반복되는 `outputData` 파싱 인라인 연산
- **위치**: `ResultDetail` 함수 내 `rawOut`, `isWrapped`, `innerOutput`, `innerMeta` 파생 로직 (라인 319–342)
- **상세**: `outputData`를 파싱하는 동일한 패턴이 `result-detail.tsx`의 `ResultDetail`과 `result-timeline.tsx`의 `isMultiTurnConversation`, `TimelineRow` 내부에서 각각 독립적으로 수행됩니다. `TimelineRow`는 `rawForConv` → `convPayload` 추출을 별도로 다시 수행하고 있어, 같은 데이터를 한 렌더 사이클 내에서 두 번 파싱합니다.
- **제안**: `outputData`의 언래핑 로직을 `unwrapNodeOutput` (이미 `output-shape.ts`에 존재)으로 통일하고, `TimelineRow` 내부에서도 이 유틸을 사용하도록 일원화하세요.

---

**[INFO]** `result-timeline.tsx` — `isMultiTurnConversation`의 중복 호출
- **위치**: `TimelineRow` 내 `isMultiTurn = isMultiTurnConversation(result)` (라인 125)와 후속 `rawForConv`/`convPayload` 재계산 블록 (라인 153–164)
- **상세**: `isMultiTurnConversation(result)` 호출 시 `outputData`를 파싱한 후, 동일 함수 내에서 `convPayload` 계산을 위해 같은 파싱을 다시 수행합니다. 단일 결과에 대해 같은 객체 구조 검사가 두 번 일어납니다.
- **제안**: `isMultiTurnConversation`을 파싱 결과(`unwrapped output`)도 반환하도록 리팩토링하거나, 컴포넌트 최상단에서 한 번만 언래핑하여 재사용하세요.

---

**[INFO]** `result-timeline.tsx` — `isLiveNode` 조건 확장에 따른 불필요한 확장 트리거 가능성
- **위치**: `isLiveNode` 조건 (라인 128–130)
- **상세**: 기존에는 `nodeType === "ai_agent"`로 제한하던 조건을 `result.status === "waiting_for_input"`만으로 변경했습니다. 이로 인해 `waiting_for_input` 상태의 모든 노드(form, button 등)가 `isLiveNode = true`로 평가되어 `parseHistoryMessages`를 호출하고 빈 배열을 반환합니다. 실제로는 메시지가 없어 렌더에 영향이 없지만, 의미없는 함수 호출이 발생합니다.
- **제안**: `isLiveConversation` 플래그와 함께 `isMultiTurn`을 복합 조건으로 사용하거나, `isLiveNode` 계산 시 대화형 노드 여부를 함께 체크하세요:
  ```ts
  const isLiveNode = ctx.isLiveConversation && result.status === "waiting_for_input" && isMultiTurn;
  ```

---

**[INFO]** `result-detail.tsx` — `isCompletedConversation` 조건의 과도한 폴백 체크
- **위치**: 라인 335–340
- **상세**: 세 번째 OR 조건 `rawOut?.messages != null`은 앞선 두 조건(`innerOutput?.interactionType`, `innerMeta?.interactionType`)이 충분히 커버하지 못하는 레거시 형식을 위한 폴백입니다. 하지만 이 조건은 `messages` 필드가 있는 모든 노드를 대화형으로 분류할 수 있어 의도치 않은 노드까지 conversation 뷰로 렌더링될 위험이 있고, 각 렌더마다 3번의 옵셔널 체이닝이 평가됩니다.
- **제안**: 레거시 폴백을 명시적인 `nodeType` 또는 `interactionType` 체크로 교체하여 조건을 정확하게 제한하세요.

---

**[INFO]** 테스트 파일 — `container.querySelectorAll("svg")` 사용
- **위치**: `result-timeline.test.tsx`, 새 테스트 케이스 마지막 단언
- **상세**: SVG 요소 존재 여부로 chevron 아이콘 렌더링을 검증합니다. 이는 구현 세부사항(Lucide 아이콘이 SVG를 사용함)에 의존하는 취약한 어서션으로, 다른 SVG가 렌더링되어도 통과됩니다. 성능 이슈는 아니지만 테스트 신뢰도 측면에서 지적합니다.
- **제안**: `data-testid`를 chevron 요소에 추가하거나 aria-label로 검증하세요.

---

### 요약

이번 변경은 `ai_agent` 타입 한정이던 대화형 노드 판별 로직을 `information_extractor` 등 범용 노드로 확장하는 작업입니다. 성능 측면에서 Critical 이슈는 없으나, `outputData` 언래핑 로직이 `result-detail.tsx`와 `result-timeline.tsx` 양쪽에서 각각 인라인으로 중복 구현되어 있어 이미 존재하는 `unwrapNodeOutput` 유틸 함수의 활용이 권장됩니다. 또한 `isLiveNode` 조건 완화로 인해 대화형이 아닌 `waiting_for_input` 노드에서 불필요한 `parseHistoryMessages` 호출이 발생하는 점은 조건 정제로 해소할 수 있습니다. 전반적으로 렌더링 횟수나 데이터 규모가 크지 않은 UI 컴포넌트 범주 내에서의 중복 연산이므로 실사용 성능 영향은 미미합니다.

### 위험도

**LOW**