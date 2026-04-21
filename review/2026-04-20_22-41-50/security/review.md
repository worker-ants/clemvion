### 발견사항

---

**[WARNING] 로케일 쿠키 `Secure` 속성 누락**
- 위치: `frontend/src/lib/stores/locale-store.ts` — `writeLocaleCookie()`
- 상세: `document.cookie = \`${COOKIE_KEY}=${locale}; Path=/; Max-Age=...; SameSite=Lax\`` 에서 `Secure` 속성이 없음. HTTP 환경에서도 쿠키가 전송되어 중간자 공격(MITM) 시 조작 가능. 로케일 정보 자체는 민감하지 않지만, 쿠키를 통해 서버 SSR 렌더링 분기가 결정되므로 조작 시 의도치 않은 콘텐츠 노출 경로가 생길 수 있음.
- 제안: `; Secure` 추가. 개발 환경 예외 처리가 필요하면 `process.env.NODE_ENV !== "development"` 조건부로 삽입.

---

**[WARNING] 동적 import 경로의 `isSafeDocsSlug` 의존성**
- 위치: `frontend/src/app/(main)/docs/[...slug]/page.tsx` — `DocPage` 함수
- 상세:
  ```ts
  const { default: MDXContent } = importEn
    ? await import(`@/content/docs/${slugPath}.en.mdx`)
    : await import(`@/content/docs/${slugPath}.mdx`);
  ```
  `slugPath`는 URL slug에서 파생되며, 경로 탐색(path traversal)을 차단하는 유일한 게이트가 `isSafeDocsSlug(docSlug)` + `getDocBySlug(index, docSlug)` 조합임. `getDocBySlug`가 인덱스에 없는 슬러그를 반환하지 않으므로 런타임 위험은 낮지만, Next.js/webpack이 빌드 타임에 해당 glob 패턴의 모든 파일을 번들에 포함시키므로 번들 내 파일 범위 밖으로의 실제 경로 탈출은 불가능. 단, `isSafeDocsSlug` 구현이 이 리뷰에 포함되지 않아 검증 불가.
- 제안: `isSafeDocsSlug`가 `..`, `.`, `%2e`, URL 인코딩 변형 등을 명시적으로 차단하는지 확인. 추가 방어로 `docSlug.every(seg => /^[a-z0-9\-]+$/i.test(seg))` 형태의 allowlist 검증 권장.

---

**[WARNING] 레거시 redirect에서 slug 세그먼트 미검증 전달**
- 위치: `frontend/src/app/(main)/docs/[...slug]/page.tsx` — `DocPage` 레거시 분기
- 상세:
  ```ts
  redirect(`/docs/${cookieLocale}/${slug.join("/")}`);
  ```
  `cookieLocale`은 `isLocale()` 검증으로 안전하나, `slug.join("/")`은 URL에서 온 원시 세그먼트. `//evil.com` 형태가 아닌 단순 경로이므로 실질적 오픈 리다이렉트 위험은 낮지만, `slug` 내 특수문자(`?`, `#`, `%`)가 포함될 경우 의도치 않은 URL 구조가 생성될 수 있음. Next.js `redirect()`는 내부 경로로만 동작하므로 외부 도메인 탈출은 불가능.
- 제안: `slug.join("/")`에 `encodeURIComponent` 적용하거나, 세그먼트별로 `[a-zA-Z0-9\-_]+` 패턴 사전 검증 후 redirect.

---

**[INFO] `docs-link.tsx`의 중복 타입 검사**
- 위치: `frontend/src/components/docs/mdx/docs-link.tsx` — 27~28번째 줄
- 상세: `safe` 변수 계산에서 이미 `typeof href === "string"`을 검사하지만, 이후 `if (!safe || typeof href !== "string")`에서 `typeof href !== "string"`을 재검사함. 로직에 오류는 없으나 불필요한 중복.
- 제안: `if (!safe)`만으로 충분.

---

**[INFO] `docs-link.tsx` 내부 경로 locale 주입 시 rest 경로 미검증**
- 위치: `frontend/src/components/docs/mdx/docs-link.tsx`
- 상세:
  ```ts
  const rest = href.slice("/docs/".length);
  resolved = `/docs/${locale}/${rest}`;
  ```
  MDX 콘텐츠 내 링크는 작성자 통제 하에 있으므로 실질적 위험은 낮음. 그러나 `rest`에 `../`가 포함되면 의도치 않은 경로가 생성될 수 있음.
- 제안: `isAlreadyLocalized` 함수가 이미 known locale prefix를 검사하므로 현재 수준은 수용 가능. 추가 방어가 필요하면 `rest`에서 `..` 세그먼트 제거.

---

### 요약

이번 변경은 docs 다국어(i18n) 지원 추가가 핵심으로, 전반적인 보안 설계는 양호합니다. `isLocale()` 검증이 locale 값을 사용하는 모든 진입점에서 일관되게 적용되고, XSS 차단 로직(`docs-link.tsx`)은 `javascript:`, `data:` 스킴을 명시적으로 거부합니다. 가장 주의할 지점은 동적 `import()` 경로가 `isSafeDocsSlug` 구현의 정확성에 의존한다는 점이며, 해당 함수의 리뷰가 필요합니다. 쿠키 `Secure` 속성 누락은 민감 데이터가 아니므로 위험도는 낮지만, 프로덕션 배포 전 적용을 권장합니다.

### 위험도

**LOW**