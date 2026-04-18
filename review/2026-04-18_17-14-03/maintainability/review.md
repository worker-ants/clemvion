### 발견사항

- **[CRITICAL]** `Section` 컴포넌트에 미사용 `t` prop 존재
  - 위치: `integrations/page.tsx` — `Section` 함수 내부 `void t;`
  - 상세: `t: TFunction` prop이 컴포넌트 시그니처에 선언되고 호출부에서 전달되지만, 함수 내부에서 `void t;`로 묵살됩니다. 이는 미완성 작업의 잔재로, 외부 API를 오염시키고 컴파일러 경고를 우회하는 방식입니다.
  - 제안: `Section` 내부에서 실제로 `t`를 사용하거나, prop을 제거하고 `Section` 내에서 직접 `useT()`를 호출하세요.

- **[WARNING]** Zod 스키마가 컴포넌트 렌더마다 재생성됨
  - 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` — 각 컴포넌트 body 내 `z.object(...)` 정의
  - 상세: `t`를 통한 번역 메시지를 사용하기 위해 스키마를 컴포넌트 내부로 이동했으나, 매 렌더마다 새 객체가 생성됩니다. `useForm`의 `resolver`는 초기화 시 한 번만 캡처되므로, 로케일 변경 시 유효성 검사 메시지가 갱신되지 않는 문제도 잠재적으로 존재합니다.
  - 제안: `useMemo(() => buildSchema(t), [t])`로 메모이제이션하세요.

- **[WARNING]** `t`가 `useEffect` 의존성 배열에 포함되어 API 재호출 유발 가능
  - 위치: `verify-email-content.tsx:56` — `}, [token, router, t]`, `accept-invitation-content.tsx:55` — `}, [token, router, setWorkspaces, switchWorkspace, t]`
  - 상세: `useT()`는 로케일이 바뀔 때마다 새 함수 참조를 반환합니다. 이 함수가 의존성에 포함되면 사용자가 언어를 변경하는 순간 이메일 인증·초대 수락 API가 재호출됩니다.
  - 제안: `t`를 의존성에서 제거하고, 효과 내부에서 사용하는 번역 값을 `useRef`나 효과 시작 시점에 캡처하거나, 오류 메시지 설정을 효과 외부에서 처리하세요.

- **[WARNING]** `STATUS_FILTERS`에서 키 재사용으로 인한 의미 혼동
  - 위치: `integrations/page.tsx:21` — `{ value: "all", labelKey: "integrations.scopeAll" }`
  - 상세: 상태 필터의 "All" 옵션이 범위 필터용 키인 `"integrations.scopeAll"`을 재사용합니다. 두 "All"의 번역이 현재는 동일하더라도, 향후 다르게 변경될 경우 두 UI가 함께 깨집니다.
  - 제안: `"integrations.statusAll"` 같은 별도 키를 사용하세요.

- **[WARNING]** 약관/개인정보처리방침 링크 렌더링에 IIFE + null 문자 플레이스홀더 사용
  - 위치: `register-form.tsx` — `termsAgreeHtml` 처리 블록 (~35줄 IIFE)
  - 상세: `\u0000TERMS\u0000` 같은 null 문자를 플레이스홀더로 사용하고, 이를 파싱하는 IIFE를 인라인으로 작성하는 것은 매우 비관용적인 패턴입니다. 복잡도가 높고 읽기 어려우며, 향후 번역 키 구조 변경 시 파싱 로직도 함께 수정해야 합니다.
  - 제안: `<TermsAgreement t={t} />` 같은 별도 컴포넌트로 추출하거나, `termsText`, `andText`, `privacyText` 등 3개의 분리된 키로 단순화하세요.

- **[INFO]** SSR 스냅샷이 `"ko"`로 하드코딩되어 hydration 불일치 가능
  - 위치: `i18n/index.ts` — `useT()` 내 `useSyncExternalStore` 세 번째 인자
  - 상세: `getServerSnapshot`이 항상 `"ko"`를 반환하므로, 영어를 선택한 사용자의 경우 서버 렌더 결과(한국어)와 클라이언트 결과(영어)가 달라 hydration mismatch가 발생할 수 있습니다.
  - 제안: 로케일을 쿠키나 헤더를 통해 서버에서 읽어 `getServerSnapshot`에 전달하거나, 초기 렌더를 항상 기본 로케일로 통일하고 `useEffect`에서 전환하는 구조를 명시적으로 문서화하세요.

---

### 요약

전반적인 i18n 설계(타입 안전 키, `translate()` + `useT()` 분리, zustand 기반 locale store)는 견고하고 일관성이 있습니다. 그러나 몇 가지 실질적인 유지보수성 문제가 있습니다: `Section` 컴포넌트에 실제로 사용되지 않는 `t` prop이 잔류하고, Zod 스키마가 매 렌더마다 재생성되며, `t`의 `useEffect` 의존성 등록이 의도치 않은 API 재호출을 유발할 수 있고, 약관 링크 처리를 위한 IIFE 패턴은 불필요하게 복잡합니다. 이 중 `Section`의 `void t`와 `useEffect` 의존성 문제는 기능 결함으로 이어질 수 있으므로 우선 처리가 필요합니다.

### 위험도
**MEDIUM**