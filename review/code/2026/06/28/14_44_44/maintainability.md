### 발견사항

#### 파일 1: status-badge.test.tsx

- **[INFO]** `beforeEach`/`afterEach` 훅이 최상위 파일 레벨에 위치하며 범위가 암묵적
  - 위치: `status-badge.test.tsx` L47–53
  - 상세: `vi.useFakeTimers()` / `vi.useRealTimers()` 훅이 어떤 `describe` 블록에도 속하지 않고 파일 최상위에 정의되어 있다. 이 훅이 파일 내 모든 `describe`에 암묵적으로 적용된다는 사실이 코드 구조상 드러나지 않는다. 파일 상단 블록 주석이 의도를 설명하나, 후속 `describe("humanizeUntil")`의 `minutesFromNow`가 이 고정에 의존하고 있음은 해당 섹션에서 별도 언급이 없다.
  - 제안: 최상위 `describe("status-badge utils")` 블록으로 감싸 훅 적용 범위를 구조적으로 명시하거나, 파일 상단 주석에 "이 파일 전체의 모든 테스트에 적용"임을 명시한다.

- **[INFO]** `inMinutes` / `inDaysIso` 헬퍼 이름 불일치
  - 위치: `describe("computeStatus")` 내부 L189–192
  - 상세: `inMinutes(m)`는 분 단위, `inDaysIso(d)`는 일 단위인데 `Iso` 접미사가 `inDaysIso`에만 붙어 있다. 두 함수 모두 ISO 문자열을 반환하므로 명명이 비일관적이다. 또한 아래 `describe("humanizeUntil")`에서 동일 연산을 수행하는 `minutesFromNow`가 별도로 정의되어 있어 파일 내 같은 로직을 두 이름으로 중복 정의하는 결과가 된다.
  - 제안: 파일 수준 `minutesFromNow(m: number): string` / `daysFromNow(d: number): string` 두 헬퍼로 통일하고 `inMinutes` / `inDaysIso`를 제거. `describe("humanizeUntil")`의 지역 `minutesFromNow`도 파일 수준 헬퍼를 재사용하도록 통합.

- **[INFO]** `inDaysIso`(L192)와 `inDays`(L314) — 동일 계산 중복 정의
  - 위치: `describe("computeStatus")` L192, `describe("computeAttentionBreakdown")` L314
  - 상세: 두 헬퍼는 `Date.now() + days * 24 * 60 * 60 * 1000` 동일 연산을 수행하며 ISO 문자열을 반환한다. 이름만 달리한 채 반복된다.
  - 제안: 파일 수준 `daysFromNow(d: number): string` 하나로 추출해 세 `describe` 모두 재사용.

- **[INFO]** 고정 시각 하드코딩 — 날짜 선택 근거 미명시
  - 위치: `status-badge.test.tsx` L49 (`vi.setSystemTime(new Date("2026-06-28T00:00:00Z"))`)
  - 상세: 특정 날짜(`2026-06-28`)가 왜 선택됐는지 주석에 설명이 없다. "어떤 날짜든 고정만 하면 된다"는 의도가 코드 자체에서 드러나지 않아, 향후 유지보수 시 이 날짜를 업데이트해야 하는지 혼란이 생길 수 있다.
  - 제안: 주석에 "날짜 값 자체는 무관; 임의의 고정 기준점 역할" 한 줄 추가, 또는 `const FIXED_NOW = new Date("2026-06-28T00:00:00Z");` 상수로 추출해 의도를 이름으로 표현.

- **[INFO]** 경계값 밀리초 계산 인라인 하드코딩
  - 위치: 테스트 L409 부근 (`7 * 24 * 60 * 60 * 1000 - 60_000` 패턴)
  - 상세: `EXPIRING_SOON_DAYS = 7` 경계 직전을 표현하는 밀리초 계산이 인라인으로 반복된다. 주석으로 설명은 있지만, 경계값이 변경될 때 찾아 수정할 지점이 산재한다.
  - 제안: `const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;` 상수를 파일 수준으로 추출하고 `EXPIRING_SOON_MS - 60_000`으로 표현.

---

#### 파일 2: schedules-page.test.tsx

- **[INFO]** `addBtns[0]` 인덱스 기반 접근 — 의도 표현 부족
  - 위치: `openAddDialog()` 함수
  - 상세: `addBtns[0]`이 "헤더 버튼"임을 주석으로만 설명하며 코드 자체에서 드러나지 않는다. DOM 순서 가정이 암묵적으로만 존재해 헤더 레이아웃 변경 시 인덱스 의미가 조용히 틀려진다. 다만 두 버튼 모두 동일 다이얼로그를 열기 때문에 실질적 기능 리스크는 낮다.
  - 제안: `const [headerAddBtn] = addBtns; fireEvent.click(headerAddBtn);`으로 구조 분해하여 변수명으로 의도를 표현. 또는 `within(headerEl)` 스코프 한정으로 전환하면 주석 자체가 불필요해진다.

- **[INFO]** `cleanup()` 이중 호출 — cleanup 책임 위치 불명확
  - 위치: 파일 수준 `afterEach` (L520–522), `describe("pagination") beforeEach`, `describe("RBAC") beforeEach`
  - 상세: 파일 수준 `afterEach`가 각 테스트 후 항상 `cleanup()`을 실행하므로 각 `describe`의 `beforeEach` 내 `cleanup()`은 잉여다. 두 위치에서 동일 목적으로 호출하면 향후 유지보수자가 어느 쪽을 제거해야 할지 판단하기 어렵다.
  - 제안: `beforeEach` 내 `cleanup()` 호출을 제거하고 파일 수준 `afterEach`로 일원화.

- **[INFO]** 픽스처 중복 — `row()` 함수와 pagination 인라인 객체 구조 동일
  - 위치: `describe("RBAC")` 내 `row()`, `describe("pagination")` 내 `it("renders Pagination nav...")`
  - 상세: `id: "s1"`, `cronExpression: "0 9 * * *"`, `timezone: "UTC"` 등 동일 필드 구조의 스케줄 객체가 두 곳에서 반복 정의된다.
  - 제안: 파일 수준 `SCHEDULE_ROW_FIXTURE` 상수로 추출해 `...SCHEDULE_ROW_FIXTURE` 스프레드로 재사용. 필드 구조 변경 시 단일 지점만 수정 가능.

- **[INFO]** `openEdit` 케이스의 `apiGetMock.mockImplementation` 인라인 재구현
  - 위치: `it("openEdit: ...")` 케이스
  - 상세: 이 케이스만 `mockSchedulesResponse` 헬퍼를 사용하지 않고 `apiGetMock.mockImplementation`을 직접 구현한다. `/workflows` 응답 분기가 필요해서이지만, 다른 테스트와 목 전략이 달라 파일 내 일관성이 낮다.
  - 제안: `mockSchedulesResponse`에 선택적 `workflows` 인자를 추가하거나, `mockApiResponse({ schedules, workflows? })` 형태의 통합 헬퍼를 도입.

- **[INFO]** `queryByTitle` → `queryByRole` 교정 후 editor/viewer 쿼리 패턴 수렴 — 추가 리팩터 가능
  - 위치: 변경 후 viewer RBAC 테스트 (L873–881), editor RBAC 테스트
  - 상세: 이번 diff에서 `queryByTitle` → `queryByRole("button", { name: ... })` 로 수정되었다. 변경 자체는 올바르다. editor 테스트와 viewer 테스트가 이제 동일한 패턴을 사용하므로 `getByRole` / `queryByRole` 반복 구조를 `assertButtonVisibility(name, visible)` 형태 헬퍼로 추출하면 향후 버튼 목록 변경 시 단일 지점만 수정할 수 있다.
  - 제안: 즉시 필수 아님. 중기 리팩터 대상으로 기록.

### 요약

두 파일 모두 flaky 테스트 수정과 a11y 쿼리 교정이라는 명확한 의도를 가진 최소 침습 변경이다. 핵심 로직의 가독성과 주석 품질은 양호하다. 유지보수성 관점에서는 `status-badge.test.tsx` 의 헬퍼 함수 이름 불일치(`inMinutes`/`minutesFromNow`/`inDays`/`inDaysIso`)와 동일 계산의 중복 정의, 고정 시각 날짜의 선택 근거 미명시, `schedules-page.test.tsx`의 `cleanup()` 이중 호출로 인한 책임 위치 불명확, 픽스처 중복, `openEdit` 케이스 목 전략 이탈 등 INFO 수준 문제들이 복수 존재한다. 모두 즉각적인 기능 또는 테스트 신뢰성에 영향을 주지 않으나, 테스트 파일이 커질수록 유지보수 비용이 누적되므로 단기~중기 내 정리를 권장한다.

### 위험도
LOW
