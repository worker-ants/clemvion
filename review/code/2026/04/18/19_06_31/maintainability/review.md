### 발견사항

---

- **[WARNING]** `useT`가 `useLocale`을 호출하지 않고 `useSyncExternalStore` 패턴을 중복 작성
  - 위치: `index.ts:21-25`, `index.ts:31-34`
  - 상세: `useT`와 `useLocale` 모두 `useSyncExternalStore(useLocaleStore.subscribe, () => useLocaleStore.getState().locale, () => DEFAULT_LOCALE)` 를 그대로 반복함. 스토어 구독 방식이 바뀌면 두 곳을 동기화해야 함.
  - 제안: `useT` 내부에서 `const locale = useLocale();` 호출로 교체하면 단일 구독 경로로 정리됨.

---

- **[WARNING]** `isLocale` 가드 — 로케일 추가 시 세 곳 동기화 필요
  - 위치: `types.ts:1-7`
  - 상세: `Locale` 유니온, `LOCALES` 배열, `isLocale` 함수 내 `=== "ko" || === "en"` 리터럴이 독립적으로 선언됨. `"fr"` 추가 시 세 위치를 모두 수정해야 하며 하나라도 빠지면 런타임 오류 없이 잘못 동작함.
  - 제안: `LOCALES`를 단일 소스로 두고 `Locale = (typeof LOCALES)[number]`로 파생, `isLocale = (v): v is Locale => (LOCALES as readonly string[]).includes(v as string)` 패턴으로 통합.

---

- **[WARNING]** `STORAGE_KEY` 상수가 테스트 파일에 하드코딩 중복
  - 위치: `locale-store.test.ts:3` — `const STORAGE_KEY = "idea-workflow.locale"`
  - 상세: `locale-store.ts` 내부 상수와 값이 동일하나 별도로 선언됨. 키 문자열이 변경되면 테스트 파일도 별도로 수정해야 하며, 컴파일러가 불일치를 잡지 못함.
  - 제안: `locale-store.ts`에서 `export const LOCALE_STORAGE_KEY` 로 노출하고 테스트에서 import.

---

- **[INFO]** `resolve` 함수의 `any` 타입 — 필요하나 범위를 좁힐 여지 있음
  - 위치: `core.ts:24` — `let current: any = dict`
  - 상세: 동적 키 탐색이라 `any`가 불가피하지만 `Record<string, unknown>`으로 시작 후 순회 시 타입 좁히기가 가능함. eslint-disable 주석 범위도 해당 라인에만 한정되어 있어 의도는 명확하나, 장기적으로 유지보수 시 any 확산 방지를 위한 명시적 중간 타입 사용이 바람직함.
  - 제안: `let current: unknown = dict`로 시작하고 `typeof current === "object" && current !== null` 가드 내에서 `(current as Record<string, unknown>)[part]`로 접근.

---

- **[INFO]** `interpolate`의 null 체크 중복 서술
  - 위치: `core.ts:31` — `if (value === undefined || value === null)`
  - 상세: `value == null`로 표현 가능한 조건이 두 줄로 풀어져 있음. 기능 차이 없으나 간결성이 떨어짐.
  - 제안: `if (value == null)` 로 교체.

---

- **[INFO]** `locale-store.test.ts`의 `beforeEach`/`afterEach` 초기화 범위 비대칭
  - 위치: `locale-store.test.ts:11-18`
  - 상세: `beforeEach`는 localStorage + document.lang + store를 모두 초기화하지만 `afterEach`는 localStorage + document.lang만 초기화하고 store를 건드리지 않음. 마지막 테스트 후 store 상태가 잔류하며, 이 파일 밖에서 순서 의존성이 생길 수 있음.
  - 제안: `afterEach`에도 `resetStore()` 추가하거나, `beforeEach`에서만 초기화하고 `afterEach`를 제거해 단일 전략을 유지.

---

### 요약

핵심 인프라(`translate`, `useLocaleStore`, `LocaleSync`, `isLocale` 가드)의 설계와 책임 분리는 전반적으로 견고하며 이전 리뷰에서 지적된 성능·부작용 이슈가 잘 반영되어 있다. 현시점에서 유지보수성 상 가장 실질적인 위험은 `useT`가 `useLocale`을 재사용하지 않아 구독 경로가 이중화된 것, 그리고 로케일 추가 시 세 곳을 동기화해야 하는 `isLocale` 패턴이다. 나머지 사항은 코드 간결성과 테스트 일관성 수준의 INFO 항목으로, 기능 버그로 이어지지는 않는다.

### 위험도
**LOW**