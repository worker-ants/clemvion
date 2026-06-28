# Testing Review

## 발견사항

### **[INFO]** `status-badge.test.tsx` — `vi.useFakeTimers` 적용 범위: 파일 최상위 `beforeEach/afterEach` 만 있고 중첩 `describe` 내부 헬퍼(`inMinutes`, `inDaysIso`)가 `describe` 블록 본문(테스트 선언부)에서 `Date.now()` 를 즉시 평가하는지 여부
- 위치: `status-badge.test.tsx` L127–130 (`inMinutes`/`inDaysIso` 정의 위치)
- 상세: `inMinutes`/`inDaysIso` 는 `describe("computeStatus")` 본문에 정의된 화살표 함수이며, 함수 자체는 호출 시점에 `Date.now()` 를 평가한다. `vi.useFakeTimers` 가 각 테스트 `beforeEach` 에서 설정되므로 테스트 함수가 실행될 때(`it(...)`) 이미 fake timer 가 적용된 상태 — 정상 동작한다. 다만 이 사실이 코드만으로는 명확하지 않아 의도를 오해할 수 있다.
- 제안: 비고로 남길 수준(현재 동작 올바름). 명확성을 위해 헬퍼를 `describe("humanizeUntil")` 처럼 별도 `describe` 로 이동하거나 헬퍼 정의 바로 위에 짧은 주석 추가 권고.

### **[INFO]** `status-badge.test.tsx` — `computeAttentionBreakdown` 에서 `autoRefresh=true` 통합이 카운팅에서 제외되는지 미검증
- 위치: `status-badge.test.tsx` L254–274 (`counts expired/expiring/error...`)
- 상세: `computeAttentionBreakdown` 는 내부적으로 `needsAttention` 술어를 사용한다. `needsAttention` 에 `autoRefresh` 가드가 아직 미구현(`TODO` 상태)임이 이전 리뷰에서 확인됐다. 따라서 `autoRefresh=true` + `expiresSoon=true` 행이 `expiring` 카운트에 포함되는 현재 버그 경로가 `computeAttentionBreakdown` 테스트에서도 검증되지 않는다. 즉, 해당 버그가 수정되더라도 회귀를 잡는 테스트가 없는 상태다.
- 제안: `autoRefresh=true && tokenExpiresAt=inDays(2)` 행을 포함한 목록을 `computeAttentionBreakdown` 에 넘겼을 때 `expiring` 이 0 이어야 한다는 assertion 을 추가한다(`needsAttention` 가드가 구현된 후 통과하는 테스트로 선제 작성 가능).

### **[INFO]** `status-badge.test.tsx` — `needsAttention` 직접 단위 테스트 부재
- 위치: `status-badge.test.tsx` 전체
- 상세: `needsAttention` 은 export 된 공개 함수이고 `computeAttentionBreakdown` 의 핵심 술어이지만, 직접 단위 테스트가 없다. `computeAttentionBreakdown` 에 위임 테스트(`agrees with needsAttention's...`, L299–307)가 하나 있지만 모든 입력 조합을 커버하지 않는다.
- 제안: `needsAttention` describe 블록을 추가하고 `status: "connected"` + `tokenExpiresAt: null`, `status: "pending_install"`, `credentialsStatus: "needs_reauth"` + `autoRefresh=true` 각각에 대한 케이스 추가.

### **[WARNING]** `schedules-page.test.tsx` — `viewer` 역할 RBAC 테스트의 `queryByTitle` false-negative (기존 코드, 이번 diff 포함)
- 위치: `schedules-page.test.tsx` RBAC viewer describe 내, 이번 diff 변경 후 L371–378 (`queryByRole` 로 교정된 코드)
- 상세: 이번 diff 에서 `queryByTitle(/^edit$/i)` → `queryByRole("button", { name: /^edit$/i })` 로 교정이 이루어졌다. 이 교정은 `page.tsx` 가 `aria-label` 만 사용하고 `title` attribute 를 사용하지 않는 현실과 일치하므로 올바른 수정이다. 수정된 코드는 실제 버튼이 DOM 에 렌더될 경우 테스트를 실패시킬 수 있어 false-negative 구멍이 닫혔다.
- 제안: 수정 방향이 정확함. 이 항목은 이번 diff 가 올바르게 처리했음을 확인하는 것으로 추가 조치 불필요.

### **[INFO]** `schedules-page.test.tsx` — `findAllByRole[0]` 인덱스 기반 접근의 묵시적 DOM 순서 의존
- 위치: `openAddDialog()` 함수, 이번 diff 기준 L355–361
- 상세: `findAllByRole("button", { name: /add schedule/i })[0]` 은 "헤더 버튼이 항상 DOM 에서 먼저 나온다"는 가정에 의존한다. 주석에 이 가정이 명시되어 있고, 두 버튼이 동일한 `setShowDialog(true)` 를 실행하므로 어느 쪽을 클릭해도 테스트 의도가 충족된다. 따라서 기능 리스크는 없다. 그러나 격리 렌더에서 `getByRole("banner")` 가 적용 불가한 이유를 주석에 추가 명시하면 향후 리팩터 시 혼란을 방지할 수 있다.
- 제안: 주석에 "격리 렌더 환경에는 app-shell header(banner role)가 없으므로 `within(banner)` 패턴 적용 불가" 한 줄 추가 권고 (비차단).

### **[INFO]** `schedules-page.test.tsx` — `afterEach(cleanup)` 와 `beforeEach(cleanup)` 중복
- 위치: 전역 `afterEach` 와 두 `describe` 블록 내 `beforeEach`
- 상세: 전역 `afterEach(() => cleanup())` 가 이미 각 테스트 후 DOM 을 정리하므로 `beforeEach` 내 `cleanup()` 호출은 잉여다. 동작은 무해하지만 cleanup 책임 위치가 불명확해진다.
- 제안: `beforeEach` 내 `cleanup()` 제거 후 전역 `afterEach` 로 일원화.

### **[INFO]** `schedules-page.test.tsx` — EmptyState + Editor 역할 조합 명시 어서션 부재
- 위치: RBAC describe 블록
- 상세: flaky 의 원인이 된 "빈 목록(EMPTY_RESPONSE) + Editor 역할 → 버튼 2개 동시 렌더" 시나리오를 이번 수정이 `findAllByRole` 로 대응했지만, 그 전제 조건(버튼 2개가 존재해야 한다는 사실)을 검증하는 테스트가 없다. 향후 EmptyState 또는 RoleGate 리팩터 시 이 전제가 무너져도 알아채기 어렵다.
- 제안: `EMPTY_RESPONSE` + `editor` 역할 조합에서 `findAllByRole("button", { name: /add schedule/i })` 의 `length === 2` 를 assert 하는 테스트 추가.

### **[INFO]** `schedules-page.test.tsx` — Calendar 뷰 전환 경로 커버리지 갭 (기존 코드)
- 위치: `schedules/page.tsx` `viewMode === "calendar"` 분기 전반
- 상세: `CalendarView`, `calendarSchedulesQuery`, 월 이동(`prevMonth`/`nextMonth`), `limit=200` 대형 fetch 경로가 테스트에 전혀 없다. 이번 diff 범위 밖이나 회귀 위험으로 기록.
- 제안: 뷰 전환 버튼 클릭 → 캘린더 렌더 확인, `/schedules?limit=200` 호출 여부를 단위 테스트로 추가 (중기 과제).

### **[INFO]** `schedules-page.test.tsx` — `handleSubmit` 유효성 검사 분기 커버리지 갭 (기존 코드)
- 위치: `schedules/page.tsx` L685–718
- 상세: 필수 필드 누락 toast, JSON 파싱 실패(`parameterValuesError`), 배열/null 오류 분기가 테스트에 없다. 이번 diff 범위 밖이나 향후 회귀 위험.
- 제안: submit 후 필수 필드 누락 케이스·잘못된 JSON 입력 케이스 각 1개 이상 추가 (중기 과제).

---

## 요약

이번 변경은 두 테스트 파일의 flaky 원인을 각각 정확하게 수정했다. `status-badge.test.tsx` 는 `vi.useFakeTimers` + `vi.setSystemTime` 도입으로 `Date.now()` 경계 단언의 비결정성을 제거했으며, `schedules-page.test.tsx` 는 `findByRole` → `findAllByRole[0]` 전환으로 EmptyState 타이밍 레이스를 해소했다. viewer RBAC 의 `queryByTitle` → `queryByRole` 교정은 기존 false-negative 구멍을 직접 닫는 올바른 수정이다. 발견된 나머지 항목은 대부분 기존 코드의 커버리지 갭과 cleanup 중복 등 INFO 수준이며, `autoRefresh` 가드 미구현 시 `computeAttentionBreakdown` 회귀 테스트 부재가 중기 보강 대상으로 남는다.

---

## 위험도

LOW
