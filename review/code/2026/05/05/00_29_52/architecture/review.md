## 아키텍처 코드 리뷰 — `conversation-inspector`

### 발견사항

---

**[WARNING] SummaryView 내 아이템 타입 분기 패턴 불일치 (OCP 위반)**
- 위치: `SummaryView` items.map() 루프, ~519–568행
- 상세: `tool` 타입은 early return으로 처리하고 `rag` 타입은 최종 return의 인라인 조건부로 처리한다. 두 가지 dispatch 패턴이 혼재하면 다음 타입 추가 시 어떤 패턴을 따를지 불명확하고, 루프 가독성이 선형적으로 저하된다.
- 제안: 타입별 렌더러를 별도 컴포넌트로 추출하고 map 내부를 단순 dispatch로 만든다.

```tsx
// 현재: 분기 패턴 혼재
if (isTool) { return <ToolLine />; }   // early return
// ... isRag는 최종 return 내 인라인

// 권장: 단일 dispatch
function SummaryItem({ item, ...props }) {
  if (item.type === "tool") return <ToolCompactLine {...} />;
  if (item.type === "rag")  return <RagBubble {...} />;
  if (item.type === "user") return <UserBubble {...} />;
  return <AssistantBubble {...} />;
}
```

---

**[WARNING] SummaryView 단일 책임 원칙 위반**
- 위치: `SummaryView` 전체 함수
- 상세: turn counter 표시, 4가지 메시지 타입(user/assistant/rag/tool) 각각의 시각적 렌더링, 클릭 핸들러 바인딩을 모두 담당한다. 각 타입의 bubble/line 스타일은 독립적으로 진화하는데, 이 변경이 모두 `SummaryView` 수정을 요구한다.
- 제안: `ToolCompactLine`, `RagBubble`, `MessageBubble` 컴포넌트로 분리하면 `SummaryView`는 순수한 레이아웃/dispatch 책임만 갖게 된다.

---

**[WARNING] 파일 응집도 과부하 — 파일 크기 임계점 도달**
- 위치: `conversation-inspector.tsx` 전체 (~700줄)
- 상세: `ReferencesChip`, `ToolCallBadge`, `ToolStatusIcon`, `SelectedItemDetail`, `ToolDetail`, `RagDetail`, `UserDetail`, `SummaryView`, `RagBubbleSummary`, `MessageInput`, `ConversationInspector` — 10개 이상의 서브 컴포넌트/함수가 단일 파일에 존재한다. Summary 뷰와 Detail 뷰는 이미 독립적인 진화 축을 가지고 있다.
- 제안: `summary-view.tsx` / `detail-view.tsx` / `message-input.tsx` 분리를 고려할 시점이다. 지금 당장은 아니더라도 다음 기능 추가 시 자연스러운 분리 경계다.

---

**[INFO] `summarizeToolResult` 순수 함수의 테스트 간접성**
- 위치: `conversation-inspector.tsx:208`, 테스트 파일 전체
- 상세: 포맷팅 로직이 복잡한 순수 함수임에도 export되지 않아 렌더링을 통해서만 검증된다. 현재는 테스트가 충분하지만, 로직이 확장될 경우 단위 테스트 작성이 불가능해진다.
- 제안: 포맷팅 로직이 더 복잡해지면 `format-tool-result.ts` 같은 유틸 모듈로 분리하고 직접 단위 테스트를 추가한다.

---

**[INFO] 테스트 공유 상태 패턴**
- 위치: 테스트 파일, `baseProps` 모듈 레벨 선언 (~28행)
- 상세: `vi.fn()`을 모듈 레벨에서 선언하고 `beforeEach`에서 `mockClear`로 초기화한다. 현재 테스트 수에서는 문제없으나, `mockClear`는 호출 기록만 초기화하고 구현은 유지한다. `mockReset`이나 per-test 생성 패턴이 더 안전하다.
- 제안:
```tsx
// 각 테스트마다 fresh mock 생성
let baseProps: typeof _baseProps;
beforeEach(() => {
  baseProps = { ..._baseProps, onSendMessage: vi.fn(), onEndConversation: vi.fn() };
});
```

---

**[INFO] 순환 의존성 없음**
- `lucide-react` → `execution-store` → 내부 컴포넌트 방향의 단방향 의존성이 명확히 유지된다.

---

### 요약

이번 변경의 아키텍처 방향성은 올바르다. `summarizeToolResult`와 `ToolStatusIcon`의 분리는 좋은 판단이며, tool 응답을 별도 시각 계층으로 구분하는 설계 의도도 명확하다. 주요 위험은 `SummaryView`의 아이템 렌더링 루프에 two early-return + inline conditional이 혼재하는 불일치 패턴으로, 다음 메시지 타입이 추가될 때마다 복잡도가 누적된다. 파일 자체도 이번 변경으로 단일 파일 책임의 한계에 근접했다. 현재 기능 범위에서 동작 정합성은 충분하지만, dispatch 패턴을 통일하고 Summary/Detail 렌더 단위를 분리하는 리팩터링을 다음 Sprint에서 계획하는 것이 좋다.

### 위험도

**LOW**