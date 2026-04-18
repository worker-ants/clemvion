### 발견사항

---

**[WARNING]** `interpolate` 내 정규식이 매 호출마다 재생성됨
- 위치: `core.ts:25` — `/\{\{\s*(\w+)\s*\}\}/g`
- 상세: 정규식 리터럴이 함수 본문에 위치하여 `translate()` 호출마다 새 `RegExp` 객체가 생성됨. 파라미터를 사용하는 키가 많은 페이지에서 매 렌더마다 반복 호출되면 불필요한 객체 생성이 누적됨.
- 제안: 모듈 최상단 상수로 이동
  ```typescript
  const INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g;
  // interpolate 내: template.replace(INTERPOLATION_RE, ...)
  ```

---

**[WARNING]** `locale === "ko"` 일 때 `resolve` 이중 호출
- 위치: `core.ts:44-47`
- 상세: `translate()` 내에서 `const fallback = dictionaries.ko` 를 항상 할당하고 `resolve(dict, key) ?? resolve(fallback, key)` 로 실행. locale이 `"ko"` 인 경우 `dict === fallback` 이므로 키가 없을 때 동일한 딕셔너리를 두 번 순회하는 낭비가 발생.
- 제안:
  ```typescript
  const value =
    resolve(dict, key) ??
    (locale !== "ko" ? resolve(fallback, key) : undefined);
  ```

---

**[WARNING]** `applyHtmlLang` 이 현재 값 확인 없이 DOM 속성을 무조건 갱신
- 위치: `locale-store.ts:14-17`
- 상세: `setLocale` 과 `initFromStorage` 모두 `applyHtmlLang` 을 항상 호출. 이미 동일 locale 이 설정된 상태에서도 DOM mutation 이 발생하여 브라우저 렌더 트리를 불필요하게 더럽힘. 특히 `initFromStorage` 는 `LocaleSync` 마운트마다 호출되므로 이중 갱신 빈도가 높음.
- 제안:
  ```typescript
  function applyHtmlLang(locale: Locale) {
    if (typeof document === "undefined") return;
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }
  ```

---

**[INFO]** 번역 결과 캐싱 없음 — `resolve` 가 매 호출마다 문자열 분리 및 객체 순회
- 위치: `core.ts:16-24`
- 상세: `key.split(".")` 후 단계별 프로퍼티 접근을 수행하며, 동일 키라도 매 `translate()` 호출마다 반복됨. 단독으로는 미미하나, 대형 목록·가상화 테이블 등에서 수백 번 호출 시 누적 비용이 발생할 수 있음.
- 제안: 현재 규모(2개 locale, 정적 딕셔너리)에서는 낮은 우선순위. 향후 `WeakMap` 또는 `Map<string, string>` 기반 메모이제이션 검토.

---

**[INFO]** 두 locale 딕셔너리가 항상 함께 번들링됨
- 위치: `core.ts:1-2`
- 상세: 사용자 locale 에 관계없이 `ko` 와 `en` 딕셔너리 전체가 초기 번들에 포함됨. 현재 2개 locale 기준으로는 수용 가능하나, locale 추가 시 미사용 번들 크기가 선형 증가함.
- 제안: 현재는 수용 가능. 3개 이상 locale 추가 시 `dynamic import` 기반 지연 로딩 전환 검토.

---

**[INFO]** `LocaleSync` 에서 동일 store 를 두 번 구독
- 위치: `locale-sync.tsx:10-11`
- 상세: `setLocale` 과 `initFromStorage` 를 각각 별도 selector 로 조회하여 두 개의 Zustand 구독이 생성됨. 두 값 모두 action(stable reference) 이라 실제 리렌더는 유발하지 않으므로 런타임 비용은 미미함.
- 제안: 구독 수를 줄이려면 `shallow` 비교기와 함께 단일 selector 로 병합 가능. 단, `shallow` 없이 객체를 반환하면 오히려 재구독 루프가 발생하므로 득실을 고려할 것.

---

### 요약

i18n 시스템 전반의 설계 — `useSyncExternalStore` + `useCallback` 기반 `useT()`, Zustand locale store — 는 성능 측면에서 견고하다. 가장 즉각적인 개선 포인트는 두 가지다: `core.ts`의 `interpolate` 에서 정규식이 매 호출마다 재생성되는 문제와 `locale === "ko"` 시 동일 딕셔너리를 이중 순회하는 낭비, 그리고 `applyHtmlLang` 이 현재 값 비교 없이 DOM 속성을 무조건 갱신하는 불필요한 mutation 이다. 세 항목 모두 한 줄 수정으로 해결 가능하며, 나머지 INFO 항목들은 현재 규모에서는 수용 가능한 트레이드오프다.

### 위험도

**LOW**