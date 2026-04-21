---

### 발견사항

---

**[WARNING]** `DocsLink`에서 변수명 `rest` 중복 선언 — 심각한 혼란 유발
- **위치:** `docs-link.tsx:30`, `docs-link.tsx:47`
- **상세:** 함수 파라미터에서 `...rest`로 props를 구조분해한 후, 같은 함수 내 if 블록 안에서 `const rest = href.slice(...)` 를 재선언합니다. 블록 스코프 덕분에 `{...rest}` (L51)이 실제로는 props `rest`를 참조하므로 런타임 버그는 아니지만, 미래 편집자가 두 `rest` 중 어느 것이 참조되는지 혼동하기 쉽습니다. 특히 if 블록 내에서 `resolved = ... /${rest}` 바로 아래에 있어 `{...rest}` 를 props가 아닌 경로 문자열로 잘못 읽을 위험이 있습니다.
- **제안:** 내부 변수를 `pathSuffix` 또는 `docPath`로 명명.
  ```tsx
  const pathSuffix = href.slice("/docs/".length);
  resolved = `/docs/${locale}/${pathSuffix}`;
  ```

---

**[WARNING]** `parseRoute`가 depth-1 doc slug를 레거시 redirect로 처리
- **위치:** `[...slug]/page.tsx:37` — `if (rawSlug.length < 3) return null;`
- **상세:** `rawSlug.length < 3`이면 null을 반환하여 아래의 레거시 redirect 분기를 탑니다. 현재 문서 구조는 모두 `[section]/[slug]` 2-depth이므로 3-segment 최솟값이 맞지만, 향후 단일 depth doc(`/docs/en/standalone`)을 추가하면 의도치 않게 redirect됩니다. 주석에 이 제약을 명시하거나 `length < 2` (locale + 1 doc)로 완화하는 것을 고려하세요.
- **제안:** 주석 보강: `// minimum: locale + at least one slug segment (current docs always have section/slug)` 또는 스펙 정의에서 최솟값 확정.

---

**[WARNING]** `writeLocaleCookie`에 `Secure` 속성 미포함
- **위치:** `locale-store.ts:13`
- **상세:** `SameSite=Lax`는 설정되어 있으나 `Secure` 속성이 없어, HTTP 환경(개발/스테이징 포함)에서 쿠키가 평문 전송됩니다. locale 정보 자체는 민감하지 않지만, 프로덕션에서 HTTPS를 강제할 경우 `Secure` 없이 설정된 쿠키는 브라우저마다 다르게 처리될 수 있습니다.
- **제안:** 환경에 따라 조건부 적용 — `process.env.NODE_ENV === 'production' ? '; Secure' : ''` 또는 항상 `Secure` 포함.

---

**[INFO]** `doc-body-notice.test.tsx`의 `beforeEach` locale 설정이 컴포넌트와 무관
- **위치:** `doc-body-notice.test.tsx:8`
- **상세:** `beforeEach`에서 `useLocaleStore.setState({ locale: "en" })`를 설정하지만, `DocBodyNotice`는 이제 `useLocale()`을 사용하지 않고 `fellBackToKorean` prop으로만 동작합니다. 테스트 의도를 흐리는 노이즈입니다.
- **제안:** `beforeEach`에서 locale store 설정 제거 (또는 `locale: "ko"` 기본값으로 유지하되 주석 삭제).

---

**[INFO]** `registry.ts` 말미 불필요한 빈 줄
- **위치:** `registry.ts:310` (diff 기준 `+` 빈 줄 2개 연속)
- **상세:** `buildSearchIndex` 종료 뒤 빈 줄이 한 줄 초과로 추가되었습니다.
- **제안:** 빈 줄 1개로 정리.

---

**[INFO]** `buildSearchIndex`를 layout 렌더마다 모든 locale에 대해 실행
- **위치:** `layout.tsx:17–19`
- **상세:** `LOCALES.map(locale => buildSearchIndex(index, locale))`는 파일을 로컬 파일시스템에서 읽습니다. `getDocsIndex()`가 캐시되므로 심각한 성능 문제는 아니지만, `buildSearchIndex` 자체는 매 요청마다 `fs.readFileSync`를 호출합니다. Next.js 캐싱 전략이 없는 경우 반복 I/O가 발생합니다.
- **제안:** 현재는 허용 가능한 수준이나, 문서 수가 늘어나면 `buildSearchIndex` 결과를 `getDocsIndex` 수준에서 메모화 고려.

---

### 요약

이번 변경은 `/docs` 라우팅에 locale prefix를 도입하고, 쿠키 기반 SSR locale 판정, 번역 sibling 탐지, locale-aware 검색 인덱스를 일관되게 구현한 대규모 기능입니다. 요구사항 충족 관점에서 핵심 경로(locale redirect, fallback, URL 동기화, 검색)는 모두 구현되어 있으며 테스트 커버리지도 적절합니다. 다만 `DocsLink`의 `rest` 변수명 충돌은 유지보수 위험이 있고, `Secure` 쿠키 속성 누락은 프로덕션 HTTPS 환경에서 잠재적 문제입니다. 이 두 항목 수정을 권고합니다.

### 위험도

**LOW**