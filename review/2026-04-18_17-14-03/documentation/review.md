### 발견사항

- **[WARNING]** `void t;` 패턴에 설명 없음
  - 위치: `integrations/page.tsx` - `Section` 컴포넌트 내
  - 상세: `t` prop을 받아 즉시 `void t;`로 무효화하는 이유가 불분명함. 향후 개발자가 dead code로 오해하거나 삭제할 가능성 높음
  - 제안: `// reserved for future per-item translations` 등 주석 추가 또는 현재 미사용 시 prop 자체를 제거

- **[WARNING]** Null byte 템플릿 분리 로직에 설명 없음
  - 위치: `register-form.tsx` - Terms 동의 링크 렌더링 블록
  - 상세: `\u0000TERMS\u0000` / `\u0000PRIVACY\u0000` sentinel을 사용해 번역 문자열을 분리하는 방식은 극히 비직관적이며, 이 접근법을 선택한 이유(언어에 따라 Terms/Privacy 순서가 달라질 수 있음)가 코드에 전혀 설명되지 않음
  - 제안: 블록 상단에 선택한 이유와 sentinel 규칙 설명 주석 필수

- **[WARNING]** `currentLocale()` — React 외부에서 Zustand store 접근에 설명 없음
  - 위치: `utils/date.ts:11-13`
  - 상세: `useLocaleStore.getState()`를 React 컴포넌트 외부(유틸 함수)에서 직접 호출하는 패턴은 Zustand에서 유효하나, 일반 개발자는 hook 규칙 위반으로 오해할 수 있음
  - 제안: `// Zustand getState() is safe outside React — reads snapshot synchronously` 주석 추가

- **[WARNING]** 핵심 공개 API에 JSDoc 없음
  - 위치: `i18n/index.ts` — `translate()`, `useT()`, `useLocale()`, `TFunction`, `TranslationKey`
  - 상세: 프로젝트 전체가 사용하는 공개 API임에도 사용법, 파라미터 설명, 폴백 동작 등이 문서화되지 않음
  - 제안: 최소한 `translate()`와 `useT()`에 파라미터와 폴백 동작 설명하는 JSDoc 추가

- **[WARNING]** Zod 스키마가 컴포넌트 내부로 이동된 이유 설명 없음
  - 위치: `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`
  - 상세: 스키마가 컴포넌트 안으로 이동된 이유(`t()` 호출이 필요하기 때문)가 명시되지 않아, 리뷰어가 성능상 실수로 오해하기 쉬움 (렌더마다 스키마 재생성)
  - 제안: 각 스키마 정의 위에 `// defined inside component to use translated error messages via t()` 주석 추가

- **[INFO]** `LocaleSync` 컴포넌트 JSDoc 없음
  - 위치: `i18n/locale-sync.tsx`
  - 상세: localStorage 초기화와 user 프로필 기반 locale 동기화라는 두 가지 역할을 하는 컴포넌트인데 설명이 없음
  - 제안: 컴포넌트 역할과 `Providers`에서 반드시 마운트해야 하는 이유를 JSDoc으로 설명

- **[INFO]** `formatDuration` 이동 및 신규 `locale` 파라미터에 JSDoc 없음
  - 위치: `utils/date.ts` — `formatDuration`, `timeAgo`, `formatDate`
  - 상세: 세 함수 모두 `locale` 파라미터가 추가되었으나 선택적 파라미터의 기본값 동작(store에서 읽어옴)이 문서화되지 않음
  - 제안: `@param locale — defaults to current store locale if omitted` 형태로 JSDoc 추가

- **[INFO]** i18n 시스템 추가에 따른 spec/README 업데이트 없음
  - 위치: 프로젝트 루트 `README.md`, `spec/` 디렉터리
  - 상세: 새 번역 키를 추가하는 방법(`dict/ko.ts`, `dict/en.ts`에 동시 추가 필요), 지원 로케일, 폴백 동작 등이 어디에도 문서화되지 않음
  - 제안: `spec/` 또는 `frontend/README.md`에 i18n 아키텍처와 번역 기여 가이드 추가

- **[INFO]** `STORAGE_KEY` 상수와 `applyHtmlLang` 함수 설명 없음
  - 위치: `stores/locale-store.ts`
  - 상세: `document.documentElement.lang` 설정이 SEO/접근성 목적임을 알 수 없음
  - 제안: 접근성(aria) 및 SEO를 위한 `lang` 속성 설정임을 간단히 주석으로 명시

---

### 요약

이번 i18n 구현은 구조적으로 잘 설계되어 있으나, 핵심 공개 API(`translate`, `useT`)와 비직관적인 패턴들(`void t;`, null byte sentinel, React 외부 store 접근, 컴포넌트 내부 Zod 스키마)에 대한 설명이 전무하다. 특히 `register-form.tsx`의 Terms 링크 렌더링 방식과 `date.ts`의 `currentLocale()` 패턴은 다음 개발자가 올바른 맥락 없이 코드를 수정할 경우 버그를 유발하기 쉬운 지점이며, 새 번역 키 추가 방법에 대한 spec 문서 부재는 팀 협업 시 일관성 문제로 이어질 수 있다.

### 위험도

**MEDIUM**