### 발견사항

---

**[WARNING]** 오해를 유발하는 인라인 주석 — `page.tsx`
- 위치: `DocPage` 함수, `!parsed` 분기 내 (약 88번째 줄)
- 상세: 주석 `// 알 수 없는 locale 코드("fr" 등)도 여기로 빠짐. DEFAULT_LOCALE로 교체.` 는 두 가지 점에서 부정확합니다. ① "fr"은 `isLocale()` 체크를 통과하지 않으므로 `notFound()`가 아니라 redirect 분기로 이동하는데, redirect URL은 `cookieLocale ?? DEFAULT_LOCALE`을 프리픽스로 사용하고 `slug.join("/")`에 "fr"이 그대로 포함됩니다(`/docs/ko/fr/01-first/page`). 즉 DEFAULT_LOCALE로 *교체*되는 것이 아닙니다. ② `DEFAULT_LOCALE`이 아닌 `cookieLocale`을 우선합니다.
- 제안:
  ```ts
  // 첫 세그먼트가 locale이 아닌 경우 — 레거시 경로로 보고 쿠키 locale을 프리픽스로 붙여 redirect.
  // "fr" 같은 지원하지 않는 locale 코드는 그대로 docSlug의 일부로 포함되므로,
  // 지원 locale(ko/en)이 아닌 값은 isLocale() 체크 이전에 별도 처리가 필요할 수 있음.
  ```

---

**[WARNING]** 콘텐츠 작성자를 위한 i18n 가이드 누락
- 위치: 전체 변경 범위 (특히 `registry.ts`, `locale.ts`, `.mdx` 파일들)
- 상세: 이번 변경으로 새로운 콘텐츠 규약이 도입되었습니다. `title_en` / `summary_en` 프론트매터 필드, `<slug>.en.mdx` 형식의 sibling 파일 명명 규칙, 로케일-프리픽스 없이 내부 링크 작성(`DocsLink`가 자동 주입). 그러나 이 규칙이 문서화된 곳이 없으며, 테스트 픽스처(`a.mdx`, `a.en.mdx`)만이 유일한 예시입니다. 콘텐츠 작성자가 파일을 추가하거나 링크를 수정할 때 혼란이 예상됩니다.
- 제안: `spec/` 또는 `prd/` 아래에 콘텐츠 i18n 규약 문서 추가. 최소한 `src/content/docs/` 내 `README.md` 한 파일이라도 작성:
  - sibling 파일 명명 규칙 (`foo.en.mdx`)
  - 프론트매터 필드 목록 (`title_en`, `summary_en`)
  - 내부 링크 작성 방법 (로케일 없이 `/docs/...` 작성 가능한 이유)

---

**[WARNING]** URL 구조 변경에 대한 README/CHANGELOG 미업데이트
- 위치: 프로젝트 루트 README, CHANGELOG
- 상세: `/docs/<slug>` → `/docs/<locale>/<slug>` 구조 변경은 기존 북마크, 외부 링크, 공유 URL을 모두 깨는 breaking change입니다. 서버 사이드 redirect가 구현되어 있지만, 이 동작 변경이 README나 CHANGELOG에 반영되지 않았습니다. CLAUDE.md 지침에도 "README 업데이트" 의무가 명시되어 있습니다.
- 제안: README의 "문서" 섹션에 새 URL 패턴(`/docs/ko/...`, `/docs/en/...`) 및 레거시 경로 호환성(쿠키 기반 redirect) 명시.

---

**[INFO]** `COOKIE_KEY` 와 `STORAGE_KEY` 중복 상수 — `locale-store.ts`
- 위치: `locale-store.ts` 상단 4–5번째 줄
- 상세: 두 상수 모두 `"idea-workflow.locale"` 로 동일한 값인데 별도로 선언되어 있습니다. 왜 하나로 합치지 않았는지 이유가 주석으로 없습니다. `server-locale.ts`의 `LOCALE_COOKIE_NAME`까지 합치면 동일한 문자열 리터럴이 세 군데에 분산됩니다.
- 제안: 단일 출처(예: `@/lib/i18n/types` 또는 `server-locale.ts`)로 통합하거나, 의도적으로 분리한 이유(독립적 진화 가능성 등)를 짧게 주석으로 남기기.

---

**[INFO]** `DocMeta.href` 사용처 혼동 위험
- 위치: `registry.ts` `DocMeta` 인터페이스
- 상세: `href` 필드에 `/** Canonical href without the locale prefix ... Locale-aware URLs are built at render time via localizedDocsHref. */` 주석이 추가된 것은 좋습니다. 하지만 `byHref.set(href, meta)` 로 lookup 맵을 구성하고 `getDocBySlug` 반환 객체에 `href`가 포함되어 있어, 미래 작성자가 `doc.href` 를 내비게이션에 직접 사용하는 실수를 할 수 있습니다. `@deprecated for navigation use` 등의 힌트가 있으면 더 명확합니다.
- 제안:
  ```ts
  /** Canonical (locale-free) href, e.g. `/docs/01-first/a`.
   *  ⚠ Navigation용이 아님 — 링크 생성은 `localizedDocsHref(slug, locale)` 사용. */
  href: string;
  ```

---

**[INFO]** `.en.mdx` 내부 링크의 locale-less 경로가 묵시적 규약
- 위치: 모든 `*.en.mdx` 콘텐츠 파일
- 상세: 영어 문서의 내부 링크들(`/docs/04-run-and-debug/run-results`, `/docs/02-nodes/overview` 등)이 locale 프리픽스 없이 작성되어 있으며, `DocsLink` 컴포넌트가 런타임에 자동 주입합니다. 이 동작이 의도적이고 올바르지만, 콘텐츠 작성자 관점에서 왜 `/docs/en/...`이 아닌 `/docs/...` 로 써야 하는지 어디에도 설명이 없습니다.
- 제안: `DocsLink` JSDoc에 한 줄 추가: `* @remarks MDX 본문에서는 locale-prefix 없이 `/docs/...` 링크를 사용하세요. 렌더 시 자동 주입됩니다.`

---

### 요약

이번 변경은 docs i18n 시스템을 구현하는 상당한 규모의 작업으로, 코드 내 주석 수준은 전반적으로 적절하며 핵심 함수(`localizedDocsHref`, `resolveLocalizedDocPath`, `DocsLocaleUrlSync`, `DocBodyNotice` 등)에 의도를 설명하는 한국어 주석이 잘 갖추어져 있습니다. 그러나 (1) `page.tsx`의 잘못된 주석이 "fr" 처리 동작을 오해하게 만들고, (2) 콘텐츠 작성자를 위한 i18n 규약 문서가 전혀 없으며, (3) URL 구조 변경이 README에 반영되지 않은 점은 반드시 보완이 필요합니다.

### 위험도

**MEDIUM**