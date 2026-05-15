# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 테스트 누락(DocsLink XSS 방어·parseRoute 핵심 라우팅 로직), 쿠키 상수 중복, Secure 속성 누락, rest 변수 섀도잉 등 복합적 위험 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 누락 | `DocsLink` 컴포넌트 테스트 없음 — XSS 방어 로직(`javascript:`, `data:` scheme 차단), locale 중복 주입 방지, 외부 링크 처리 등 보안·정확성 핵심 로직이 전혀 검증되지 않음 | `docs-link.tsx` | `javascript:` scheme 차단, 이미 localized된 링크 처리, locale 자동 주입, 외부 링크 `target=_blank` 등 케이스별 테스트 파일 작성 |
| 2 | 테스트 누락 | `parseRoute` 함수 단위 테스트 없음 — `slug[0]`을 locale로 해석하는 핵심 라우팅 로직으로 오동작 시 프로덕션에서 무한 redirect 가능 | `[...slug]/page.tsx` | `parseRoute`를 export하거나 별도 모듈로 분리 후 `rawSlug.length < 3` 경계값, 알 수 없는 locale 처리, 유효 파싱 케이스 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 중복 상수 | 쿠키 키 상수가 3곳에 독립 선언됨 — `locale-store.ts`의 `COOKIE_KEY`, `server-locale.ts`의 `LOCALE_COOKIE_NAME`, 테스트 파일 모두 `"idea-workflow.locale"` 리터럴. 한 곳만 변경 시 서버-클라이언트 locale 동기화가 조용히 깨짐 | `locale-store.ts:5`, `server-locale.ts:3` | `server-locale.ts`의 `LOCALE_COOKIE_NAME`을 단일 출처로 삼고 `locale-store.ts`에서 import. 또는 별도 `constants.ts`로 추출 |
| 2 | 보안 | `writeLocaleCookie`에 `Secure` 속성 미설정 — HTTPS 환경에서도 HTTP로 쿠키 전송 가능. locale 자체는 민감하지 않으나 SSR 렌더링 분기를 결정하는 쿠키이므로 보안 hygiene 위반 | `locale-store.ts:13` | `; Secure` 추가. 개발 환경 예외가 필요하면 `process.env.NODE_ENV !== 'development'` 조건부 적용 |
| 3 | 가독성·버그위험 | `docs-link.tsx`에서 `rest` 변수 섀도잉 — props `...rest`와 내부 `const rest = href.slice(...)` 동일명 충돌. 블록 스코프로 런타임 버그는 없으나 `{...rest}` 참조가 어느 값인지 즉시 판별 불가, 향후 편집 오류 위험 | `docs-link.tsx:38` | 내부 변수를 `pathSuffix` 또는 `docPath`로 명명 |
| 4 | API 계약 | URL 구조 breaking change — `/docs/<slug>` → `/docs/<locale>/<slug>`. 서버 redirect가 구현되었으나 외부 링크·SEO·북마크·CDN 캐시에 영향. 현재 redirect 방식이 영구(301)인지 임시(307)인지 불명확 | `[...slug]/page.tsx:15-20`, `generateStaticParams()` | `next.config.js`의 `redirects`에 명시적 301 규칙 추가; README에 새 URL 패턴 문서화 |
| 5 | 성능·동시성 | `buildSearchIndex`가 매 레이아웃 렌더마다 locale 수 × 문서 수만큼 `fs.readFileSync` 동기 I/O 실행 — 동시 요청 폭증 시 이벤트 루프 블로킹 | `layout.tsx:17-19`, `registry.ts buildSearchIndex` | React `cache()` 또는 모듈 수준 `Map<Locale, DocsSearchEntry[]>` 싱글턴으로 결과 캐싱. `getDocsIndex` 재로드 시에만 무효화 |
| 6 | 테스트 | `readLocaleCookie`(server-locale.ts) 테스트 없음 — `/docs` 인덱스 redirect와 slug 페이지 두 진입점에서 호출되는 SSR 핵심 함수 | `server-locale.ts` | `next/headers` mock 후 유효 locale 반환·null 반환 케이스 단위 테스트 추가 |
| 7 | 테스트 | `doc-body-notice.test.tsx`에 컴포넌트와 무관한 locale store setup/teardown 잔존 — `DocBodyNotice`는 더 이상 `useLocale()` 미사용이나 `beforeEach`에서 `useLocaleStore.setState` 호출 | `doc-body-notice.test.tsx` | locale store 관련 setup/teardown 코드 제거, `fellBackToKorean` prop만으로 분기 표현 |
| 8 | 테스트 | `docs-sidebar.test.tsx`에서 locale 전환 시나리오 미검증 — `activeSectionKey`가 `localizedDocsHref(p.slug, locale) === pathname`으로 변경됐으나 locale 변경 시 active 상태 갱신 미검증 | `docs-sidebar.test.tsx` | locale을 "en"으로 변경 후 `/docs/en/...` href가 active로 인식되는 케이스 추가 |
| 9 | 테스트 | `buildSearchIndex` locale 생략(기본값) 경로 미검증 | `registry.test.ts` | `buildSearchIndex(index)` 호출 시 `DEFAULT_LOCALE(ko)` 동작 확인 테스트 추가 |
| 10 | 유지보수 | `importEn` 변수명이 특정 locale에 종속 — 실제 의미는 "현재 locale에 번역본 존재 여부"이나 이름이 영어만을 암시, 신규 locale 추가 시 오해 유발 | `page.tsx:92` | `hasTranslation` 또는 `shouldImportTranslation`으로 변경 |
| 11 | 유지보수 | `isLocaleSibling` 정규식이 2자리 locale만 허용 — `zh-TW`, `pt-BR` 등 BCP 47 형식 locale 추가 시 sibling 파일이 canonical로 잘못 등록될 수 있음 | `registry.ts:158` | `[a-z]{2,3}(-[A-Z]{2})?`로 확장하거나 `LOCALES` 배열 기반으로 파일명 suffix 직접 확인 |
| 12 | 문서 | `page.tsx` 주석이 실제 동작과 불일치 — "fr 등 알 수 없는 locale 코드도 DEFAULT_LOCALE로 교체"라고 쓰여있으나 실제로는 `fr`가 docSlug에 포함된 채 redirect됨 | `page.tsx:83-84` | 주석을 실제 동작(`fr → docSlug 일부로 포함 → getDocBySlug 실패 → notFound`)에 맞게 수정 |
| 13 | 아키텍처 | `DocsLink`가 `"use client"`로 MDX 전체 `<a>` 태그를 클라이언트 컴포넌트화 — 페이지당 수십 개 링크 hydration 발생, SSG 이점 감소, XSS 방어·locale 주입 두 책임 혼재(SRP 위반) | `docs-link.tsx`, `mdx-components.tsx` | 서버 컴포넌트에서 locale을 MDX context prop으로 전달하거나 remark 플러그인으로 빌드타임 변환 검토 |
| 14 | 아키텍처 | `localizedDocsHref`가 `locale.ts`와 `registry.ts` 두 경로로 import 가능 — `registry.ts`는 서버 전용(`node:fs`) 모듈임에도 클라이언트 안전 유틸을 재수출하여 모듈 경계 불명확 | `locale.ts:61`, `registry.ts` re-export | `registry.ts`의 locale 함수 re-export 제거; 모든 소비처가 `locale.ts`에서 직접 import |
| 15 | 문서 | 콘텐츠 작성자를 위한 i18n 규약 문서 없음 — `title_en`/`summary_en` 프론트매터, `<slug>.en.mdx` 명명 규칙, locale-less 내부 링크 작성법 등 어디에도 문서화되지 않음 | `spec/` 또는 `src/content/docs/` | `spec/` 또는 `src/content/docs/`에 i18n 규약 문서 추가 |
| 16 | 문서 | README에 URL 구조 변경 미반영 — CLAUDE.md 지침에도 "README 업데이트" 의무 명시됨 | 프로젝트 루트 README | 새 URL 패턴(`/docs/ko/...`, `/docs/en/...`) 및 레거시 경로 호환성 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `docs-locale-url-sync.test.tsx` — pathname 동적 변화 시나리오 없음. 초기 렌더만 검증, pathname 변경 후 useEffect 재실행으로 redirect 트리거 미검증 | `docs-locale-url-sync.test.tsx` | `mockPathname` 변경 후 `rerender` 호출 케이스 추가 |
| 2 | 테스트 | `isLocaleSibling`·`detectAvailableLocales` 직접 단위 테스트 없음, `loadDocsIndex` 통합 테스트로만 검증 | `registry.ts` | 두 함수 export 또는 fixture 다양화로 직접 테스트 추가 |
| 3 | 성능 | `resolveLocalizedDocPath`에서 `fs.existsSync` 재호출 — `DocMeta.availableLocales`에 이미 계산된 정보가 있음에도 중복 syscall | `registry.ts resolveLocalizedDocPath` | `buildSearchIndex`에서 `page.availableLocales.includes(locale)`로 판별, `existsSync` 제거 |
| 4 | 성능 | `DocsLink.isAlreadyLocalized`가 렌더마다 `LOCALES` 선형 탐색 — locale 수 증가 시 링크 수 × locale 수만큼 증가 | `docs-link.tsx isAlreadyLocalized` | 모듈 수준 `Set` 또는 정규식 미리 컴파일: `new RegExp(\`^/docs/(${LOCALES.join("\|")})[/]?\`)` |
| 5 | 성능 | `DocsSearch` locale 변경 시 Fuse 인덱스 재생성 — locale 전환마다 O(N) 작업 재실행 | `docs-search.tsx:35-36` | 모든 locale 인덱스를 `useMemo`로 한 번에 생성: `LOCALES.map(loc => [loc, new Fuse(...)])` |
| 6 | 타입 안전성 | `docs-search.tsx`에서 서버 전용 모듈(`registry.ts`) `import type` 사용 — 현재 안전하나 value import로 변경 시 클라이언트 번들에 `node:fs` 포함 위험 | `docs-search.tsx:8` | `DocsSearchEntry` 타입을 `locale.ts` 또는 별도 `types.ts`로 분리 |
| 7 | 유지보수 | `DocMeta.href`가 locale 없는 canonical 경로임에도 직접 navigation에 쓰일 위험 — 타입 시스템이 차단 불가 | `registry.ts DocMeta` | 필드명을 `canonicalHref`로 변경하거나 JSDoc에 `⚠ Navigation용 아님 — localizedDocsHref() 사용` 추가 |
| 8 | 유지보수 | `locale-store.ts`에서 `COOKIE_KEY`와 `STORAGE_KEY` 모두 동일한 `"idea-workflow.locale"` 값으로 선언 | `locale-store.ts:4-5` | 의도적 분리라면 주석으로 이유 명시, 아니면 단일 상수로 통합 |
| 9 | 아키텍처 | 서버 redirect(레거시 URL)·클라이언트 `router.replace`(locale 변경) 이중 메커니즘의 역할이 문서화되지 않아 향후 유지보수 혼동 위험 | `[...slug]/page.tsx:80-89`, `docs-locale-url-sync.tsx:18-25` | 두 경로의 처리 범위를 코드 주석으로 명확히 선언 (서버: 첫 진입/크롤러, 클라이언트: 런타임 locale 전환) |
| 10 | 아키텍처 | `parseRoute`의 `rawSlug.length < 3` 제약이 미래 단일 depth doc 추가 시 의도치 않은 redirect 유발 가능 | `[...slug]/page.tsx:37` | 주석으로 제약 명시: `// minimum: locale + section + slug (current structure always 2-depth)` |
| 11 | 보안 | `docs-link.tsx`에서 `typeof href === "string"` 이중 검사 중복 | `docs-link.tsx:27-28` | `if (!safe)`만으로 충분, 중복 제거 |
| 12 | 코드 품질 | `registry.ts` 말미 불필요한 빈 줄 추가 | `registry.ts:309-310` | 빈 줄 1개로 정리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | DocsLink·parseRoute 테스트 누락, 기존 테스트 코드 노이즈 |
| architecture | MEDIUM | 쿠키 상수 이중 정의, localizedDocsHref 모듈 경계 혼재, DocsLink 클라이언트화 |
| performance | MEDIUM | buildSearchIndex 매 요청마다 동기 I/O, 중복 existsSync |
| maintainability | MEDIUM | rest 변수 섀도잉, 쿠키 상수 중복, importEn 명명, isLocaleSibling 정규식 |
| documentation | MEDIUM | page.tsx 주석 오류, 콘텐츠 i18n 규약 미문서화, README 미업데이트 |
| api_contract | MEDIUM | URL 구조 breaking change, 쿠키 계약 이중 선언 |
| side_effect | MEDIUM | 인터페이스 변경 누락 여부, DocsLink 클라이언트 전환 영향 |
| concurrency | LOW | buildSearchIndex 동기 I/O 이벤트 루프 블로킹 |
| dependency | LOW | 쿠키 상수 중복, Secure 플래그 누락, 서버 모듈 타입 import |
| security | LOW | Secure 속성 누락, 동적 import 경로 isSafeDocsSlug 의존, redirect slug 미검증 |
| scope | LOW | rest 변수 섀도잉, 불필요한 빈 줄 |
| requirement | LOW | rest 변수명 충돌, parseRoute 제약, Secure 속성 누락 |
| database | NONE | 해당 없음 (순수 프론트엔드 변경) |

---

## 발견 없는 에이전트

| 에이전트 |
|----------|
| database |

---

## 권장 조치사항

1. **[CRITICAL] `DocsLink` 테스트 파일 작성** — XSS 방어(`javascript:`, `data:` 차단), locale 자동 주입, 이미 localized된 링크 중복 방지, 외부 링크 처리 케이스 포함
2. **[CRITICAL] `parseRoute` 단위 테스트 추가** — `rawSlug.length < 3` 경계값, 알 수 없는 locale, 유효 파싱 케이스; 함수를 export하거나 별도 모듈로 분리
3. **[WARNING] 쿠키 키 상수 단일화** — `LOCALE_COOKIE_NAME`을 `server-locale.ts` 또는 별도 `constants.ts`에서 export, `locale-store.ts`에서 import
4. **[WARNING] `writeLocaleCookie`에 `Secure` 속성 추가** — `process.env.NODE_ENV !== 'development'` 조건부 또는 무조건 적용
5. **[WARNING] `docs-link.tsx` `rest` 변수 섀도잉 해소** — 내부 변수를 `pathSuffix`로 명명
6. **[WARNING] `buildSearchIndex` 결과 캐싱** — React `cache()` 또는 모듈 수준 Map 싱글턴으로 매 요청 동기 I/O 제거
7. **[WARNING] 기존 테스트 코드 정리** — `doc-body-notice.test.tsx` locale store setup/teardown 제거; `docs-sidebar.test.tsx` locale 전환 시나리오 추가; `registry.test.ts` 기본 locale 경로 추가
8. **[WARNING] `importEn` 변수명 변경** — `hasTranslation`으로 의미 명확화
9. **[WARNING] README 업데이트** — 새 URL 패턴(`/docs/ko/...`, `/docs/en/...`) 및 레거시 경로 호환성 명시 (CLAUDE.md 지침 준수)
10. **[WARNING] 콘텐츠 i18n 규약 문서 작성** — sibling 파일 명명 규칙, 프론트매터 필드, locale-less 내부 링크 작성법을 `spec/` 또는 `src/content/docs/`에 추가
11. **[INFO] `localizedDocsHref` import 경로 통일** — `registry.ts` re-export 제거, `locale.ts` 직접 import로 통일
12. **[INFO] `isLocaleSibling` 정규식 확장** — `[a-z]{2,3}(-[A-Z]{2})?` 또는 `LOCALES` 배열 기반 매칭으로 BCP 47 대비