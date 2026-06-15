# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 spec: `spec/2-navigation/6-config.md`
diff-base: 86b50b29

---

## 발견사항

### 1. Rationale 위반 없음 — God Component 분리는 중립적 리팩터링

본 diff 는 `page.tsx` 내의 `useState` 11개 + `dialogMode` 분기를 `useAuthConfigForm` 훅으로 추출하고, 단일 다이얼로그를 `AuthConfigCreateForm` / `AuthConfigEditDialog` 두 컴포넌트로 분리한 것이다.

분리 전과 후의 **동작**은 코드 주석과 테스트 모두 "bit-identical" 임을 명시하고 있으며, 이하 항목별 Rationale 정합성 검토 결과는 모두 NONE 이다.

---

#### [INFO] `generatedKey` 자동 클리어 effect deps 변경 (`[generatedKey]` -> `[generatedKey, setGeneratedKey]`)

- target 위치: `page.tsx` diff, `useEffect` 의존 배열 변경 부분
- 과거 결정 출처: `spec/2-navigation/6-config.md` R-2 "클라이언트 타이머는 `useEffect` cleanup 으로 언마운트·재노출 시 정리해 누수·stale clear 를 막는다"
- 상세: spec R-2 는 "useEffect cleanup 으로 누수·stale clear 방지" 만 요구하며, deps 배열 구성에 관한 invariant 는 기록하지 않는다. `setGeneratedKey` 는 `useState` 의 setter 로 참조 안정성이 보장되므로 deps 추가는 eslint-exhaustive-deps 준수 목적의 방어적 변경이다. 정책 위반 아님.
- 제안: 현 구현 유지. Rationale 갱신 불필요.

#### [INFO] `form.close()` 가 `resetForm()` 을 대체

- target 위치: `page.tsx` diff, `createMutation.onSuccess` / `updateMutation.onSuccess`
- 과거 결정 출처: `spec/2-navigation/6-config.md` R-2 "편집 폼은 자동 발급·마스킹 정책을 동일 적용 — 비밀 변경은 regenerate 단일 경로로 일원화"
- 상세: `close()` 내부가 구 `resetForm()` 과 동일하게 모든 필드·`generatedKey`·mode 를 초기화하므로 invariant 유지. 이름만 변경된 내부 리팩터링.
- 제안: 현 구현 유지.

#### [INFO] `AuthConfigCreateForm` 에서 `generatedKey` 분기를 직접 렌더링

- target 위치: `auth-config-create-form.tsx`, generatedKey 표시 분기
- 과거 결정 출처: `spec/2-navigation/6-config.md` §A.4 "UI: 평문 표시 + Copy 버튼 + 30초 후 자동 hide"
- 상세: 분리 전 단일 다이얼로그가 수행하던 generatedKey 평문 표시·Done 버튼·Copy 버튼 UX 가 `AuthConfigCreateForm` 으로 이전됐다. 기능·정책 변경 없이 위치만 이동. 30초 자동 클리어 타이머는 여전히 `page.tsx` 의 `useEffect` 에서 관리하므로 §A.4 / R-2 의 "30초 자동 hide" invariant 가 유지된다.
- 제안: 현 구현 유지.

#### [INFO] `AuthConfigEditDialog` 에서 type select `disabled` + `showTypeLockedHint` prop 으로 명시적 분기

- target 위치: `auth-config-form-fields.tsx`, `typeDisabled` / `showTypeLockedHint` / `showPassword` prop
- 과거 결정 출처: `spec/2-navigation/6-config.md` R-2 "type 변경도 편집 폼에서 차단(타입 전환은 비밀 재발급을 수반 -> 삭제 후 재생성)"
- 상세: 이전 `dialogMode === "edit"` 분기를 명시적 capability prop(`typeDisabled=true`, `showPassword=false`)으로 대체했다. 동일 invariant 를 더 명확하게 표현한 것으로, R-2 의 "type·비밀값 불변" 정책과 충돌하지 않는다.
- 제안: 현 구현 유지.

---

## 요약

이번 diff 는 `spec/2-navigation/6-config.md` 의 인증 설정 화면 spec 에서 도출된 기능을 변경하지 않는다. God Component(`page.tsx`)에서 폼 상태·검증·다이얼로그 제어를 `useAuthConfigForm` 훅과 두 개의 단일-목적 컴포넌트로 추출한 순수 리팩터링이며, Rationale 에 기록된 모든 invariant(30초 자동 hide, type·비밀값 편집 차단, regenerate 단일 경로, shallow-merge 비밀 보존)가 구현 내에 그대로 유지된다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, 암묵적 가정 충돌 중 어느 항목도 발견되지 않았다.

## 위험도

NONE
