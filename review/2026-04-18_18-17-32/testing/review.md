### 발견사항

---

- **[WARNING]** `locale-sync.test.tsx` — localStorage 초기화 테스트에서 `document.documentElement.lang` 부수효과 미검증
  - 위치: `locale-sync.test.tsx` — "initializes from localStorage on mount" 테스트
  - 상세: `initFromStorage`는 내부에서 `applyHtmlLang`을 호출하므로 `document.documentElement.lang`도 갱신됩니다. 현재 테스트는 `useLocaleStore.getState().locale`만 검증하고 `document.documentElement.lang`은 확인하지 않습니다. `locale-store.test.ts`의 "reads a previously stored locale on init"은 이 측면을 검증하지만, `LocaleSync` 컴포넌트를 통한 경로에서 동일한 부수효과가 발생하는지 별도로 확인되지 않습니다.
  - 제안: 해당 테스트에 `expect(document.documentElement.lang).toBe("en")` 검증 추가

---

- **[WARNING]** `locale-sync.test.tsx` — 사용자 로그아웃(user → null) 시나리오 테스트 없음
  - 위치: `locale-sync.tsx:17` — `useEffect([user?.locale, setLocale])`
  - 상세: `user`가 null이 되는 경우(로그아웃) `useEffect`가 재실행되지만 `user?.locale`이 `undefined`이므로 locale이 초기화되지 않습니다. 이 동작이 의도적인지(로그아웃 후 locale 유지) 여부가 테스트로 명시되지 않아 회귀 위험이 있습니다.
  - 제안:
    ```tsx
    it("retains locale when user logs out", () => {
      // 먼저 en locale로 user 설정
      act(() => { useAuthStore.setState({ user: { locale: "en", ... }, isAuthenticated: true }); });
      // 로그아웃
      act(() => { useAuthStore.setState({ user: null, isAuthenticated: false }); });
      expect(useLocaleStore.getState().locale).toBe("en"); // 유지
    });
    ```

---

- **[WARNING]** `locale-store.test.ts` — localStorage `setItem` 예외 경로 미테스트
  - 위치: `locale-store.ts:34-38` — `setLocale` 내 `try { localStorage.setItem(...) } catch { }`
  - 상세: 저장소 용량 초과 등으로 `setItem`이 `QuotaExceededError`를 던질 때, 스토어 상태(`locale`)는 정상적으로 변경되되 localStorage 반영만 실패하는 경로가 테스트되지 않습니다. 이 경로는 `catch` 블록으로 흡수되나 스토어 상태가 의도대로 동작하는지 검증이 없습니다.
  - 제안: `vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error(); })` 패턴으로 케이스 추가

---

- **[WARNING]** `locale-store.test.ts` — 잘못된 저장값 폴백 시 `document.documentElement.lang` 미검증
  - 위치: `locale-store.test.ts` — "falls back to the default when stored value is invalid" 테스트
  - 상세: `initFromStorage`에 잘못된 값이 저장된 경우, `readStoredLocale()`이 `DEFAULT_LOCALE("ko")`를 반환하고 `applyHtmlLang("ko")`가 호출됩니다. 현재 테스트는 스토어 상태만 확인하고 `document.documentElement.lang`이 `"ko"`로 설정되는 부수효과를 검증하지 않습니다.
  - 제안: `expect(document.documentElement.lang).toBe("ko")` 검증 추가

---

- **[WARNING]** `locale-sync.test.tsx` — user locale 전환(en → ko) 시나리오 미테스트
  - 위치: `locale-sync.test.tsx`
  - 상세: user가 처음 "en" locale로 설정된 후 "ko"로 재설정될 때 양방향 전환이 모두 올바르게 동작하는지 테스트되지 않습니다. 단방향(초기 설정)만 검증되어 있습니다.
  - 제안:
    ```tsx
    it("updates locale when user locale changes", () => {
      render(<LocaleSync />);
      act(() => { useAuthStore.setState({ user: { locale: "en", ... }, isAuthenticated: true }); });
      expect(useLocaleStore.getState().locale).toBe("en");
      act(() => { useAuthStore.setState({ user: { locale: "ko", ... }, isAuthenticated: true }); });
      expect(useLocaleStore.getState().locale).toBe("ko");
    });
    ```

---

- **[INFO]** `locale-sync.test.tsx` — `afterEach`에서 `cleanup()` 호출 순서
  - 위치: `locale-sync.test.tsx:20-24`
  - 상세: `window.localStorage.clear()` 이후 `cleanup()`이 호출됩니다. RTL 관례상 `cleanup()`을 먼저 호출하는 것이 권장되며, 일부 RTL 버전에서는 cleanup 이전 DOM 상태에 의존하는 부수효과가 발생할 수 있습니다. 기능상 문제는 없으나 순서 일관성이 낮습니다.
  - 제안: `cleanup()` → `window.localStorage.clear()` → `resetStores()` 순서로 변경

---

- **[INFO]** `locale-sync.test.tsx` — localStorage + user locale 우선순위 충돌 케이스 미테스트
  - 위치: `locale-sync.tsx` — localStorage init 후 user locale sync 순서
  - 상세: localStorage에 "ko"가 저장된 상태에서 user.locale이 "en"이면 최종적으로 "en"이 되어야 합니다. 이 우선순위(user locale > localStorage)가 통합 시나리오로 명시적 테스트되지 않습니다. 각 side effect가 별도 테스트로만 검증되어 effect 실행 순서 의존성이 암묵적으로 처리됩니다.
  - 제안: 두 효과가 동시에 적용되는 통합 케이스 추가

---

- **[INFO]** `core.ts` — `interpolate` 함수 경계값 테스트 파악 불가
  - 위치: `core.ts:28-35`
  - 상세: `interpolate`에서 params 값이 `null`인 경우 빈 문자열을 반환하는 로직이 있습니다(`value === null ? "" : String(value)`). 리뷰 대상에 `i18n/__tests__/i18n.test.ts`가 포함되지 않아 이 경계값과 `0`, `false`, 빈 문자열 등의 falsy 값 처리가 테스트되는지 확인할 수 없습니다.
  - 제안: `translate("ko", someKey, { value: 0 })`, `translate("ko", someKey, { value: null as any })` 케이스가 `i18n.test.ts`에 포함되었는지 확인

---

### 요약

`locale-store.test.ts`와 `locale-sync.test.tsx` 모두 핵심 시나리오(기본값, localStorage 영속성, 잘못된 값 폴백, 구독자 알림, 사용자 locale 동기화)를 적절히 커버하고 있으며, Zustand 스토어의 `setState`/`getState` 직접 사용과 `act()` 래핑 패턴도 올바릅니다. 주요 갭은 `locale-sync.test.tsx`에서 `initFromStorage`의 `document.documentElement.lang` 부수효과가 미검증된 점, 사용자 로그아웃 후 locale 유지 동작의 의도성이 불명확한 점, localStorage 오류 경로와 user locale 양방향 전환 케이스가 빠진 점입니다. 치명적 결함은 없으나 부수효과가 많은 모듈 특성상 위 갭들이 향후 회귀의 사각지대가 될 수 있습니다.

### 위험도

**MEDIUM**