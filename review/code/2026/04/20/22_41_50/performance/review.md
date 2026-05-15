### 발견사항

---

#### **[WARNING] `buildSearchIndex` 다중 호출 — 요청마다 전체 문서 파일을 동기 I/O로 읽음**
- **위치**: `docs/layout.tsx` 14–19줄, `registry.ts` `buildSearchIndex`
- **상세**: `DocsLayout`(Server Component)에서 `LOCALES.map((locale) => buildSearchIndex(index, locale))`를 실행한다. `buildSearchIndex`는 내부에서 모든 문서 파일을 `fs.readFileSync`(동기 I/O)로 읽는다. 로케일 2개 × 문서 N개 = 요청마다 2N번의 동기 블로킹 I/O가 Node.js 이벤트 루프를 점유한다. `getDocsIndex`는 모듈 캐시가 있지만 `buildSearchIndex`는 캐시가 없어 매 요청마다 재실행된다.
- **제안**: `buildSearchIndex` 결과를 Next.js `cache()` 또는 모듈 수준 `Map<Locale, DocsSearchEntry[]>` 싱글턴으로 캐싱한다. 인덱스가 변경될 때(`getDocsIndex` 재로드 시)만 무효화하면 첫 요청 이후 파일 I/O를 제거할 수 있다.

```ts
// registry.ts 예시
import { cache } from "react";
export const buildSearchIndex = cache((index: DocsIndex, locale: Locale = DEFAULT_LOCALE) => { ... });
```

---

#### **[WARNING] `resolveLocalizedDocPath`에서 `availableLocales`를 이미 알고 있음에도 `fs.existsSync` 재호출**
- **위치**: `registry.ts` `resolveLocalizedDocPath`, `buildSearchIndex` 내부
- **상세**: `DocMeta.availableLocales`는 인덱스 로드 시 `detectAvailableLocales`에서 이미 `fs.existsSync`를 호출해 계산해둔다. `buildSearchIndex`에서 `resolveLocalizedDocPath`를 다시 호출하면 locale별로 이미 알고 있는 정보를 위해 `fs.existsSync`를 N번 추가 호출한다.
- **제안**: `buildSearchIndex` 내부에서 `page.availableLocales.includes(locale)`로 sibling 존재 여부를 판별하고, 경로는 `canonicalFilePath.replace(...)` 패턴으로 직접 조립한다. `resolveLocalizedDocPath`의 `existsSync` 경로를 제거할 수 있다.

---

#### **[INFO] `DocsLink.isAlreadyLocalized` — 렌더마다 선형 탐색**
- **위치**: `docs-link.tsx` `isAlreadyLocalized` 함수
- **상세**: MDX 본문의 모든 `<a>` 태그가 `DocsLink`로 렌더링되며, `isAlreadyLocalized`가 `LOCALES`를 순회한다. 현재 로케일이 2개이므로 O(2)지만, 로케일이 늘어나면 링크 수 × 로케일 수만큼 증가한다.
- **제안**: 모듈 수준 `Set<string>` 또는 정규식을 미리 컴파일해두면 O(1) 탐색으로 개선된다.

```ts
const LOCALIZED_PREFIX_RE = new RegExp(`^/docs/(${LOCALES.join("|")})[/]?`);
function isAlreadyLocalized(href: string): boolean {
  return LOCALIZED_PREFIX_RE.test(href);
}
```

---

#### **[INFO] `docs-sidebar.tsx` — 렌더 루프 내 `localizedDocsHref` 반복 호출**
- **위치**: `docs-sidebar.tsx` `activeSectionKey` useMemo 및 pages 렌더 루프
- **상세**: `localizedDocsHref`는 단순 템플릿 문자열 연산이지만, `activeSectionKey` useMemo와 렌더 루프 양쪽에서 같은 `page.slug + locale` 조합에 대해 두 번 호출된다.
- **제안**: 렌더 루프에서 `const href = localizedDocsHref(page.slug, locale)`를 한 번만 계산하는 현재 방식은 괜찮다. `activeSectionKey` useMemo도 `href`를 재사용하도록 pages를 미리 `{ page, href }` 쌍으로 매핑하면 추가 호출을 제거할 수 있다(현 규모에서는 무시 가능).

---

#### **[INFO] `DocsLocaleUrlSync` — `router` 의존성 배열 포함**
- **위치**: `docs-locale-url-sync.tsx` useEffect deps
- **상세**: Next.js `useRouter`는 렌더마다 안정적인 참조를 반환하므로 실질적 문제는 없지만, `router`를 deps에 포함시키면 이론상 router 객체 교체 시 effect가 재실행된다.
- **제안**: eslint-plugin-react-hooks 규칙을 만족하는 현재 구조를 유지하되, 필요 시 `useCallback`으로 handler를 감싸는 패턴으로 전환 가능하다.

---

#### **[INFO] `DocsSearch` locale 변경 시 Fuse 인덱스 재생성**
- **위치**: `docs-search.tsx` 35–36줄
- **상세**: locale이 변경되면 `entries` 참조가 바뀌고 `useMemo(() => new Fuse(entries, FUSE_OPTIONS), [entries])`가 재실행된다. Fuse 생성은 O(N) 작업으로, locale 전환마다 전체 검색 인덱스가 재구축된다. 현재 문서 규모에서는 체감되지 않지만, 문서가 수백 개 수준으로 늘면 UX에 영향을 줄 수 있다.
- **제안**: `const fuseByLocale = useMemo(() => Object.fromEntries(LOCALES.map(loc => [loc, new Fuse(entriesByLocale[loc], FUSE_OPTIONS)])), [entriesByLocale])`으로 모든 로케일 인덱스를 한 번에 생성해두면 locale 전환이 O(1) 조회가 된다.

---

### 요약

이번 변경의 핵심 성능 리스크는 **`DocsLayout` 서버 컴포넌트에서 `buildSearchIndex`를 로케일별로 반복 호출**하는 부분이다. 각 호출은 모든 문서 파일을 동기 I/O(`fs.readFileSync`)로 읽으므로, 캐시 없이 매 요청마다 2N번의 블로킹 파일 읽기가 발생한다. 나머지 이슈(sidebar의 `localizedDocsHref` 중복 호출, `resolveLocalizedDocPath`의 중복 `existsSync`, `DocsLink`의 선형 탐색)는 현 문서 규모에서 체감하기 어렵지만, React `cache()` 또는 모듈 수준 캐싱으로 `buildSearchIndex`를 보호하는 것이 최우선 과제다.

### 위험도
**MEDIUM**