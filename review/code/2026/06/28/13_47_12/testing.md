# Testing Review — schedules-page.test.tsx

## 발견사항

### **[INFO]** findAllByRole[0] 인덱스 접근의 암묵적 가정
- 위치: `openAddDialog()` 함수, 변경된 라인 42–47
- 상세: `findAllByRole("button", { name: /add schedule/i })` 후 `[0]`을 클릭하는 방식은 "첫 번째 = 헤더 버튼"이라는 DOM 순서 가정에 의존한다. 현재 `page.tsx` 구조(헤더 버튼 → EmptyState 버튼 순)로는 올바르지만, 헤더 레이아웃 변경 시 인덱스가 깨진다. 변경 코멘트에 이 가정이 명시되어 있어 의도는 명확하지만, 더 견고한 방법은 헤더 컨테이너를 `within()`으로 스코프 지정하는 것이다.
- 제안:
  ```tsx
  // 헤더 영역 내 버튼만 타겟
  const header = await screen.findByRole("banner"); // 또는 findByTestId("page-header")
  const addBtn = within(header).getByRole("button", { name: /add schedule/i });
  fireEvent.click(addBtn);
  ```
  현재 구현도 flaky 문제를 해소하므로 즉시 변경 필수는 아니나, 장기 유지보수를 위해 권고한다.

### **[INFO]** `afterEach(cleanup)` 와 `beforeEach(cleanup)` 중복
- 위치: 파일 전체 (`afterEach` at L89–91, `beforeEach` 내 `cleanup()` at L105, L149)
- 상세: 전역 `afterEach(cleanup)`가 추가되었으나 두 describe 블록의 `beforeEach`에도 `cleanup()`이 남아 있다. 중복 호출은 동작 상 무해하지만 코드 명확성을 떨어뜨리며 의도(cleanup 책임 위치)를 모호하게 한다.
- 제안: `beforeEach`의 `cleanup()` 호출을 제거하고 전역 `afterEach`로 일원화한다.

### **[INFO]** EmptyState 조건 하의 버튼 개수 검증 부재
- 위치: RBAC describe 내 "Editor: Add schedule·toggle·edit·delete 모두 노출" 테스트 (L228–248)
- 상세: 이 테스트는 목록 데이터가 있는 `row()`를 사용하므로 EmptyState가 렌더되지 않아 "Add schedule" 버튼은 헤더에 1개만 존재한다. `getByRole` (단수)를 사용해도 안전하며 현재 구현이 맞다. 그러나 flaky 문제가 발생한 EmptyState 케이스 — 빈 목록(EMPTY_RESPONSE)에서 Editor 역할로 header + EmptyState 모두 렌더될 때 버튼 2개가 나타나는 상황 — 에 대한 명시적 테스트가 없다.
- 제안: `EMPTY_RESPONSE`와 `editor` 역할 조합에서 `findAllByRole("button", { name: /add schedule/i })`의 length가 2임을 assert하는 테스트를 추가하면 RoleGate·EmptyState 연동 회귀를 조기에 잡을 수 있다.

### **[INFO]** Calendar 뷰 모드 미테스트
- 위치: 테스트 파일 전반
- 상세: `page.tsx`에는 `viewMode === "calendar"` 분기, `CalendarView` 컴포넌트, `calendarSchedulesQuery` 가 존재하지만 테스트에는 캘린더 뷰 전환 및 렌더링 케이스가 없다. 특히 `limit=200` 대형 fetch, 월 이동(prevMonth/nextMonth), 스케줄 도트 표시 등의 경로가 전혀 커버되지 않는다.
- 제안: 캘린더 뷰 전환 시 `/schedules?limit=200` 호출 여부, 뷰 전환 버튼 렌더링 정도는 단위 테스트로 추가할 것을 권고한다.

### **[INFO]** `handleSubmit` 검증 로직 미테스트
- 위치: `page.tsx` L685–718 (handleSubmit), 테스트 파일 전반
- 상세: 필수 필드 미입력 시 toast 에러, JSON 파싱 실패 시 `parameterValuesError` 표시, 배열/null 파싱 시 오류 등 `handleSubmit` 내 유효성 검사 분기가 테스트에서 전혀 다루어지지 않는다.
- 제안: submit 버튼 클릭 후 필수 필드 누락 케이스, 잘못된 JSON 입력 케이스를 각각 1개 이상 추가한다.

### **[INFO]** `viewer` 역할 + icon-only 버튼 assertion 방식 불일치
- 위치: "Viewer: Add schedule·toggle·edit·delete 모두 비표시" 테스트 (L431–448)
- 상세: `editor` 역할 테스트(L243–248)는 `getByRole("button", { name: /^edit$/i })`로 `aria-label` 기반 assertion을 사용하지만, `viewer` 역할 테스트(L441–442)는 `queryByTitle(/^edit$/i)`로 `title` 속성 기반을 사용한다. `page.tsx`에서 편집·삭제 버튼은 `aria-label`만 지정되어 있고 `title` 속성이 없으므로, viewer 테스트의 `queryByTitle` assertion은 항상 `null`을 반환해 의도와 무관하게 통과한다 — 즉 실제 버튼이 렌더되어도 테스트가 통과하는 false-negative 위험이 있다.
- 제안: `queryByTitle` 대신 `queryByRole("button", { name: /^edit$/i })`를 사용해 editor 테스트와 일관된 방식으로 검증한다.

## 요약

이번 변경의 핵심인 `findByRole` → `findAllByRole[0]` 전환은 EmptyState와 헤더 버튼이 동시에 렌더될 때 발생하는 flaky 다중 매칭 문제를 올바르게 해소하며, 코멘트도 충분히 상세하다. 전역 `afterEach(cleanup)` 추가 역시 DOM 누수를 막는 정당한 조치다. 다만 viewer 역할 테스트의 `queryByTitle` 사용은 `aria-label`만 있는 버튼을 감지하지 못하는 구조적 오탐 가능성이 있어 수정이 필요하다(false-negative). 캘린더 뷰·handleSubmit 유효성 검사 등의 커버리지 갭은 현재 diff 범위 밖이나 향후 회귀 위험으로 기록한다.

## 위험도

LOW
