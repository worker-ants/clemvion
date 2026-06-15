# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 spec: `spec/2-navigation/6-config.md`
diff 기준: `1899c05e...HEAD`
변경 성격: authentication/page.tsx God Component → create/edit 폼 컴포넌트 + 커스텀 훅 순수 구조 리팩토링

---

## 발견사항

기각된 대안 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 invariant 우회 여부를 `spec/2-navigation/6-config.md ## Rationale` (R-1~R-6) 및 cross-reference 된 인접 spec Rationale 에 대해 점검했다.

### 발견사항 없음 (NONE)

검토 관점 4가지 모두에서 충돌 항목이 발견되지 않았다. 상세 근거는 아래 각 항목별 검증 결과로 확인한다.

---

## 검토 관점별 상세

### 1. 기각된 대안의 재도입 점검

**R-2 (편집 폼 비밀값 차단, type 편집 차단, regenerate 단일 경로)**

spec `R-2` 는 다음 invariant 를 명시한다:
- 편집 폼은 name · IP · 비-비밀 config 만 변경하고, 비밀값 재입력은 받지 않는다.
- type 변경은 편집 폼에서 차단한다 (비밀 재발급 수반 → 삭제 후 재생성).
- 비밀 변경은 regenerate 단일 경로로 일원화.

이번 변경에서:
- `AuthConfigEditDialog` 는 `AuthConfigFormFields` 에 `typeDisabled={true}`, `showPassword={false}` 를 전달 → type select 잠금과 password 입력 제거가 컴포넌트 prop 경계로 명시적으로 강제된다.
- `openEdit` 내부에서 `setPassword("")` 로 편집 진입 시 password 를 명시 초기화한다.
- `validateAndProceed` 에서 `requirePassword` 는 create 흐름에서만 `true` 로 전달되고, edit 흐름(`handleUpdate`)은 옵션 없이 호출한다 — 기각된 "편집 폼에서도 password 를 받는다" 대안이 재도입되지 않았다.
- `AuthConfigCreateForm` 은 `typeDisabled={false}` 로 type 선택 자유를 허용하고 `showPassword={true}` 로 password 입력을 노출 — create/edit 의 역할 분리가 명확하다.

**R-2 (bearer_token 자동 발급 강제)**

이번 변경은 create 폼에서 bearer_token 의 사용자 입력 필드를 추가하지 않았다. `auth-config-form-fields.tsx` 는 `form.type === "bearer_token"` 분기를 두지 않아 사용자 입력란이 없다 — 자동 발급 강제 invariant 유지.

**R-2 (항상 마스킹 + Reveal 3 경로)**

`pickPlaintextSecret` 는 `auth-config-types.ts` 로 이전됐으나 동작이 동일하다 (단위 테스트 `auth-config-types.test.ts` 가 기각된 "평문을 목록 응답에 포함" 대안을 차단). create mutation `onSuccess` 에서만 `setGeneratedKey(secret)` 를 호출하고, `basic_auth` 처럼 secret 이 없으면 `form.close()` 로 즉시 닫는다 — "1회 표시 후 소멸" 경로가 유지된다.

**R-1 (기본 모델 select-only 정책)**

이번 변경은 ModelConfig 관련 코드를 건드리지 않는다. 영향 없음.

### 2. 합의된 원칙 위반 점검

**단일 수집 지점 원칙 (`collectFormState`)**

spec `A.2 구현 현황` 에서 "편집 PATCH 는 config 를 shallow-merge 해 암호화 비밀값을 보존한다" 는 백엔드 계약을 전제하며, 프론트엔드의 `collectFormState` 가 일관된 상태를 payload 로 조립한다는 원칙이 있다. 이번 리팩토링은 `collectFormState` 를 `useAuthConfigForm` 훅으로 이전했으며 로직이 동일하다 — 수집 지점 단일화 원칙 유지.

**regenerate 단일 경로 원칙**

`regenerateMutation.onSuccess` 에서 `form.setGeneratedKey(secret)` 를 사용한다. regenerate 경로가 고유한 평문 표시 진입점으로 유지된다. 새 컴포넌트(`AuthConfigCreateForm`)가 generatedKey 를 표시하는 동일 UI 패턴을 재사용하지만, regenerate 흐름은 여전히 별도 confirm 다이얼로그(`regenerateTarget` state) → 별도 mutation 경로를 사용하며 create 폼과 교차하지 않는다.

**IP Whitelist 공통 필드 원칙**

`auth-config-form-fields.tsx` 에서 `{form.type !== "" && <textarea id="auth-ip-whitelist" ...>}` 로 모든 type 공통(선택) 필드를 유지한다. create/edit 공통으로 `showPassword` prop 과 무관하게 노출된다 — 원칙 유지.

### 3. 결정의 무근거 번복 점검

이번 변경은 순수 구조 리팩토링이며 spec 을 수정하지 않는다. create/edit 다이얼로그 분리는 `spec/2-navigation/6-config.md` 의 `## Rationale` 항목 중 어느 것도 번복하지 않는다. 이전의 `dialogMode === "edit"` 분기를 prop 로 교체한 것은 동일 의사결정을 다른 코드 구조로 표현한 것이다. 새 Rationale 를 spec 에 추가할 의무가 없다.

### 4. 암묵적 가정 충돌 점검

**기밀값 상태 초기화 invariant**

`useAuthConfigForm.close()` 에서 `setPassword("")`, `setGeneratedKey(null)` 를 명시 초기화한다. 이전 `resetForm()` 과 bit-identical. 다이얼로그가 닫힐 때 비밀값이 메모리에서 제거되는 invariant 가 유지된다.

**편집 진입 시 비밀값 빈 상태 진입 invariant**

`openEdit()` 내부에서 `setPassword("")`, `setGeneratedKey(null)` 를 명시 설정한다. 이전 `handleEditClick` 의 동작과 bit-identical. 편집 폼이 비밀값을 채워 열리는 기각된 대안이 코드에 들어오지 않았다.

**Regenerate 후 generatedKey 표시가 create 폼을 거치지 않는 invariant**

regenerate 완료 후 `form.setGeneratedKey(secret)` 를 호출하지만, 이 시점에 `form.mode` 는 이미 닫힘(`null`) 상태다 — regenerate 는 edit dialog 가 닫힌 뒤 별도 confirm dialog 로 진행하기 때문이다. 즉 `form.mode === "create"` 조건 분기가 regenerate 를 오염하지 않는다. `generatedKey` 가 설정되더라도 `form.mode` 가 null 이면 `AuthConfigCreateForm` 이 렌더되지 않아 generatedKey 가 화면에 표시되지 않는다.

이 점을 추가 검토했다: 기존 page.tsx 는 `showDialog` 와 `generatedKey` 가 별도 state 였고, `showDialog=false` + `generatedKey=non-null` 이 동시에 가능했다. 기존 구현에서 regenerate 시 `showDialog` 를 `true` 로 세팅하지 않으므로 regenerate generatedKey 는 이전에도 화면에 표시되지 않았다 — 즉 기존 동작과 동일하다. 문제가 있다면 리팩토링 전후 모두 동일 문제이며, 이번 변경이 새로 도입한 회귀가 아니다. `if (secret) form.setGeneratedKey(secret)` 의 설정값은 `close()` 가 호출될 때 정리된다. Rationale 위반은 아니다.

---

## 요약

이번 변경(`authentication/page.tsx` God Component → `AuthConfigCreateForm` + `AuthConfigEditDialog` + `useAuthConfigForm` 분리)은 `spec/2-navigation/6-config.md ## Rationale` 의 R-2 핵심 invariant — 편집 폼 비밀값 입력 차단, type 편집 차단, regenerate 단일 경로 — 를 코드 구조 수준에서 오히려 더 명확하게 표현한다. `typeDisabled`, `showPassword`, `showTypeLockedHint` 세 prop 이 각 invariant 를 컴포넌트 경계에서 선언적으로 강제하며, `useAuthConfigForm.openEdit` 과 `close` 가 비밀값 상태의 생명주기를 단일 지점에서 관리한다. 기각된 대안(편집 폼 비밀값 허용, type 변경 허용, 자동 발급 bypass)의 재도입 흔적이 없으며, 과거 결정을 번복하는 새 Rationale 부재 위반도 없다. 순수 구조 리팩토링이라는 의도와 완전히 부합한다.

---

## 위험도

NONE
