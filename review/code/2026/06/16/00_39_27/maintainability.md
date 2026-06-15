# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] AUTH_TYPES와 TYPE_LABEL_KEYS 사이의 중복 데이터
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` 라인 1525-1537
- 상세: `AUTH_TYPES` 배열과 `TYPE_LABEL_KEYS` 맵이 동일한 4개의 type-to-labelKey 매핑을 중복으로 정의한다. `AUTH_TYPES`에서 `TYPE_LABEL_KEYS`를 파생시킬 수 있음에도 별개로 유지한다. 신규 인증 타입 추가 시 두 곳을 모두 수정해야 해 누락 오류 가능성이 있다.
- 제안: `AUTH_TYPES`에서 파생: `export const TYPE_LABEL_KEYS = Object.fromEntries(AUTH_TYPES.map(t => [t.value, t.labelKey])) as Record<string, TranslationKey>;`

### [WARNING] 다이얼로그 셸 JSX 중복 — AuthConfigCreateForm vs AuthConfigEditDialog
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` 라인 813-826, `codebase/frontend/src/app/(main)/authentication/auth-config-edit-dialog.tsx` 라인 1009-1022
- 상세: `fixed inset-0 z-50 flex items-center justify-center bg-black/50` 외부 오버레이와 `w-full max-w-md rounded-lg border ... p-6 shadow-lg` 내부 카드, 헤더 `flex items-center justify-between` 구조, X 닫기 버튼이 두 파일에 동일하게 복붙되어 있다. page.tsx에 남아있는 Regenerate/Reveal/Delete 확인 모달도 같은 패턴을 사용한다. 총 5개의 동일한 모달 셸이 코드베이스에 존재한다.
- 제안: `DialogShell` 또는 `ModalOverlay` 공용 컴포넌트를 추출해 title과 onClose, children을 props로 받게 한다. 이미 `SlideDrawer` 같은 UI 컴포넌트가 존재하는 패턴과 일치한다.

### [WARNING] useAuthConfigForm 훅의 close() 함수가 10개 상태를 개별 setter로 초기화
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` 라인 2991-3003
- 상세: `close()` 함수가 각 필드를 개별 `setState` 호출로 초기화한다(10개 호출). 새 필드가 추가될 때 `close()`와 초기 `useState` 두 곳을 모두 수정해야 하며, 하나를 빠뜨리면 stale state 버그가 발생한다. 훅 자체 주석도 이 위험을 인식하고 있다("필드 추가 시 한 곳만 수정하면 된다"는 `collectFormState` 주석이 있지만 `close`는 별개다).
- 제안: 초기값을 상수 객체로 정의하고 `useReducer`로 전환하거나, 초기값 상수를 추출해 `useState`에서도 `close()`에서도 동일 상수를 참조하도록 한다.

### [INFO] useAuthConfigForm 인터페이스가 setter를 직접 노출 — 캡슐화 약화
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` 라인 2943-2959 (UseAuthConfigForm 인터페이스)
- 상세: 훅이 `setName`, `setType`, `setHmacHeader` 등 내부 state setter 14개를 직접 공개 인터페이스로 노출한다. 이로 인해 소비자 컴포넌트가 훅 내부 상태 구조에 직접 의존하게 되어, 훅 내부 구현 변경 시 모든 소비자를 함께 수정해야 한다.
- 제안: 단기적으로는 현 구조 유지가 현실적이나, 향후 setter를 번들 업데이트 함수(`updateField(key, value)` 또는 `setFormFields({...})`)로 추상화하는 것을 고려한다.

### [INFO] auth-config-form-fields.tsx의 select 엘리먼트에 하드코딩된 Tailwind 클래스 문자열 중복
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` 라인 1177, 1220, 1387 (auth-type select, hmac-algorithm select)
- 상세: `select` 엘리먼트에 `"flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"` 같은 동일한 Tailwind 클래스 문자열이 type select와 hmac-algorithm select에 중복 하드코딩되어 있다. 코드베이스의 `Input` 컴포넌트처럼 추상화되어 있지 않다.
- 제안: `Select` UI 컴포넌트를 추출하거나(`/components/ui/select.tsx` 패턴 적용), 최소한 공통 클래스 문자열을 상수로 추출한다.

### [INFO] use-auth-config-form.test.tsx 내 단일 it 블록에서 두 시나리오 검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx` 라인 542-566 (validateAndProceed enforces basic_auth password...)
- 상세: 하나의 `it` 블록 안에서 "create 흐름(requirePassword) 차단"과 "edit 흐름(requirePassword 미설정) 통과"를 순차적으로 검증한다. 테스트 실패 시 어떤 시나리오가 실패했는지 즉시 파악하기 어렵다. 또한 `onValid.mockClear()` + `toastError.mockClear()` 수동 리셋이 필요해 테스트 상태 관리가 복잡해진다.
- 제안: 두 시나리오를 별도 `it` 블록으로 분리한다.

### [INFO] page.tsx에 남아있는 인라인 모달 JSX — 부분적 추출의 일관성 문제
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 2434-2569 (Regenerate/Reveal/Delete 확인 모달)
- 상세: Create/Edit 다이얼로그는 별도 컴포넌트로 추출했지만, Regenerate 확인, Reveal 비밀번호 입력, Revealed Secret 표시, Delete 확인 모달 4개는 여전히 page.tsx 인라인에 남아있다. 이로 인해 page.tsx는 여전히 621줄이며, 추출 기준이 일관성 있게 적용되지 않았다. 현재 상태는 "일부는 추출, 일부는 인라인"이라는 혼재된 패턴을 만든다.
- 제안: 이번 PR의 범위 결정(계획 문서의 "회귀 위험 대비 scope 분리")을 이해하나, 향후 후속 PR에서 나머지 4개 확인 모달도 동일 패턴으로 추출하는 것을 권장한다.

## 요약

이번 변경은 `authentication/page.tsx`의 God Component를 `useAuthConfigForm` 훅, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `auth-config-types.ts` 5개로 분리한 구조 리팩토링이다. 코드의 가독성과 단일 책임 원칙 적용이 명확히 개선되었으며, `dialogMode === "edit"` 분산 분기 제거와 커스텀 훅 통합은 올바른 방향이다. 다만 `AUTH_TYPES`와 `TYPE_LABEL_KEYS`의 동일 데이터 중복 정의, Create/Edit 다이얼로그 셸의 구조적 JSX 중복(추가로 page.tsx의 4개 모달까지 포함하면 총 5중 복붙), `close()` 함수의 다중 setter 패턴은 신규 인증 타입 추가 등 확장 시 유지보수 부담을 높인다. `select` 엘리먼트의 Tailwind 클래스 문자열 중복도 `Input` 컴포넌트와 패턴 불일치를 만든다. 전체적으로 이전 상태 대비 명확한 개선이며 CRITICAL 수준의 문제는 없으나, 데이터 중복(AUTH_TYPES/TYPE_LABEL_KEYS)과 다이얼로그 셸 중복은 후속 PR에서 정리하는 것을 권장한다.

## 위험도
LOW
