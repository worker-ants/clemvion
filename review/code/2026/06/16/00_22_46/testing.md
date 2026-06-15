# Testing Review — Auth Config God Component Split

## 발견사항

### [WARNING] `useAuthConfigForm` 훅에 대한 직접 단위 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts`
- 상세: `validateAndProceed`, `openCreate`, `openEdit`, `close`, `collectFormState` 등 핵심 상태 전환 로직이 `useAuthConfigForm` 훅에 집중되어 있으나, 이 훅을 직접 테스트하는 파일이 존재하지 않는다. 현재는 `authentication-form.test.tsx`가 `page.tsx`를 통한 통합 경로로 간접 커버하고 있다. 리팩토링 목적이 로직 집중화였으므로, 훅 자체를 `renderHook`으로 격리하는 단위 테스트가 존재해야 한다.
- 제안: `@testing-library/react`의 `renderHook`을 활용해 `use-auth-config-form.test.ts`를 신설하고, 최소한 `openCreate → mode === "create"`, `openEdit(config) → mode === "edit" + 필드 초기화`, `close → mode === null + 전체 필드 리셋`, `validateAndProceed` 의 각 분기(empty name, requireType, requirePassword, basic_auth username, invalid IP, invalid header)를 직접 검증해야 한다.

### [WARNING] `generatedKey` 1회 표시 흐름(create 성공 후 복사 UI)에 대한 통합 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` (generatedKey 분기)
- 상세: `AuthConfigCreateForm`이 `generatedKey`가 null이 아닐 때 "saveKeyNotice" 메시지와 Copy 버튼을 노출하는 분기는 기존 `authentication-form.test.tsx`에서 전혀 테스트되지 않는다. 해당 테스트에서 `postMock`이 `config: {}`를 반환하도록 설정되어 있어 `pickPlaintextSecret`이 null을 반환하고 `generatedKey` 분기 경로가 실행되지 않는다. `api_key`/`bearer_token`/`hmac` 타입 생성 성공 시 서버가 평문 키를 내려주는 경우, 그 키가 화면에 노출되고 Copy 버튼이 작동하는 경로가 완전히 미검증이다.
- 제안: `postMock`이 `{ data: { data: { id: "c1", type: "api_key", config: { key: "abc123" } } } }`를 반환하는 시나리오를 추가하고, `saveKeyNotice` 텍스트 노출, `code` 요소 내 `"abc123"` 렌더링, `navigator.clipboard.writeText` 호출까지 검증하는 테스트를 `authentication-form.test.tsx`에 추가한다.

### [WARNING] `pickPlaintextSecret`에 대한 단위 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` (`pickPlaintextSecret` 함수)
- 상세: `pickPlaintextSecret`은 `key ?? token ?? secret ?? password` 우선순위 체인으로 평문 비밀값을 추출하는 순수 함수로, 보안상 중요한 로직(평문 노출 여부 결정)이다. `auth-config-form.test.ts` 수준의 단위 테스트가 마땅하나 현재 테스트 파일이 전혀 존재하지 않는다. `auth-config-types.ts`의 다른 상수(`AUTH_TYPES`, `STATUS_BADGE_VARIANT`, `TYPE_LABEL_KEYS`)도 미검증이나, 이것들은 단순 데이터라 우선순위가 낮다.
- 제안: `auth-config-types.test.ts`를 신설하거나 기존 `auth-config-form.test.ts`에 `describe("pickPlaintextSecret")` 블록을 추가해 `key` 필드 우선, `token` 폴백, `secret` 폴백, `password` 폴백, 비문자열 값 처리(null 반환), undefined config 처리(null 반환) 케이스를 모두 검증한다.

### [INFO] `AuthConfigFormFields`의 type별 조건부 렌더링 경로가 통합 테스트에서 부분 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx`
- 상세: `authentication-form.test.tsx`는 `api_key` 타입만 선택해 테스트한다. `hmac`(header + algorithm select), `basic_auth`(username + password 조건부), `bearer_token`(추가 필드 없음)에 대한 폼 필드 렌더링 및 `onChange` 핸들러 연결은 미검증이다.
- 제안: 우선순위는 낮으나 `hmac` 타입 선택 시 `hmacHeader`/`hmacAlgorithm` 필드 노출 및 페이로드 매핑을 `authentication-form.test.tsx`에 1개 케이스 추가하면 회귀 가드가 강화된다.

### [INFO] `validateAndProceed`의 `requirePassword` 분기가 통합 테스트에서 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (라인 2308~2312 of prompt file)
- 상세: `basic_auth` 타입으로 생성 시 `password` 필드가 비어 있으면 제출을 막는 분기가 있으나, 현재 통합 테스트에서 이 경로를 실행하는 케이스가 없다. `authentication-form.test.tsx`는 `api_key` 경로만 테스트한다.
- 제안: `basic_auth` 선택 + username 입력 + password 미입력 → 제출 클릭 → toastError 호출, `postMock` 미호출을 검증하는 케이스를 추가한다.

### [INFO] `close()` 호출 시 전체 필드 리셋 검증 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (`close` 함수)
- 상세: `close()`는 11개 상태를 초기화한다. 편집 다이얼로그를 열고 일부 필드를 변경한 후 "Cancel"을 눌렀을 때 이전 데이터가 남지 않고 새 생성 폼을 열면 깨끗한 상태인지 확인하는 테스트가 없다. 리팩토링 전 `resetForm`이 담당하던 동일 보장을 `close`가 이어받았으나 이 동작은 현재 무검증이다.
- 제안: `openEdit` → 필드 변경 → `close` → `openCreate` 후 필드가 기본값인지 확인하는 통합 테스트를 추가한다.

## 요약

이번 변경은 `page.tsx`의 God Component를 순수 구조 리팩토링으로 분리한 작업이다. 기존 `authentication-form.test.tsx`(통합, 페이지 경로)와 `auth-config-form.test.ts`(순수 함수 단위)가 회귀 가드 역할을 하며 plan 기술 대로 전체 통과가 확인되었다. 그러나 핵심 로직이 집중된 `useAuthConfigForm` 훅 자체에 대한 직접 단위 테스트가 없고, 보안 관련 `pickPlaintextSecret` 순수 함수와 `generatedKey` 1회 표시 UI 흐름이 완전히 미검증 상태다. 기존 테스트 수준은 리팩토링 전 행동을 적절히 보호하지만, 신규 훅·유틸 함수에 대한 커버리지 갭이 존재해 향후 수정 시 회귀 탐지력이 낮다.

## 위험도

MEDIUM
