### 발견사항

#### 파일 1: status-badge.test.tsx

- **[INFO]** `beforeEach`/`afterEach` 훅 배치가 `describe` 블록 외부에 위치
  - 위치: `status-badge.test.tsx` L47–53
  - 상세: `vi.useFakeTimers()` / `vi.useRealTimers()` 훅이 파일 최상위에 정의되어 있고, `inMinutes`/`inDaysIso` 헬퍼 함수는 `describe("computeStatus")` 내부에 중첩되어 있다. 파일 수준 시간 고정은 모든 `describe`에 암묵적으로 적용되는데, 이 범위가 코드에서 명시적으로 드러나지 않는다. 후속 `describe("humanizeUntil")`의 `minutesFromNow`도 이 고정에 의존하지만 같은 섹션에 설명이 없다.
  - 제안: 훅과 헬퍼를 묶는 최상위 `describe` 블록 하나로 감싸거나, 파일 상단의 주석을 "이 파일 전체에 적용"임을 명시하는 방향 중 하나를 선택해 일관성을 유지한다.

- **[INFO]** `inMinutes`/`inDaysIso` 헬퍼 이름 불일치
  - 위치: `describe("computeStatus")` 내부 L189–192
  - 상세: `inMinutes(m)` 는 분 단위, `inDaysIso(d)` 는 일 단위인데 접미사 `Iso`가 `inMinutes`에는 없고 `inDaysIso`에만 붙어 있다. 둘 다 ISO 문자열을 반환하므로 명명이 비일관적이다.
  - 제안: `minutesFromNow`/`daysFromNow`(아래 `describe("humanizeUntil")`의 패턴과 일치) 로 통일하거나, 두 헬퍼 모두 `Iso` 접미사를 붙이거나 빼는 방향으로 통일한다.

- **[INFO]** `describe("computeAttentionBreakdown")` 내 `inDays` 와 상위 `describe("computeStatus")` 내 `inDaysIso` 중복
  - 위치: L192 (`inDaysIso`), L314 (`inDays`)
  - 상세: 두 헬퍼는 동일한 `Date.now() + days * 24 * 60 * 60 * 1000` 연산을 수행하며 ISO 문자열을 반환한다. 네이밍만 달리한 채 동일 로직이 반복된다.
  - 제안: 파일 수준 `daysFromNow(d: number): string` 헬퍼 하나로 추출해 세 `describe` 모두 재사용.

- **[INFO]** `minutesFromNow` 가 `describe("humanizeUntil")` 내에 지역 정의되어 상위 `inMinutes`와 중복
  - 위치: L269 (`minutesFromNow`), L189 (`inMinutes`)
  - 상세: `inMinutes(m) = new Date(Date.now() + m * 60 * 1000)` 와 `minutesFromNow(m) = new Date(Date.now() + m * 60_000)` 은 수학적으로 동일하다. 같은 파일에서 두 이름으로 중복 정의되어 있다.
  - 제안: 파일 수준 `minutesFromNow` 하나로 통일하고 `inMinutes`를 제거.

- **[INFO]** 경계값 상수 `7 * 24 * 60 * 60 * 1000 - 60_000` 하드코딩
  - 위치: L409–411
  - 상세: `EXPIRING_SOON_DAYS = 7` 경계 직전을 표현하기 위해 밀리초 계산을 인라인으로 사용한다. 주석(`EXPIRING_SOON_DAYS = 7 — locked-in boundary`)으로 설명은 있지만, 상수로 분리하면 경계값 변경 시 단일 지점만 수정하면 된다.
  - 제안: `const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;` 상수 추출 후 `EXPIRING_SOON_MS - 60_000`으로 표현.

---

#### 파일 2: schedules-page.test.tsx

- **[INFO]** `addBtns[0]` 인덱스 기반 접근 — 의도 표현 부족
  - 위치: `openAddDialog()` 함수, L560–564
  - 상세: `addBtns[0]`이 "헤더 버튼"임은 주석으로만 설명되며 코드 자체에서는 드러나지 않는다. DOM 순서 가정이 암묵적이어서 헤더 레이아웃 변경 시 인덱스가 조용히 잘못된 버튼을 가리키게 된다.
  - 제안: `const [headerAddBtn] = addBtns; fireEvent.click(headerAddBtn);`으로 구조 분해하여 의미를 이름에 담거나, `within(screen.getByRole("banner")).getByRole("button", ...)` 방식으로 스코프를 한정한다.

- **[INFO]** `cleanup()` 이중 호출 — 책임 위치 불명확
  - 위치: 파일 수준 `afterEach` L520–522, `describe("pagination") beforeEach` L587–590, `describe("RBAC") beforeEach` L633–636
  - 상세: 파일 수준 `afterEach`가 각 테스트 후 항상 `cleanup()`을 실행하므로 각 `describe`의 `beforeEach` 내 `cleanup()`은 잉여다. 의도 차이를 주석으로 설명했지만, 두 위치에서 동일 목적으로 호출되면 향후 유지보수자가 어느 쪽을 제거해야 할지 판단하기 어렵다.
  - 제안: `beforeEach` 내 `cleanup()` 호출을 제거하고 파일 수준 `afterEach`로 일원화.

- **[INFO]** `row()` 픽스처 함수 중복 — pagination 인라인 객체와 구조 동일
  - 위치: `describe("RBAC")` 내 `row()` L640–657, `describe("pagination")` 내 `it("renders Pagination nav...")` L607–628
  - 상세: 두 곳 모두 `id: "s1"`, `cronExpression: "0 9 * * *"`, `timezone: "UTC"` 등 동일 필드 구조를 가진 스케줄 객체를 반복 정의한다.
  - 제안: 파일 수준 `SCHEDULE_ROW_FIXTURE` 상수로 추출해 `...SCHEDULE_ROW_FIXTURE`로 스프레드 사용.

- **[INFO]** `openEdit` 케이스의 `apiGetMock.mockImplementation` 인라인 재구현
  - 위치: `it("openEdit: ...")` L818–860
  - 상세: 이 케이스만 `mockSchedulesResponse` 헬퍼를 사용하지 않고 `apiGetMock.mockImplementation`을 직접 구현한다. `/workflows` 응답 분기가 필요해서이지만, 다른 테스트와 목 전략이 달라 일관성이 낮다.
  - 제안: `mockSchedulesResponse`에 선택적 `workflows` 인자를 추가하거나, `mockApiResponse({ schedules, workflows? })` 형태의 통합 헬퍼를 도입한다.

- **[INFO]** `queryByRole` / `queryByTitle` 쿼리 전략 혼용 (이번 변경에서 수정됨)
  - 위치: 변경 전 L441–442 → 변경 후 L873–881
  - 상세: 이번 diff에서 `queryByTitle` → `queryByRole("button", { name: ... })`로 수정되었다. 변경 자체는 올바르다. 그러나 editor 테스트(L674–679)와 viewer 테스트(L873–881)가 이제 동일 패턴을 사용하므로 중복된 `getByRole`/`queryByRole` 문 구조를 공통 헬퍼 `assertButtonVisibility(name, visible)` 형태로 추출하면 향후 버튼 목록 변경 시 단일 지점만 수정하면 된다.
  - 제안: 즉시 필수 아님. 중기 리팩터 대상으로 기록.

---

### 요약

두 파일 모두 flaky 테스트 수정 또는 a11y 쿼리 교정이라는 명확한 의도를 가진 최소 침습 변경이다. 핵심 로직 가독성과 주석 품질은 양호하다. 유지보수성 관점에서는 헬퍼 함수 이름 불일치 및 동일 계산의 중복 정의(`inMinutes`/`minutesFromNow`/`inDays`/`inDaysIso`), 파일 수준 `afterEach`와 `beforeEach` 내 `cleanup()` 이중 호출로 인한 책임 위치 불명확, 픽스처 중복, `openEdit` 케이스의 목 전략 이탈 등 INFO 수준 문제들이 복수 존재한다. 모두 즉각적 기능 또는 테스트 신뢰성 영향은 없으나, 테스트 파일이 커질수록 유지보수 비용이 누적되므로 단기~중기 내 정리를 권장한다.

### 위험도
LOW
