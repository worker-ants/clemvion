# 부작용(Side Effect) 리뷰

리뷰 대상: authentication/page.tsx RBAC UI 가드 변경 (spec §3.2)
검토 파일: authentication-form.test.tsx, authentication/page.tsx, plan/in-progress/spec-sync-config-gaps.md

---

## 발견사항

### [INFO] `MUTATION_BUTTON_NAMES` 상수의 describe 블록 내 선언 위치
- 위치: `authentication-form.test.tsx` — diff 38~45행, 전체 파일 261~268행
- 상세: `MUTATION_BUTTON_NAMES` 배열이 `describe("AuthenticationPage — edit form §A.2", ...)` 블록 내부에서 `it(...)` 블록들과 같은 레벨에 선언되어 있다. 이 자체는 부작용을 일으키지 않는다. 그러나 선언 위치가 `beforeEach`/`afterEach` 훅과 같은 스코프에 있기 때문에, 향후 이 `describe` 블록 내 다른 `it` 테스트가 실수로 이 상수를 변형(배열 push/pop 등)할 경우 아래 `it` 테스트들에 영향을 줄 수 있다. 현재 코드에서는 변형이 없으므로 실질적 부작용은 없다.
- 제안: 상수이므로 현재 구조로 무방하다. `Object.freeze(MUTATION_BUTTON_NAMES)`를 추가하면 향후 실수에 의한 변형을 방어할 수 있으나 필수는 아니다.

### [INFO] `roleState.isAdmin` 공유 변경 — describe 간 격리 확인
- 위치: `authentication-form.test.tsx` 전체 파일 104~108행 (`vi.hoisted`), 246~257행 (`beforeEach`/`afterEach`)
- 상세: `roleState`는 `vi.hoisted`로 선언된 모듈 수준 공유 객체다. `describe("edit form §A.2")` 의 `afterEach`가 `roleState.isAdmin = true`로 복원하며, 새로 추가된 두 `it` 테스트 모두 `beforeEach`에서 `vi.clearAllMocks()`와 함께 명시적으로 `roleState.isAdmin`을 설정한다. 복원 경로가 이미 존재하므로 첫 번째 `describe("create form §A.2 fields")` 블록의 테스트들이 `roleState.isAdmin`을 건드리지 않는 한 크로스-describe 오염은 발생하지 않는다. 첫 번째 describe 블록은 `roleState.isAdmin`을 수정하지 않으므로 격리가 올바르다.
- 제안: 현재 구조 유지. 다만 `describe("create form")` 블록에도 `afterEach`에서 `roleState.isAdmin = true` 복원을 추가하면 방어적 격리가 더 견고해진다.

### [INFO] 액션 셀 `e.stopPropagation()` 가드 변경의 행동 차이
- 위치: `authentication/page.tsx` — diff 기준 행 381~383 (이전 코드) vs 새 코드의 `{isAdmin && (<div onClick={(e) => e.stopPropagation()}>...)}`
- 상세: 변경 전에는 `<div onClick={(e) => e.stopPropagation()}>` 컨테이너가 `isAdmin` 여부에 관계없이 항상 렌더링되었다. 변경 후에는 비-admin 사용자에게 해당 `<div>`가 아예 렌더링되지 않는다. 비-admin 사용자가 액션 셀 영역(이제 빈 `<td>`)을 클릭하면 `e.stopPropagation()`이 동작하지 않아 클릭 이벤트가 `<tr onClick={() => handleRowClick(config.id)}`까지 버블링되어 usage 드로어가 열린다. 이는 의도된 동작이다 — 목록 행 클릭(usage 드로어 = 읽기)은 모든 역할에 허용된다는 주석과 일치한다. 부작용이 아니라 의도적 동작 변경이다.
- 제안: 이미 코드 주석에 명시되어 있어 충분하다.

### [INFO] 전역/공유 상태·환경 변수·네트워크 호출·파일시스템 변경 없음
- 위치: 두 파일 전체
- 상세: 이번 변경은 순수 UI 조건부 렌더링 변경이다. `isAdmin`은 `useHasRole("admin")` 훅의 반환값을 소비할 뿐이며, 이 훅이 전역 상태를 수정하지 않는다. 새로운 전역 변수, 환경 변수 접근, 네트워크 호출, 파일시스템 작업은 도입되지 않았다.

### [INFO] 함수/메서드 시그니처 및 공개 API 무변경
- 위치: `authentication/page.tsx`
- 상세: `AuthenticationPage` 컴포넌트의 시그니처, props, 내보내기 방식이 변경되지 않았다(`export default function AuthenticationPage()`). `handleRowClick`, `copyToClipboard`, `handleCreate`, `handleUpdate` 등 내부 함수의 시그니처도 불변이다. 기존 호출자에 대한 영향 없음.

### [INFO] 이벤트/콜백 호출 패턴 변경 없음
- 위치: `authentication/page.tsx`
- 상세: `createMutation`, `updateMutation`, `toggleMutation`, `regenerateMutation`, `deleteMutation`, `revealMutation`의 `onSuccess`/`onError` 콜백은 변경되지 않았다. 이벤트 발생 패턴에 신규 부작용이 없다.

### [INFO] 테스트 파일의 `describe` 블록 내 상수 선언의 스코프 격리
- 위치: `authentication-form.test.tsx` — 전체 파일 259~268행
- 상세: 이전 코드에서 같은 위치에 `it(...)` 블록만 있었으나, 변경 후 `const MUTATION_BUTTON_NAMES = [...]`가 `it(...)` 블록들 사이에 선언된다. 이는 JavaScript의 `const` 블록 스코프 규칙에 따라 `describe` 콜백 내에서만 유효하며 모듈 수준으로 누출되지 않는다. 부작용 없음.

---

## 요약

이번 변경은 `authentication/page.tsx`의 모든 변경 액션 버튼(Add Config, Toggle, Reveal, Edit, Regenerate, Delete)을 단일 `{isAdmin && (...)}` 조건부 렌더링 블록으로 통합한 순수 UI 가드 추가다. 새로운 전역 변수, 공유 상태 변형, 환경 변수 접근, 네트워크 호출, 파일시스템 부작용, 함수 시그니처 변경, 공개 API 변경은 전혀 없다. 테스트 파일의 `roleState` 공유 객체는 기존 `afterEach` 복원 패턴으로 올바르게 격리되어 있으며, 새로 추가된 두 `it` 케이스도 이 격리 패턴을 준수한다. 비-admin 사용자에 대해 액션 셀이 미렌더링됨에 따라 `e.stopPropagation()`이 동작하지 않아 행 클릭 시 usage 드로어가 열리는 변화는 spec §3.2의 "읽기 허용" 의도와 일치하는 의도된 동작이다. 부작용 관점에서 문제되는 항목은 발견되지 않았다.

---

## 위험도

NONE
