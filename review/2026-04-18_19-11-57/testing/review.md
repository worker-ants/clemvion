### 발견사항

---

**[WARNING]** `locale-sync.test.tsx` — "ignores unknown locale" 테스트에서 `document.documentElement.lang` 미검증
- 위치: `locale-sync.test.tsx:60-70`
- 상세: 잘못된 locale(`"jp"`)로 user가 설정되면 단일 `useEffect` 내 `isLocale("jp") === false` 경로가 `initFromStorage()`를 호출하고, localStorage의 `"en"`을 읽어 `document.documentElement.lang`을 `"en"`으로 갱신한다. 현재 테스트는 store의 `locale`만 검증하고 DOM 반영은 확인하지 않는다. 다른 모든 시나리오 테스트가 `document.documentElement.lang`을 함께 검증하는 것과 불일치한다.
- 제안:
  ```tsx
  expect(useLocaleStore.getState().locale).toBe("en");
  expect(document.documentElement.lang).toBe("en"); // 추가
  ```

---

**[WARNING]** `core.ts` — `interpolate`의 개발환경 경고(`console.warn`) 분기 미테스트
- 위치: `core.ts:42-44`
- 상세: 파라미터 누락 경고가 `process.env.NODE_ENV === "development"`에서만 실행된다. 테스트 환경(`NODE_ENV === "test"`)에서는 이 분기에 진입하지 않아 경고 메시지 포맷이나 조건이 변경되어도 회귀가 감지되지 않는다.
- 제안: `NODE_ENV`를 `"development"`로 오버라이드하거나 `vi.spyOn(console, "warn")`을 사용해 누락 파라미터 경고 분기를 명시적으로 테스트. 또는 조건을 `process.env.NODE_ENV !== "production"`으로 완화해 테스트 환경에서도 동일 분기가 실행되도록 변경.

---

**[INFO]** 이전 리뷰어들의 WARNING 항목 대부분이 현재 코드에서 이미 해결됨
- 위치: `locale-sync.test.tsx`, `locale-store.test.ts`, `core.ts`, `locale-store.ts`
- 상세: `testing/review.md`, `requirement/review.md`, `side_effect/review.md`, `performance/review.md`가 지적한 항목들이 현재 코드에서 이미 수정되어 있다:
  - `document.documentElement.lang` 검증: `locale-sync.test.tsx:46,57,84` ✓
  - 로그아웃(user → null) 시나리오: `locale-sync.test.tsx:87-102` ✓
  - `setItem` 예외 경로: `locale-store.test.ts:34-47` ✓
  - 잘못된 저장값 폴백 DOM 검증: `locale-store.test.ts:64` ✓
  - user locale 양방향 전환(en → ko): `locale-sync.test.tsx:72-85` ✓
  - localStorage + user locale 우선순위 충돌: `locale-sync.test.tsx:104-113` ✓
  - `afterEach` cleanup 순서: `cleanup()` → `localStorage.clear()` → 순서 준수 ✓
  - `INTERPOLATION_RE` 모듈 상수 분리: `core.ts:21` ✓
  - `applyHtmlLang` 현재값 비교 가드: `locale-store.ts:24` ✓
  - `locale === DEFAULT_LOCALE` 이중 호출 방지: `core.ts:64-67` ✓

---

**[INFO]** `locale-sync.tsx` 구현이 단일 `useEffect`로 변경 — 이전 리뷰들의 전제 오류
- 위치: `locale-sync.tsx:24-33`
- 상세: `side_effect/review.md`와 `requirement/review.md`의 여러 지적이 "두 `useEffect`"를 전제로 하지만, 실제 구현은 `userLocale` 유효성에 따라 `setLocale` / `initFromStorage`를 선택하는 단일 effect다. 두 effect 실행 순서 의존 문제, `initFromStorage` 재실행 경쟁 문제 등 해당 리뷰들의 WARNING 근거가 실제 코드와 일치하지 않는다. 이미 해소된 사항이나, 후속 리뷰에서 혼선 방지를 위해 언급한다.

---

**[INFO]** `interpolate` 함수의 falsy 경계값 테스트 미포함
- 위치: `core.ts:40-48`
- 상세: `value === null`(타입 외 런타임 방어), `value === 0`(falsy number), 빈 문자열 파라미터에 대한 테스트가 없다. `i18n.test.ts`가 리뷰 대상에 포함되지 않아 확인 불가. TypeScript 타입(`string | number`)이 `null`을 배제하므로 실제 위험은 낮다.
- 제안: `i18n.test.ts`에 `{ value: 0 }`, `{ value: "" }` 케이스를 추가해 falsy 값이 올바르게 문자열로 변환됨을 검증.

---

**[INFO]** `locale-store.test.ts` — `afterEach`에서 `resetStore()` 미호출
- 위치: `locale-store.test.ts:17-20`
- 상세: `afterEach`가 localStorage와 DOM 속성만 초기화하고 Zustand store 상태는 초기화하지 않는다. `beforeEach`에서 `resetStore()`가 호출되므로 실질적 격리 문제는 없지만, `locale-sync.test.tsx`의 `afterEach`가 `resetStores()`를 포함하는 것과 패턴이 비대칭적이다.
- 제안: `afterEach`에 `resetStore()` 추가해 정리 로직을 대칭화.

---

**[INFO]** `translate()` 폴백 동작의 통합 테스트 확인 불가
- 위치: `core.ts:57-75`
- 상세: `en` locale에서 누락된 키가 `ko`로 폴백되는 동작, 양 locale 모두 누락 시 raw key를 반환하는 동작이 JSDoc에 명시되어 있지만 `i18n.test.ts`가 리뷰 대상에 포함되지 않아 커버 여부를 확인할 수 없다.

---

### 요약

이전 두 차례 리뷰에서 제기된 WARNING 항목의 대부분이 현재 코드에서 이미 해결되어 있다. `locale-sync.test.tsx`는 로그아웃, 양방향 전환, 우선순위 충돌, DOM 갱신 등 핵심 시나리오를 모두 커버하고 있으며, `locale-store.test.ts`는 localStorage 예외와 폴백 동작까지 검증한다. 남은 실질적 갭은 "ignores unknown locale" 테스트에서 `document.documentElement.lang` 단언이 빠진 것(다른 모든 테스트와의 불일치)과, `interpolate` 개발환경 경고 분기가 테스트 환경에서 실행되지 않는 점이다.

### 위험도

**LOW**