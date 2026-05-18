# 테스트(Testing) 리뷰 결과

## 발견사항

---

### 1. 테스트 존재 여부 / 커버리지 갭

- **[WARNING]** `PresentationCardBody` 컴포넌트에 대한 단독 단위 테스트가 없음
  - 위치: `conversation-inspector.tsx` 내 `PresentationCardBody` 함수 (라인 225~273)
  - 상세: `PresentationCardBody` 는 `button_click` / `button_continue` / `form_submitted` 세 분기를 가지며, `presentation` 필드가 없는 경우(fallback)까지 4개 코드 경로가 존재한다. 현재 테스트는 `ConversationInspector SummaryView` 전체 렌더를 통해 간접 검증하는 형태라 세부 조합(예: `p.presentation` 이 `undefined` 인 경우)이 누락되어 있다.
  - 제안: `PresentationCardBody` 를 export 하거나, 세부 시나리오(presentation 없음, data 없음, entries 0개)를 `SummaryView` 테스트 케이스에 명시적으로 추가한다.

- **[WARNING]** `form_submitted` 에서 `entries.length === 0` 인 경우("(no fields)" 표시) 테스트 없음
  - 위치: `conversation-inspector.tsx` 라인 254~260, `conversation-inspector.test.tsx`
  - 상세: `form_submitted` 케이스 테스트(`presentation_user (form_submitted) 는 data 의 key-value 를 표로 표시`)는 데이터가 존재하는 정상 경로만 커버한다. 빈 data(`{}`)가 오는 엣지 케이스(`(no fields)` 렌더링)는 테스트되지 않는다.
  - 제안: `data: {}` 인 `form_submitted` 케이스를 추가하고 `(no fields)` 텍스트가 렌더링됨을 검증한다.

- **[WARNING]** `threadTurnsToConversationItems` 에서 `ai_assistant` 가 `turnIndex` 0 인 채로 먼저 오는 경우(turn 카운터 미초기화) 테스트 없음
  - 위치: `conversation-utils.ts` 라인 738 — `const turn0 = turnIndex || 1;`
  - 상세: 코드가 `turnIndex === 0` 일 때 `1` 로 폴백한다(`turnIndex || 1`). 이것은 `ai_user` 없이 `ai_assistant` 가 먼저 등장하는 이례적인 스트림에 대한 방어 코드인데, 해당 케이스를 검증하는 테스트가 없다.
  - 제안: `ai_user` 없이 `ai_assistant`로만 구성된 turns 배열을 입력했을 때 `turnIndex === 1` 이 되는지를 검증하는 케이스를 추가한다.

- **[WARNING]** `use-execution-events.ts` 의 `threadTurns` 분기 로직에 대한 테스트가 없음
  - 위치: `use-execution-events.ts` 라인 1001~1013
  - 상세: `conversationThread.turns` 가 있으면 `threadTurnsToConversationItems`로, 없으면 기존 `messagesToConversationItems` fallback 경로로 분기한다. 이 두 경로 모두 hook 레벨의 통합 테스트나 단위 테스트가 현재 diff 내에 없다. 특히 fallback 경로(기존 `convConfig.messages` 경로)가 기존과 동일하게 동작하는지 회귀 검증이 누락되어 있다.
  - 제안: `use-execution-events` hook 에 대한 테스트 파일이 이미 존재한다면 해당 분기를 커버하는 케이스를 추가한다. 없다면 신규 케이스 추가를 검토한다.

- **[INFO]** `stripInlineMarkers` 의 중첩 마커(예: `[user-input][user-input]X[/user-input][/user-input]`) 처리에 대한 테스트 없음
  - 위치: `conversation-utils.test.ts` `stripInlineMarkers` describe 블록
  - 상세: 현재 테스트는 단일·다중 쌍, undefined, empty 를 커버한다. 중첩된 비정규 마커가 오면 `/\[\/?user-input\]/g` 정규식이 태그만 제거하므로 "내용" 이 남는 형태이나, 이것이 예상 동작인지 명시되지 않았다.
  - 제안: 필수 추가는 아니지만, 비정규 중첩 입력에 대한 기대 동작을 주석 또는 테스트로 명문화하면 회귀 발생 시 원인 파악이 쉬워진다.

---

### 2. 엣지 케이스 테스트

- **[WARNING]** `button_continue` 케이스에서 `url` 이 없는 경우 빈 문자열 렌더링 테스트 없음
  - 위치: `conversation-inspector.tsx` 라인 244~250, `conversation-inspector.test.tsx`
  - 상세: `data.url` 이 `undefined` 이면 빈 문자열(`""`)로 렌더되는데, 테스트는 URL 이 있는 정상 경로만 확인한다. 실제 운영 데이터에서 `url` 누락은 발생 가능하다.
  - 제안: `data: { buttonId: "go", buttonLabel: "Open" }` (url 없음) 케이스를 추가하고 빈 URL 영역이 렌더되는지 또는 "no url" 등의 fallback 이 필요한지 확인한다.

- **[WARNING]** `PresentationDetail` / `SystemDetail` 에서 `item.timestamp` 가 `undefined` 인 경우 렌더 테스트 없음
  - 위치: `conversation-inspector.tsx` 라인 298~306, 309~331, `conversation-inspector.test.tsx`
  - 상세: `makeItem` 헬퍼에 `timestamp` 가 없는 경우가 기본값인지 확인이 필요하다. `formatDate` 가 `undefined` 를 받을 때 예외를 던지지 않는다면 문제없지만, 해당 경로의 렌더가 보장되지 않는다.
  - 제안: `makeItem` 의 기본값에 `timestamp` 가 포함/미포함인지를 확인하고, 미포함 케이스를 명시적으로 한 건 추가한다.

- **[INFO]** `threadTurnsToConversationItems` 에서 알 수 없는 `source` 값 입력 시 처리 테스트 없음
  - 위치: `conversation-utils.ts` 라인 725~807, `conversation-utils.test.ts`
  - 상세: `switch(turn.source)` 에 `default` 케이스가 없어 정의되지 않은 `source` 값이 오면 해당 turn 은 조용히 무시된다. 이 동작이 의도적인지 명시되지 않았다.
  - 제안: `default` 케이스를 명시적으로 추가(`// unknown source — skip`)하거나, 테스트로 "알 수 없는 source 는 items 배열에 포함되지 않음"을 검증한다.

---

### 3. Mock 적절성

- **[INFO]** `ConversationInspector SummaryView` 테스트에서 `useT` (i18n hook) 의 mock 처리 방식이 코드에 명시되지 않음
  - 위치: `conversation-inspector.test.tsx` (SummaryView 테스트 블록 전체)
  - 상세: 테스트 코드가 `/button clicked|버튼 클릭/i`, `/form submitted|폼 제출/i`, `/link continue|링크 이동/i`, `/system note|시스템 알림/i` 와 같이 영문/한국어 둘 다 허용하는 정규식을 사용하는 것은 `useT` 가 실제 사전을 반환하는 경우와 key 를 그대로 반환하는 경우 모두를 커버하는 좋은 패턴이다. 그러나 이 처리 방식이 기존 테스트들과 동일한 mock 설정을 따르는지(예: `vi.mock("@/lib/i18n")`) test 파일 상단의 setup 에서 확인이 필요하다.
  - 제안: 기존 테스트 파일에서 `useT` mock 방식을 확인하고 일관성을 유지한다. 만약 실제 사전을 로드한다면 영어 라벨로 단정하는 게 더 명확하고, mock 이라면 key 를 그대로 반환하는 형태를 문서화한다.

---

### 4. 테스트 격리

- **[INFO]** `describe("ConversationInspector SummaryView — source 별 시각 분기")` 내 `beforeEach` 에서 `baseProps` 를 재생성하므로 테스트 간 상태 공유 위험은 없음
  - 위치: `conversation-inspector.test.tsx` 라인 38~41
  - 상세: `makeBaseProps()` 를 `beforeEach` 에서 재생성하는 패턴은 올바르다. 단, `render` 호출 후 `cleanup` 이 자동으로 이루어지는지(`@testing-library/react` 의 `afterEach` 자동 cleanup 설정) 확인이 필요하다. 이미 기존 테스트에서 동일 방식을 사용하고 있다면 문제없다.
  - 제안: 문제 없음, 기존 패턴과 일치한다면 그대로 유지.

---

### 5. 테스트 가독성

- **[INFO]** `SummaryView` 테스트에서 `screen.getByText("🧩")` 사용은 이모지 값 변경 시 테스트가 깨지는 취약한 선택자임
  - 위치: `conversation-inspector.test.tsx` 라인 60, 152
  - 상세: 아이콘을 이모지 문자로 직접 하드코딩하면, 추후 SVG 아이콘으로 교체하거나 값이 변경될 때 테스트가 깨진다. 스펙 자체가 🧩 아이콘을 규정하므로 의도적인 선택일 수 있으나, `aria-label` 또는 `data-testid` 를 사용하면 더 견고하다.
  - 제안: `<span aria-hidden>🧩</span>` 에 `aria-hidden` 이 붙어있으므로 접근성 측면에서는 적절하다. 테스트 견고성을 위해 presentation 카드 컨테이너에 `data-testid="presentation-card"` 를 부여하고 `getByTestId` 로 검증하는 방식도 고려한다.

- **[INFO]** `it` 설명 문자열에 한국어와 영어가 혼재하나 기존 테스트와 일관성은 유지됨
  - 위치: `conversation-inspector.test.tsx` 및 `conversation-utils.test.ts` 전반
  - 상세: 기존 파일의 패턴과 일치하여 문제없다.

---

### 6. 회귀 테스트

- **[WARNING]** `SummaryView` 내 `stripInlineMarkers` 적용(`m.content` → `stripInlineMarkers(m.content)`) 에 대한 회귀 테스트가 `conversation-inspector.test.tsx` 에 없음
  - 위치: `conversation-inspector.tsx` 라인 341, 350 (`SummaryView` 내부 user/assistant content 처리)
  - 상세: `conversation-utils.test.ts` 에 `messagesToConversationItems — inline marker strip` describe 블록이 있어 converter 레이어는 검증되나, `SummaryView` 컴포넌트 자체가 `stripInlineMarkers` 를 직접 호출하는 코드(라인 341, 350)에 대한 테스트는 없다. Converter 와 Renderer 가 이중으로 strip 을 적용하는 상황이 생길 수 있어 회귀 검증이 필요하다.
  - 제안: `SummaryView` 테스트에 `[user-input]` 마커가 포함된 user/assistant 메시지를 입력했을 때 마커가 렌더링에서 사라지는지 검증하는 케이스를 추가한다. 또한 이중 strip(converter + renderer 양쪽 모두 strip)이 의도된 동작인지 확인하고, 의도적이라면 주석으로 명시한다.

- **[INFO]** 기존 `describe("summarizeToolResult")` 테스트는 변경 사항과 무관하여 그대로 유효하다
  - 위치: `conversation-inspector.test.tsx` 라인 327 이전 기존 테스트
  - 상세: `summarizeToolResult` 는 변경되지 않았으므로 회귀 위험 없음.

---

### 7. 테스트 용이성

- **[WARNING]** `PresentationDetail` / `SystemDetail` 이 `useT` hook 에 직접 의존하여 순수 단위 테스트가 어려움
  - 위치: `conversation-inspector.tsx` 라인 283, 309
  - 상세: `PresentationDetail` 과 `SystemDetail` 이 내부에서 `useT()` 를 직접 호출한다. 이 컴포넌트들을 격리 테스트하려면 i18n provider/mock 이 항상 필요하다. 이미 기존 컴포넌트들이 같은 패턴이므로 일관성은 있지만, 향후 이 컴포넌트들의 테스트 용이성을 높이려면 label 문자열을 props 로 받는 순수 presentational 레이어와 hook 레이어를 분리하는 구조가 유리하다.
  - 제안: 현재 패턴은 기존 코드와 일관적으로 허용 가능하다. 중장기적으로 i18n 키를 props 로 내려주는 컨테이너/뷰 분리를 고려한다.

- **[INFO]** `threadTurnsToConversationItems` 는 순수 함수로 외부 의존성이 없어 테스트 용이성이 높음
  - 위치: `conversation-utils.ts` 전체
  - 상세: 외부 서비스·hook 의존성 없이 입출력이 명확한 순수 함수 구조이며, 현재 테스트도 이를 잘 활용하고 있다.

---

## 요약

전반적으로 이번 변경에서 테스트 작성이 잘 동반되었다. `conversation-utils.ts` 의 순수 함수들(`stripInlineMarkers`, `threadTurnsToConversationItems`)은 충실한 단위 테스트로 검증되며, `ConversationInspector SummaryView` 의 source 분기 렌더링도 5가지 주요 시나리오를 커버한다. 그러나 몇 가지 커버리지 갭이 존재한다. 가장 주의가 필요한 부분은 (1) `SummaryView` 가 `stripInlineMarkers` 를 직접 호출하는 경로의 회귀 테스트 누락(converter와 이중 strip 가능성), (2) `form_submitted`의 빈 data 및 `button_continue`의 url 누락 엣지 케이스, (3) `use-execution-events.ts` 의 새로운 분기 로직에 대한 통합 테스트 부재다. `ai_assistant` 가 `ai_user` 없이 먼저 오는 경우의 `turnIndex || 1` 폴백 동작도 명시적 테스트가 권장된다. 이모지를 직접 선택자로 사용하는 패턴은 스펙이 아이콘 변경을 결정할 때 취약점이 될 수 있으나 현재는 스펙과 일치하므로 허용 가능하다.

## 위험도

MEDIUM
