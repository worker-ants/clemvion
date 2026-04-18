## 아키텍처 코드 리뷰 — i18n 도입

### 발견사항

---

- **[WARNING]** Zod 스키마를 컴포넌트 내부에서 정의하여 `useForm` 리졸버가 언어 변경에 반응하지 않음
  - 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`
  - 상세: `const forgotPasswordSchema = z.object(...)` 가 render 함수 내부에 정의됨. `useForm({ resolver: zodResolver(forgotPasswordSchema) })`는 초기화 시 리졸버를 캡처하므로 이후 locale이 변경되어도 검증 메시지가 업데이트되지 않음 (폼이 언마운트/재마운트되기 전까지). 또한 매 렌더마다 스키마 객체가 재생성됨.
  - 제안: `useMemo`로 감싸거나, 에러 메시지를 zod 수준이 아닌 `formState.errors` 렌더 시점에 `t()`로 해석하도록 분리. 가장 단순한 패턴은 `useMemo(() => buildSchema(t), [t])`

---

- **[WARNING]** `"use client"` 지시어가 `index.ts` 전체에 적용되어 순수 함수인 `translate()`의 SSR 사용 불가
  - 위치: `src/lib/i18n/index.ts:1`
  - 상세: `translate()`, `TranslationKey`, `TFunction` 등은 React 의존성이 없는 순수 코드인데 `"use client"`로 묶여 Server Component에서 직접 사용 불가. 현재 모든 페이지가 Client Component라면 문제는 없지만, 향후 RSC 도입 시 장벽이 됨.
  - 제안: `index.ts`를 두 개로 분리 — `core.ts`(순수 `translate`, 타입들, `"use client"` 없음)와 `hooks.ts`(`"use client"` + `useT`, `useLocale`). `index.ts`에서 re-export.

---

- **[WARNING]** `Section` 컴포넌트가 `t: TFunction` prop을 받지만 `void t`로 즉시 무시 — 불완전한 리팩토링
  - 위치: `src/app/(main)/integrations/page.tsx:371`
  - 상세: `t` prop이 타입에 추가되고 호출부에서도 전달되지만 내부에서 `void t`로 버려짐. Section 내 하드코딩 문자열이 남아있을 가능성이 높으며, prop 자체가 불필요한 API 오염임.
  - 제안: `Section` 내부에서 `useT()`를 직접 호출하거나, 번역이 불필요하면 `t` prop 제거.

---

- **[WARNING]** `date.ts` 유틸리티가 `locale-store`에 직접 의존하여 계층 결합 발생
  - 위치: `src/lib/utils/date.ts:1-5`
  - 상세: 유틸리티 레이어가 Zustand store(클라이언트 상태 관리 레이어)에 의존. `currentLocale()`은 `useLocaleStore.getState()`를 사용하므로 런타임에는 동작하지만, 테스트 격리성이 낮아지고 계층 방향이 역전됨 (util → store). `locale-store.ts`가 `"use client"`이므로 번들러 설정에 따라 SSR 환경에서 문제가 될 수 있음.
  - 제안: `currentLocale()` 헬퍼를 제거하고 locale 인자를 항상 필수로 받거나, 호출부(`timeAgo`, `formatDuration`, `formatDate`)에서 `useLocale()`훅을 통해 locale을 받아 내려보내는 구조로 전환. 이미 `locale?: Locale` 선택 인자가 있으므로 기본값 로직만 삭제하면 됨.

---

- **[WARNING]** locale 변경 코드 경로가 두 곳으로 분산 — 응집도 저하
  - 위치: `profile/page.tsx:125-128` (직접 `setLocaleStore` 호출), `locale-sync.tsx` (auth 상태 동기화)
  - 상세: locale 설정 책임이 `ProfilePage`와 `LocaleSync` 두 곳에 분산. 특히 `ProfilePage`에서 `onChange`(즉시 반영) + `onSave`(서버 저장 후 반영)의 두 경로로 locale 변경이 이루어져 일관성 추론이 어려움.
  - 제안: locale 변경은 서버 저장 성공 후 한 번만 반영하거나, 반대로 낙관적 업데이트 전략을 명시적으로 문서화.

---

- **[INFO]** `register-form.tsx`의 terms 링크 인터폴레이션에 null byte 센티넬(`\u0000`) 사용 — 취약한 패턴
  - 위치: `register-form.tsx:197-230`
  - 상세: 번역 문자열에 `\u0000TERMS\u0000` 센티넬을 심어 split하는 방식은 창의적이나 번역가가 실수로 null byte를 포함시킬 경우 파싱이 깨짐. 또한 로직이 장황함.
  - 제안: `Trans` 컴포넌트 패턴(또는 render prop) 사용. 간단하게는 `"auth.register.termsAgree"` 번역을 `"I agree to the {terms} and {privacy}"` 형태로 두고 `{terms}`, `{privacy}` 슬롯에 JSX를 주입하는 작은 유틸 함수 작성.

---

- **[INFO]** `STATUS_FILTERS`에서 `"all"` 값이 `"integrations.scopeAll"` 키를 재사용 — 의미 불일치
  - 위치: `src/app/(main)/integrations/page.tsx:31-37`
  - 상세: Status 필터의 "All" 옵션이 Scope 필터용 키 `integrations.scopeAll`을 공유. 현재는 번역 내용이 동일하더라도 별도 키로 분리해야 향후 텍스트가 달라질 때 안전.
  - 제안: `"integrations.statusAll"` 키 추가.

---

### 요약

전반적으로 i18n 인프라 설계(`translate()`, `useT()`, `TranslationKey` 타입 추론, `LocaleSync`)는 응집도가 높고 타입 안전성을 잘 갖추고 있다. 그러나 **Zod 스키마를 컴포넌트 내부에 정의한 것은 검증 메시지 반응성 버그를 내포**하고 있어 반드시 수정이 필요하다. `"use client"` 경계 설정 미흡으로 `translate()` 순수 함수가 RSC에서 사용 불가한 점과, `date.ts`가 store에 직접 의존하는 계층 역전도 개선이 필요하다. `Section` 컴포넌트의 `void t`는 불완전한 리팩토링 흔적으로 즉시 정리되어야 한다.

### 위험도

**MEDIUM**