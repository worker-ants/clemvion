## 발견사항

### File 1: `[executionId]/page.tsx`

- **[INFO]** `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`, `formatDuration` 상수 및 함수가 `page.tsx`(목록)와 중복 정의됨
  - 위치: 라인 22~65
  - 상세: 동일한 상수/유틸이 두 파일에 각각 복사되어 있음. 신규 파일 구현이므로 즉각적인 문제는 아니나 유지보수 부채 발생
  - 제안: 향후 `lib/utils/execution.ts` 등으로 공통 추출 고려

- **[WARNING]** adjacent 실행 조회가 `limit: 100`으로 고정
  - 위치: 라인 117~134
  - 상세: prev/next 네비게이션을 위해 최대 100건을 전부 불러옴. 100건 초과 시 범위 밖 실행에 대한 네비게이션 불가능하며, 페이로드 낭비 발생
  - 제안: API가 지원한다면 `cursor` 기반 prev/next 전용 엔드포인트 사용, 혹은 해당 한계를 명시적으로 주석 처리

- **[INFO]** `eslint-disable-next-line @typescript-eslint/no-explicit-any` 사용
  - 위치: 라인 122
  - 상세: API 응답 타입이 불명확해 `any` 캐스팅 필요. 타입 정의 개선 여지 있음

---

### File 2: `execution-detail-page.test.tsx`

- **[INFO]** `shows node detail when clicking a node in Node Results` 테스트가 fragile함
  - 위치: 라인 130~143
  - 상세: `getAllByRole("button")`로 버튼 배열을 가져와 `textContent?.includes`로 찾는 방식은 DOM 구조 변경에 취약. `aria-label` 또는 `data-testid` 기반 쿼리가 더 안정적
  - 제안: `getByRole("button", { name: /Data Transform/ })` 또는 `data-testid` 활용

- **[INFO]** `navigates to execution list on back button click`에서 `buttons[0]` 인덱스 의존
  - 위치: 라인 145~153
  - 상세: 버튼 순서가 바뀌면 테스트 실패. 인덱스보다 역할/레이블 기반 접근 권장

---

### File 3: `execution-list-page.test.tsx`

- **[WARNING]** `mockBack`이 선언되었으나 어떤 테스트에서도 검증되지 않음
  - 위치: 라인 8
  - 상세: 목록 페이지의 뒤로가기 버튼은 `router.back()`을 호출하지만 해당 동작에 대한 테스트가 없음
  - 제안: `it("navigates back on back button click", ...)` 테스트 추가

- **[INFO]** `vi.clearAllMocks()`가 `beforeEach`에만 있고 mock이 `vi.mock()`으로 모듈 수준에서 고정되어 있어 다른 describe 블록과의 격리가 불완전할 수 있음
  - 위치: 라인 51~90
  - 상세: 단일 describe 블록이라 현재는 문제없으나, 테스트 추가 시 주의 필요

---

### File 4: `page.tsx` (ExecutionListPage)

- **[INFO]** `FILTER_BUTTONS`에 `pending`, `waiting_for_input` 상태가 누락
  - 위치: 라인 101~107
  - 상세: `STATUS_LABEL` 맵에는 해당 상태가 정의되어 있으나 필터 버튼에는 없음. 의도적 UX 결정인지 누락인지 불명확
  - 제안: 스펙 확인 후 의도적이라면 주석으로 명시

- **[INFO]** `eslint-disable-next-line @typescript-eslint/no-explicit-any` 사용
  - 위치: 라인 156
  - 상세: 동일하게 API 응답 타입 불명확으로 인한 임시 처리

---

## 요약

4개 파일 모두 `workflows/[id]/executions/` 경로 하위에 새로 추가된 파일로, 기존 코드를 의도치 않게 변경하거나 범위 외 리팩토링을 수행하는 사례는 없음. 전반적으로 변경 범위가 적절히 통제되어 있으나, `STATUS_*` 상수 및 `formatDuration` 유틸의 목록/상세 페이지 간 중복, adjacent 조회의 `limit: 100` 하드코딩, 그리고 `router.back()` 호출에 대한 테스트 누락이 주요 개선 포인트임.

## 위험도

**LOW**