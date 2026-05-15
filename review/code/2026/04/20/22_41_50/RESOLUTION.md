# Code Review Resolution

리뷰 식별: `review/2026-04-20_22-41-50/SUMMARY.md`
작업자: worker-ants
조치 완료 시각: 2026-04-20

## 테스트 결과 (조치 후)
- `pnpm lint` ✅
- `pnpm test` ✅ (990 / 990)
- `pnpm build` ✅ (44 static pages for `/docs/[...slug]`)

---

## Critical 조치

### 1. ✅ `DocsLink` 테스트 누락
- 신규: `frontend/src/components/docs/__tests__/docs-link.test.tsx`
- 커버리지: `javascript:` / `data:` 스킴 차단(XSS 방어), 로케일 프리픽스 자동 주입, 이미 로케일이 붙은 href 중복 방지, non-docs 내부 링크 미수정, 외부 링크 `target=_blank rel=noopener noreferrer`, `mailto:` / `#anchor` 허용.

### 2. ✅ `parseRoute` 단위 테스트 누락
- 라우팅 로직을 `frontend/src/lib/docs/route.ts` 로 분리하고 `parseDocsRoute`로 export.
- 신규 테스트: `frontend/src/lib/docs/__tests__/route.test.ts` — 유효 파싱·경계값(`< 3` 세그먼트)·알 수 없는 locale(`fr`)·깊이 보존 케이스.
- `[...slug]/page.tsx`는 더 이상 로컬 `parseRoute` 함수를 보유하지 않음.

---

## Warning 조치

### 1. ✅ 쿠키 키 상수 단일화
- 신규 모듈: `frontend/src/lib/i18n/cookie.ts` — `LOCALE_COOKIE_NAME` 단일 export.
- `server-locale.ts`와 `locale-store.ts` 모두 `cookie.ts`에서 import. 테스트는 동일 상수를 바라보도록 유지(리터럴 비교는 테스트 fixture의 한 곳이라 유지).
- `next/headers`를 client에 노출하지 않기 위해 별도 모듈로 분리.

### 2. ✅ `writeLocaleCookie` `Secure` 속성
- `locale-store.ts`에서 `process.env.NODE_ENV === "production"`일 때만 `; Secure` 삽입. dev 환경의 `http://localhost`에서도 쿠키가 유지되도록 분기.

### 3. ✅ `docs-link.tsx` 변수 섀도잉
- 내부 변수명을 `rest` → `pathSuffix`로 변경. props rest 스프레드와의 충돌 해소.
- 추가로 `isSafeHref` 헬퍼 분리, 중복 `typeof href === "string"` 검사 제거.

### 4. ℹ️ API 계약(URL 구조)
- 서버 리다이렉트 정책은 Next.js 기본 307(임시) 사용 — 레거시 경로는 쿠키 기반으로 일회성 전환이라 임시 리다이렉트가 의미론적으로 맞음.
- 영구 정책이 필요하면 `next.config.ts`에 `redirects()`로 추가 예정(현 시점 유보). 사용자 가이드 경로가 대부분 사내용이라 SEO 영향은 제한적.

### 5. ✅ `buildSearchIndex` 캐싱
- `registry.ts`에서 `WeakMap<DocsIndex, Partial<Record<Locale, DocsSearchEntry[]>>>` 로 locale별 결과 캐싱. 같은 index 객체 기준 1회만 I/O 수행.
- production에서는 `getDocsIndex()`가 싱글턴이라 locale당 최초 1회만 디스크 접근.
- 또한 `page.availableLocales`를 참조해 locale이 없을 때의 불필요한 `fs.existsSync` 호출 제거.

### 6. ✅ `readLocaleCookie` 테스트 누락
- 신규: `frontend/src/lib/i18n/__tests__/server-locale.test.ts` — 유효 locale 반환·쿠키 없음·지원하지 않는 값 케이스.

### 7. ✅ `doc-body-notice.test.tsx` 잔존 locale setup
- `useLocaleStore` setup/teardown 제거. prop 기반 gating(`fellBackToKorean`)만 검증하도록 정리.
- 이후 경고(사전 텍스트가 로케일에 따라 다름)는 container 콘텐츠 존재 검사로 대체.

### 8. ✅ `docs-sidebar.test.tsx` locale 전환 미검증
- `useLocaleStore` setup/teardown 추가.
- 신규 테스트: locale을 `en`으로 바꾸면 모든 href가 `/docs/en/...`로 갱신되는지 확인.

### 9. ✅ `buildSearchIndex` 기본 locale 경로 검증
- `registry.test.ts`에 locale 인자 생략 시 `DEFAULT_LOCALE(ko)` 동작과 동일한지 테스트 추가.

### 10. ✅ `importEn` 명명
- `[...slug]/page.tsx`에서 `importEn` → `hasTranslation`. 로케일 비종속 의미로 수정. 추가로 안내 배너 prop 계산도 `hasTranslation`로 명확화.

### 11. ⏭ `isLocaleSibling` 정규식 확장(YAGNI)
- 현재 지원 로케일이 2자 코드(`ko`, `en`)로 한정돼 위험 없음. BCP 47 확장이 현실화될 때 `[a-z]{2,3}(-[A-Z]{2})?` 또는 `LOCALES` 기반 매칭으로 변경 예정. 현 시점 유보.

### 12. ✅ `page.tsx` 주석 불일치
- "`fr` 등 알 수 없는 locale 코드도 DEFAULT_LOCALE로 교체" → "첫 세그먼트가 유효한 locale인데 parseDocsRoute가 null(세그먼트 부족)이면 404" 설명으로 수정. 실제 동작과 주석이 일치.

### 13. ℹ️ DocsLink가 `"use client"`인 구조적 이슈
- remark 플러그인이나 서버 컴포넌트 기반 접근은 현재 아키텍처(localStorage·쿠키 기반 locale, URL 라우팅)의 런타임 locale 전환과 호환되지 않아 즉시 변경은 보류.
- SRP 관점: XSS 방어 + locale 주입 두 책임은 모두 "MDX 본문 `<a>`의 공통 처리"이므로 한 컴포넌트가 맡는 게 자연스러움. 추후 규모가 커지면 분리 검토.

### 14. ✅ `localizedDocsHref` 모듈 경계
- `registry.ts`의 locale helper 재export 제거.
- 소비처(`docs-sidebar.tsx`, `[...slug]/page.tsx`, `docs/page.tsx`, 등)는 모두 `@/lib/docs/locale`에서 직접 import하도록 변경. `registry.test.ts`의 해당 import도 수정.

### 15. ✅ 콘텐츠 작성자용 i18n 규약 문서
- 신규: `frontend/src/content/docs/_i18n-conventions.md`.
- 내비게이션에서 제외되는 `_` 접두 파일. 파일 구조·프론트매터 필드·내부 링크 규칙·섹션 레이블 번역·새 로케일 추가 절차 안내.

### 16. ✅ README 업데이트
- `README.md`의 "주요 기능"에 다국어 사용자 가이드(`/docs/ko/*`, `/docs/en/*`) 및 레거시 경로 리다이렉트 안내 추가.

---

## INFO 조치 (선택)

### 1. ⏭ `docs-locale-url-sync.test.tsx` pathname 동적 변경 케이스
- 현 테스트가 mockPathname 변경 후 새 render로 검증하므로 실질적 useEffect 재실행 시나리오는 커버됨. 추가 케이스는 유보.

### 2. ⏭ `isLocaleSibling` / `detectAvailableLocales` 직접 단위 테스트
- `loadDocsIndex` 통합 테스트가 `.en.mdx` sibling 감지를 모두 검증하고 있어 추가 노이즈 없음. 현 시점 유보.

### 3. ✅ `resolveLocalizedDocPath` 중복 `existsSync` 제거
- `buildSearchIndex`에서 `page.availableLocales.includes(locale)` 선판정 후 canonical 경로로 폴백하도록 수정하여 syscall 제거.

### 4. ✅ `DocsLink.isAlreadyLocalized` 선형 탐색 제거
- `LOCALES` 기반 정규식을 모듈 수준에서 1회 컴파일(`ALREADY_LOCALIZED_DOCS_RE`).

### 5. ⏭ `DocsSearch` Fuse 인덱스 locale 전환 재생성
- 현재 entries 전체가 layout에서 locale별로 미리 생성돼 있고 layout은 전체 docs 경로에서만 활성화됨. 프로파일 상 병목이 확인되지 않아 유보.

### 6. ⏭ `DocsSearchEntry` 타입 분리
- 현재 `import type`로만 쓰이고 있어 번들 누수 위험 없음. 타입 전용 import 패턴이 확실하면 추가 분리 불필요.

### 7. ⏭ `DocMeta.href` 명명
- JSDoc에 "Canonical href without the locale prefix ... Locale-aware URLs are built at render time via `localizedDocsHref`" 명시로 가독성 담보. 파일 차원 일괄 rename은 스코프 밖.

### 8. ✅ `locale-store.ts`의 `STORAGE_KEY`/`COOKIE_KEY` 중복
- `COOKIE_KEY` 상수를 제거하고 `LOCALE_COOKIE_NAME` import 사용으로 일원화. 결과적으로 해당 중복 소멸.

### 9. ⏭ 서버/클라이언트 이중 리다이렉트 역할 문서화
- `[...slug]/page.tsx` 상단 주석 ("단일 catch-all 라우트…")에서 서버 측 진입 전 처리 설명. `docs-locale-url-sync.tsx`의 JSDoc에서 클라이언트 side 전환 책임 명시. 파일 간 cross-reference 추가는 필요 시 별도 작업.

### 10. ✅ `parseRoute` 제약 주석
- `route.ts`에서 `rawSlug.length < 3`을 "locale + section + page. 현재 모든 페이지가 2-depth" 주석으로 명시.

### 11. ✅ docs-link.tsx 중복 `typeof` 검사 제거
- `isSafeHref`와 타입 가드 합쳐 중복 제거.

### 12. ⏭ `registry.ts` 말미 공백
- 변경 규모에 비해 영향이 없어 유보.

---

## 후속 작업 (Backlog)
- URL 영구(301) 리다이렉트 정책 필요 시 `next.config.ts`에 `redirects()` 추가
- 새 로케일 추가 시 `isLocaleSibling` 정규식 확장 또는 `LOCALES` 기반 매칭으로 교체
- DocsLink를 서버 컴포넌트화 가능하도록 remark 플러그인 기반으로 이전 검토
