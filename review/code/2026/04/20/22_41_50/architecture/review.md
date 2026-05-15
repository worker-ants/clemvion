### 발견사항

---

**[WARNING] 쿠키 키 상수 이중 정의**
- 위치: `locale-store.ts:5` (`COOKIE_KEY = "idea-workflow.locale"`), `server-locale.ts:3` (`LOCALE_COOKIE_NAME = "idea-workflow.locale"`)
- 상세: 서버(SSR)가 읽는 쿠키 이름과 클라이언트(Zustand)가 쓰는 쿠키 이름이 동일한 문자열로 두 파일에 독립적으로 선언되어 있습니다. 한쪽만 변경되면 locale 결정 로직이 조용히 깨집니다. 두 파일 간 단방향 의존이 없어 타입시스템이 불일치를 감지할 수 없습니다.
- 제안: `server-locale.ts`의 `LOCALE_COOKIE_NAME`을 `@/lib/i18n/types` 또는 별도 `constants.ts`로 이동하고, `locale-store.ts`가 동일 상수를 import해서 단일 출처(Single Source of Truth)를 만드세요.

---

**[WARNING] `localizedDocsHref` 모듈 경계 혼재**
- 위치: `locale.ts:61`, `registry.ts` (re-export)
- 상세: `localizedDocsHref`가 `locale.ts`에 정의되고 `registry.ts`에서 재수출되어 두 가지 import 경로가 공존합니다. `docs-sidebar.tsx`는 `locale.ts`에서, `[...slug]/page.tsx`는 `registry.ts`에서 같은 함수를 가져옵니다. `registry.ts`가 `fs`/`path` 의존을 가지는 서버 전용 모듈임에도 클라이언트 안전 유틸리티를 재수출하는 barrel 역할을 겸하면서 모듈의 책임이 불명확해집니다.
- 제안: `registry.ts`의 locale 함수 re-export를 제거하고, 모든 소비처가 `locale.ts`를 직접 import하도록 통일하세요. `registry.ts`는 파일시스템 인덱스 빌드에만 집중해야 합니다.

---

**[WARNING] `DocsLink`가 `"use client"`로 MDX 전체를 클라이언트 컴포넌트화**
- 위치: `docs-link.tsx`
- 상세: MDX 본문의 모든 `<a>` 태그가 `useLocale()`(Zustand 스토어)를 호출하는 클라이언트 컴포넌트로 교체됩니다. 문서 사이트에서 링크 수는 페이지당 수십 개에 달하므로 각 링크마다 클라이언트 hydration이 발생하고, 정적 생성(SSG) 이점이 감소합니다. 또한 XSS 방어와 locale 주입이라는 두 가지 책임을 단일 컴포넌트가 담당합니다(SRP 위반).
- 제안: 서버 컴포넌트인 `DocPage`에서 locale을 MDX context prop으로 전달하거나, locale 프리픽스가 없는 내부 doc 링크를 빌드타임에 `remark` 플러그인으로 변환하는 방식을 검토하세요. XSS 방어 로직은 순수 유틸리티 함수로 분리 가능합니다.

---

**[INFO] `parseRoute`의 암묵적 URL 구조 계약**
- 위치: `[...slug]/page.tsx:35` (`if (rawSlug.length < 3) return null`)
- 상세: "locale + section + slug 최소 3개" 규칙이 주석으로만 기술되고, 코드 여러 곳(`generateStaticParams`, `DocsLocaleUrlSync` 세그먼트 파싱, `localizedDocsHref`)에 암묵적으로 분산되어 있습니다. 섹션 없는 최상위 문서(`/docs/ko/overview` = 2세그먼트)를 추가할 경우 `parseRoute`가 `null`을 반환해 레거시 redirect 분기로 잘못 진입합니다.
- 제안: URL 구조 계약을 `@/lib/docs/routing.ts` 같은 별도 모듈로 추출하고, `parseRoute`를 export해 다른 소비처(sidebar, link)가 동일 로직을 재사용하도록 하세요.

---

**[INFO] 레이아웃에서 locale별 `buildSearchIndex` 전량 실행**
- 위치: `layout.tsx:17–20`
- 상세: `LOCALES.map(locale => buildSearchIndex(index, locale))`가 layout 렌더마다(RSC 모드에서는 요청마다) 모든 MDX 파일을 locale 수 × 문서 수만큼 읽습니다. 현재 2개 locale이지만 locale·문서가 늘어날수록 cold-start latency가 선형 증가합니다.
- 제안: `buildSearchIndex` 결과를 `getDocsIndex()`와 동일한 singleton 캐시에 locale 키로 memoize하거나, Next.js의 `unstable_cache`/`cache()` API를 활용해 재빌드 주기를 명시하세요.

---

**[INFO] 이중 redirect 메커니즘의 역할 불명확**
- 위치: `[...slug]/page.tsx:80–89` (서버 redirect), `docs-locale-url-sync.tsx:18–25` (클라이언트 replace)
- 상세: 레거시 URL은 서버가, locale 변경은 클라이언트가 처리하는 구조는 논리적으로 분리되어 있지만, 언어 전환 시 서버 렌더 → 클라이언트 replace 순서로 URL이 두 번 바뀔 수 있고, 이 플래시(flash) 동작이 명시적으로 문서화되지 않아 향후 유지보수에서 혼동을 줄 수 있습니다.
- 제안: 두 경로의 처리 범위를 코드 주석 또는 ADR로 명확히 선언하세요. (서버: 첫 진입/북마크/크롤러용, 클라이언트: 런타임 locale 전환용)

---

### 요약

이 변경은 docs URL에 locale 세그먼트를 도입하는 전략적으로 올바른 접근이며, `availableLocales` 감지·sibling 폴백·URL redirect 등 핵심 흐름은 잘 설계되어 있습니다. 다만 **쿠키 키 이중 정의**(유지보수 hazard), **`localizedDocsHref` 재수출로 인한 혼재된 모듈 경계**, **`DocsLink`의 클라이언트 컴포넌트화**가 중기적으로 버그 또는 성능 문제로 이어질 수 있습니다. `registry.ts`가 파일시스템 인덱서와 locale 유틸 barrel을 겸하는 점도 단일 책임 원칙을 약화시킵니다.

### 위험도

**MEDIUM**