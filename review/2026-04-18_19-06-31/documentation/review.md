## 문서화 코드 리뷰

### 발견사항

---

- **[INFO]** `isLocale()` 타입 가드에 JSDoc 없음
  - 위치: `types.ts:5-7`
  - 상세: localStorage, API 응답, 사용자 입력 등 여러 신뢰 경계에서 사용되는 공개 API이나 역할 설명이 없음. 현재 여러 리뷰에서 이 문제를 지적했으나 코드에 반영되지 않음.
  - 제안: `/** Type guard for Locale. Use at trust boundaries (localStorage, user API response, URL params). */` 추가

---

- **[INFO]** `readStoredLocale()` 함수에 JSDoc 없음
  - 위치: `locale-store.ts` — `function readStoredLocale(): Locale`
  - 상세: SSR 가드(`typeof window === "undefined"`)와 catch 처리 이유가 없음. `applyHtmlLang`은 문서화되어 있는데 페어 함수인 이 함수는 누락.
  - 제안: `// SSR-safe localStorage read; returns DEFAULT_LOCALE when unavailable (private mode, SSR)` 한 줄 추가

---

- **[INFO]** `STORAGE_KEY` 상수 설명 없음
  - 위치: `locale-store.ts:6` — `const STORAGE_KEY = "idea-workflow.locale"`
  - 상세: 키 네이밍 규칙(`idea-workflow.` prefix)이나 다른 스토리지 키와의 관계가 불명확함.
  - 제안: 제품 네임스페이스 prefix임을 짧게 주석 추가, 또는 앱 전역 상수로 추출

---

- **[INFO]** `LocaleState` 인터페이스에 JSDoc 없음
  - 위치: `locale-store.ts` — `interface LocaleState`
  - 상세: `initFromStorage`의 호출 시점(마운트 시 1회) 및 `setLocale`의 부수효과(DOM + localStorage)가 인터페이스만으로는 드러나지 않음.
  - 제안: 각 메서드에 `/** Persists to localStorage and updates <html lang> */` 수준의 한 줄 JSDoc 추가

---

- **[INFO]** `interpolate()` 내부 함수 주석 없음
  - 위치: `core.ts` — `function interpolate(...)`
  - 상세: `{{placeholder}}` 문법과 누락 파라미터 시 `""` 치환 동작이 함수 시그니처에서 드러나지 않음. `translate`의 JSDoc에서 interpolation을 언급하지 않아 흐름이 불완전함.
  - 제안: `translate()` JSDoc에 `@example translate("en", "time.minutesAgo", { minutes: 5 })` 추가

---

- **[WARNING]** spec/README i18n 기여 가이드 미작성 (이월 상태 지속)
  - 위치: RESOLUTION.md — "별도 DOCUMENTATION 작업으로 분리 예정"
  - 상세: 번역 키 추가 절차(`dict/ko.ts`와 `dict/en.ts` 동시 수정 필요), 폴백 동작(`ko` fallback), `TranslationKey` 타입 추론, `LocaleSync` 마운트 요구사항이 어디에도 없음. 2차 리뷰(`2026-04-18_18-17-32`)에서도 여전히 이월 상태.
  - 제안: `frontend/src/lib/i18n/README.md` 최소 내용: 지원 로케일, 키 추가 절차, `useT` vs `translate` 사용 기준, `LocaleSync` 역할

---

### 요약

1차·2차 리뷰에서 지적된 핵심 문서화 이슈(`translate` JSDoc, `useT`/`useLocale` JSDoc, `applyHtmlLang` 주석, `LocaleSync` JSDoc, `core.ts` 분리 이유, catch 블록 주석)는 RESOLUTION.md 기준으로 잘 반영되어 있다. 남은 결함은 모두 INFO 수준으로, `isLocale()` 공개 API의 JSDoc 누락과 이월 상태인 spec/README i18n 기여 가이드가 가장 시급하다. 특히 기여 가이드 부재는 신규 개발자가 `ko.ts`에만 키를 추가하고 `en.ts`를 누락하는 실수로 이어질 수 있어 팀 협업 시 실질적 위험이 된다.

### 위험도
**LOW**