### 발견사항

#### 파일 1: status-badge.test.tsx — `vi.useFakeTimers()` 도입

- **[INFO]** `vi.setSystemTime` 고정값이 현재 날짜(2026-06-28)와 일치하나 미래 변경 시 혼동 가능
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/frosty-hawking-b08718/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L80
  - 상세: `new Date("2026-06-28T00:00:00Z")`로 고정한 기준 시각이 테스트 파일 상단의 `row()` 픽스처 `createdAt: "2026-05-14T00:00:00Z"`와 충분히 멀어 현재 충돌 없음. 그러나 날짜를 특정 상수가 아닌 인라인 리터럴로 고정하면, 이 파일을 복사·재사용할 때 기준 시각의 의미를 파악하기 어렵다.
  - 제안: `const FROZEN_NOW = new Date("2026-06-28T00:00:00Z");` 상수로 명명하고 `vi.setSystemTime(FROZEN_NOW)` 으로 참조하면 의도 전달이 명확해진다.

- **[INFO]** `humanizeUntil` 경계값 테스트: 정확히 60s / 60m / 24h 경계 케이스 누락
  - 위치: `describe("humanizeUntil")` 블록 전체
  - 상세: 현재 테스트는 30s(<1m), 45m, 60m, 84m, 24h, 72h 등 대표값을 커버하고 있어 핵심 경로는 충분히 검증된다. 다만 정확히 60s(= 1분)나 정확히 24h(=1d) 경계에서 단위가 올바르게 올라가는지 검증하는 케이스가 없다. `Date.now()` 를 고정해 두었으므로 이런 경계 케이스를 추가해도 flaky 없이 결정론적으로 실행된다.
  - 제안: `minutesFromNow(1)` → `"1m"`, 정확히 `minutesFromNow(24 * 60)` = `"1d"` 는 이미 있으나 `+1m(1441m)` → `"1d"` 여부 추가 검토.

- **[INFO]** `computeStatus`의 `credentialsStatus === "needs_reauth"` + `status !== "connected"` 조합 미검증
  - 위치: `describe("computeStatus")` L150–156
  - 상세: 현재 `needs_reauth` 케이스는 `status: "connected"` 조합만 테스트한다. `status: "expired"` 또는 `status: "error"` 상태에서 `credentialsStatus: "needs_reauth"` 가 동시에 세팅될 때 어느 라벨이 우선하는지 검증되지 않는다.
  - 제안: `row({ status: "error", credentialsStatus: "needs_reauth" })` 케이스 1개 추가.

- **[INFO]** `beforeEach`/`afterEach` 훅이 `describe` 바깥 최상위에 위치하여 파일 전체 describe 블록에 적용됨 — 의도 명확하나 위치 규약 통일 필요
  - 위치: L78–84
  - 상세: `vi.useFakeTimers()` 설정이 `computeStatus`, `humanizeUntil`, `computeAttentionBreakdown` 세 describe 블록 모두에 영향을 준다. `computeStatus` 내부의 `inMinutes` / `inDaysIso` 헬퍼가 `describe` 안에 선언되어 있으나 fake timer 의존 계산이 `describe` 블록 정의 시점이 아닌 `it` 실행 시점에 수행되므로 동작상 문제없음. 단 코드를 읽는 입장에서 최상위 `beforeEach` 가 어디까지 적용되는지 명시되지 않는다.
  - 제안: 주석에 "이 훅은 이 파일의 모든 describe 블록에 적용된다" 를 간략히 추가하거나, `describe` 블록을 하나 더 wrapping 해서 범위를 명시적으로 한정.

#### 파일 2: schedules-page.test.tsx — flaky 수정 및 RBAC false-negative 교정

- **[WARNING]** `addBtns[0]` 인덱스 기반 접근 — DOM 순서 의존성으로 레이아웃 변경 시 silent breakage 위험
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/frosty-hawking-b08718/codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` L560–565 (`openAddDialog` 함수)
  - 상세: `findAllByRole("button", { name: /add schedule/i })` 의 첫 번째 결과가 "헤더 버튼"이라는 가정은 주석으로만 표현된다. 헤더 구조 또는 EmptyState 렌더 순서가 변경되면 `addBtns[0]` 이 의도한 버튼이 아닐 수 있으며, 테스트는 여전히 통과하지만 의도하지 않은 버튼을 클릭하게 된다. flaky 원인은 해결했지만 구조적 취약성이 남아 있다.
  - 제안: `within(screen.getByRole("banner"))` 또는 `within(document.querySelector("header"))` 로 스코프를 헤더로 한정한 뒤 `getByRole("button", { name: /add schedule/i })` 단수 쿼리를 사용하면 DOM 순서에 의존하지 않고 명확하게 헤더 버튼만 찾을 수 있다.

- **[INFO]** viewer RBAC 테스트의 false-negative 교정이 이번 변경에서 처리됨 — 교정 자체는 올바름
  - 위치: L876–881
  - 상세: `queryByTitle(/^edit$/i)` → `queryByRole("button", { name: /^edit$/i })`로 수정됨. `page.tsx`가 `title` attribute 없이 `aria-label` 만 사용한다는 사실을 이제 테스트가 정확히 검증한다. 수정 방향 정확.

- **[INFO]** `cleanup()` 이중 호출 잔존 — `afterEach` + `beforeEach` 양쪽에서 호출
  - 위치: L520–522 (`afterEach`), L587–592 / L633–638 (`beforeEach` 내)
  - 상세: 파일 수준 `afterEach(() => { cleanup(); })`가 각 테스트 후 DOM을 정리하므로 `beforeEach` 내의 `cleanup()` 은 잉여다. 현재는 동작 상 무해하지만 cleanup 책임 위치가 두 곳에 분산되어 있어 혼란을 줄 수 있다.
  - 제안: `beforeEach` 내 `cleanup()` 제거, 전역 `afterEach` 로 일원화.

- **[INFO]** `openEdit` 케이스의 `apiGetMock.mockImplementation` 인라인 재구현 — 헬퍼 미사용
  - 위치: L820–843
  - 상세: 다른 테스트는 `mockSchedulesResponse` 헬퍼를 사용하나, `openEdit` 케이스는 `/workflows`와 `/schedules` 분기를 직접 구현한다. `mockSchedulesResponse`가 `/workflows` 응답을 선택적으로 받도록 확장하면 코드 중복이 줄어든다.
  - 제안: `mockSchedulesResponse(body, { workflows?: WorkflowItem[] })` 시그니처로 헬퍼 확장.

- **[INFO]** EmptyState + Editor 역할 조합에서 버튼 2개 렌더 케이스 명시적 어서션 없음
  - 위치: RBAC describe 블록 전반
  - 상세: `openAddDialog`의 주석이 "빈 목록 응답 시 Add schedule 버튼이 2개가 된다"고 설명하지만, 이 상태 자체를 검증하는 명시적 테스트가 없다. flaky 수정의 근거가 되는 조건이 실제로 발생함을 테스트로 증명하는 것이 좋다.
  - 제안: `EMPTY_RESPONSE` + `editor` 역할 렌더 후 `findAllByRole("button", { name: /add schedule/i })` 결과 `.length >= 2` 어서션 케이스 추가.

- **[INFO]** Calendar 뷰 전환 경로 테스트 전혀 없음
  - 위치: `page.tsx` 전반 (기존 코드, 이번 변경 범위 밖)
  - 상세: `viewMode === "calendar"` 전환, `calendarSchedulesQuery` (limit=200 파라미터), 월 이동 버튼 렌더링 등의 경로가 테스트되지 않는다.
  - 제안: 캘린더 뷰 전환 시 `/schedules?limit=200` 요청 여부 확인 단위 테스트 추가.

- **[INFO]** `handleSubmit` 유효성 검사 분기 테스트 없음
  - 위치: `page.tsx` (기존 코드, 이번 변경 범위 밖)
  - 상세: 필수 필드 누락, 잘못된 JSON 입력, 배열/null 오류 등 submit 유효성 검사 경로가 테스트되지 않는다.
  - 제안: 필수 필드 누락 및 잘못된 JSON 입력 케이스 각 1개 이상 추가.

### 요약

이번 변경의 핵심은 두 가지다: (1) `status-badge.test.tsx`에 `vi.useFakeTimers()`를 도입해 `Date.now()` 경쟁 조건에 의한 flaky를 결정적으로 제거한 것, (2) `schedules-page.test.tsx`에서 `findByRole` 단수 쿼리를 `findAllByRole + [0]`으로 교체해 EmptyState 동시 렌더에 의한 다중 매칭 throw를 방지하고, viewer RBAC 테스트의 `queryByTitle` false-negative를 `queryByRole`로 교정한 것. flaky 수정 의도는 명확하고 방향도 올바르다. 다만 `addBtns[0]` 인덱스 접근은 DOM 순서 의존성을 그대로 남기고 있어 `within(header)` 스코프 한정 방식으로 개선하는 것이 권고 수준이다. 그 외 cleanup 중복, 픽스처 중복, 헬퍼 미통합, 커버리지 갭(Calendar 뷰, handleSubmit 유효성)은 모두 기존 코드 대상의 INFO 수준 이슈로 이번 flaky 수정과 직접적 관련은 없다.

### 위험도
LOW

STATUS: success
