### 발견사항

---

- **[WARNING]** `locale-sync.test.tsx` — "ignores unknown locale values" 테스트에서 `document.documentElement.lang` 검증 누락
  - 위치: `locale-sync.test.tsx:63-68`
  - 상세: 잘못된 locale("jp")이 거부될 때 `useLocaleStore.getState().locale`은 검증하지만 `document.documentElement.lang`은 검증하지 않음. `initFromStorage` → `setLocale("en")` → `applyHtmlLang("en")` 경로가 테스트되지 않아 DOM 부수효과의 회귀 감지 불가.
  - 제안: `expect(document.documentElement.lang).toBe("en")` 추가

---

- **[WARNING]** `locale-store.test.ts` — `localStorage.getItem` 예외 경로 미테스트
  - 위치: `locale-store.ts:9-12` (`readStoredLocale` catch 블록)
  - 상세: `setItem` 예외(`QuotaExceededError`) 케이스는 있으나 `getItem` 예외 경로가 없음. `readStoredLocale`의 try-catch는 `getItem` 실패 시 `DEFAULT_LOCALE`을 반환하도록 설계되어 있는데, 이 경로가 검증되지 않음.
  - 제안:
    ```ts
    it("falls back to default when localStorage.getItem throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
        throw new Error("SecurityError");
      });
      useLocaleStore.getState().initFromStorage();
      expect(useLocaleStore.getState().locale).toBe("ko");
    });
    ```

---

- **[WARNING]** `locale-sync.test.tsx` — 인증된 사용자 상태로 마운트될 때 effect 이중 실행 시나리오 미테스트
  - 위치: `locale-sync.tsx:22-29`
  - 상세: localStorage에 "en"이 있고 이미 user가 인증된 상태(`userLocale`이 의존성)로 컴포넌트가 마운트될 때, 단일 effect로 통합되었지만 최종 locale 우선순위(user.locale > localStorage)가 검증되지 않음. 현재 통합 케이스는 `render` 후 별도 `act`로 user를 설정하는 방식만 있음.
  - 제안:
    ```tsx
    it("prefers user.locale on initial mount over localStorage", () => {
      window.localStorage.setItem("idea-workflow.locale", "en");
      setUser("ko"); // user already authenticated before mount
      render(<LocaleSync />);
      expect(useLocaleStore.getState().locale).toBe("ko");
    });
    ```

---

- **[INFO]** `locale-sync.test.tsx` — `afterEach`의 `resetStores()` 중복 호출
  - 위치: `locale-sync.test.tsx:37-42`, `locale-sync.test.tsx:25-28`
  - 상세: `beforeEach`와 `afterEach` 모두 `resetStores()`를 호출함. `beforeEach`가 각 테스트 전에 일관된 상태를 보장하므로 `afterEach`의 `resetStores()` 호출은 불필요한 중복.
  - 제안: `afterEach`에서 `resetStores()` 제거

---

- **[INFO]** `locale-sync.test.tsx` — `setUser` 헬퍼의 User 타입 의존성
  - 위치: `locale-sync.test.tsx:13-23`
  - 상세: user 객체가 `theme: "light"` 등 모든 필드를 인라인으로 하드코딩함. `User` 타입에 필수 필드가 추가되면 컴파일 오류로 즉시 감지되므로 런타임 위험은 없으나, `locale` 이외 필드가 변경되면 헬퍼만 수정하면 됨. 현재 구조는 적절.

---

- **[INFO]** `locale-store.test.ts` — `setLocale`을 동일 값으로 호출하는 no-op 시나리오 미테스트
  - 위치: `locale-store.ts:20-23` (`applyHtmlLang` 내 조건 분기)
  - 상세: `applyHtmlLang`에 `document.documentElement.lang !== locale` 가드가 있어 DOM 불필요 갱신을 방지하지만 이 최적화 경로에 대한 테스트가 없음. subscriber 알림은 여전히 발생하므로 동작 계약이 명시적이지 않음.

---

- **[INFO]** `locale-sync.test.tsx` — 테스트 `cleanup()` 자동 실행 여부 불명확
  - 위치: `locale-sync.test.tsx:44`
  - 상세: vitest + `@testing-library/react`는 기본적으로 `afterEach`에서 자동 cleanup을 수행함. 명시적 `cleanup()` 호출은 방어적으로는 유효하나, 자동 cleanup이 이미 설정된 환경에서는 이중 실행됨. `vitest.setup.ts`의 설정 확인 필요.

---

### 요약

두 테스트 파일은 핵심 시나리오(localStorage 초기화, user locale 동기화, 잘못된 값 폴백, 로그아웃 유지, 양방향 전환, localStorage 예외 처리)를 체계적으로 커버하고 있으며 전반적인 품질이 양호하다. 주요 갭은 두 가지다: "ignores unknown locale values" 테스트에서 `document.documentElement.lang` DOM 부수효과가 검증되지 않아 `applyHtmlLang` 회귀 감지가 불가하고, `localStorage.getItem` 예외 경로(`readStoredLocale`의 catch 블록)가 전혀 테스트되지 않는다. 인증된 사용자 상태로 마운트되는 시나리오도 추가하면 effect 통합 결과의 우선순위 동작을 명시적으로 보장할 수 있다.

### 위험도
**LOW**