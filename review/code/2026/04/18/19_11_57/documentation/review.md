### 발견사항

---

**[WARNING]** `/docs` 사용자 설명서에 i18n 시스템 가이드가 없음

- **위치**: `frontend/src/app/(main)/docs/` 전체
- **상세**: CLAUDE.md는 구현 완료 후 `/docs` 사용자 설명서를 최신화하도록 명시하고 있다. 이번에 새로 도입된 i18n 시스템(`useT()`, `translate()`, 로케일 전환, 번역 키 추가 방법)에 대한 개발자 가이드나 사용자 설명이 `/docs` 경로에 존재하지 않는다. 서버 컴포넌트/클라이언트 컴포넌트 사용 구분(`translate` vs `useT`), 폴백 전략, 번역 키 추가 절차 등은 코드에서 직접 유추하기 어렵다.
- **제안**: `frontend/src/app/(main)/docs/` 하위에 i18n 사용 가이드 문서 추가. 최소 포함 항목: `useT()` vs `translate()` 사용 구분, `ko.ts` / `en.ts` 에 키 추가하는 절차, 폴백 동작 설명.

---

**[WARNING]** `types.ts` — `DEFAULT_LOCALE = "ko"` 선택 근거 미문서화

- **위치**: `types.ts:4`
- **상세**: 한국어가 기본 로케일인 이유가 코드·주석 어디에도 명시되지 않는다. 이 값은 `core.ts`의 폴백 체인, `locale-store.ts`의 초기값, SSR 서버 렌더링 기본값 등에 폭넓게 영향을 미친다. 프로젝트 도메인 배경을 모르는 기여자가 이 상수를 수정하면 여러 컴포넌트에서 예상치 못한 동작이 발생할 수 있다.
- **제안**:
  ```typescript
  /** Korean is the primary market locale and serves as the translation fallback. */
  export const DEFAULT_LOCALE: Locale = "ko";
  ```

---

**[INFO]** `types.ts` — `isLocale()` JSDoc 없음

- **위치**: `types.ts:6-8`
- **상세**: `isLocale()`은 `locale-store.ts`와 `locale-sync.tsx` 양쪽에서 외부 입력(localStorage, 사용자 프로필)의 화이트리스트 검증 경계로 사용되는 공개 API이다. 보안 경계 역할이 코드 서명만으로는 드러나지 않는다.
- **제안**:
  ```typescript
  /** Whitelist guard — accepts only the two supported locale codes. */
  export function isLocale(value: unknown): value is Locale {
  ```

---

**[INFO]** `locale-store.ts` — `LocaleState` 인터페이스 멤버 JSDoc 없음

- **위치**: `locale-store.ts:29-33`
- **상세**: `setLocale`은 DOM 변경(`<html lang>`) + localStorage 쓰기 + Zustand 상태 갱신이라는 세 가지 부작용을 발생시킨다. `initFromStorage`는 `readStoredLocale()`을 호출하여 SSR 환경과 localStorage 미지원 환경에 대한 가드를 수행한다. 인터페이스에 이 계약이 명시되지 않아 `LocaleState`를 처음 보는 코드 독자가 부작용을 추론해야 한다.
- **제안**:
  ```typescript
  interface LocaleState {
    locale: Locale;
    /** Persists `locale` to localStorage and mirrors it onto `<html lang>`. */
    setLocale: (locale: Locale) => void;
    /** Reads locale from localStorage (or falls back to DEFAULT_LOCALE) and hydrates the store. */
    initFromStorage: () => void;
  }
  ```

---

**[INFO]** `locale-store.ts` — `STORAGE_KEY`가 비공개이며 테스트에서 하드코딩으로 중복됨

- **위치**: `locale-store.ts:6`, `locale-store.test.ts:4`
- **상세**: `STORAGE_KEY = "idea-workflow.locale"` 가 소스와 테스트 양쪽에 동일한 문자열 리터럴로 존재한다. 스토리지 키 변경 시 테스트가 자체적으로 이전/이후 값을 동일하게 사용하므로 회귀를 감지하지 못한다. 의도적 복사라면 주석으로 명시가 필요하다.
- **제안**: `STORAGE_KEY`를 `export`하거나, 테스트 파일에 `// keep in sync with locale-store.ts STORAGE_KEY` 주석을 추가해 중복 의도를 명시.

---

**[INFO]** `core.ts` — 공개 타입 `TranslationKey`, `TFunction` JSDoc 없음

- **위치**: `core.ts:18`, `core.ts:77-80`
- **상세**: `TranslationKey`는 `PathInto<Dict>`에서 파생되는 복잡한 타입이며, 사용처에서 IDE 자동완성 외에 동작을 설명하는 문서가 없다. `TFunction`은 `useT()` 반환 타입으로 외부에서 함수 시그니처를 참조할 때 쓰이지만 용도가 문서화되어 있지 않다.
- **제안**:
  ```typescript
  /** Union of all dot-notation translation keys derived from the reference dictionary shape. */
  export type TranslationKey = PathInto<Dict>;

  /** Translate function bound to a specific locale — return type of `useT()`. */
  export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
  ```

---

**[INFO]** `i18n/index.ts` — 모듈 레벨 주석 없음 (서버/클라이언트 분리 미명시)

- **위치**: `index.ts:1`
- **상세**: `"use client"` 경계가 있는 이 파일은 서버 컴포넌트에서 `translate()`를 직접 import하면 안 되고 `core.ts`를 직접 참조해야 한다는 중요한 제약이 있다. `index.ts`를 통한 `translate` 재내보내기는 기술적으로 가능하지만, 이 파일 자체가 클라이언트 번들에 묶인다는 점이 문서화되지 않았다. RSC 사용자는 이 구분을 코드 구조만으로 유추해야 한다.
- **제안**: 파일 상단 또는 `translate` 재내보내기 라인 근처에 주석 추가:
  ```typescript
  // Server Components: import `translate` from "@/lib/i18n/core" directly.
  // Client Components: use `useT()` from this module.
  export { translate };
  ```

---

### 요약

핵심 공개 API(`translate`, `useT`, `useLocale`, `LocaleSync`)는 전반적으로 잘 문서화되어 있으며, 특히 `LocaleSync`의 JSDoc은 마운트 동작·로그아웃 동작·부작용 소유권을 명확히 기술하고 있다. 주요 문서화 공백은 `/docs` 사용자 설명서 부재(CLAUDE.md 명시 요구사항 미이행)와 `DEFAULT_LOCALE = "ko"` 선택 근거 미문서화이며, 그 외에는 인터페이스 멤버 JSDoc 누락, 서버/클라이언트 경계 불명시, 스토리지 키 중복에 대한 주석 부재 등 코드 독자 편의 수준의 개선 사항이다.

### 위험도

**LOW**