### 발견사항

---

- **[WARNING]** `dict/types.ts`가 여전히 `ko.ts`에 의존 — 부분적 분리
  - 위치: `dict/types.ts:1` — `import type { ko } from "./ko"`
  - 상세: `en.ts` → `ko.ts` 직접 의존을 `dict/types.ts`로 중개하는 방식으로 개선됐으나, 의존 체인이 `en.ts → dict/types.ts → ko.ts`로 유지된다. 한국어 dict가 여전히 스키마 권위 소스를 겸하는 구조적 비대칭이 남아있다. `ko.ts` 삭제 또는 구조 변경 시 `types.ts`와 `en.ts`가 함께 파괴된다.
  - 제안: `dict/types.ts`에서 `ko`의 구체적 shape 대신 독립적인 스키마 정의(명시적 인터페이스 또는 code-gen)를 사용하거나, 현재 구조의 한계를 `spec/` 문서에 명시적으로 기술해 후속 작업 시 혼란을 방지한다.

---

- **[WARNING]** `LocaleSync`가 `i18n/` 레이어에서 `auth-store`를 직접 import — DIP 위반 (이월)
  - 위치: `locale-sync.tsx:5`
  - 상세: i18n은 앱 기반 레이어이고 auth는 도메인 레이어다. RESOLUTION.md에서 "구독 의존"으로 판단해 이월했으나, 향후 auth 모듈 교체 시 `i18n/locale-sync.tsx`가 변경 영향을 받는 구조는 유지된다. `LocaleSync`를 `src/lib/providers/` 또는 `src/components/layout/`으로 이동하면 레이어 방향을 복원할 수 있다.
  - 제안: 이월 판단은 합리적이나, `RESOLUTION.md`에 기록된 대로 차기 대형 리팩터링 시 우선 처리 대상으로 명시한다.

---

- **[INFO]** `locale-store` 초기 상태가 `LocaleSync` 마운트에 암묵적으로 의존
  - 위치: `locale-store.ts:29` — `locale: DEFAULT_LOCALE`
  - 상세: store는 `"ko"`로 초기화되고 실제 localStorage 값은 `LocaleSync` 마운트 시점까지 반영되지 않는다. store만 사용하고 `LocaleSync`가 없으면 항상 기본값만 반환되는 암묵적 라이프사이클 의존이 존재한다. `initFromStorage`의 책임이 컴포넌트에 위임되어 store가 완전하지 않은 상태로 생성된다.
  - 제안: `create()` 내에서 `typeof window !== "undefined"` 조건으로 즉시 `readStoredLocale()`을 초기값으로 사용하면 `LocaleSync`를 user 동기화 전담으로 범위를 축소할 수 있다.

---

- **[INFO]** `Locale` 유니온 타입이 `LOCALES` 배열에서 파생되지 않음 — 이중 소스
  - 위치: `types.ts:1-5`
  - 상세: `Locale = "ko" | "en"` 유니온과 `LOCALES = ["ko", "en"]` 배열이 별도 정의되어 새 locale 추가 시 두 곳 동시 수정이 필요하다. `type Locale = (typeof LOCALES)[number]` 패턴으로 단일 소스를 확보할 수 있으나 RESOLUTION.md에서 narrowing 동작 변경 우려로 이월했다.
  - 제안: 이월 이유는 타당하나, `isLocale` 구현이 어차피 `value === "ko" || value === "en"` 리터럴 비교라 실제 narrowing 차이가 없음을 검증 후 차기 작업에서 통합하는 것을 권장한다.

---

### 요약

이전 리뷰에서 제기된 Critical/Warning 이슈들(`core.ts` 분리, 이중 `useEffect` 통합, `setLocale` 연산 순서, `applyHtmlLang` 멱등성, 서버 스냅샷 `DEFAULT_LOCALE` 참조, `INTERPOLATION_RE` 모듈 상수, ko locale 이중 순회 제거)이 모두 반영되어 아키텍처가 크게 개선됐다. 남은 구조적 문제는 `dict/types.ts`가 `ko.ts`에 의존하는 비대칭 dict 구조(개선됐지만 근본 의존은 유지), `LocaleSync`의 auth 레이어 의존(합리적 이유로 이월), store 초기화의 컴포넌트 의존 세 가지다. 이월 판단들은 비용 대비 타당하며, 현재 2개 locale 규모에서 실질적 위험은 낮다.

### 위험도
**LOW**