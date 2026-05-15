### 발견사항

---

**[INFO]** 모듈 레벨 `/g` 플래그 정규식 — 현재 안전하나 잠재적 footgun

- 위치: `core.ts:21` — `const INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g`
- 상세: `String.prototype.replace()`는 ECMAScript 명세상 `@@replace` 진입 시 `lastIndex`를 0으로 리셋하므로, 현재 `template.replace(INTERPOLATION_RE, ...)` 사용은 안전하다. 그러나 `/g` 플래그를 가진 공유 정규식 객체는 `.test()` 또는 루프 내 `.exec()`로 사용될 경우 `lastIndex` 상태가 누적되어 호출 간 매칭 결과가 달라지는 전형적인 JavaScript concurrency footgun이다. JavaScript는 단일 스레드이지만, 이 상수가 외부로 노출되거나 향후 재사용처에서 `.test()`로 호출되면 조용한 버그가 발생한다.
- 제안: 내보내지 않는 한 현재 코드에서는 문제없음. 주석으로 `replace()` 전용임을 명시하거나, 방어적으로 non-global 버전을 사용하는 방향 고려 (`/\{\{\s*(\w+)\s*\}\}/` — `replace()`는 `/g` 없이도 전체 치환이 가능).

---

**[INFO]** `LocaleSync` 단일 effect — 로그아웃 시 `initFromStorage()` 재호출

- 위치: `locale-sync.tsx:24-33`
- 상세: `userLocale`이 `undefined`로 전환될 때(로그아웃) effect가 재실행되어 `initFromStorage()`가 호출된다. 이는 localStorage 읽기 + `applyHtmlLang()` 호출을 유발한다. `applyHtmlLang()`은 현재 값과 같으면 DOM 변경을 건너뛰도록 guard되어 있어(`locale-store.ts:24`) 실질적 side effect는 없다. 순서 의존성이 없는 단일 effect 구조이므로 React Strict Mode 이중 실행(mount → unmount → mount) 하에서도 멱등성이 보장된다. 동시성 버그 아님.

---

**[INFO]** `setLocale`과 `initFromStorage`의 `applyHtmlLang` 호출 순서 — 이전 리뷰 지적 해소됨

- 위치: `locale-store.ts:37-53`
- 상세: 이전 round 리뷰(side_effect)에서 두 경로의 `applyHtmlLang` / `set()` 호출 순서가 비대칭이라는 지적이 있었다. 현재 코드에서는 `setLocale`(L40→L48)과 `initFromStorage`(L52→L53) 모두 `applyHtmlLang` → `set()` 순서로 일치한다. DOM과 storage가 Zustand 구독자 알림 이전에 갱신되므로 구독자가 최신 DOM 상태를 보는 것이 보장된다.

---

**[INFO]** Zustand `create()` 모듈 레벨 싱글톤 — SSR 요청 간 state 공유

- 위치: `locale-store.ts:35`
- 상세: `useLocaleStore`는 모듈 평가 시 즉시 생성된다. Next.js 서버 환경에서 이 싱글톤은 요청 간 공유된다. 현재 모든 DOM/storage side effect는 `typeof window/document === "undefined"` guard로 차단되어 있고, `"use client"` 지시어가 선언되어 있으므로 SSR에서 직접 호출될 가능성이 낮다. locale이 사용자 민감 정보가 아니므로 현재 위험도는 낮으나, 향후 per-user 상태를 이 store에 추가할 경우 요청 간 state 누출이 발생한다.

---

### 요약

이 i18n 시스템은 JavaScript 단일 스레드 이벤트 루프 모델 안에서 동작하므로 전통적 의미의 race condition, deadlock, mutex 이슈는 해당 없다. 실질적 동시성 관점의 주요 포인트는 세 가지다: 모듈 레벨 `/g` 정규식이 현재 `replace()` 전용으로만 사용되어 안전하지만 `.test()`/`.exec()` 재사용 시 `lastIndex` 버그 위험이 잠재하는 점; 단일 `useEffect` 구조가 이전 두 effect의 순서 의존성을 제거하여 React Strict Mode 이중 실행에 안전한 멱등성을 갖추게 된 점; `setLocale`과 `initFromStorage` 양 경로의 `applyHtmlLang → set()` 호출 순서가 이제 일치하여 구독자 시점 DOM 일관성이 보장된다는 점. 전반적으로 동시성 관점의 구조적 위험은 낮다.

### 위험도

**LOW**