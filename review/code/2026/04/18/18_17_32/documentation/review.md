### 발견사항

---

- **[INFO]** `LocaleSync` 컴포넌트에 JSDoc 없음
  - 위치: `locale-sync.tsx:7` — `export function LocaleSync()`
  - 상세: localStorage 초기화(`initFromStorage`)와 인증 상태 기반 locale 동기화(`user.locale`)라는 두 가지 역할을 수행하는 컴포넌트이나, 왜 `Providers`에서 반드시 마운트해야 하는지, 각 `useEffect`의 의도가 무엇인지 설명이 없음. 다른 개발자가 중복으로 판단해 제거할 위험 있음.
  - 제안: 컴포넌트 선언 위에 두 역할과 마운트 위치에 대한 간단한 JSDoc 추가.

- **[INFO]** `applyHtmlLang`의 목적(접근성/SEO) 설명 없음
  - 위치: `locale-store.ts:12-15` — `function applyHtmlLang(locale: Locale)`
  - 상세: `document.documentElement.lang` 을 설정하는 이유(스크린리더 지원 및 SEO용 `<html lang>` 속성)가 코드에서 전혀 드러나지 않음. 동일 효과를 내는 다른 방법으로 우연히 교체되거나 삭제될 가능성 있음.
  - 제안: `// sets <html lang> for accessibility (screen readers) and SEO` 한 줄 주석 추가.

- **[INFO]** `isLocale()` 타입 가드에 JSDoc 없음
  - 위치: `types.ts:5-7` — `export function isLocale(value: unknown): value is Locale`
  - 상세: `unknown` 입력을 받아 타입 내로우잉하는 가드 함수로, `locale-store`, `locale-sync`, `profile/page` 등 여러 경계에서 신뢰 기점으로 사용됨. 역할이 단순하지만 공개 API이므로 간단한 설명이 있으면 활용 목적이 명확해짐.
  - 제안: `/** Returns true if value is a supported locale ("ko" | "en"). Use at trust boundaries (localStorage, API responses). */` 추가.

- **[INFO]** spec/README에 i18n 아키텍처 미문서화 (이월 상태)
  - 위치: `RESOLUTION.md` — "별도 문서 커밋으로 분리 예정"
  - 상세: 번역 키 추가 방법(`dict/ko.ts`와 `dict/en.ts` 동시 수정 필요), 지원 로케일, 폴백 동작(`ko` fallback), `TranslationKey` 타입 추론 구조 등이 어디에도 문서화되지 않은 상태가 지속되고 있음. 팀 협업 시 번역 키 누락 또는 불일치 위험.
  - 제안: `spec/` 또는 `frontend/README.md`에 i18n 기여 가이드(지원 로케일, 키 추가 절차, 폴백 동작) 커밋 예정 작업 트래킹 필요.

---

### 요약

RESOLUTION.md에 명시된 대로 핵심 공개 API(`translate()`, `useT()`, `useLocale()`)에 JSDoc이 적절히 추가되었고, `core.ts` 분리로 RSC 호환성도 갖추었다. 남은 문서화 결함은 모두 INFO 수준으로, `LocaleSync` 컴포넌트의 역할 설명 부재, `applyHtmlLang`의 접근성 목적 미주석, 그리고 이월 상태인 spec/README i18n 아키텍처 문서가 주요 항목이다. 기능 안전성에는 영향이 없으나 팀 협업 관점에서 번역 키 추가 가이드 문서가 가장 우선 작성되어야 한다.

### 위험도
**LOW**