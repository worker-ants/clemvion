---

## 발견사항

### **[CRITICAL]** `t` 함수가 `useEffect` 의존성 배열에 포함되어 API 중복 호출 발생

- **위치**: `verify-email-content.tsx:57`, `accept-invitation-content.tsx:58`
- **상세**: `useT()`는 locale이 변경될 때마다 새 함수 참조를 반환한다(`useCallback([locale])`). `t`를 `useEffect` deps에 추가하면, 사용자가 이메일 인증 또는 초대 수락 페이지에 머무는 중 locale이 바뀔 경우 verify/accept API가 재호출된다. 초대 수락의 경우 `switchWorkspace`까지 재실행된다.
- **제안**: 로케일 의존 번역 함수를 useEffect deps에 넣지 말 것. `t` 제거 후, 에러 메시지 번역은 `translate(currentLocale(), ...)` 형태로 호출 시점에 처리하거나, `useRef`로 `t`를 캡처

---

### **[WARNING]** `date.ts` 유틸리티 함수가 전역 Zustand 상태에 암묵적으로 의존

- **위치**: `date.ts:11-13`, `timeAgo`, `formatDate`, `formatDuration`
- **상세**: `currentLocale()`이 `useLocaleStore.getState()`를 직접 읽어 함수 출력이 전역 상태에 달라진다. 순수 유틸리티였던 함수가 이제 앱 전역 상태의 부작용을 가진다. 또한 `date.ts`는 `"use client"` 선언이 없지만 `"use client"` 모듈(`locale-store.ts`, `i18n/index.ts`)을 임포트하여, Server Component에서 `timeAgo`/`formatDate`를 사용하면 런타임 오류가 발생할 수 있다. `statistics/page.tsx:130`에는 아직 로컬 `formatDuration` 함수가 남아 있어 동작이 불일치한다.
- **제안**: `date.ts`에 `"use client"`를 추가하거나, `translate`/`useLocaleStore` 의존성을 분리해 서버/클라이언트 양쪽에서 사용 가능하게 유지

---

### **[WARNING]** Zod 스키마가 컴포넌트 내부에서 매 렌더마다 재생성됨

- **위치**: `login-form.tsx:41`, `register-form.tsx:54`, `forgot-password-form.tsx:31`, `reset-password-form.tsx:51`
- **상세**: `loginSchema`, `registerSchema` 등이 컴포넌트 함수 본문에서 정의되어 매 렌더마다 새 객체가 생성된다. `react-hook-form`의 `useForm`은 `resolver`를 초기 마운트 시점에만 읽어 내부 ref에 저장하므로, 이후 locale이 변경되어도 유효성 검사 오류 메시지가 갱신되지 않는다. 또한 `type RegisterFormValues = z.infer<typeof registerSchema>`를 컴포넌트 내부에 정의하는 것은 TypeScript 타입이 런타임 스코프에 불필요하게 존재하는 패턴이다.
- **제안**: 스키마를 컴포넌트 외부의 팩토리 함수로 추출: `function buildLoginSchema(t: TFunction) { return z.object({...}) }` 후 `useMemo(() => buildLoginSchema(t), [t])`로 메모이제이션. 단, `useForm`의 `resolver`는 마운트 후 변경되지 않으므로, locale 변경 시 validation 메시지 업데이트가 필요하다면 `useForm`을 `key={locale}`로 리마운트하는 방안 검토 필요

---

### **[WARNING]** `Section` 컴포넌트가 `t: TFunction` prop을 받지만 사용하지 않음

- **위치**: `integrations/page.tsx:368-382`
- **상세**: `Section`에 `t` prop이 추가되고 시그니처가 변경되었지만, 내부에서 `void t`로만 참조를 소비하고 실제 번역에 사용되지 않는다. 불필요한 공개 인터페이스 변경이다.
- **제안**: `t` prop 제거. 미래에 사용이 필요하다면 그 시점에 추가

---

### **[WARNING]** `register-form.tsx`의 React 링크 삽입 방식이 취약함

- **위치**: `register-form.tsx:189-229`
- **상세**: 번역 문자열에 null byte(`\u0000TERMS\u0000`, `\u0000PRIVACY\u0000`)를 sentinel로 주입한 뒤 분리하는 방식이 적용됐다. `parts = template.split(...)` 결과가 3개 요소를 가정하지만, 번역 담당자가 플레이스홀더를 하나만 쓰거나 생략하면 `parts[2]`가 `undefined`가 되어 오동작한다. 또한 `termsFirst` 판단 로직이 복잡해 번역 순서 변경 시 링크 대상이 뒤바뀔 수 있다.
- **제안**: `Trans` 컴포넌트 패턴 도입 또는 별도 번역 키로 분리(`termsOfServiceLink`, `privacyPolicyLink`) 후 간단한 JSX로 조합

---

### **[WARNING]** `i18n/index.ts`의 `"use client"` 선언이 `translate()` 순수 함수의 서버 사용을 차단

- **위치**: `i18n/index.ts:1`
- **상세**: `translate()`는 dict 조회만 하는 순수 함수이지만, 모듈 상단의 `"use client"` 선언 때문에 React Server Component에서 import 불가능하다. 서버에서 번역이 필요한 경우(예: 메타데이터 생성) 사용할 수 없다.
- **제안**: `translate()`, `TranslationKey`, `TFunction` 타입 등 클라이언트 훅에 의존하지 않는 코드를 별도 `core.ts`(no `"use client"`)로 분리

---

### **[INFO]** `profile/page.tsx`에서 locale이 3곳에서 중복 설정됨

- **위치**: `profile/page.tsx:289-296` (onChange), `profile/page.tsx:125-127` (handleSave), `profile/page.tsx:62-64` (useEffect)
- **상세**: language select onChange 시점에 `setLocaleStore`가 즉시 호출되어 저장 전에 UI 언어가 바뀐다. 저장을 취소해도 locale 상태는 이미 변경된 채로 남는다(다음 페이지 로드 전까지 LocaleSync가 복원하지 않는 한).
- **제안**: onChange에서는 local state(`setLanguage`)만 업데이트하고 `setLocaleStore`는 저장 성공 후에만 호출

---

### **[INFO]** `STATUS_FILTERS`의 첫 번째 항목이 scope용 translation key를 재사용

- **위치**: `integrations/page.tsx:29`
- **상세**: `{ value: "all", labelKey: "integrations.scopeAll" }`로 status filter의 "전체"가 scope filter의 "전체" 키를 공유한다. 현재는 동일 문자열이지만, 향후 두 컨텍스트의 번역이 달라지면 오역이 발생한다.
- **제안**: `"integrations.statusAll"` 등 별도 키 사용

---

## 요약

이번 i18n 변경의 핵심 부작용 위험은 두 곳에 집중된다. 첫째, `verify-email`과 `accept-invitation`의 `useEffect` 의존성에 `t`가 포함되어 locale 변경 시 API가 재호출될 수 있다(CRITICAL). 둘째, `date.ts`가 전역 Zustand 상태에 암묵적으로 의존하게 되어 순수 유틸리티의 예측 가능성이 깨지고 Server Component 호환성도 손상됐다. 인증 폼의 Zod 스키마 인라인 정의는 RHF의 resolver 캐싱 특성상 locale 변경 후 validation 메시지가 갱신되지 않는 버그를 내포한다.

## 위험도

**HIGH**