### 발견사항

---

**[WARNING] `translate()` / `resolve()` 호출마다 배열 재할당 및 결과 캐싱 없음**
- 위치: `core.ts:24-29` (`resolve`), `core.ts:43-57` (`translate`)
- 상세: `resolve(dict, key)`는 매 호출마다 `key.split(".")` 로 새 배열을 할당하고 dict 트리를 처음부터 순회한다. 동일한 `(locale, key)` 조합이라도 이전 결과를 재사용하지 않는다. locale 전환 시 `useT()` 구독 컴포넌트 전체가 일제히 재렌더되며, 50개 번역 항목이 있는 페이지라면 50회 이상의 `split` + 트리 탐색이 순간적으로 누적된다. `params`가 없는 순수 키 번역은 동일 locale에서 결과가 불변임에도 매번 재계산한다.
- 제안: `params`가 없는 호출에 한해 `Map<string, string>` 모듈 캐시로 `${locale}:${key}` 를 키로 결과를 메모이즈한다. locale 전환 시에는 캐시를 clear하거나 locale을 키에 포함하면 자동으로 miss가 발생한다.
  ```typescript
  const _cache = new Map<string, string>();

  export function translate(locale, key, params?) {
    if (!params) {
      const k = `${locale}\x00${key}`;
      const hit = _cache.get(k);
      if (hit !== undefined) return hit;
      const result = _computeTranslate(locale, key);
      _cache.set(k, result);
      return result;
    }
    return _computeTranslate(locale, key, params);
  }
  ```

---

**[WARNING] `/g` 플래그가 있는 `INTERPOLATION_RE` 를 모듈 상수로 공유**
- 위치: `core.ts:21`
- 상세: `/g` 플래그를 가진 정규식은 `lastIndex` 내부 상태를 보유한다. `String.prototype.replace`는 ECMAScript 스펙상 `[Symbol.replace]` 진입 시 `lastIndex`를 0으로 리셋하므로 현재 `interpolate()` 내 사용은 안전하다. 그러나 이 상수를 미래에 `.exec()` 또는 `.test()`에서 재사용하면 전 호출의 `lastIndex`가 남아 매치가 누락된다. 모듈 수준에서 `/g` 플래그 상수를 여러 호출이 공유하는 패턴 자체가 이러한 오용을 유도하며, 이를 잘 모르는 개발자가 나중에 실수할 여지가 있다.
- 제안: 플래그를 제거하고 `replaceAll` 사용(ES2021+), 또는 인라인 리터럴로 두어 공유 상태 자체를 없앤다. 현대 JS 엔진은 동일한 리터럴 정규식을 내부 캐싱한다.
  ```typescript
  // 인라인 방식: 공유 lastIndex 위험 없음
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => { ... });
  ```

---

**[INFO] `useSyncExternalStore` snapshot 함수를 매 렌더마다 인라인 생성**
- 위치: `index.ts:17-18`, `index.ts:26-27`
- 상세: `getSnapshot`과 `getServerSnapshot`이 인라인 화살표 함수로 전달된다. `useSyncExternalStore`는 snapshot 함수를 직접 호출하므로 참조 안정성이 엄격하게 요구되지는 않으나, React 18 내부에서 두 스냅샷 함수를 이전 렌더 결과와 비교하는 로직이 있을 경우 매 렌더마다 새 참조가 들어오면 불필요한 처리가 생길 수 있다. 현재 기능 결함은 없다.
- 제안: 모듈 상수로 추출하면 의도도 명확해진다.
  ```typescript
  const getLocaleSnapshot = () => useLocaleStore.getState().locale;
  const getServerLocaleSnapshot = () => DEFAULT_LOCALE;
  ```

---

**[INFO] 로케일 변경 시 `useT()` 소비 컴포넌트 전체 재렌더**
- 위치: `index.ts:14-24`
- 상세: `useSyncExternalStore(useLocaleStore.subscribe, ...)` 는 locale store의 모든 업데이트에 컴포넌트 재렌더를 트리거한다. 현재 `locale-store.ts`는 `locale` 단일 필드만 가지므로 locale과 무관한 업데이트는 없다. 그러나 향후 스토어에 필드가 추가될 경우, `locale`이 변경되지 않아도 다른 필드 업데이트로 `useT()` 소비 컴포넌트 전체가 재렌더된다. 현재는 안전하다.
- 제안: 스토어 확장 시에도 현재 `getSnapshot: () => useLocaleStore.getState().locale` 구조를 유지하면 snapshot 비교로 인해 `locale` 값이 실제로 바뀔 때만 재렌더가 발생한다. 현재 설계는 이를 이미 만족한다.

---

**[INFO] `locale-sync.tsx`에서 `setLocale`, `initFromStorage`를 selector로 구독**
- 위치: `locale-sync.tsx:20-21`
- 상세: `useLocaleStore((s) => s.setLocale)` selector는 컴포넌트가 locale store를 구독하게 만든다. Zustand에서 액션 함수는 `create()` 콜백 내에 정의되어 참조가 불변이므로 실제로 재렌더를 유발하지 않는다. 기능상 문제는 없으나 구독을 완전히 없애고 싶다면 `useLocaleStore.getState().setLocale`을 컴포넌트 외부에서 한 번만 읽어 사용할 수 있다.
- 제안: 현 방식 유지 가능. 성능 민감 경로라면 `const { setLocale, initFromStorage } = useLocaleStore.getState()` 로 subscribe 없이 추출.

---

### 요약

이번 i18n 구현에서 가장 주목할 성능 포인트는 `translate()` / `resolve()` 의 결과 캐싱 부재다. locale 전환 시 `useT()` 구독 컴포넌트 전체가 재렌더되며 모든 번역 키에 대해 배열 할당과 dict 트리 순회가 반복된다. 현재 dict 깊이(최대 3~4 레벨)와 일반적 페이지 규모에서는 체감되지 않지만, 실행 목록처럼 동일 키를 수십 행 반복하는 페이지에서 GC 압력이 누적된다. `params` 없는 순수 키 번역에 한해 `Map` 캐시를 추가하면 locale 전환 비용을 크게 낮출 수 있다. `INTERPOLATION_RE` 정규식 모듈 상수와 `applyHtmlLang` DOM 조건부 갱신, `useSyncExternalStore` 기반 locale 구독 설계는 전반적으로 적절하다.

### 위험도
**LOW**