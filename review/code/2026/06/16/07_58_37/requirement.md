# 요구사항(Requirement) Review

## 발견사항

### [INFO] 테스트 mock 에서 `useHasRole` 반환 타입이 boolean 이나 실제 구현도 boolean — 일치
- 위치: `authentication-form.test.tsx` line 108 — `useHasRole: () => roleState.isAdmin`
- 상세: 실제 `role-gate.tsx` 의 `useHasRole` 는 `boolean` 을 반환하고, mock 도 `isAdmin: true/false` boolean 을 반환한다. 타입 일치 확인.
- 제안: 이슈 없음.

### [INFO] `MUTATION_BUTTON_NAMES` 상수 scope — `describe` 블록 내 선언으로 정상
- 위치: `authentication-form.test.tsx` lines 262–269 (전체 파일 컨텍스트 기준)
- 상세: `describe("AuthenticationPage — edit form §A.2", ...)` 블록 내부에 `MUTATION_BUTTON_NAMES` 가 선언돼 있으며, `it` 두 개가 이를 공유한다. describe 블록 내 top-level 선언이라 각 `it` 가 동일 배열을 읽는다. 불변 상수이므로 상태 오염 없음.
- 제안: 이슈 없음.

### [INFO] `MUTATION_BUTTON_NAMES` 에 `/^Activate$/` 미포함 — 의도된 설계
- 위치: `authentication-form.test.tsx` lines 262–268
- 상세: 테스트 픽스처 `existing.isActive = true` 이므로 토글 버튼 라벨이 `"Deactivate"` 이다. `"Activate"` 라벨은 `isActive=false` 행에서만 나타나므로, 현재 픽스처로는 `/^Activate$/` 를 검증할 수 없다. 다만 "admin 에서 모든 버튼 노출" 테스트에서 `/^Deactivate$/` 가 존재를 확인해 admin 가드가 올바로 노출됨을 간접 검증한다. `isActive=false` 픽스처 추가 없이 `"Activate"` 라벨은 테스트 미커버이지만 동일 조건부(`isAdmin && ...`) 경로에 있어 실제 버그 위험은 없다.
- 제안: INFO 수준 — 필요 시 `isActive=false` 픽스처 추가로 커버 가능하나 required 아님.

### [INFO] `spec/5-system/1-auth.md §3.2` — Auth Config 행의 Owner 와 Admin 권한 정합 확인
- 위치: `spec/5-system/1-auth.md` line 337 `| Auth Config | CRUD | CRUD | R | R |`
- 상세: 스펙은 Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R 로 명시한다. 코드는 `useHasRole("admin")` 를 사용하며 `ROLE_LEVEL` 계층 비교(`>=`)를 통해 admin 이상(admin·owner 모두 통과)을 올바르게 처리한다. Owner 포함 여부가 코드와 spec 간 정합.
- 제안: 이슈 없음.

### [INFO] Auth Config Reveal 스펙 정합 확인
- 위치: `spec/5-system/1-auth.md` line 338 `| Auth Config Reveal (평문 노출) | ✅ | ✅ | — | — |`, `page.tsx` 내 `{isAdmin && (...)}` 블록
- 상세: 스펙은 Reveal 를 Owner·Admin 만 허용으로 명시. 변경된 코드는 Reveal 버튼을 `isAdmin && (...)` 내부로 이동해 동일하게 가드한다. 정합.
- 제안: 이슈 없음.

### [WARNING] 비-admin 에게 "Actions" 테이블 열 헤더(th)는 여전히 렌더됨
- 위치: `page.tsx` `<th>` — `{t("common.actions")}` 헤더 (변경 범위 밖이나 비-admin UX 에 영향)
- 상세: 비-admin 사용자에게는 Actions 컬럼의 버튼 셀이 빈 `<td>` 로 렌더된다(`{isAdmin && (...)}` 이 null 반환). Actions 헤더 th 는 계속 보인다. 빈 컬럼이 의미 없이 공간을 차지하며 UX 관점에서 혼란을 줄 수 있다. 기능적 버그(권한 우회)는 아니지만 UI 일관성 문제다. 스펙(`spec/5-system/1-auth.md §3.2`)은 UI 열 표시 여부를 명시하지 않아 spec fidelity 위반은 아니다.
- 제안: 비-admin 에서 Actions th/td 자체를 숨기거나(테이블 구조 조건부), 빈 td 를 그대로 두는 것이 허용됨을 명시적으로 결정할 것.

### [INFO] `/^Regenerate$/` — aria-label 기반 조회 시 i18n 값 의존
- 위치: `authentication-form.test.tsx` line 44, `page.tsx` `aria-label={t("authentication.regenerateButton")}`
- 상세: Regenerate 버튼은 아이콘 전용(`<RefreshCw />`), visible 텍스트 없음. `screen.getByRole("button", { name: /^Regenerate$/ })` 가 올바르게 동작하려면 `authentication.regenerateButton` 의 `en` 로케일 값이 정확히 `"Regenerate"` 이어야 한다. 단위 테스트 4440 개가 통과한 것으로 실제값 일치 간접 확인.
- 제안: INFO 수준 — 이슈 없음.

## 요약

이번 변경은 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스(Auth Config: Owner/Admin=CRUD, Editor/Viewer=R)에 따라 프론트엔드 UI 의 모든 Auth Config 변경 액션 버튼(Add Config·Toggle·Reveal·Edit·Regenerate·Delete)을 `{isAdmin && (...)}` 단일 가드 아래 통합한 것이다. `useHasRole("admin")` 가 계층 비교(`>=`)로 Owner 도 포함하므로 스펙의 "Owner/Admin CRUD" 정책을 정확히 이행한다. Reveal 에 대한 별도 스펙 항목(`Auth Config Reveal: Admin+`)도 동일 가드로 충족된다. 테스트는 비-admin 전체 버튼 숨김과 admin 노출을 명시적으로 검증하며, isActive 픽스처(`true`)로 인해 "Activate" 라벨만 미커버이나 동일 코드 경로라 실질 위험 없다. 주요 미완성·에러 시나리오 누락·비즈니스 로직 오류는 발견되지 않았다. Actions 열 헤더가 비-admin 에게도 렌더되는 UX 미완성은 WARNING 수준이나 보안·기능 결함은 아니다.

## 위험도

LOW
