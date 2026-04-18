### 발견사항

- **[WARNING]** `t` 함수가 `useEffect` 의존성 배열에 포함되어 API 재호출 가능
  - 위치: `verify-email-content.tsx:56` (`[token, router, t]`), `accept-invitation-content.tsx:58` (`[token, router, setWorkspaces, switchWorkspace, t]`)
  - 상세: `useT()`가 반환하는 `t`는 locale이 변경될 때마다 새 함수 참조를 생성한다(`useCallback([locale])`). 이 `t`를 일회성 작업(이메일 인증, 초대 수락)의 `useEffect` 의존성 배열에 넣으면, locale 변경 시 `verify()` / `accept()` 가 재실행되어 중복 API 호출이 발생한다.
  - 제안: 일회성 비동기 작업의 effect에서는 `t`를 의존성에서 제거하거나, `useEffectEvent`(React 19) 또는 ref 패턴(`const tRef = useRef(t)`)으로 최신 `t`를 캡처하되 재실행은 막는다.

- **[WARNING]** JSX 내 `formatDuration` / `timeAgo` 호출 시 locale 구독 없이 `getState()` 사용
  - 위치: `date.ts:10-12` (`currentLocale()` → `useLocaleStore.getState()`), `dashboard/page.tsx` 등에서 JSX 내 직접 호출
  - 상세: `useLocaleStore.getState()`는 Zustand 스토어를 구독하지 않는 일회성 스냅샷 읽기다. 해당 컴포넌트가 `useT()`나 `useLocale()`을 통해 locale을 구독하지 않으면, locale 변경 후에도 컴포넌트가 리렌더링되지 않아 날짜/기간 포맷이 구 locale 값으로 유지된다(tearing).
  - 제안: `timeAgo`, `formatDuration`을 JSX에서 직접 호출하는 컴포넌트는 `useLocale()`을 통해 locale을 구독하고 명시적 `locale` 인자로 전달하거나, 컴포넌트 내에서 locale 인자를 받는 함수를 wrapping하는 hook을 제공한다.

- **[INFO]** 언어 드롭다운 `onChange`에서 store를 즉시 업데이트 — 저장 전 locale 선반영
  - 위치: `profile/page.tsx` - 언어 select `onChange`
  - 상세: `setLocaleStore(next)`가 `onChange` 시점에 호출되므로 저장 버튼 클릭 전에 UI 전체가 새 locale로 전환된다. 저장 실패 시 서버 locale과 UI locale이 불일치하며, `LocaleSync`는 실패 후 revert를 수행하지 않는다.
  - 제안: locale store 업데이트를 저장 성공 callback으로 이동시키거나, 실패 시 이전 locale로 rollback하는 로직을 추가한다.

- **[INFO]** Zod 스키마가 컴포넌트 body 내에서 매 렌더마다 재생성됨
  - 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`
  - 상세: 스키마가 `useForm` resolver로 넘겨지는데, locale 변경 시 스키마 인스턴스가 교체되어 `react-hook-form` 내부가 stale resolver를 참조할 수 있다. 비동기 submit 진행 중 locale이 변경되면 검증 메시지가 혼재될 수 있다.
  - 제안: `useMemo(() => buildSchema(t), [t])`로 메모이제이션하거나, locale 변경 시 `reset()`을 호출해 폼을 재초기화한다.

---

### 요약

변경사항은 i18n 도입으로 직접적인 멀티스레드 동시성 문제는 없으나, JavaScript 단일 스레드 환경에서도 발생 가능한 두 가지 실질적 결함이 존재한다. 첫째, `useT()`가 반환하는 `t`를 일회성 비동기 작업의 `useEffect` 의존성으로 사용하면 locale 변경 시 API 중복 호출이 발생한다. 둘째, `useLocaleStore.getState()`를 구독 없이 JSX 렌더 경로에서 호출하면 locale 변경 후 날짜/기간 포맷이 갱신되지 않는 stale 렌더링이 생긴다. 나머지 사항들은 UX 일관성과 성능 관련 INFO 수준이다.

### 위험도
**MEDIUM**