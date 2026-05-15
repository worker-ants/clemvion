### 발견사항

---

- **[WARNING]** `isLocale()` 구현이 `LOCALES` 배열과 독립적으로 하드코딩됨
  - 위치: `types.ts:6-8`
  - 상세: `LOCALES = ["ko", "en"]` 배열이 있음에도 `isLocale()`은 `value === "ko" || value === "en"`으로 별도 하드코딩되어 있음. 로케일 추가 시 `LOCALES`, `Locale`, `isLocale` 세 곳을 모두 수동으로 동기화해야 하며, TypeScript는 이 불일치를 감지하지 못함.
  - 제안: `return (LOCALES as readonly unknown[]).includes(value)` 또는 `type Locale = (typeof LOCALES)[number]`로 파생 타입 사용

---

- **[WARNING]** `interpolate()`가 누락된 파라미터를 빈 문자열(`""`)로 무음 치환
  - 위치: `core.ts:31` — `return ""`
  - 상세: `t("time.minutesAgo", {})` 처럼 필수 파라미터가 누락된 경우 프로덕션에서 `"m ago"` 같은 잘리고 의미없는 문자열이 사용자에게 노출됨. 개발 환경 경고는 있으나 운영 배포 후 탐지 수단이 없음.
  - 제안: 프로덕션에서도 원본 플레이스홀더(`{{minutes}}`)를 그대로 유지하거나, fallback 값을 명시적으로 문서화. 또는 `translate()`에서 params 완전성 검증 후 실패 시 key 반환.

---

- **[WARNING]** `locale-sync.test.tsx` — 알 수 없는 locale 무시 테스트에서 `document.documentElement.lang` 미검증
  - 위치: `locale-sync.test.tsx:60-70`
  - 상세: "ignores unknown locale values" 테스트가 `useLocaleStore.getState().locale === "en"`만 확인하고 `document.documentElement.lang`은 검증하지 않음. `initFromStorage()` 호출 시 `applyHtmlLang`도 실행되므로 DOM 부수효과 완전성이 검증되지 않음.
  - 제안: `expect(document.documentElement.lang).toBe("en")` 추가

---

- **[INFO]** `LocaleSync` 마운트 시 localStorage 없음 + 비인증 상태(순수 기본값) 경로 미테스트
  - 위치: `locale-sync.test.tsx` 전반
  - 상세: 현재 테스트들은 모두 localStorage에 값이 있거나 user가 설정된 상태에서 시작함. localStorage가 비어 있고 user도 없을 때 `initFromStorage()` → `DEFAULT_LOCALE("ko")` 반환 경로가 컴포넌트를 통해 검증되지 않음.
  - 제안: `localStorage` 비어있고 user 없는 상태에서 render 시 locale이 `"ko"`, lang이 `"ko"`임을 검증하는 케이스 추가

---

- **[INFO]** `translate()` — 두 로케일 모두 키가 없을 때 raw key를 반환
  - 위치: `core.ts:53-57`
  - 상세: `"auth.login.title"` 같은 점 표기 키가 사용자에게 그대로 노출될 수 있음. `process.env.NODE_ENV === "development"` 경고는 있으나 프로덕션에서 누락 키 발생 시 UX 문제로 직결됨.
  - 제안: 반환값이 raw key임을 JSDoc에 명시하고, 번역 dict 완전성을 CI에서 검증하는 스크립트 고려 (`Object.keys(ko).every(k => k in en)`)

---

- **[INFO]** `dict/types.ts` `WidenString`의 배열 분기는 번역 dict 구조에서 dead code
  - 위치: `dict/types.ts:6-7` — `T extends readonly (infer U)[] ? readonly WidenString<U>[]`
  - 상세: `ko.ts`/`en.ts` 딕셔너리는 중첩 문자열 객체 구조로 배열을 포함하지 않음. 배열 처리 분기가 실제로 사용되지 않으면서 타입 복잡도를 높임.
  - 제안: 현재는 무해하나, 주석으로 "dict에 배열이 없어 현재 미사용" 명시

---

### 요약

제공된 코드는 두 차례 리뷰 사이클을 거친 최종 resolved 버전으로, 이전에 지적된 핵심 문제(단일 effect 통합, INTERPOLATION_RE 모듈 상수화, applyHtmlLang 불필요 DOM 갱신 제거, core.ts 분리)가 잘 반영되어 있다. 요구사항 관점의 잔존 위험은 두 가지다: `isLocale()`이 `LOCALES` 배열과 독립적으로 하드코딩되어 로케일 추가 시 조용한 버그를 유발할 수 있고, `interpolate()`의 누락 파라미터 빈 문자열 치환이 프로덕션에서 탐지 불가한 깨진 메시지를 만들 수 있다. 나머지는 테스트 커버리지 보강과 문서화 수준의 INFO 항목이다.

### 위험도
**LOW**