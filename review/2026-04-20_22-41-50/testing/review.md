## 발견사항

### [CRITICAL] `DocsLink` 컴포넌트에 대한 테스트 파일 없음
- **위치**: `frontend/src/components/docs/mdx/docs-link.tsx`
- **상세**: XSS 방어 로직(`javascript:`, `data:` scheme 차단), locale 프리픽스 자동 주입, 이미 localized된 링크 중복 주입 방지 등 보안·정확성 로직이 집중되어 있으나 테스트가 전혀 없음. `mdx-components.tsx`에서 전체 MDX 문서의 `<a>` 렌더링을 담당하므로 커버리지 공백이 큼.
- **제안**:
  ```tsx
  it("javascript: scheme은 span으로 렌더링해요", ...)
  it("이미 locale 프리픽스가 있는 /docs/en/... 링크는 locale을 중복 주입하지 않아요", ...)
  it("/docs/some-page는 현재 locale을 자동 주입해요", ...)
  it("외부 링크는 target=_blank rel=noopener noreferrer를 붙여요", ...)
  ```

---

### [CRITICAL] `parseRoute` 함수에 단위 테스트 없음
- **위치**: `frontend/src/app/(main)/docs/[...slug]/page.tsx` (parseRoute)
- **상세**: `slug[0]`을 locale로 해석하는 핵심 라우팅 로직이지만 테스트가 없음. `rawSlug.length < 3` 경계값, 알 수 없는 locale 코드 처리, 유효한 locale+slug 파싱 등 여러 경계 케이스가 미검증 상태.
- **제안**: `parseRoute`를 파일 외부로 export하거나 별도 모듈로 분리 후 단위 테스트 추가:
  ```ts
  it("slug가 2개 이하면 null을 반환해요", ...)
  it("첫 세그먼트가 locale이 아니면 null을 반환해요", ...)
  it("유효한 locale + docSlug를 파싱해요", ...)
  ```

---

### [WARNING] `readLocaleCookie` (`server-locale.ts`)에 테스트 없음
- **위치**: `frontend/src/lib/i18n/server-locale.ts`
- **상세**: `/docs` 인덱스 리다이렉트와 slug 페이지 두 곳에서 호출되는 SSR 진입점이지만 테스트 파일이 없음. 유효하지 않은 쿠키값에 대한 null 반환, 유효 locale 반환 경로 미검증.
- **제안**: `next/headers`를 mock하여 단위 테스트 추가:
  ```ts
  it("유효한 locale 쿠키값을 반환해요", ...)
  it("없거나 유효하지 않은 값이면 null을 반환해요", ...)
  ```

---

### [WARNING] `doc-body-notice.test.tsx`에 obsolete locale 상태 관리 잔존
- **위치**: `frontend/src/components/docs/__tests__/doc-body-notice.test.tsx`
- **상세**: 컴포넌트가 더 이상 `useLocale()`을 쓰지 않음에도 `beforeEach`와 `afterEach`에서 `useLocaleStore.setState`로 locale을 설정/복원하는 코드가 남아있음. 테스트 의도를 오독하게 만들고, 미래에 다른 개발자가 locale이 여전히 동작에 영향을 준다고 오해할 수 있음.
- **제안**: locale store 관련 setup/teardown 코드를 제거하고, `fellBackToKorean` prop만으로 모든 분기를 표현하도록 정리.

---

### [WARNING] `docs-sidebar.test.tsx` - locale 전환 시나리오 미검증
- **위치**: `frontend/src/components/docs/__tests__/docs-sidebar.test.tsx`
- **상세**: `activeSectionKey` 계산 로직이 `localizedDocsHref(p.slug, locale) === pathname`으로 변경됐으나, locale이 "en"으로 변경됐을 때 active 상태가 올바르게 갱신되는지 검증하지 않음. `mockPathname`이 가변적이지 않아 동적 locale 시나리오를 테스트할 수 없는 구조.
- **제안**:
  ```tsx
  it("locale이 en으로 바뀌면 /docs/en/... href가 active로 인식돼요", () => {
    useLocaleStore.setState({ locale: "en" });
    // pathname을 /docs/en/02-nodes/ai로 변경하고 active 검증
  });
  ```

---

### [WARNING] `buildSearchIndex` default parameter 경로 미검증
- **위치**: `frontend/src/lib/docs/__tests__/registry.test.ts`
- **상세**: `buildSearchIndex(index, locale = DEFAULT_LOCALE)` 시그니처에서 locale 생략 시 기본값이 적용되는 경로가 테스트되지 않음. 기존 호출부 호환성 확인 불가.
- **제안**:
  ```ts
  it("locale 인자 없이 호출하면 기본 locale(ko)로 동작해요", () => {
    const entries = buildSearchIndex(index);
    expect(entries.find(...)).toBeDefined();
  });
  ```

---

### [INFO] `docs-locale-url-sync.test.tsx` - pathname 동적 변화 시나리오 없음
- **위치**: `frontend/src/components/docs/__tests__/docs-locale-url-sync.test.tsx`
- **상세**: 초기 렌더 시점 동작만 검증. `pathname`이 변경된 이후 `useEffect` 재실행으로 redirect가 트리거되는지(예: 다른 doc 페이지로 이동 후 locale이 불일치할 때)는 테스트되지 않음.
- **제안**: `mockPathname`을 변경 후 `rerender`를 호출하는 케이스 추가.

---

### [INFO] `isLocaleSibling` / `detectAvailableLocales` 직접 테스트 없음
- **위치**: `frontend/src/lib/docs/registry.ts`
- **상세**: 두 함수 모두 `loadDocsIndex`를 통한 통합 테스트로만 검증됨. `LOCALES`에 새 locale이 추가될 때 회귀를 빠르게 잡기 어려움.
- **제안**: 두 함수를 내보내거나, fixture를 다양화해 직접 단위 테스트 추가.

---

## 요약

이번 변경은 docs i18n localization의 핵심 로직을 도입했으며, `registry.test.ts`, `locale-store.test.ts`, `docs-locale-url-sync.test.tsx` 등 신규 테스트를 통해 서버-사이드 데이터 레이어와 클라이언트 상태 동기화의 주요 경로는 잘 커버되었습니다. 그러나 전체 MDX 문서의 `<a>` 렌더링을 담당하며 XSS 방어 로직을 포함하는 `DocsLink` 컴포넌트 테스트 누락과, 라우팅의 핵심인 `parseRoute` 함수 미검증이 가장 큰 리스크로 판단됩니다. 특히 `DocsLink`의 `isAlreadyLocalized` 오동작 시 locale 프리픽스가 중복 삽입되거나 누락될 수 있고, `parseRoute` 오동작 시 프로덕션 환경에서 무한 redirect가 발생할 수 있어 두 항목은 반드시 보완이 필요합니다.

## 위험도

**HIGH**