# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `openCreate()` 가 폼 초기화 없이 모드만 전환함
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` — `openCreate()` (line 254-256)
- 상세: `close()` 는 모든 필드를 초기화하고 `mode = null` 로 전환하지만, `openCreate()` 는 `setMode("create")` 만 호출한다. 사용자가 편집(openEdit) 흐름에서 다이얼로그를 닫지 않고 esc·overlay 클릭 없이 다른 경로로 create 를 열 수 있다면, 이전 편집 세션의 name/type/ip 등이 create 폼에 남는다. 현재 UI 상에서는 create 버튼 클릭 전에 edit 다이얼로그가 항상 `form.close()` 를 거치므로 실제 경로는 문제 없음. 그러나 `openCreate()` 의 계약이 "현재 폼이 비어있다" 라는 불변식을 스스로 보장하지 않아 향후 직접 호출 시 잔류 상태 부작용이 발생할 수 있다.
- 제안: `openCreate()` 내부에서 필드를 초기화(또는 `close()` 를 먼저 호출)한 뒤 `setMode("create")` 를 호출해 호출 순서 불문 안전성 확보. 코멘트에도 "항상 close 후 호출되는 것을 전제로 한다"는 명시 보강.

### [INFO] `regenerateMutation.onSuccess` 에서 `form.setGeneratedKey` 가 `mode=null` 상태에서도 호출됨
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `regenerateMutation.onSuccess` (line 1590)
- 상세: `regenerateMutation` 은 create/edit 다이얼로그 없이 별도 Regenerate 확인 모달에서 실행된다. `form.setGeneratedKey(secret)` 이 호출되면 `form.mode === null` (다이얼로그 닫힌 상태) 임에도 `generatedKey` 가 null 이 아닌 값이 된다. 현재 JSX 에서 `generatedKey` 는 `AuthConfigCreateForm` 내부에서만 읽히고 `form.mode === "create"` 일 때만 해당 컴포넌트가 렌더링되므로 화면에 불필요한 UI 가 노출되지는 않는다. 그러나 `form` 상태에 `mode=null, generatedKey!=null` 이라는 비일관 상태가 존재할 수 있다. 이전 god-component 에서도 동일 패턴이었으므로 동작 회귀는 없음.
- 제안: regenerate 성공 시 별도 표시 경로(예: 독립 `regeneratedKey` state 사용)로 분리하거나, `setGeneratedKey` 에 `mode === "create"` guard 를 추가해 의도를 명확히.

### [INFO] `AUTH_TYPES`, `TYPE_LABEL_KEYS`, `STATUS_BADGE_VARIANT` 상수가 모듈 레벨 전역 `export const` 로 이동됨
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` — 전체 파일
- 상세: 이전엔 `page.tsx` 스코프 내 지역 `const` 였으나 이번에 모듈 최상위 `export const` 로 이동했다. 의도된 변경이며 순수 읽기 전용 상수이나, `Object.freeze` 없이 내보내지므로 TypeScript 타입 레벨에서만 불변이 강제된다. Next.js 번들링 구조에서 동일 모듈 인스턴스를 공유하므로 이론상 런타임 돌연변이 가능. 실질 위험도는 낮음.
- 제안: 필요 시 `Object.freeze(AUTH_TYPES)` 등 적용. codebase 기존 스타일상 강제 사항은 아님.

### [INFO] `useAuthConfigForm` hook 내부에서 `toast.error` 를 직접 발생시킴
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` — `validateAndProceed()` 내부
- 상세: custom hook 이 `toast.error(...)` 를 직접 발생시켜 UI 사이드 이펙트(알림 표시)를 hook 내부에서 수행한다. 이는 이전 `page.tsx` 의 `validateAndProceed` 와 동일한 동작이므로 회귀 없음. hook 이 순수 상태 관리 + validation 을 담당하고 toast 는 호출자가 담당하도록 책임을 분리하면 테스트 용이성이 향상된다.
- 제안: 현 단계에서는 기존 동작 보존이 목적이므로 accept. 이후 hook 을 단독 테스트할 때 `toast` mock 이 필요함을 인지.

## 요약

이번 변경은 `authentication/page.tsx` 의 인라인 form 상태 11개 + `dialogMode` 분기를 `useAuthConfigForm` 커스텀 훅으로 추출하고, create/edit UI 를 별도 컴포넌트(`AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`)로 분리한 순수 구조 리팩토링이다. 전역 변수 신규 도입은 없으며(모듈 레벨 `export const` 는 읽기 전용 상수의 이동), 파일시스템·네트워크·환경 변수·이벤트 발행 측면에서 의도하지 않은 부작용은 발견되지 않았다. `openCreate()` 가 필드를 독립적으로 초기화하지 않는 구조적 약점과 `regenerateMutation.onSuccess` 에서 `form.setGeneratedKey` 가 `mode=null` 상태에서도 호출되는 비일관 상태 가능성이 존재하나, 둘 다 이전 god-component 와 동작 등가이며 현재 UI 렌더링 경로에서 실질 오작동을 유발하지 않는다. 공개 API(`buildAuthConfigPayload`, `buildAuthConfigUpdatePayload` 등 기존 export) 시그니처는 변경되지 않았고, `page.tsx` 에서 삭제된 내부 함수(`resetForm`, `handleEditClick`, `collectFormState`, `validateAndProceed`)는 비공개 스코프였으므로 외부 호출자 영향 없음.

## 위험도

LOW
