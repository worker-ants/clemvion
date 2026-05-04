### 발견사항

---

**[WARNING] `durationMs` 렌더링 미검증**
- 위치: 테스트 1 (`tool 아이템은 '🤖 AI' 라벨로 표시되지 않는다`)
- 상세: `durationMs: 124` 를 fixture에 포함하지만 `"124ms"` 텍스트가 DOM에 노출되는지 단언이 없다. 구현 코드에서 `{item.durationMs}ms` 를 `ml-auto` span으로 렌더하므로 이 경로가 테스트되지 않는다.
- 제안: `expect(screen.getByText("124ms")).toBeInTheDocument()` 추가

---

**[WARNING] `ToolStatusIcon` 시각적 렌더링 미검증**
- 위치: 전체 테스트
- 상세: `pending` → Loader2, `success` → CheckCircle, `error` → XCircle 세 분기가 모두 미테스트. 에러 테스트에서 에러 *메시지 텍스트* 는 검증하지만 XCircle 아이콘이 실제로 렌더되는지는 확인하지 않는다.
- 제안: `screen.getByRole("img", { hidden: true })` 또는 `data-testid` 기반으로 아이콘 존재 확인, 또는 `aria-label` 추가 후 단언

---

**[WARNING] 키보드 인터랙션 미테스트**
- 위치: 테스트 7 (`tool 라인을 클릭하면 …`)
- 상세: `handleKeyDown`은 `Enter`/`Space` 키 시 `onSelectItem(i)` 를 호출하는 경로인데 `fireEvent.click` 만 검증하고 `fireEvent.keyDown(el, { key: "Enter" })` 검증이 없다.
- 제안: Enter 키 이벤트로 동일한 `onSelect` 호출 확인하는 케이스 추가

---

**[WARNING] `summarizeToolResult` 경계값 미커버**
- 위치: 테스트 3~5
- 상세: 아래 분기들이 누락됨:
  - **단수 배열**: `toolResult: ["x"]` → `"1 item"` (복수형 분기 반전 검증 없음)
  - **빈 객체**: `toolResult: {}` → `"{}"` 경로
  - **단일 키 객체**: `{ id: 1 }` → `"+N"` 없이 `{id: 1}` 출력 여부
  - **문자열 ≤80자**: truncate 안 됨을 확인하는 케이스 없음 (현재는 >80만 검증)
  - **비표준 타입**: `number`, `boolean` → `String(result).slice(0, 80)` 경로 미테스트
- 제안: 각 분기별 단위 테스트 케이스 추가

---

**[WARNING] 비-live 경로(역사 데이터) 미테스트**
- 위치: 모든 테스트, `baseProps.isLive: true` 고정
- 상세: `isLive: false` 일 때 `SummaryView`는 `resolveResultField(output, "messages")` 경로로 메시지를 재구성한다. 이 경로에서 `tool` 타입 메시지가 어떻게 처리되는지 전혀 검증되지 않는다.
- 제안: `isLive: false` + `result.outputData` 에 tool 메시지를 포함한 케이스 추가

---

**[WARNING] `onSelectItem` 미제공 시 클릭 불가 상태 미테스트**
- 위치: 테스트 7
- 상세: `onSelectItem` 이 없으면 tool 라인은 `role="button"` 없이 렌더되어야 한다. 이 경우 `tabIndex`, `cursor-pointer` CSS가 제거되는 경로를 검증하는 케이스가 없다.
- 제안: `onSelectMessage` 없이 렌더 후 `getByRole("button")` 이 없음을 확인

---

**[INFO] 모듈 스코프 `baseProps` mock 공유**
- 위치: 37~44행
- 상세: `vi.fn()` 이 모듈 초기화 시 한 번만 생성되고 `beforeEach`에서 `mockClear()`로 정리된다. 현재 테스트 수에서는 문제없으나, 테스트가 `baseProps` 객체를 직접 변이(mutate)하면 다른 테스트에 영향을 줄 수 있다.
- 제안: `beforeEach`에서 `baseProps` 를 `{ ...baseProps }` 로 복사하거나, 각 테스트에서 spread 후 사용하는 패턴 유지 (현재는 spread 사용 중이므로 안전)

---

**[INFO] `aria-hidden` 이모지 쿼리 방식**
- 위치: 테스트 1, `screen.getByText("🔧")`
- 상세: 구현에서 `<span aria-hidden>🔧</span>` 이지만, Testing Library의 `getByText`는 DOM 텍스트 컨텐츠를 쿼리하므로 현재 동작한다. 다만 `aria-hidden` 요소를 `getByText`로 쿼리하는 것은 접근성 시맨틱과 불일치한다.
- 제안: 아이콘을 `data-testid` 로 식별하거나, 현 방식을 유지하되 `{ hidden: true }` 옵션 명시적 사용 검토

---

### 요약

테스트 파일은 `SummaryView` 내 tool 메시지의 핵심 렌더링 로직(라벨 분리, 결과 요약, 클릭 이벤트)을 잘 구조화하여 검증한다. `makeItem` 헬퍼와 `beforeEach` mock 초기화 패턴도 적절하다. 그러나 `summarizeToolResult`의 경계값(단수 배열, 빈 객체, 단일 키 객체, ≤80자 문자열, 비표준 타입), `ToolStatusIcon` 시각 렌더링, 키보드 접근성, `durationMs` 표시, 그리고 `isLive: false` 경로가 전혀 테스트되지 않아 커버리지 갭이 존재한다. 특히 비-live 경로는 운영 데이터 조회 시 tool 메시지가 올바르게 표시되는지 보장할 방법이 없어 회귀 위험이 있다.

### 위험도

**MEDIUM**