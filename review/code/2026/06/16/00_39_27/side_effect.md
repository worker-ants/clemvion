### 발견사항

**[INFO] 테스트 파일 — 부작용 없음 (파일 1, 2, 3)**
- 위치: `auth-config-types.test.ts`, `authentication-form.test.tsx`, `use-auth-config-form.test.tsx`
- 상세: 세 테스트 파일 모두 순수 단위/통합 테스트. `vi.mock`으로 `sonner`, `apiClient`, `role-gate`를 격리하고, `afterEach`에서 `cleanup()` + `useLocaleStore.setState({ locale: "en" })`로 Zustand 전역 스토어를 초기화해 테스트 간 오염을 방지한다. Vitest mock hoisting 패턴(`vi.hoisted`)을 올바르게 사용.
- 제안: 없음 (의도된 패턴).

**[INFO] `auth-config-types.ts` — 모듈 레벨 상수, 의도된 전역**
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts`, 전체
- 상세: `AUTH_TYPES`, `TYPE_LABEL_KEYS`, `STATUS_BADGE_VARIANT` 세 상수는 모듈 스코프 `const`로 선언되어 변경 불가한 읽기 전용 객체다. 이전에 `page.tsx` 내부에 `const`로 존재하던 것과 완전히 동일한 값이며, 이제 모듈 밖으로 이동했을 뿐 변경 자체는 없다. `pickPlaintextSecret`는 인자에 변이를 가하지 않는 순수 함수.
- 제안: 없음.

**[INFO] `auth-config-form-fields.tsx` — `Label` import 제거 주의점**
- 위치: `page.tsx` diff `- import { Label } from "@/components/ui/label"`
- 상세: `Label` 컴포넌트가 `page.tsx`에서 제거되고 `auth-config-form-fields.tsx`로 이동했다. 이것은 의도된 것으로, 실제 UI에 회귀는 없다. 다만 향후 `page.tsx` 내 다른 위치에 Label이 필요해질 경우 다시 import해야 한다는 점 이외에 부작용은 없다.
- 제안: 없음 (의도된 이동).

**[WARNING] `openCreate` — 폼 초기화 미수행으로 잔류 상태 노출 가능성**
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts`, `openCreate()` 함수
- 상세: `openCreate`는 `setMode("create")` 만 수행하고 필드를 초기화하지 않는다. 코드 주석 및 훅 JSDoc에 "close 가 초기화 담당"이라고 명시돼 있고, 사용 흐름상 다이얼로그를 닫지 않고 create를 다시 여는 경로가 현재는 없어 보인다. 그러나 미래에 `form.openCreate()`를 `close()` 없이 직접 호출하는 경우(예: 다이얼로그 외부에서 "New" 버튼을 더 추가하거나, regenerate 완료 후 create 모드로 전환하는 흐름 등), 이전 edit 세션의 `editTargetId`, `name`, `type`, 기타 필드가 잔류할 수 있다. 현재 `page.tsx`에서 `form.openCreate`는 버튼 onClick에만 연결되어 있고 그 시점에는 항상 mode === null이므로, 현재 구현에서는 실제 문제가 발생하지 않는다. 하지만 계약이 암묵적이라 신규 호출자에게 함정이 될 수 있다.
- 제안: `openCreate` 내부에서 필드를 초기화하거나, JSDoc에 "모드가 null 인 상태에서만 안전하게 호출 가능"임을 명시한다. 또는 `close()`를 먼저 호출한 후 mode를 set하도록 변경하는 방법이 가장 안전하다.

**[INFO] `use-auth-config-form.ts` — `type` 필드의 `as AuthConfigType` 강제 캐스팅**
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts`, `collectFormState()` 함수
- 상세: `type: type as AuthConfigType`은 `type`이 빈 문자열("")인 경우에도 `AuthConfigType`으로 캐스팅한다. 이것은 이전 `page.tsx`와 동일한 패턴이며, `validateAndProceed`의 `requireType` 가드로 보호되어 있다. 현재 사용처(`createMutation.mutationFn`, `updateMutation.mutationFn`)는 항상 `validateAndProceed` 이후에 호출되므로 실제 위험은 없다.
- 제안: 문서화로 충분. 현재 사용 패턴에서 실제 부작용 없음.

**[INFO] `regenerateMutation.onSuccess` — `form.setGeneratedKey` 호출 시 다이얼로그 미오픈**
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, `regenerateMutation.onSuccess`
- 상세: `if (secret) form.setGeneratedKey(secret)` 호출 시 `form.mode`가 null인 상태에서 generatedKey만 세팅된다. `AuthConfigCreateForm`은 `form.mode === "create"` 조건으로 렌더링되므로, generatedKey가 설정되더라도 다이얼로그가 열리지 않아 평문이 표시되지 않는다. 이것은 이전 코드와 동일한 동작(분리 전에도 showDialog가 false라 표시 안 됨)을 유지하는 것이다. 즉 분리 전후 동작이 동일한 기존 버그를 보존한다.
- 제안: 이 리팩토링의 범위 밖이며(기존 동작 유지 목적의 순수 구조 변경), 별도 이슈로 추적 권장.

**[INFO] `page.tsx` — `TranslationKey` import 제거**
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: `TranslationKey`는 이제 `auth-config-types.ts`와 `auth-config-form-fields.tsx`가 각자 import하므로 `page.tsx`에서 제거된 것이다. 타입만 제거되므로 런타임 부작용 없음.
- 제안: 없음.

---

### 요약

이 변경은 `authentication/page.tsx`의 God Component를 `useAuthConfigForm` 훅, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `auth-config-types.ts` 5개 파일로 순수 구조 분리한 리팩토링이다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 환경 변수 접근 없음, 외부 네트워크 호출 패턴 변경 없음, 공개 API 시그니처 변경 없음(내부 인터페이스 `UseAuthConfigForm`는 신규 추가). 동작은 이전 page.tsx와 bit-identical하게 유지된다. 유일한 주의 사항은 `openCreate()`가 필드를 초기화하지 않아 미래 호출자가 잔류 상태에 노출될 수 있는 암묵적 계약이며, 현재 사용처에서는 실제 문제가 없다. 테스트 파일의 Zustand 스토어 초기화 패턴도 올바르게 구성되어 있다.

### 위험도

LOW
