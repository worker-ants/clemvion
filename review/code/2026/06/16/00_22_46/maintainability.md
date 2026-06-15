# 유지보수성(Maintainability) Review

## 발견사항

### **[INFO]** `TYPE_LABEL_KEYS`와 `AUTH_TYPES` 사이 레이블 매핑 중복
- 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` L774-786
- 상세: `AUTH_TYPES` 배열과 `TYPE_LABEL_KEYS` 레코드가 동일한 4개 type→labelKey 매핑을 두 번 선언한다. 향후 type 추가 시 두 곳을 동시에 수정해야 한다.
- 제안: `AUTH_TYPES`를 단일 진실(SoT)로 두고, `TYPE_LABEL_KEYS`는 `Object.fromEntries(AUTH_TYPES.map(t => [t.value, t.labelKey]))` 로 파생하면 중복을 제거할 수 있다.

### **[INFO]** `UseAuthConfigForm` 인터페이스의 setter 파라미터 명 `v`
- 위치: `/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` L2197-2213
- 상세: `setName: (v: string) => void`, `setType: (v: AuthConfigType | "") => void` 등 모든 setter의 파라미터 명이 `v`로 통일되어 있다. 단일 매개변수라 IDE 힌트에서 의미 정보가 줄어들고, 코드 리뷰 시 "무엇을 받는 setter인지"를 타입 외에 이름으로 파악하기 어렵다.
- 제안: `value` 혹은 각 필드에 맞는 구체적인 이름(`name`, `type`, `header` 등)으로 변경하거나, 최소한 `value`로 통일한다. 현재 `v`는 허용 가능한 약어이나 INFO 수준으로 판단.

### **[INFO]** `close()` 내부의 순차적 setState 11개 나열
- 위치: `/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` L2240-2252
- 상세: `close()`가 setState를 순차적으로 11번 호출한다. 이 자체가 버그는 아니지만, 새 필드 추가 시 `openEdit`·`close`·`collectFormState` 세 곳에 동시에 추가해야 한다. 필드가 더 늘어나면 누락 위험이 증가한다.
- 제안: 초기 상태를 `const DEFAULT_FORM = { name: "", type: "", ... }` 상수로 정의하고, `useReducer` 또는 단일 `useState(DEFAULT_FORM)` 객체 방식으로 전환하면 필드 추가 시 누락 지점이 하나로 줄어든다. 현재 규모에서는 허용 가능하므로 INFO.

### **[INFO]** `AuthConfigCreateForm`과 `AuthConfigEditDialog`의 다이얼로그 껍데기 구조 중복
- 위치: `auth-config-create-form.tsx` L62-63 및 `auth-config-edit-dialog.tsx` L258-259
- 상세: 두 컴포넌트 모두 `fixed inset-0 z-50 ...` overlay div와 `w-full max-w-md rounded-lg border ...` card div를 동일한 클래스로 반복 선언한다. 헤더(h2 + X 버튼 패턴)도 거의 동일하다. 현재 두 파일이므로 허용 범위이지만, `page.tsx` 내부에도 동일 패턴의 모달(regenerate/reveal/delete 확인)이 4개 더 남아있어 총 6개의 동일 패턴이 존재한다.
- 제안: 공통 `ModalOverlay` / `ConfirmDialog` 컴포넌트 추출을 중기 과제로 기록하는 것이 좋다.

### **[INFO]** `page.tsx` 내 인라인 확인 모달 패턴 4회 반복
- 위치: `/codebase/frontend/src/app/(main)/authentication/page.tsx` L1682-1818
- 상세: regenerate / reveal 비밀번호 입력 / revealedSecret 표시 / delete 확인 모달이 각각 `fixed inset-0 z-50`과 동일한 card 구조를 4회 반복한다. 이번 PR의 God Component 분리 범위에서는 의도적으로 제외했으나, 유지보수성 측면에서 미래의 모달 추가·수정 시 일관성을 지키기 어려워질 수 있다.
- 제안: `ConfirmDialog` 추상화를 다음 리팩토링 단계의 후속 작업으로 명시하는 것을 권장한다.

### **[INFO]** `auth-config-form-fields.tsx`: 네이티브 `<select>`와 Shadcn `<Input>` 혼용
- 위치: `auth-config-form-fields.tsx` L425-442, L466-478
- 상세: `name` / 비밀 입력은 Shadcn `<Input>`을 쓰고, type select / hmac algorithm select는 네이티브 `<select>`에 직접 Tailwind 클래스를 수동으로 지정한다. 두 select가 같은 클래스 문자열을 복사하고 있어 스타일 변경 시 두 곳을 수동으로 동기화해야 한다.
- 제안: 네이티브 `<select>` className을 재사용 가능한 상수 또는 `SelectNative` 래퍼 컴포넌트로 추출하면 두 select의 스타일이 자동으로 동기화된다.

### **[INFO]** `validateAndProceed` 내 서로 다른 조건이 동일한 토스트 키 사용
- 위치: `/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` L2299-2312
- 상세: `!name.trim()`, `!username.trim()`, `!password` 세 가지 조건이 모두 동일한 `"authentication.fillRequired"` 키로 토스트를 표시한다. 사용자 입장에서는 어떤 필드가 비었는지 알기 어렵고, 조건 추가 시 어떤 메시지 키를 선택해야 하는지도 불명확하다.
- 제안: 각 조건에 맞는 구체적인 에러 키(예: `"authentication.nameRequired"`)를 사용하거나, 검증 결과를 구조체로 반환해 호출자가 처리하도록 하면 향후 유지보수가 용이하다.

## 요약

이번 변경은 `authentication/page.tsx`의 God Component를 5개 파일로 명확하게 분리한 구조 리팩토링이다. `useAuthConfigForm` 훅으로 11개 `useState`와 분산된 `dialogMode` 분기를 단일 책임 단위로 통합하고, create/edit 다이얼로그를 별도 컴포넌트로 추출하며, 공유 타입·상수를 `auth-config-types.ts`로 이동한 설계 결정은 모두 올바른 방향이다. JSDoc 주석과 인라인 한국어 설명도 의도를 잘 전달한다. 주요 유지보수 위험 요소는 `AUTH_TYPES`와 `TYPE_LABEL_KEYS`의 레이블 매핑 중복, `page.tsx` 내부에 남겨진 4개의 인라인 모달 패턴 반복, `close()` 내 11개 setState 나열이나, 모두 현 규모에서는 즉각 수정이 필수인 CRITICAL/WARNING 수준이 아닌 INFO 수준으로 판단된다. 전체적으로 유지보수성이 이전 단일 파일 대비 뚜렷하게 향상되었다.

## 위험도

LOW
