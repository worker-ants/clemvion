# Testing 리뷰 — Authentication God Component 분리

## 발견사항

### [INFO] `pickPlaintextSecret` 단위 테스트: 우선순위 체인·엣지 케이스 모두 커버됨
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-types.test.ts`
- 상세: 5개 케이스(우선순위·폴백 체인·빈 객체·undefined·비문자열)가 순수 함수를 완전히 커버한다. `pickPlaintextSecret`는 보안 관련 로직이므로 회귀 가드가 적절히 배치됐다.
- 제안: 없음(현행 유지).

### [INFO] `useAuthConfigForm` 훅 테스트: 상태 전환·검증 분기 망라
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx`
- 상세: `openCreate`/`openEdit`/`close`/`collectFormState`/`validateAndProceed` 각 경로를 `renderHook` + `act`로 격리 검증한다. `beforeEach`에서 `vi.clearAllMocks()` + `useLocaleStore.setState`로 각 테스트를 독립화해 격리 수준이 양호하다.
- 제안: 없음(현행 유지).

### [WARNING] `useAuthConfigForm` 훅 테스트: `hmac` 타입 `collectFormState` 경로 및 초기값 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx`
- 상세: `validateAndProceed` 및 `collectFormState` 테스트는 `api_key`·`basic_auth` 두 타입만 다룬다. `hmac`은 `hmacHeader`/`hmacAlgorithm` 필드를 별도로 가지며 `AUTH_CONFIG_DEFAULTS`로 초기화된다. 초기값 테스트(`starts closed`케이스)에서 `hmacHeader`·`hmacAlgorithm` 기본값 assertion이 없고, `collectFormState` 테스트도 `hmac` 타입을 커버하지 않는다.
- 제안: `collectFormState` 테스트에 `type: "hmac"` + `hmacHeader`·`hmacAlgorithm` 케이스를 추가하거나, 초기값 테스트에 `hmacHeader`·`hmacAlgorithm`의 기본값 assertion을 추가한다.

### [WARNING] 분리된 UI 컴포넌트 3개에 직접 단위 테스트 없음 — prop 조합 분기가 통합 경로에만 의존
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`
- 상세: 신규 분리된 세 컴포넌트는 `AuthenticationPage`를 렌더링하는 통합 테스트(`authentication-form.test.tsx`)를 통해서만 간접 검증된다. `AuthConfigFormFields`의 `showTypeLockedHint=true` 시 hint 문구 렌더링, `showPassword=false` 시 password 필드 미렌더링, `typeDisabled=true` 시 select disabled 상태 등 prop 조합 분기는 직접 단언이 없다. `AuthConfigEditDialog`의 닫기(X) 버튼이 `form.close`를 호출하는지도 통합 테스트에서 확인되지 않는다.
- 제안: `AuthConfigFormFields`에 대한 단위 테스트를 추가해 `typeDisabled`/`showTypeLockedHint`/`showPassword` 조합별 렌더링 분기를 직접 검증한다. 최소한 `authentication-form.test.tsx`에 edit 다이얼로그의 X버튼 닫기 assertion을 추가한다.

### [INFO] `generatedKey` 1회 표시 후 Done 클릭 시 소멸 검증 추가 — 적절함
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` (신규 케이스)
- 상세: `shows the one-time plaintext secret after a successful create` 케이스가 평문 키 노출과 Done 클릭 후 DOM에서 사라지는 것을 `waitFor`로 정확히 검증한다. 보안 관련 UI 흐름에 적합한 테스트다.
- 제안: 없음(현행 유지).

### [INFO] Copy 버튼 클릭 시 `onCopy` 호출 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` (generatedKey 표시 UI 내 Copy 버튼)
- 상세: generatedKey 표시 후 Copy 버튼 클릭 시 `onCopy(generatedKey)`가 올바른 값으로 호출되는지 테스트가 없다. 보안 키의 올바른 복사 경로 보증에 유용하다.
- 제안: 기존 plaintext-secret 테스트에 Copy 버튼 클릭 후 `copyToClipboard`가 `"wfk_live_abc123"`로 호출되는지 확인하는 assertion을 추가한다.

### [WARNING] regenerate 후 `generatedKey` 표시 경로 — 분리 후 실제 동작 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` `regenerateMutation.onSuccess`
- 상세: `regenerateMutation.onSuccess`에서 `form.setGeneratedKey(secret)`를 호출하지만, 이 시점에 `form.mode`는 `null`(다이얼로그 닫힘)이다. `AuthConfigCreateForm`은 `form.mode === "create"`일 때만 렌더링되므로, regenerate 후 평문 키가 실제로 UI에 표시되지 않을 수 있다. 분리 전 코드에서는 `showDialog=true` + `generatedKey` 설정이 동시에 이뤄졌으나, 분리 후엔 `setGeneratedKey`만 호출하고 `openCreate()`를 호출하지 않는다. 이 경로에 대한 통합 테스트가 없어 회귀 발견이 어렵다.
- 제안: regenerate 성공 시 평문 키 표시 동작을 통합 테스트로 검증한다. 만약 표시가 의도적으로 제거됐다면 그에 맞게 `regenerateMutation.onSuccess`에서 `setGeneratedKey` 호출을 제거하거나 별도 표시 경로를 마련한다.

### [INFO] 테스트 격리 — `authentication-form.test.tsx`의 `afterEach`에 `cleanup` 중복 호출
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx`
- 상세: `beforeEach`와 `afterEach` 모두 `cleanup()`을 호출한다. Vitest + `@testing-library/react`는 `afterEach`에서 자동 cleanup을 수행하므로 명시적 이중 호출은 불필요하다. 기능적 문제는 없으나 테스트 의도를 흐린다.
- 제안: `afterEach`의 `cleanup()` 호출 제거를 고려한다.

### [INFO] `use-auth-config-form.test.tsx` — `afterEach` 없이 locale store 복원 누락
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx`
- 상세: `beforeEach`에서 `useLocaleStore.setState({ locale: "en" })`을 설정하지만 `afterEach`로 되돌리지 않는다. `authentication-form.test.tsx`는 `afterEach`에서 locale을 복원하는 반면 이 파일은 그렇지 않아 테스트 파일 간 오염 가능성이 있다.
- 제안: `afterEach(() => useLocaleStore.setState({ locale: "en" }))` 블록을 추가해 `authentication-form.test.tsx`와 패턴을 통일한다.

---

## 요약

이번 변경은 God Component 순수 구조 리팩토링으로서 테스트 측면은 전반적으로 양호하다. `pickPlaintextSecret` 보안 함수에 대한 단위 테스트가 완비됐고, `useAuthConfigForm` 훅도 주요 상태 전환과 검증 분기를 `renderHook`으로 직접 커버한다. 주요 우려 사항은 두 가지다. 첫째, `regenerateMutation.onSuccess`에서 `form.setGeneratedKey`만 호출하고 다이얼로그를 열지 않아 regenerate 후 평문 키가 실제로 표시되지 않을 수 있으며 이를 검증하는 테스트가 없다 — 이는 분리 전과의 동작 차이로 기능 회귀일 가능성이 있다. 둘째, 분리된 세 UI 컴포넌트(`AuthConfigFormFields`·`AuthConfigCreateForm`·`AuthConfigEditDialog`)의 prop 조합 분기(typeDisabled/showPassword/showTypeLockedHint)가 통합 테스트로만 간접 커버되어 prop 오용 회귀를 즉시 감지하기 어렵다.

---

## 위험도

MEDIUM
