# Testing Review — config-c1-auth-god-split

## 발견사항

### [INFO] pickPlaintextSecret 테스트 — 공백 문자열 엣지 케이스 누락
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-types.test.ts`
- 상세: 5개 케이스가 undefined 입력·비문자열 값·우선순위 체인 모두 검증한다. 단 `{ key: "" }` (빈 문자열)처럼 typeof 체크는 통과하지만 UI 표시상 무의미한 값을 허용하는 경로가 미검증이다. `generatedKey ? …` 분기에서 빈 문자열은 falsy라 실제 동작에는 영향 없으나, 함수 계약이 명시되지 않아 미래 변경 시 회귀 위험이 있다.
- 제안: `expect(pickPlaintextSecret({ key: "" })).toBe("")` 또는 null 반환 정책 결정 후 명시 케이스 추가.

---

### [INFO] authentication-form.test.tsx — fireEvent.click vs userEvent.click 혼재
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` 140·151·253·268·283·303·314행
- 상세: 같은 파일에서 입력값 변경에는 userEvent를 쓰고 버튼 클릭에는 fireEvent.click을 사용한다. fireEvent는 이벤트 버블링·포커스·키보드 합성을 건너뛰어 실제 사용자 행동을 완전히 재현하지 못한다. 특히 disabled 상태 검증 등 미래 케이스에서 결과가 달라질 수 있다.
- 제안: 클릭도 `await userEvent.click(…)`으로 통일. 파일 상단에 `userEvent.setup()` 패턴 적용 권장.

---

### [INFO] use-auth-config-form.test.tsx — openEdit → close → openCreate 시퀀스 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx` 471-479행
- 상세: openCreate 테스트는 setName("draft") 후 이름이 유지됨을 확인하지만, openEdit → close → openCreate 순서에서 edit 데이터가 잔류하지 않는지는 별도 케이스가 없다. close가 먼저 리셋하고 openCreate는 모드만 전환한다는 설계 계약이 조합 시나리오에서 회귀 가드되지 않는다.
- 제안: openEdit(EXISTING) → close() → openCreate() 시퀀스 후 name이 "" 임을 확인하는 케이스 추가.

---

### [INFO] AuthConfigFormFields — hmac·bearer_token 타입별 조건부 렌더 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx`
- 상세: 신규 분리된 세 컴포넌트(AuthConfigCreateForm, AuthConfigEditDialog, AuthConfigFormFields)에 대한 직접 렌더 테스트가 없다. authentication-form.test.tsx의 통합 테스트는 api_key 경로만 커버하므로 다음 분기가 미검증이다: (1) form.type === "hmac" 시 header·algorithm 필드 렌더, (2) form.type === "bearer_token" 시 type별 필드 미렌더, (3) showPassword=false 시 password 입력 미노출, (4) typeDisabled=true 시 type 셀렉트 disabled, (5) showTypeLockedHint=true 시 안내 문구 노출.
- 제안: AuthConfigFormFields 단위 렌더 테스트를 추가하거나, authentication-form.test.tsx에 hmac·basic_auth 타입 선택 케이스를 보완.

---

### [INFO] regenerateMutation 후 generatedKey 표시 경로 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` ~330행 regenerateMutation.onSuccess
- 상세: createMutation 성공 후 generatedKey 표시는 신규 테스트로 가드되었으나, regenerateMutation 성공 시 동일 경로(`form.setGeneratedKey(secret)`)는 미검증이다. 특히 regenerate 후 다이얼로그가 닫히지 않고 키 표시만 나타나는 분기가 create와 다를 수 있다.
- 제안: regenerateMutation 성공 응답에 config.key가 담긴 경우 generatedKey UI 렌더 테스트 추가. 우선순위 낮음(모달 열기 시퀀스가 복잡).

---

### [INFO] validateAndProceed — basic_auth + requirePassword=false 시 username 빈 값 차단 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx` 714-738행
- 상세: requirePassword=false(편집 모드) 케이스에서 username: "admin"이 세팅된 상태만 테스트한다. basic_auth 편집 모드에서 username이 비어있으면 토스트가 호출되어야 하는데, 이 경로(requirePassword=false + username 비어있음)가 명시 검증되지 않는다.
- 제안: setType("basic_auth") + username 미설정 + validateAndProceed(onValid) (requirePassword 없음) 조합에서 toastError 호출을 확인하는 케이스 추가.

---

### [INFO] 테스트 격리 — beforeEach에 cleanup() 호출 중복
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` 225·234행
- 상세: beforeEach와 afterEach 모두에서 cleanup()을 호출한다. @testing-library/react는 afterEach에서 자동 cleanup을 수행하므로 beforeEach의 중복 호출은 불필요하다. 단독으로는 무해하지만 이전 테스트의 부작용을 방어하려는 의도라면 테스트가 완전히 독립적이지 않다는 신호다.
- 제안: beforeEach의 cleanup() 제거 후 afterEach만 유지.

---

### [INFO] use-auth-config-form.test.tsx — hmac openEdit 시 hmacAlgorithm 복원 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx` openEdit 케이스
- 상세: openEdit 테스트의 EXISTING fixture가 api_key 타입이라 hmac config(header/algorithm) 복원 경로가 훅 수준에서 미검증이다. formStateFromAuthConfig 자체는 auth-config-form.test.ts에서 커버되지만 훅 통합 경로는 별도 확인이 없다.
- 제안: hmac 타입 + algorithm: "sha512" config를 가진 fixture로 openEdit 후 result.current.hmacAlgorithm === "sha512" 확인 케이스 추가.

---

## 요약

이번 변경은 God Component 분리 리팩토링으로, 핵심 순수 함수(pickPlaintextSecret)와 훅 로직(useAuthConfigForm)에 대한 신규 단위 테스트가 추가되어 회귀 가드 수준이 전반적으로 양호하다. 기존 auth-config-form.test.ts의 순수 함수 커버리지와 authentication-form.test.tsx의 통합 테스트가 주요 동작 경로를 보호한다. 주요 갭은 신규 분리된 컴포넌트들(AuthConfigFormFields)의 hmac·bearer_token 타입별 조건부 렌더링 분기, showPassword/typeDisabled prop 조합이 통합 테스트에서 api_key 경로로만 간접 검증되는 점이다. 그 외 regenerateMutation 후 generatedKey 표시 경로, basic_auth 편집 시 username 필수 검증, openEdit→close→openCreate 상태 시퀀스 등이 미검증 엣지 케이스로 남아있다. 모두 정보성 항목이며 기능 동작을 막는 Critical 이슈는 없다.

## 위험도

LOW
