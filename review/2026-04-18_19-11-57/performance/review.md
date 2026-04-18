### 발견사항

---

**[WARNING]** `LocaleSync`에서 stable action 참조를 Zustand 선택자로 구독

- **위치**: `locale-sync.tsx:21-22`
- **상세**: `setLocale`, `initFromStorage` 두 함수는 Zustand가 보장하는 stable reference다. 그럼에도 `useLocaleStore((s) => s.setLocale)` 방식으로 구독하면 Zustand의 내부 subscriber Set에 두 개의 상시 구독 항목이 생성되고, locale 변경 시마다 두 selector 함수가 모두 호출된다. 실제 리렌더는 reference가 안정적이어서 발생하지 않으나, 불필요한 선택자 실행 비용이 locale 변경마다 누적되고 `useEffect` 의존 배열도 불필요하게 길어진다.
- **제안**: 액션은 effect 내부에서 `useLocaleStore.getState()`로 즉시 읽어 subscriptions를 0으로 줄이고 의존 배열을 단일 항목(`[userLocale]`)으로 축소:
  ```tsx
  useEffect(() => {
    const { setLocale, initFromStorage } = useLocaleStore.getState();
    if (userLocale && isLocale(userLocale)) {
      setLocale(userLocale);
    } else {
      initFromStorage();
    }
  }, [userLocale]);
  ```

---

**[INFO]** `resolve()` — 동일 키 반복 호출 시 매번 문자열 분리 및 객체 순회

- **위치**: `core.ts:23-32`
- **상세**: `key.split(".")` 후 단계별 프로퍼티 접근을 수행한다. 현재 2개 locale·정적 딕셔너리 규모에서 단일 호출 비용은 미미하나, 가상화 테이블이나 대형 리스트에서 동일 키를 수백 번 호출하는 경우 누적 비용이 발생할 수 있다. `translate()` 결과에 대한 캐싱이 전혀 없다.
- **제안**: 현재 규모에서는 수용 가능. 향후 `Map<string, string>` 기반(`"${locale}:${key}"` → 결과값) 메모이제이션을 locale 변경 시 무효화하는 방식으로 전환 검토.

---

**[INFO]** `useT()` · `useLocale()` 각각 독립적으로 전체 store를 구독

- **위치**: `index.ts:18-19, 34-35`
- **상세**: 두 훅 모두 `useLocaleStore.subscribe`를 `useSyncExternalStore`의 subscribe 인자로 직접 사용한다. 동일 컴포넌트에서 두 훅을 모두 호출하면 store에 두 개의 구독이 생성된다. `useSyncExternalStore`가 snapshot 값(`locale` 문자열) 비교로 불필요한 리렌더를 차단하므로 런타임 비용은 미미하나, store에 새로운 상태가 추가될 경우 selector가 없어 불필요한 통지가 증가한다.
- **제안**: 현재 규모에서는 수용 가능. store 확장 시 `useLocaleStore((s) => s.locale)` 패턴으로 전환 검토.

---

**[INFO]** 두 locale 딕셔너리가 항상 초기 번들에 포함됨

- **위치**: `core.ts:1-2`
- **상세**: 사용자 locale에 관계없이 `ko`, `en` 딕셔너리 전체가 번들에 포함된다. 현재 2개 locale 기준으로는 수용 가능하나, locale 추가 시 미사용 번들 크기가 선형 증가한다.
- **제안**: 3개 이상 locale 추가 시 `dynamic import` 기반 지연 로딩 전환 검토.

---

**[INFO]** `INTERPOLATION_RE`의 `g` 플래그 — `.replace()` 외 용도 확장 시 `lastIndex` 주의

- **위치**: `core.ts:21`
- **상세**: 현재 `.replace()` 전용으로 사용하므로 안전하다(사양상 `replace`는 실행 전 `lastIndex`를 0으로 초기화). 그러나 미래에 `.exec()` 루프나 `.test()`로 변경하면 module-scope 공유 regex의 `lastIndex` 오염이 발생한다.
- **제안**: 현재 용도에서는 문제없음. 용도 변경 시 local regex로 전환할 것.

---

### 요약

이전 리뷰(2026-04-18_17-14-03)에서 지적된 세 가지 WARNING — `INTERPOLATION_RE` 매 호출 재생성, `locale === "ko"` 시 이중 `resolve()`, `applyHtmlLang` 무조건 DOM 갱신 — 은 현재 코드에서 모두 올바르게 수정되어 있다. 현재 코드베이스에서 즉각 개선이 가능한 항목은 `LocaleSync`에서 stable action 참조를 selector로 구독하는 패턴으로, `useLocaleStore.getState()` 직접 호출로 전환하면 Zustand 구독 수를 줄이고 의존 배열을 단순화할 수 있다. 나머지 항목은 현재 2-locale 정적 규모에서 수용 가능한 트레이드오프다.

### 위험도

**LOW**