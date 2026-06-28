### 발견사항

- **[INFO]** `addBtns[0]` — 인덱스 기반 접근으로 의도 명시 부족
  - 위치: `openAddDialog()` 함수, line 133
  - 상세: `addBtns[0]`은 "헤더 버튼"임을 주석으로만 설명하며 코드 자체에서는 의도가 드러나지 않는다. 주석이 삭제되거나 DOM 구조가 바뀌면 인덱스 의미가 불분명해진다.
  - 제안: 변수명을 `headerAddBtn`으로 구조 분해하거나 `within(header element)` 범위를 좁혀 접근하면 주석 없이도 의도가 명확해진다. 예: `const [headerAddBtn] = addBtns;` 또는 `const headerAddBtn = addBtns[0]; fireEvent.click(headerAddBtn);`

- **[INFO]** 중복된 `cleanup()` 호출
  - 위치: `afterEach` (line 89-91), 두 `describe` 블록의 `beforeEach` (line 161, 204)
  - 상세: 파일 수준의 `afterEach(() => { cleanup(); })`가 이미 존재하는데 각 `beforeEach`에도 `cleanup()`을 중복 호출한다. 주석으로 이유를 설명했지만("파일의 마지막 렌더 잔류 제거"), 두 군데에서 동일 목적으로 호출되면 의도가 혼란스럽다. 실질적으로 `beforeEach` 내 `cleanup()`은 잉여가 된다.
  - 제안: `afterEach` 한 곳에서만 정리하고 `beforeEach` 내 `cleanup()` 제거. 이미 `afterEach`가 각 테스트 후 정리하므로 다음 테스트 시작 시 DOM이 항상 깨끗하다.

- **[INFO]** `row()` 함수 내 하드코딩된 픽스처와 pagination 테스트의 인라인 픽스처 중복
  - 위치: `describe("SchedulesPage — RBAC")` 내 `row()` (line 209-226), `describe("SchedulesPage — pagination")` 내 `it("renders Pagination nav...")` (line 176-197)
  - 상세: 스케줄 행 오브젝트(`id: "s1"`, `cronExpression: "0 9 * * *"`, 등)가 `row()` 함수와 pagination 테스트 내 인라인에서 동일한 구조로 반복된다.
  - 제안: `SCHEDULE_ROW_FIXTURE`와 같은 파일 수준 상수로 추출하면 변경 시 한 곳만 수정하면 된다.

- **[INFO]** `openEdit` 테스트의 `apiGetMock.mockImplementation` 인라인 반복
  - 위치: line 389-411
  - 상세: `openEdit` 케이스는 `mockSchedulesResponse` 헬퍼를 사용하지 않고 직접 `apiGetMock.mockImplementation`을 재구현한다. `mockSchedulesResponse`가 `/workflows` 분기 처리도 지원하면 재사용 가능하다.
  - 제안: `mockSchedulesResponse`에 workflows 응답을 선택적으로 받도록 확장하거나, `mockApiResponse({ schedules, workflows })` 형태의 헬퍼로 통합한다.

- **[INFO]** viewer RBAC 테스트에서 `queryByTitle`과 `queryByRole` 혼용
  - 위치: line 442-443
  - 상세: editor RBAC 테스트는 `getByRole("button", { name: /^edit$/i })`를 사용하고, viewer RBAC 테스트는 동일 버튼을 `queryByTitle(/^edit$/i)`로 조회한다. 같은 요소를 다른 쿼리 전략으로 찾으면 일관성이 떨어지고 리팩터 시 한쪽만 업데이트되는 회귀 위험이 있다.
  - 제안: viewer 테스트도 `queryByRole("button", { name: /^edit$/i })`로 통일.

### 요약

이번 변경은 `findByRole` → `findAllByRole + [0]` 패턴으로 flaky 테스트를 수정한 것으로, 핵심 의도는 명확하고 주석 설명도 충분하다. 다만 인덱스 기반 접근의 의도 표현 부족, `cleanup()` 중복 호출, 픽스처 중복, `apiGetMock` 인라인 재구현, `queryByTitle/queryByRole` 혼용 등 테스트 코드의 일관성과 유지보수성에 영향을 주는 낮은 수준의 문제들이 존재한다. 모두 INFO 수준이며 기능 동작이나 테스트 신뢰성에는 즉각적인 영향이 없다.

### 위험도
LOW
