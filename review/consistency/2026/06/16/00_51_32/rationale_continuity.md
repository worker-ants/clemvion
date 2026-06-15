# Rationale 연속성 검토 결과

**검토 대상**: `spec/2-navigation/6-config.md`  
**검토 모드**: 구현 완료 후 검토 (--impl-done, diff-base=1899c05e)  
**검토 일시**: 2026-06-16

---

## 발견사항

### [INFO] 타입 분리(auth-config-types.ts)는 Rationale 원칙과 정합 — 별도 기록 불필요
- **target 위치**: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` (신규)
- **과거 결정 출처**: `spec/2-navigation/6-config.md ## Rationale R-2` — "편집 폼은 자동 발급·마스킹 정책을 동일 적용"
- **상세**: `pickPlaintextSecret` 함수가 `auth-config-types.ts` 로 이동하면서 `key ?? token ?? secret ?? password` 우선순위 체인은 원래 `page.tsx` 안의 동일 로직을 그대로 유지하고 있다. R-2 의 "Reveal·regenerate·create 3 경로만 평문 노출" invariant 와 정합. 로직 변경 없이 모듈 위치만 이동한 것이므로 새 Rationale 항목은 불필요하다.
- **제안**: 해당 없음 (정합).

### [INFO] `openCreate` 가 초기화 없이 모드만 전환하는 것 — 기존 resetForm 계약 유지 확인
- **target 위치**: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` L1335–1337 (`openCreate` 함수)
- **과거 결정 출처**: `spec/2-navigation/6-config.md ## Rationale R-2` — "close 가 초기화 담당" 설계 (구 `resetForm`)
- **상세**: `openCreate` 는 `setMode("create")` 만 수행하며 필드 초기화를 하지 않는다. 이는 기존 `page.tsx` 의 `setDialogMode("create"); setShowDialog(true)` 와 동일 행동이다. 훅 주석(`// openCreate 는 초기화하지 않는다(분리 전 page.tsx 와 동일 — close 가 초기화 담당)`)이 이 결정을 명시하고 있어 의도적 보존임이 분명하다. R-2 의 "비밀 변경은 regenerate 단일 경로" invariant 를 우회하지 않는다.
- **제안**: 해당 없음 (정합). 코드 주석이 이미 충분한 근거를 기록하고 있다.

### [INFO] 편집 폼에서 비밀값 입력 없음 원칙 유지 확인
- **target 위치**: `codebase/frontend/src/app/(main)/authentication/auth-config-edit-dialog.tsx` (신규), `auth-config-form-fields.tsx` L576–590
- **과거 결정 출처**: `spec/2-navigation/6-config.md ## Rationale R-2` — "편집 PATCH 는 name·IP·비-비밀 config 만 변경하고 비밀값 재입력은 받지 않는다"
- **상세**: `AuthConfigEditDialog` 는 `showPassword={false}` 를 명시적으로 전달하고 `AuthConfigFormFields` 에서 `showPassword` prop 이 false 일 때 password 입력을 렌더하지 않는다. 이전 `dialogMode === "create"` 분기 대신 명시적 capability prop(`showPassword`, `typeDisabled`)으로 대체했다 — 동작은 Rationale R-2 를 정확히 준수한다.
- **제안**: 해당 없음 (정합).

### [INFO] type 편집 차단 원칙 유지 확인
- **target 위치**: `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` L499–501
- **과거 결정 출처**: `spec/2-navigation/6-config.md ## Rationale R-2` — "type 변경도 편집 폼에서 차단(타입 전환은 비밀 재발급을 수반 → 삭제 후 재생성)"
- **상세**: `auth-config-form-fields.tsx` 의 type select 는 `disabled={typeDisabled}` prop 을 받으며, `AuthConfigEditDialog` 는 `typeDisabled={true}` 를 전달한다. R-2 의 "type 변경은 편집 폼에서 차단" 원칙이 capability prop 방식으로 명시적으로 표현되어 있다. 기존 `dialogMode === "edit"` 조건부 차단과 기능상 동등하다.
- **제안**: 해당 없음 (정합).

---

## 요약

이번 diff 는 `authentication/page.tsx` God Component 를 `useAuthConfigForm` 훅 + `AuthConfigCreateForm` / `AuthConfigEditDialog` / `AuthConfigFormFields` 컴포넌트 + `auth-config-types.ts` 공유 모듈로 분리하는 순수 리팩터링이다. 분석 결과, `spec/2-navigation/6-config.md ## Rationale` 의 핵심 결정—(R-2) 비밀값 편집 불가·type 편집 차단·비밀 변경은 regenerate 단일 경로, (R-6) 호출 이력 스키마—을 모두 동일하게 유지하고 있다. 기각된 대안의 재도입, 합의된 invariant 위반, 또는 새 Rationale 없는 번복은 발견되지 않았다. 변경은 Rationale 에 명시된 원칙의 표현 방식만 바꿨으며(dialogMode 분기 → 명시적 capability prop), 원칙 자체는 그대로 보존한다.

---

## 위험도

NONE
