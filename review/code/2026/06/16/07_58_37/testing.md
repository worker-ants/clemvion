# Testing Review — Auth Config RBAC UI Guard

## 발견사항

### [WARNING] `useHasRole` mock 이 역할 계층(ROLE_LEVEL)을 무시하는 boolean 플래그로 단순화됨
- 위치: `/codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` L105–108
- 상세: 실제 `useHasRole`은 `ROLE_LEVEL` 계층 비교(`viewer=1 < editor=2 < admin=3 < owner=4`)를 수행하지만, 테스트 mock은 `roleState.isAdmin` boolean을 직접 반환한다. 이로 인해 `owner` 역할이 `admin` 이상이라 버튼을 보여야 하는 시나리오, `editor`/`viewer` 가 명시적으로 숨겨져야 하는 시나리오 모두 테스트되지 않는다. mock이 실제 역할 계층 동작 대신 "admin인가 아닌가"의 이진 분기만 검증한다.
- 제안: `roleState`에 `role: WorkspaceRole` 을 두고 mock이 `ROLE_LEVEL[role] >= ROLE_LEVEL['admin']` 를 계산하도록 하거나, `editor`/`owner` 케이스를 별도 파라미터화 테스트로 추가. 최소한 `owner` 역할도 admin+ 로 버튼을 보여야 함을 커버해야 한다.

### [WARNING] `isActive=false` 행에 대한 Activate 버튼 가드 미검증
- 위치: `authentication-form.test.tsx` L263, `page.tsx` L1009–1011
- 상세: `MUTATION_BUTTON_NAMES`에 `/^Deactivate$/`만 있고 `/^Activate$/`는 없다. `existing.isActive = true`이기 때문에 `Deactivate` 라벨이 렌더되어 현재 테스트는 통과하지만, `isActive=false` 인 config 행의 경우 `Activate` 버튼이 admin 에게 표시되고 비-admin 에게 숨겨져야 함을 검증하는 테스트가 없다. page.tsx 에는 두 가지 라벨 분기(`t("workflows.actions.deactivate")` / `t("workflows.actions.activate")`)가 모두 존재하므로 한쪽 분기만 커버된 상태다.
- 제안: `existing.isActive = false`를 사용하는 fixture로 `Activate` 라벨 시나리오를 추가하거나, `MUTATION_BUTTON_NAMES`에 `/^Activate$/`도 포함하고 비-admin fixture를 두 개(isActive=true/false)로 커버.

### [INFO] `MUTATION_BUTTON_NAMES` 배열의 배치 — "Add Config" 가드를 edit form describe 블록에서 검증
- 위치: `authentication-form.test.tsx` L261–268 (전체 파일)
- 상세: `MUTATION_BUTTON_NAMES`는 `describe("AuthenticationPage — edit form §A.2")` 내부에 선언되어 있고 `/^Add Config$/`도 포함한다. "Add Config" 버튼은 헤더 영역에 있고 목록 유무와 무관하게 렌더되므로 동작 상 문제는 없지만, 의미적으로 헤더 버튼 가드 테스트가 "edit form" 블록에 묶여 있어 가독성이 저하된다.
- 제안: 두 admin/non-admin 가드 테스트를 별도 `describe("RBAC visibility guard")` 블록으로 분리.

### [INFO] `roleState.isAdmin = true` 초기화가 `afterEach`에만 있고 `beforeEach`에 없음
- 위치: `authentication-form.test.tsx` L245–257
- 상세: `afterEach`에서 `roleState.isAdmin = true`로 초기화한다. `afterEach` 실패 시 다음 테스트에 stale 상태가 흘러들 수 있다. `beforeEach`에서 명시적으로 초기화하면 사전조건이 명확해진다.
- 제안: `beforeEach` 블록에 `roleState.isAdmin = true` 추가(방어적 중복).

### [INFO] 비-admin 사용자의 row click(usage 드로어 = 읽기) 허용 동작에 대한 테스트 없음
- 위치: `page.tsx` L993 주석 + `authentication-form.test.tsx` 전체
- 상세: 변경 코드는 "행 클릭(usage 드로어 = 읽기)은 모든 역할 허용"을 주석으로 명시하지만, 비-admin 상태에서 행 클릭 → usage 드로어 오픈을 검증하는 테스트가 없다. RBAC 변경 시 이 경로가 의도치 않게 막혔는지 회귀 감지 수단이 없다.
- 제안: `it("non-admin can still click a row to open the usage drawer", ...)` 테스트 추가.

### [INFO] Reveal/Regenerate/Delete 버튼 aria-label이 i18n 번역 런타임 값에 의존
- 위치: `authentication-form.test.tsx` L43–44, `page.tsx` L1017·L1035·L1044
- 상세: 테스트가 `useLocaleStore.setState({ locale: "en" })`로 로케일을 고정하므로 현재는 정규식(`/^Reveal$/`, `/^Regenerate$/`, `/^Delete$/`)이 매칭된다. i18n 번역 값이 바뀌면 조용히 false-negative가 발생할 수 있다. 우선순위는 낮으나, 현재 구조는 번역 변경을 감지하지 못한다.
- 제안: 우선순위 낮음. 허용 가능한 수준이나, 번역 키 값을 import해서 단언하면 regression 감지 향상.

---

## 요약

이번 변경의 핵심인 "비-admin 에게 모든 mutation 버튼 숨김·admin 에게 전부 노출" 방향의 테스트가 두 방향으로 잘 추가되었고, `MUTATION_BUTTON_NAMES` 배열로 일괄 검증하는 구조는 누락 방지 측면에서 긍정적이다. 다만 실제 `useHasRole`의 역할 계층(`owner` 포함)을 무시한 이진 boolean mock으로 인해 역할 계층 경계 시나리오가 커버되지 않으며, `isActive=false` 행의 `Activate` 버튼 가드도 검증되지 않은 상태다. 비-admin의 row click(읽기) 허용 경로에 대한 회귀 가드도 없다. 보안 RBAC 관련 변경임을 고려하면 mock 충실도 개선(`owner` 역할 시나리오)과 `Activate` 라벨 커버가 우선 권장된다.

---

## 위험도

LOW
