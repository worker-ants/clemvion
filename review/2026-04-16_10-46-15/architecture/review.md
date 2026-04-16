### 발견사항

- **[WARNING]** `isCompletedConversation` 판별 로직이 컴포넌트 내부에 인라인으로 중복 구현됨
  - 위치: `result-detail.tsx:330–342`, `result-timeline.tsx:isMultiTurnConversation()`
  - 상세: 두 파일 모두 `outputData`의 wrapped/flat 구조를 직접 파싱하여 대화 노드 여부를 판별하고 있음. 동일한 휴리스틱(`"config" in raw && "output" in raw`, `interactionType === "ai_conversation"`, `messages` 존재 여부)이 두 곳에서 각각 다른 형태로 구현되어 있어 향후 조건 변경 시 양쪽을 동시에 수정해야 함.
  - 제안: `output-shape.ts` 또는 별도 `conversation-utils.ts`에 `isConversationOutput(outputData): boolean` 순수 함수를 추출하고 두 컴포넌트가 이를 공유하도록 리팩터링.

- **[WARNING]** `result-detail.tsx` 내 outputData 파싱 로직이 컴포넌트 렌더 함수에 직접 위치
  - 위치: `result-detail.tsx:321–342`
  - 상세: `isWrapped`, `innerOutput`, `innerMeta` 추출 로직은 이미 `unwrapNodeOutput()`(`output-shape.ts`)이 담당하는 책임과 겹침. 컴포넌트가 데이터 형태 변환 책임을 직접 지고 있어 SRP 위반.
  - 제안: `unwrapNodeOutput`의 반환 타입에 `isConversation: boolean` 또는 `interactionType` 필드를 추가하여 파싱 책임을 단일 모듈로 집중시킬 것.

- **[WARNING]** `isLiveNode` 판별에서 `nodeType` 조건 제거로 인한 과도한 범위 확장
  - 위치: `result-timeline.tsx:135–137`
  - 상세: 변경 전에는 `nodeType === "ai_agent"` 조건이 있었으나 제거되어, `waiting_for_input` 상태인 모든 노드가 `isLiveNode`로 판별됨. `form`, `carousel` 같은 presentation 노드도 `waiting_for_input`을 가질 수 있어 대화 UI가 의도치 않게 렌더링될 수 있음.
  - 제안: 타입 조건 대신 `isMultiTurnConversation(result) || result.nodeType === "information_extractor"` 같이 의미 기반 조건으로 범위를 명시적으로 제한할 것.

- **[INFO]** `isCompletedConversation` 조건의 마지막 fallback(`rawOut?.messages != null`)이 모호함
  - 위치: `result-detail.tsx:341`
  - 상세: `innerOutput?.messages`가 이미 확인된 상황에서 `rawOut?.messages != null`은 중복 조건이거나 flat 레거시 포맷 대응으로 보임. 의도가 주석 없이는 불명확하며, `isWrapped`가 `true`일 때 `rawOut.messages`는 항상 `undefined`이므로 이 조건은 사실상 `!isWrapped` 케이스에서만 영향을 미침.
  - 제안: 조건 분기를 `isWrapped`/`!isWrapped` 두 경로로 명시적으로 분리하거나, 앞서 제안한 공통 유틸 함수 내에서 정리할 것.

- **[INFO]** 테스트가 SVG 존재 여부로 기능을 검증하는 취약한 단언 사용
  - 위치: `result-timeline.test.tsx:116`
  - 상세: `container.querySelectorAll("svg")` 카운트는 lucide 아이콘 변경이나 다른 SVG 추가 시 깨질 수 있고, 실제로 chevron이 렌더링되었는지를 의미적으로 검증하지 못함.
  - 제안: chevron 버튼에 `aria-label` 또는 `data-testid`를 부여하거나, `expanded` 상태 변화를 `fireEvent.click` 후 자식 목록 렌더링으로 검증하는 방식 권장.

---

### 요약

이번 변경은 `ai_agent` 하드코딩 의존을 제거하고 `information_extractor` 등 새로운 대화형 노드를 지원하기 위한 범용화 작업으로, 방향성은 올바르다. 그러나 핵심 판별 로직(`isMultiTurnConversation` / `isCompletedConversation`)이 두 컴포넌트에 각각 다른 형태로 분산되어 있어 변경에 취약한 구조가 됐다. 이미 `output-shape.ts`라는 파싱 전담 모듈이 존재하므로, 해당 모듈로 책임을 집중시키면 결합도를 낮추고 향후 노드 타입 추가 시 단일 지점만 수정하면 되는 구조를 만들 수 있다. `isLiveNode` 범위 확장 또한 의도치 않은 렌더링 부작용을 유발할 수 있어 명시적 조건 보완이 필요하다.

### 위험도

**MEDIUM**