### 발견사항

---

**[WARNING] 경로 탐색(Path Traversal) 잠재 위험 — `loadDocsIndex` 의 `root` 파라미터**
- 위치: `registry.ts` — `loadDocsIndex(root: string, ...)`, `listSectionDirs(root)`, `listMdxFiles(sectionDir)`
- 상세: `root` 는 호출자가 임의 문자열을 전달할 수 있는 파라미터입니다. 프로덕션 진입점인 `getDocsIndex()`는 `process.cwd()` 기반 고정 경로를 사용하므로 직접 노출은 없습니다. 그러나 테스트 코드(`registry.test.ts`)에서 `path.resolve(__dirname, "fixtures-broken")`처럼 외부 경로를 전달하는 패턴이 공개 API 형태로 존재하며, 향후 API 라우트나 서버 액션에서 요청 파라미터를 `root`로 넘길 경우 `/etc/passwd` 수준의 임의 파일 접근이 가능합니다. `path.join`을 사용하더라도 `root` 자체가 오염된 경우 `join`은 탐색을 막지 못합니다.
- 제안: `loadDocsIndex` 내부에서 `root`가 허용된 기저 디렉터리(`DEFAULT_DOCS_ROOT`) 하위인지 `path.resolve(root).startsWith(path.resolve(ALLOWED_BASE))`로 검증하거나, `loadDocsIndex`를 내부 전용으로 만들고 `getDocsIndex()`만 퍼블릭 API로 노출하세요.

---

**[WARNING] `filePath`가 에러 메시지에 절대 경로로 노출**
- 위치: `registry.ts` — `assertFrontmatter()` 내 모든 `throw new Error(...)` 구문
- 상세: 에러 메시지에 `filePath`(서버 파일시스템 절대 경로)가 포함됩니다. Next.js 서버 컴포넌트·API Route에서 이 에러가 잡히지 않고 HTTP 응답에 포함되면 서버 디렉터리 구조가 클라이언트에 노출될 수 있습니다. 특히 빌드 실패 메시지가 CI 로그나 에러 페이지에 노출될 때 위험합니다.
- 제안: 에러 메시지에는 섹션 키·파일명 등 상대적 식별자만 포함하고, 절대 경로는 서버 측 로깅(예: `console.error`)으로만 기록하세요.

---

**[WARNING] 전역 모듈 캐시(`cachedIndex`)가 서버 환경에서 초기화되지 않음**
- 위치: `registry.ts` — `let cachedIndex: DocsIndex | null = null` / `getDocsIndex()`
- 상세: 모듈 수준 변수는 Node.js 프로세스 전체 수명 동안 유지됩니다. `includeDrafts` 조건이 `NODE_ENV !== "production"` 으로 캐시 시점에 한 번만 평가되므로, 환경 변수를 런타임에 변경하거나 hot-reload 상황에서 draft 문서가 production 캐시에 잘못 포함될 수 있습니다. 또한 동시 요청 환경(서버리스 cold start 경쟁 조건)에서 두 요청이 동시에 `cachedIndex === null` 을 확인하고 중복 초기화할 가능성이 있습니다.
- 제안: Next.js의 `unstable_cache` 또는 `React.cache`를 사용하거나, 빌드 타임에만 인덱스를 생성하고 런타임 캐시를 제거하세요.

---

**[INFO] 외부 링크에 `rel="noopener noreferrer"` 적용 — 양호**
- 위치: `mdx-components.tsx` — 외부 `<a>` 렌더러
- 상세: `target="_blank"` 사용 시 `rel="noopener noreferrer"`가 올바르게 적용되어 탭나이핑(tabnabbing) 공격이 방지됩니다. 다만 MDX 콘텐츠 내 임의 href 값이 `javascript:` 프로토콜을 포함할 수 있습니다.
- 제안: `isInternal` 판별 전에 `href.startsWith("javascript:")` 또는 `href.startsWith("data:")` 를 차단하는 허용 프로토콜 검사를 추가하세요.

```tsx
const SAFE_PROTOCOLS = ["https:", "http:", "/", "#", "mailto:"];
const isSafe = !href || SAFE_PROTOCOLS.some(p => href.startsWith(p));
if (!isSafe) return <>{children}</>;
```

---

**[INFO] `draft: true` 파일의 서버사이드 필터링 — 양호**
- 위치: `registry.ts` — `getDocsIndex()` 의 `includeDrafts = process.env.NODE_ENV !== "production"`
- 상세: 빌드 환경 변수 기반으로 draft 문서를 필터링하는 구조는 적절합니다. 단, 이 필터는 인덱스 레벨에서만 작동하므로 MDX 파일에 직접 접근하는 라우트(`/docs/[...slug]`)에서도 동일한 draft 검사가 있는지 확인이 필요합니다.
- 제안: 동적 라우트 핸들러에서 `getDocBySlug` 결과의 `frontmatter.draft` 를 한 번 더 확인하고 draft인 경우 production에서 `notFound()`를 호출하세요.

---

**[INFO] `gray-matter` 의존성 — YAML 파싱 안전성**
- 위치: `registry.ts` — `matter(source)`
- 상세: `gray-matter`는 기본적으로 YAML과 JS 표현식 모드를 모두 지원합니다. `engines.javascript` 옵션이 활성화된 상태에서 악의적인 MDX 파일이 `---js` 헤더를 사용하면 서버에서 임의 코드가 실행될 수 있습니다. 현재는 파일시스템 기반 신뢰 콘텐츠이므로 위험이 낮지만, 추후 사용자 업로드 콘텐츠를 지원할 경우 위험합니다.
- 제안: `matter(source, { engines: { javascript: false } })` 와 같이 JS 엔진을 명시적으로 비활성화하세요.

---

### 요약

이 코드셋은 서버사이드 파일시스템 기반 문서 레지스트리로, 전반적으로 보안 설계가 양호합니다. 가장 주의할 점은 `loadDocsIndex`의 `root` 파라미터에 대한 경로 탐색 방어가 없다는 것과, `assertFrontmatter`에서 절대 파일 경로가 에러 메시지에 노출되는 구조입니다. MDX 링크 렌더러에서 `javascript:` URI 차단이 누락되어 있어 XSS 벡터가 될 수 있으며, `gray-matter`의 JS 엔진 비활성화도 명시적으로 적용하는 것이 권장됩니다. 외부 링크의 `rel="noopener noreferrer"` 처리, draft 필터링, 언더스코어 디렉터리 제외 등 핵심 보안 동작은 올바르게 구현되어 있습니다.

---

### 위험도

**LOW**