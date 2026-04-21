### 발견사항

- **[WARNING]** 문서 URL 구조 변경 — 하위 호환성 위험
  - 위치: `page.tsx` L15–20, `generateStaticParams()`
  - 상세: 기존 `/docs/<section>/<slug>` → `/docs/<locale>/<section>/<slug>`로 URL 구조가 변경됨. `dynamicParams = true`로 전환하고 레거시 URL에 대한 redirect를 구현했으나, 이는 외부에서 직접 링크된 URL, SEO 인덱스, 공유된 북마크 등에 영향을 미치는 breaking change임.
  - 제안: 서버 측 301 Permanent Redirect(현재 임시 redirect로 보임)로 처리하고, `next.config.js`의 `redirects` 설정에 명시적 규칙을 추가해 크롤러와 CDN 캐시가 올바르게 처리되도록 할 것.

- **[WARNING]** 쿠키 기반 암묵적 SSR/CSR API 계약
  - 위치: `locale-store.ts`, `server-locale.ts`
  - 상세: 클라이언트(`writeLocaleCookie`)가 `idea-workflow.locale` 쿠키를 기록하고, 서버 컴포넌트(`readLocaleCookie`)가 이를 SSR 시 읽어 locale을 결정하는 구조. 이 쿠키 이름과 값 형식(`"ko"` | `"en"`)이 암묵적인 API 계약이 됨. 현재 `LOCALE_COOKIE_NAME` 상수가 `server-locale.ts`에만 export되어 있고, `locale-store.ts`에는 `COOKIE_KEY`로 독립적으로 선언되어 있어 이름 불일치 위험이 있음.
  - 제안: 쿠키 키 상수를 단일 소스(`server-locale.ts`의 `LOCALE_COOKIE_NAME`)에서 export하고, `locale-store.ts`에서 이를 import해 사용해야 함. 현재 두 곳에서 각각 `"idea-workflow.locale"`로 동일하게 선언되어 있어 향후 변경 시 동기화 실패 가능성이 있음.

- **[WARNING]** `DocsSearchEntry.href` 계약 변경
  - 위치: `registry.ts` L257–258, `buildSearchIndex()`
  - 상세: `DocsSearchEntry.href`가 이전에는 `/docs/<section>/<slug>` 형태였으나, 이제 `/docs/<locale>/<section>/<slug>`를 반환함. 이 인터페이스를 직접 소비하는 외부 코드(예: 다른 컴포넌트, 테스트, 또는 잠재적 API 클라이언트)가 있다면 href 형식 변경이 breaking change임.
  - 제안: JSDoc에 "locale-prefixed" 명시(이미 추가됨)는 좋으나, 인터페이스 버전 관리 또는 마이그레이션 가이드를 문서화할 것.

- **[INFO]** `DocBodyNotice` 컴포넌트 API — required prop 추가
  - 위치: `doc-body-notice.tsx`
  - 상세: 기존 `<DocBodyNotice />` → `<DocBodyNotice fellBackToKorean={boolean} />`로 변경. 내부적으로만 사용되는 컴포넌트이므로 외부 계약 위반은 아니나, 내부 컴포넌트 API의 breaking change임. 테스트 업데이트가 함께 이루어진 점은 긍정적.
  - 제안: 해당 없음 (적절히 처리됨).

- **[INFO]** `DocsSearch` 컴포넌트 API — prop 형태 변경
  - 위치: `docs-search.tsx`
  - 상세: `entries: DocsSearchEntry[]` → `entriesByLocale: Record<Locale, DocsSearchEntry[]>`로 변경. 이 역시 내부 컴포넌트 API 변경이며, 레이아웃에서의 유일한 사용처도 함께 업데이트됨.
  - 제안: 해당 없음 (적절히 처리됨).

- **[INFO]** `buildSearchIndex` 함수 시그니처 — 하위 호환 변경
  - 위치: `registry.ts` L279–281
  - 상세: `locale: Locale = DEFAULT_LOCALE` 기본값 추가로 기존 호출부는 영향 없음. 하위 호환성 유지됨.
  - 제안: 해당 없음.

- **[INFO]** `DocMeta` 인터페이스 확장
  - 위치: `registry.ts` L38–43
  - 상세: `availableLocales: Locale[]` 필드 추가. TypeScript 타입 확장이며, 직렬화/역직렬화 없이 메모리에서만 사용하므로 위험 없음.
  - 제안: 해당 없음.

---

### 요약

이번 변경의 핵심은 백엔드 REST API가 아닌 **프론트엔드 라우팅 계약의 변경**이다. 가장 주목할 사항은 `/docs/<slug>` → `/docs/<locale>/<slug>` URL 구조 전환으로, 이는 외부 링크·SEO·북마크에 영향을 주는 breaking change이며 redirect 처리로 완화되어 있다. 쿠키 기반 SSR/CSR locale 계약에서 동일한 쿠키 키가 두 파일에 독립적으로 선언된 부분은 관리 부채로 즉시 통합이 필요하다. 나머지 컴포넌트 prop 변경들은 내부 API이며 테스트와 함께 일관되게 업데이트되어 있다.

### 위험도
**MEDIUM**