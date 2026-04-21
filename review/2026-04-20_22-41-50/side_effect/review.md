## 발견사항

### 시그니처 / 인터페이스 변경

- **[WARNING]** `DocBodyNotice`의 `fellBackToKorean` prop 추가 (필수)
  - 위치: `doc-body-notice.tsx`
  - 상세: 기존 호출부는 prop 없이 `<DocBodyNotice />` 형태였음. 현재 `page.tsx` 외에 다른 호출부가 있다면 TypeScript 오류 발생.
  - 제안: 코드베이스 전체에 `<DocBodyNotice` 사용처를 grep으로 확인하고, 미처리된 호출부가 없는지 검증.

- **[WARNING]** `DocsSearch` prop: `entries` → `entriesByLocale` 변경
  - 위치: `docs-search.tsx`
  - 상세: `layout.tsx`는 정상 업데이트되었지만, 스토리북/테스트에서 직접 `entries`를 전달하는 코드가 있으면 런타임 오류 없이 묵묵히 잘못 동작(`undefined` Fuse 인스턴스).
  - 제안: `entriesByLocale[locale]`가 `undefined`인 경우 방어 코드 추가: `const entries = entriesByLocale[locale] ?? []`.

- **[WARNING]** `DocMeta.availableLocales` 신규 필수 필드
  - 위치: `registry.ts`, `DocMeta` 인터페이스
  - 상세: `loadDocsIndex` 외부에서 `DocMeta`를 직접 생성하는 테스트 코드(`docs-sidebar.test.tsx` fixture 등)는 이 필드를 명시적으로 추가해야 함. 누락 시 TypeScript 빌드 오류.
  - 제안: 테스트 fixture에 `availableLocales: ["ko"]` 추가가 이미 반영됨 — 다른 테스트 fixture 파일에도 적용 여부 확인 필요.

- **[INFO]** `buildSearchIndex(index)` → `buildSearchIndex(index, locale = DEFAULT_LOCALE)` 기본값 추가
  - 위치: `registry.ts`
  - 상세: 기존 호출부는 locale 없이 호출해도 `DEFAULT_LOCALE(ko)` 동작을 유지하므로 하위 호환성 있음. 의도적 silent fallback임을 주석으로 명확히 하면 좋음.

---

### 새로운 부작용 도입

- **[WARNING]** `setLocale` / `initFromStorage`에서 `document.cookie` 쓰기 추가
  - 위치: `locale-store.ts`, `writeLocaleCookie()`
  - 상세: locale 변경 시 `document.cookie`에 1년짜리 쿠키를 기록하는 부작용이 새로 생김. `localStorage` 쓰기 오류는 catch되지만, `document.cookie` 할당은 SecurityError가 발생할 수 있는 환경(sandboxed iframe 등)에 대해 이미 try/catch로 감싸져 있어 안전함. 그러나 **Secure 속성이 없어** HTTPS 전용 환경에서도 HTTP 요청에 쿠키가 포함됨.
  - 제안: 프로덕션에서 HTTPS만 사용한다면 `; Secure` 추가 검토: `` `${COOKIE_KEY}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure` ``.

- **[INFO]** `DocsLocaleUrlSync` — locale 변경 시 `router.replace` 호출
  - 위치: `docs-locale-url-sync.tsx`
  - 상세: locale store가 변경될 때마다 `/docs` 경로에서 `router.replace`를 호출. replace 후 pathname이 바뀌고 useEffect가 재실행되지만, `pathLocale === locale` 조건으로 무한 루프가 방지됨. 정상 설계이나, SSR hydration 직후 locale store가 초기화될 때 한 번 불필요한 replace가 실행될 수 있음 (pathname의 locale과 store의 locale이 순간적으로 불일치하는 경우).
  - 제안: 큰 문제는 아니지만, `router` 참조를 dependency array에서 제외하거나 `useRef`로 안정화하는 것도 고려 가능 (현재 Next.js `useRouter`는 안정적 참조를 반환하므로 실질적 문제 없음).

---

### `dynamicParams` 변경

- **[WARNING]** `dynamicParams = false` → `dynamicParams = true`
  - 위치: `[...slug]/page.tsx`
  - 상세: 빌드 타임에 생성되지 않은 경로가 런타임에 처리됨. 레거시 bookmark redirect를 위한 의도적 변경이나, `generateStaticParams`에 없는 locale(`/docs/fr/...`)이 들어오면 `parseRoute`가 null을 반환하고 `isLocale(first)` → notFound()를 호출함. 이 경로는 정상 처리되나, 악의적인 경로(`/docs/ko/../../../etc`)는 `isSafeDocsSlug`가 차단해야 함.
  - 제안: `isSafeDocsSlug`가 directory traversal 패턴을 실제로 검증하는지 확인 (현재 코드에서 `isSafeDocsSlug` 구현 미포함).

---

### MDX 링크 처리 변경

- **[WARNING]** `<a>` 처리가 서버 컴포넌트 → `"use client"` 컴포넌트(`DocsLink`)로 변경
  - 위치: `mdx-components.tsx`, `docs-link.tsx`
  - 상세: MDX 내 모든 앵커 태그가 이제 클라이언트 사이드에서 렌더링됨. hydration 전까지 locale 주입이 안 된 href가 잠시 노출될 수 있음. 또한 MDX 파일들의 내부 링크(`/docs/04-run-and-debug/...` 형태)는 `DocsLink`가 locale을 주입하지만, 이 컴포넌트 외부(예: 사이트맵 생성, OpenGraph 크롤러)에서 해당 링크를 읽는 경우 locale 미포함 URL이 그대로 노출됨.
  - 제안: 정적 사이트맵이나 메타태그용 링크는 별도로 locale 처리가 필요한지 검토.

---

### 기타

- **[INFO]** `parseRoute`의 최소 길이 조건 `rawSlug.length < 3`
  - 위치: `[...slug]/page.tsx`, `parseRoute()`
  - 상세: locale + section + slug 3세그먼트가 필수. 만약 섹션 없이 직접 페이지 파일이 있는 구조(`/docs/ko/page`)가 향후 추가된다면, 이 조건이 문제됨.
  - 제안: 현재 콘텐츠 구조가 `<section>/<slug>` 형태만 사용한다면 문제없음. 구조 불변성을 주석으로 명시 권장.

- **[INFO]** `layout.tsx`에서 `buildSearchIndex`를 locale별로 모두 호출
  - 위치: `docs/layout.tsx`
  - 상세: LOCALES 수만큼 fs.readFileSync가 발생함. 현재 2개 locale이므로 2배 파일 읽기. Next.js의 layout은 공유 캐시가 있어 실제 문제가 되지 않을 가능성이 높으나, locale이 늘어날수록 선형 증가함.

---

## 요약

이번 변경은 docs 경로에 locale 프리픽스를 도입하는 큰 리팩터링으로, 의도한 부작용(cookie 미러링, URL 동기화)은 명확하게 설계되어 있고 안전장치(try/catch, isLocale 검증, isSafeDocsSlug 가드)도 갖추어져 있음. 다만 `DocBodyNotice`, `DocsSearch`, `DocMeta` 등 여러 공개 인터페이스가 동시에 변경되었으므로 호출부 누락 여부를 빌드 전 전수 확인해야 하며, `DocsLink`가 client component로 전환되면서 MDX 내 앵커의 hydration 전후 동작 차이와 `Secure` 쿠키 속성 미설정이 보완이 필요한 주요 포인트임.

## 위험도

**MEDIUM**