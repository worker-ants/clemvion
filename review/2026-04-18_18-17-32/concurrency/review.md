### 발견사항

---

- **[WARNING]** `LocaleSync`의 두 `useEffect`가 첫 렌더에서 연속 실행되어 이중 상태 업데이트 발생
  - 위치: `locale-sync.tsx:12-21`
  - 상세: 첫 번째 effect는 `initFromStorage()`로 localStorage 값을 store에 적용하고, 두 번째 effect는 `user?.locale`로 덮어쓴다. 인증된 사용자가 이미 store에 존재하는 상태로 마운트되면 두 effect가 같은 렌더 이후 순서대로 실행되어 Zustand 상태 업데이트가 두 번 발생한다. React 18 배치 처리로 실제 렌더 횟수는 1회로 줄어들 수 있으나, `setLocale` 내부의 `localStorage.setItem`과 `applyHtmlLang`이 각각 두 번 호출된다.
  - 제안: 두 소스(localStorage, user.locale)의 우선순위를 단일 effect 내에서 명시적으로 처리: `user?.locale`이 유효하면 user locale 적용, 아니면 localStorage 폴백. 또는 `initFromStorage`에서 user가 없을 때만 적용하도록 조건화.

---

- **[WARNING]** `setLocale`의 세 연산(Zustand set → localStorage write → DOM mutation)이 원자적이지 않음
  - 위치: `locale-store.ts:25-36`
  - 상세: `set({ locale })`는 즉시 Zustand 구독자에게 전파되어 컴포넌트 재렌더가 스케줄된다. 그러나 `localStorage.setItem`과 `document.documentElement.lang` 갱신은 그 이후에 실행된다. React 18 concurrent rendering 환경에서는 Zustand 상태가 갱신된 직후 새 locale로 렌더된 컴포넌트가 화면에 나타나는 시점과 `document.documentElement.lang` 갱신 시점 사이에 불일치 구간이 존재한다. 스크린리더나 lang-dependent CSS가 이 간극을 감지할 수 있다.
  - 제안: DOM 변경을 `queueMicrotask` 또는 `useEffect` 내부로 이동하거나, `set` callback 내에서 한 번의 동기 블록으로 처리해 순서를 명확히 한다.

---

- **[INFO]** `useSyncExternalStore`의 서버 스냅샷이 `"ko"`로 하드코딩되어 concurrent hydration mismatch 유발
  - 위치: `i18n/index.ts:19`
  - 상세: `useSyncExternalStore`의 세 번째 인수(`getServerSnapshot`)가 항상 `"ko"`를 반환한다. 영어를 선택한 사용자의 경우 서버 스냅샷("ko")과 클라이언트 스냅샷("en")이 달라 React가 hydration mismatch를 감지한다. `<html suppressHydrationWarning>`으로 `lang` 속성 경고는 억제되지만, `useT()`로 렌더된 번역 텍스트 자체는 억제되지 않아 React의 concurrent diffing 과정에서 불일치 경고가 남는다.
  - 제안: locale을 쿠키/헤더로 서버에 전달하거나, RESOLUTION.md에 기재된 대로 hydration 전략을 명시적으로 문서화.

---

- **[INFO]** `locale-sync.test.tsx`에서 `act()` 외부 상태 변경은 올바르게 처리되었으나, 두 effect가 동시 실행되는 시나리오 테스트 없음
  - 위치: `locale-sync.test.tsx:32-48`
  - 상세: 현재 테스트는 localStorage 초기화와 user locale 동기화를 개별적으로 검증한다. 그러나 "localStorage에 'en'이 저장된 상태에서 인증된 user(locale: 'ko')로 마운트" 시 최종 locale이 'ko'인지 확인하는 케이스가 없다. 두 effect의 실행 순서에 의존하는 동작이 회귀 없이 보장되지 않는다.
  - 제안: localStorage에 "en"을 설정한 상태에서 user.locale이 "ko"인 채로 렌더했을 때 최종 locale이 "ko"임을 검증하는 케이스 추가.

---

### 요약

이 변경사항은 단일 스레드 JavaScript 환경의 i18n 인프라로, 전통적 멀티스레드 동시성 문제(데드락, 레이스 컨디션)는 존재하지 않는다. 그러나 `LocaleSync`의 두 `useEffect`가 첫 렌더에서 연속 실행되며 locale을 두 번 덮어쓰는 이중 업데이트 패턴, `setLocale` 내 Zustand 상태 전파와 DOM 변경 사이의 비원자적 순서, `useSyncExternalStore`의 하드코딩된 서버 스냅샷으로 인한 React concurrent hydration 불일치가 실질적인 concurrency 관련 위험으로 식별된다. `useSyncExternalStore` 사용 자체는 concurrent mode tearing 방지를 위한 올바른 선택이다.

### 위험도
**MEDIUM**