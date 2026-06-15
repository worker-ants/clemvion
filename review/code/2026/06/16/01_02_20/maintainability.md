# 유지보수성(Maintainability) 리뷰

## 발견사항

### **[INFO]** `UseAuthConfigForm` 인터페이스에 setter 노출 과다 — 캡슐화 약화
- 위치: `/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` 라인 128–161
- 상세: `UseAuthConfigForm` 인터페이스가 `setName`, `setType`, `setHmacHeader`, `setHmacAlgorithm`, `setApiKeyHeader`, `setIpWhitelist`, `setUsername`, `setPassword`, `setGeneratedKey` 등 9개의 raw setter 를 public 으로 노출한다. 개별 필드를 외부에서 직접 변경할 수 있어 폼 상태 전환 의도가 분산되고, 향후 필드 간 연동 로직(예: type 변경 시 연관 필드 초기화)이 이 setter 를 사용하는 모든 호출 지점에 걸쳐 중복 처리되어야 한다. 현재는 `openEdit` 와 `close` 가 그 역할을 담당하지만, 테스트 파일(`use-auth-config-form.test.tsx`) 에서 `result.current.setName("changed")` 처럼 외부에서 직접 setter 를 호출하는 패턴이 이 경계를 약화시킨다.
- 제안: setter 를 인터페이스에서 유지하되, 단위 테스트에서 내부 상태를 직접 조작하는 대신 `openEdit` / `openCreate` 등 의도를 드러내는 액션으로만 상태를 전환하는 방향을 권장. 장기적으로는 setter 를 internal 로 숨기고 의미 있는 액션만 공개하는 패턴으로 리팩토링 고려.

---

### **[WARNING]** `AuthConfigCreateForm` 과 `AuthConfigEditDialog` 의 다이얼로그 래퍼 DOM 중복
- 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` 라인 813–870 / `/codebase/frontend/src/app/(main)/authentication/auth-config-edit-dialog.tsx` 라인 1009–1045
- 상세: 두 컴포넌트가 동일한 `div.fixed.inset-0.z-50...` 오버레이, `div.w-full.max-w-md.rounded-lg...` 카드, `Button(ghost, size=icon, X)` 닫기 버튼 구조를 각자 직접 작성하고 있다. CSS 클래스 문자열이 두 파일에서 완전히 동일하다. 향후 다이얼로그 디자인 토큰(z-index, max-width, shadow, 둥글기)이 바뀌면 두 곳을 모두 수정해야 한다. page.tsx 에 남아 있는 Regenerate/Reveal/Delete 확인 모달도 동일 패턴을 반복하고 있어 실제로는 5곳 이상이 복사된 상태다.
- 제안: `AuthConfigDialogShell` 같은 공통 래퍼 컴포넌트를 추출해 오버레이, 카드, 헤더(제목 + 닫기 버튼) 레이아웃을 단일 SoT 로 관리. 기존 `SlideDrawer` 패턴을 참고해 공통 Dialog 컴포넌트 추상화 검토.

---

### **[WARNING]** `auth-config-form-fields.tsx` 내 `<select>` 인라인 className 이 두 곳에서 거의 동일하게 반복
- 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` 라인 1346 (auth-type select), 라인 1387 (auth-hmac-algorithm select)
- 상세: 두 `<select>` 요소의 `className` 이 `"flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"` 으로 거의 동일(type select 에는 `disabled:cursor-not-allowed disabled:opacity-60` 추가). 이 Tailwind 클래스 조합이 변경될 경우 두 곳을 개별 수정해야 한다.
- 제안: 공용 `SelectField` 컴포넌트 또는 `selectClassName` 상수를 추출. 이미 `Input` 컴포넌트를 추상화해 사용 중인 패턴과 일관성 유지를 위해 `Select` UI 컴포넌트 도입 고려.

---

### **[INFO]** `validateAndProceed` 내 동일 toast 메시지(`fillRequired`) 를 서로 다른 검증 실패 조건에서 반복 사용
- 위치: `/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` 라인 3041–3054
- 상세: name 미입력, type 미선택, username 미입력, password 미입력 네 가지 조건이 모두 동일한 `toast.error(t("authentication.fillRequired"))` 를 호출한다. 어느 필드가 문제인지 사용자에게 구분 가능한 메시지를 제공하지 않으며, 내부 코드에서도 조건이 분산되어 있어 새 검증 규칙 추가 시 토스트 키를 매번 확인해야 한다.
- 제안: 수정 필요도는 낮지만, 향후 필드별 인라인 에러 메시지나 더 구체적인 토스트 메시지로 개선 시 네 분기를 한 번에 확인할 수 있도록 검증 실패 이유를 반환하는 순수 함수로 추출하는 구조가 유지보수성을 높인다.

---

### **[INFO]** plan 문서의 `STATUS_BADGE_VARIANT` 산출 목록 기술이 실제 구현과 불일치
- 위치: `/plan/in-progress/spec-sync-config-gaps.md` 라인 3334 / `/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 2221–2229
- 상세: plan 문서는 `STATUS_BADGE_VARIANT` 를 `auth-config-types.ts` 산출물로 열거하고 있지만, 실제 코드에서는 `page.tsx` 에 정의되어 있으며 `auth-config-types.ts` 에는 존재하지 않는다. `page.tsx` 자체의 주석("page 전용 — lib/utils/execution-status.ts 의 동명 상수와 값 집합이 달라 export 하지 않는다")이 이를 의도적으로 설명하고 있어 기능 문제는 없으나, plan 문서의 산출 목록과 실제 구현이 일치하지 않아 추후 유지보수자가 혼동할 수 있다.
- 제안: plan 문서의 산출 목록에서 `STATUS_BADGE_VARIANT` 항목을 제거하거나 "page 내 유지(의도적)" 라는 주석을 plan 에 추가.

---

### **[INFO]** `auth-config-form-fields.tsx` 의 `textarea` 가 Tailwind 인라인 className 으로 직접 스타일링 — UI 컴포넌트 패턴 비일관
- 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` 라인 1282
- 상세: `textarea` 가 프로젝트의 `Input` 컴포넌트 패턴을 따르지 않고 `className` 을 직접 지정한다. `focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]` 같은 focus 스타일이 `Input` 컴포넌트의 방식과 다를 수 있으며, 디자인 시스템 변경 시 이 `textarea` 만 누락될 위험이 있다.
- 제안: `Textarea` UI 컴포넌트가 없다면 `Input` 과 동일한 스타일 패턴을 가진 `Textarea` 컴포넌트를 추출해 일관성 확보.

---

### **[INFO]** `min-h-[72px]` arbitrary value — 선택 근거 미기술
- 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` 라인 1282
- 상세: `min-h-[72px]` 는 임의로 선택된 높이 값이다. IP whitelist 가 "2줄 이상을 권장한다"는 UX 의도라면 주석 또는 Tailwind config 에 named value 로 표현하는 것이 의도를 명확히 한다.
- 제안: 주석으로 선택 근거 명시(`/* 3 lines at 1.5rem line-height + py-2 */` 등) 또는 Tailwind config 에 semantic key 추가.

---

## 요약

이번 변경은 `page.tsx` 의 God Component 에서 폼 상태·검증(`useAuthConfigForm`), 생성 다이얼로그(`AuthConfigCreateForm`), 편집 다이얼로그(`AuthConfigEditDialog`), 공유 입력 필드(`AuthConfigFormFields`), 공유 타입·헬퍼(`auth-config-types.ts`) 를 분리한 명확한 구조 개선이다. `dialogMode === "edit"` 분기 4곳 제거와 `useState` 11개 통합은 가독성과 단일 책임 원칙 측면에서 실질적인 유지보수성 향상을 가져온다. 네이밍은 일관되고 의도가 명확하며, 파일별 JSDoc 설명도 충분하다. 주요 유지보수성 위험은 두 다이얼로그 컴포넌트(및 page.tsx 내 확인 모달 4개)가 동일한 오버레이·카드 DOM 구조를 중복 작성하는 점이며(WARNING 2건), 향후 세 번째 다이얼로그 추가 시 동일 패턴이 복사될 위험이 있다. 공통 `DialogShell` 추출이 이 PR 이후 가장 우선순위 높은 유지보수성 개선 과제다. 전반적인 코드 복잡도·중첩 깊이는 양호하며, 회귀 가드 테스트 16건 추가로 리팩토링 신뢰성도 충분히 확보되어 있다.

## 위험도

LOW
