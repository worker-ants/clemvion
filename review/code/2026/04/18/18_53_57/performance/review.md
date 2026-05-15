### 발견사항

- **[WARNING]** `useMemo([t])` Zod 스키마 재생성 위험
  - 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`의 `useMemo(() => z.object(...), [t])`
  - 상세: `t` 함수 레퍼런스가 렌더마다 새 객체로 생성되면 `useMemo`가 무효화되어 Zod 스키마가 매 렌더에 재생성됩니다. `react-hook-form`은 resolver가 바뀌면 내부 상태를 재초기화하므로, 입력 중 불필요한 re-validation이 유발될 수 있습니다.
  - 제안: `useT()`가 stable reference를 반환하는지 확인. 그렇지 않다면 `useCallback`으로 `t`를 안정화하거나 schema를 `useRef`에 저장하고 locale 변경 시에만 갱신.

- **[WARNING]** `key={locale}` 폼 전체 언마운트
  - 위치: `ForgotPasswordForm`, `ResetPasswordForm`, `LoginForm`, `RegisterForm`의 wrapper
  - 상세: locale 변경 시 전체 폼 컴포넌트 트리가 언마운트/리마운트됩니다. 진행 중인 입력 데이터 손실, DOM 재생성 비용, 포커스 리셋이 발생합니다.
  - 제안: 의도적 동작이라면 허용 가능. 그러나 locale 변경이 프로필 저장 후 즉시 적용된다면, 폼 페이지에서 locale을 바꾸는 시나리오에서 UX 손상 우려 — 적어도 locale 변경이 폼 페이지에서 발생할 수 없음을 확인 필요.

- **[INFO]** 다수 컴포넌트의 `useT()` 동시 구독
  - 위치: 변경된 40+ 컴포넌트 전체
  - 상세: locale store 변경 시 `useT()`를 구독하는 모든 컴포넌트가 동시에 re-render됩니다. React의 배치 처리로 단일 커밋으로 처리되지만, 컴포넌트 수가 많아 reconciliation 부하가 커질 수 있습니다.
  - 제안: Zustand의 `shallow` 비교 또는 selector 최적화가 이미 적용되어 있는지 확인. locale store에 구독자 수가 과도하게 늘어난다면 context API 대신 React Server Components 레이어에서 locale을 prop으로 내려보내는 방식 검토.

- **[INFO]** `summaryCards` 배열 메모이제이션 누락
  - 위치: `dashboard/page.tsx`, `summaryCards` 배열 선언부
  - 상세: `summary` 데이터 변경과 무관하게 모든 렌더에서 새 배열 객체가 생성됩니다. 현재 규모(4개 항목)에서는 무시 가능하나 `t(card.labelKey)` 호출이 배열 내에 포함되어 있어 각 렌더에서 4회 translation lookup이 발생합니다.
  - 제안: `useMemo(() => [...], [t, summary])` 적용 가능하나 현재 규모에서는 필수 아님.

- **[INFO]** `getPasswordStrength(password, t)` 미메모이제이션
  - 위치: `reset-password-form.tsx` 렌더 내 인라인 호출
  - 상세: 키입력마다 정규식 5회 실행. 경량 연산이므로 실질적 성능 영향은 없으나 `useMemo([password, t])`로 감쌀 수 있음.
  - 제안: 현재 규모에서 최적화 불필요.

---

### 요약

이번 변경은 하드코딩 문자열을 translation key 참조로 교체하는 i18n 적용 작업입니다. 성능 관점에서 가장 주목할 부분은 auth form들에서 Zod 스키마를 `useMemo([t])`로 감싸는 패턴인데, `t` 함수의 레퍼런스 안정성에 따라 `react-hook-form` resolver가 매 렌더마다 재생성될 수 있어 입력 경험에 영향을 줄 수 있습니다. `key={locale}` 폼 리마운트 전략은 locale 변경 시 schema 동기화를 위한 합리적 선택이지만 폼 상태 손실 비용을 수반합니다. 전반적인 위험도는 낮으며, `t` 함수 안정성 확인 한 가지가 핵심 검증 포인트입니다.

### 위험도
**LOW**