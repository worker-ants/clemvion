# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 테스트 픽스처 누락으로 인한 거짓 양성 테스트, 스펙 명시 검증 항목 누락, 보안 관련 소수 개선 필요

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `fixtures-broken` 디렉터리가 존재하지 않으면 `loadDocsIndex`가 예외 없이 빈 인덱스를 반환하여 `.toThrow()` 단언이 항상 실패함 | `registry.test.ts` — `"frontmatter 필수 필드 검증에 실패하면 예외를 던져요"` | `fixtures-broken/01-section/invalid.mdx` (필수 필드 누락 파일) 픽스처를 실제로 커밋하거나, `beforeEach`/`afterEach`로 동적 생성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Scope | Spec §11이 명시적으로 요구하는 `spec:`/`code:` 경로 존재 검증 테스트가 완전히 누락됨 | `registry.test.ts` 전체, `spec/13-user-guide.md` §11 | `spec`/`code` glob 경로가 실제로 존재하는지 검증하는 테스트 케이스 추가 |
| 2 | Requirement | Spec §9의 `index.mdx` 섹션 랜딩 페이지 처리가 미구현 — 현재는 일반 파일로 취급하여 `/docs/<section>/index` 슬러그를 생성함 | `registry.ts` — `loadDocsIndex` 함수 전체 | `index.mdx`를 섹션 랜딩 슬러그(`/docs/<section>`)로 등록하거나 `DocsSection`에 `landingPage?` 필드를 추가; 또는 스펙에 "미구현(TODO)" 표시 |
| 3 | Testing | `getDocsIndex()` 캐싱 로직(캐시 히트·`NODE_ENV` 분기)에 대한 테스트가 전혀 없음 | `registry.ts` — `getDocsIndex()`, `let cachedIndex` | `resetDocsIndexCache()` export 또는 `vi.resetModules()` 활용하여 캐시 동작 전용 테스트 추가 |
| 4 | Testing | `sectionLabel` / `humanize` / `stripNumberPrefix` 헬퍼 함수에 대한 단위 테스트 없음 — `SECTION_LABELS`에 없는 키의 엣지 케이스 미검증 | `registry.ts` — `stripNumberPrefix`, `humanize`, `sectionLabel` | 해당 함수를 export하고 별도 단위 테스트 추가; 또는 `SECTION_LABELS`에 없는 섹션 fixture를 추가하여 `label` 필드 검증 |
| 5 | Testing | `getAllSlugs`의 `includeDrafts: true` 대칭 케이스 미검증 — draft slug가 포함되는지 확인하는 테스트 없음 | `registry.test.ts` — `getAllSlugs` describe 블록 | `includeDrafts: true`로 로드한 인덱스에서 `getAllSlugs` 호출 시 `"02-second/c"` draft slug 포함을 검증하는 테스트 추가 |
| 6 | Security | `loadDocsIndex`의 `root` 파라미터에 경로 탐색(Path Traversal) 방어 로직 없음 — 향후 요청 파라미터로 전달될 경우 임의 파일 접근 가능 | `registry.ts` — `loadDocsIndex(root: string, ...)` | `root`가 허용된 기저 디렉터리 하위인지 `path.resolve(root).startsWith(path.resolve(ALLOWED_BASE))`로 검증; 또는 `loadDocsIndex`를 내부 전용으로 제한 |
| 7 | Security | `assertFrontmatter`의 에러 메시지에 서버 파일시스템 절대 경로(`filePath`)가 노출됨 | `registry.ts` — `assertFrontmatter()` 내 모든 `throw new Error(...)` | 에러 메시지에는 섹션 키·파일명 등 상대 식별자만 포함하고, 절대 경로는 `console.error`로만 로깅 |
| 8 | Security / Side Effect | `mdx-components.tsx`에서 `javascript:` / `data:` URI 차단 로직 없음 — MDX 콘텐츠 내 악성 href로 XSS 발생 가능 | `mdx-components.tsx` — 외부 `<a>` 렌더러 | `SAFE_PROTOCOLS` 허용 목록으로 href 검증 추가 (`javascript:`, `data:` 차단) |
| 9 | Dependency / Performance | `getDocsIndex()`의 모듈 레벨 캐시(`cachedIndex`)가 Next.js HMR 환경에서 갱신되지 않아 개발 중 stale 인덱스를 반환할 수 있음 | `registry.ts` — `let cachedIndex: DocsIndex | null = null` (L161~163) | 개발 환경에서는 캐싱 비활성화: `if (!cachedIndex \|\| process.env.NODE_ENV === 'development')` 조건 추가; 또는 `globalThis.__docsIndex` 패턴 사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `useMDXComponents`의 내부/외부 링크 분기 렌더링 로직에 대한 테스트 없음 (`href=undefined` 케이스 포함) | `mdx-components.tsx` | `@testing-library/react`로 내부/외부 링크 렌더링 테스트 추가 |
| 2 | Testing | `loadDocsIndex`에서 모든 페이지가 draft이고 `includeDrafts: false`일 때 섹션 자체가 생략되는 로직 미검증 | `registry.ts:115` — `if (pages.length === 0) continue;` | "모든 페이지가 draft인 섹션은 `sections` 배열에서 제외"됨을 검증하는 테스트 추가 |
| 3 | Testing | `getAllSlugs` 테스트가 `expect.arrayContaining`으로 검증하여 순서가 깨져도 통과함 — 순서 보장이 요구사항이라면 문제 | `registry.test.ts` — `getAllSlugs` describe (L68~77) | 순서 보장이 요구사항이면 `toEqual`로 전체 배열 비교로 변경 |
| 4 | Architecture | `SECTION_LABELS` 상수가 하드코딩되어 섹션 추가 시 코드와 디렉터리 양쪽을 동기화해야 하는 결합 문제; `humanize()` 폴백은 영문 기반으로 한글 요구사항 미충족 | `registry.ts` — `SECTION_LABELS` (L37~44) | 각 섹션 디렉터리에 `_section.json` 메타파일로 레이블 선언; 또는 `index.mdx` 프론트매터에서 레이블 읽기 |
| 5 | Architecture | `section` 프론트매터 필드가 파일이 속한 디렉터리명과 항상 일치해야 하지만 자동 검증 없이 수동 기재 — 불일치 탐지 로직 없음 | `registry.ts:118`, spec §4 | `loadDocsIndex` 내에서 `frontmatter.section !== sectionKey` 불일치를 경고/에러 처리; 또는 `section` 필드를 파일시스템에서 자동 주입 |
| 6 | Architecture / Maintainability | `assertFrontmatter`의 이중 검증 구조 (존재 확인 루프 + 타입 검사 개별 `if`) — 필드 추가 시 두 곳을 동시에 수정해야 함 | `registry.ts` — `assertFrontmatter` (L57~82) | `zod`/`valibot` 스키마 검증으로 대체하거나 단일 패스 헬퍼(`assertString`, `assertNumber`)로 통합 |
| 7 | Documentation | `registry.ts` 공개 함수(`loadDocsIndex`, `getDocBySlug`, `getAllSlugs`, `getDocsIndex`)에 JSDoc 없음 — 특히 `getDocsIndex()`의 캐싱·환경 분기 동작이 비자명함 | `registry.ts` — 공개 함수 전체 | 최소한 `getDocsIndex()`에 캐싱 동작과 production/development 차이를 명시하는 JSDoc 추가 |
| 8 | Documentation | `SECTION_LABELS` 확장 방법 미문서화, `DocFrontmatter` 인터페이스 필드 설명 부재 | `registry.ts` — L34~41, L6~15 | 인라인 주석으로 "새 섹션 추가 시 이 맵에도 등록" 안내; 인터페이스에 spec 문서 수준의 JSDoc 추가 |
| 9 | Documentation | `useMDXComponents`의 컴포넌트 병합 우선순위(`{ ...docsComponents, ...components }`)가 주석 없이 암묵적 | `mdx-components.tsx:33-35` | 함수 위에 한 줄 주석으로 오버라이드 방향 명시 |
| 10 | Security | `gray-matter` JS 엔진이 기본 활성화 상태 — `---js` 헤더를 사용한 악의적 MDX 파일이 서버에서 임의 코드 실행 가능 (현재는 신뢰 콘텐츠이나 예방적 조치 필요) | `registry.ts` — `matter(source)` | `matter(source, { engines: { javascript: false } })`로 JS 엔진 명시적 비활성화 |
| 11 | Security | 동적 라우트 핸들러에서 draft 재검증 없음 — 인덱스 레벨 필터만 존재하여 직접 URL 접근 시 draft 문서가 노출될 수 있음 | `/docs/[...slug]` 라우트 핸들러 (미리뷰) | `getDocBySlug` 결과에서 `frontmatter.draft`를 재확인하고 production에서 `notFound()` 호출 |
| 12 | Side Effect | `mdx-components.tsx`의 `a` 컴포넌트가 호출자 override에 의해 교체될 경우 `rel="noopener noreferrer"` 보안 처리가 사라질 수 있음 | `mdx-components.tsx:32` — `{ ...docsComponents, ...components }` | 병합 순서 반전(`{ ...components, ...docsComponents }`)하거나 명시적 주의사항 주석 추가 |
| 13 | Scope | `mdx-components.tsx`에서 import하는 `Callout`, `Example`, `FieldTable`, `Step`, `Steps` 구현체가 리뷰 범위에 없음 | `mdx-components.tsx:3-6` | 빌드 성공 여부를 TEST WORKFLOW로 확인; 구현체를 리뷰 대상에 포함 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `fixtures-broken` 픽스처 미존재, Spec §9 랜딩 페이지 미구현, Spec §11 경로 검증 테스트 누락 |
| testing | MEDIUM | `getDocsIndex()` 캐시 테스트 누락, `fixtures-broken` 픽스처 오탐 위험, 헬퍼 함수 단위 테스트 없음 |
| scope | MEDIUM | `fixtures-broken` 픽스처 미존재로 거짓 양성 테스트, Spec §11 검증 항목 미구현 |
| security | LOW | Path Traversal 잠재 위험, 절대 경로 에러 노출, `javascript:` URI 미차단 |
| performance | LOW | 동기 I/O 반복 호출, 개발 환경 캐시 미무효화, 불필요한 배열 복사 |
| side_effect | LOW | 모듈 레벨 싱글턴 캐시 오염 가능성, `NODE_ENV` 읽기 타이밍, `fixtures-broken` 오탐 |
| architecture | LOW | 모듈 수준 싱글턴 캐시 HMR 미갱신, `assertFrontmatter` 이중 검증, `SECTION_LABELS` 하드코딩 |
| maintainability | LOW | `assertFrontmatter` 중복 검증 패턴, `fixtures-broken` 픽스처 누락 오탐, `SECTION_LABELS` 결합 문제 |
| documentation | LOW | 공개 함수 JSDoc 없음, `SECTION_LABELS` 확장 방법 미문서화, Spec-구현 불일치 (§9) |
| dependency | LOW | HMR 환경 캐시 미갱신 (`globalThis` 패턴 권장), `gray-matter` 신규 도입 확인 필요 |
| concurrency | LOW | 비동기 전환 시 경쟁 조건 잠재 위험 (현재 동기 구현은 안전) |
| api_contract | NONE | 해당 없음 |
| database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| api_contract | 순수 클라이언트 사이드 정적 콘텐츠 처리 — 외부 API 계약과 무관 |
| database | 파일시스템 기반 인메모리 레지스트리 — DB 접근 없음 |

---

## 권장 조치사항

1. **[Critical] `fixtures-broken` 픽스처 생성** — `fixtures-broken/01-section/invalid.mdx` (필수 프론트매터 필드 누락)를 커밋하여 예외 검증 테스트가 실제로 동작하도록 수정

2. **[Warning] Spec §11 `spec:`/`code:` 경로 존재 검증 테스트 추가** — 스펙이 명시적으로 요구하는 빌드 시 경로 실존 확인 로직 및 테스트 케이스 구현

3. **[Warning] Spec §9 `index.mdx` 랜딩 페이지 처리** — 구현하거나, 구현하지 않을 경우 스펙에 "Phase 2 / TODO"로 명시하고 `registry.ts`에 주석 추가

4. **[Warning] `getDocsIndex()` 개발 환경 캐시 무효화** — `process.env.NODE_ENV === 'development'` 시 캐시 건너뛰기 또는 `globalThis.__docsIndex` 패턴으로 HMR 안전성 확보

5. **[Warning] `getDocsIndex()` 캐시 동작 테스트 추가** — `resetDocsIndexCache()` export 또는 `vi.resetModules()` 패턴으로 캐시 히트·`NODE_ENV` 분기 검증

6. **[Warning] 헬퍼 함수 단위 테스트 추가** — `humanize`, `stripNumberPrefix`, `sectionLabel`의 엣지 케이스 및 `getAllSlugs`의 `includeDrafts: true` 대칭 케이스 검증

7. **[Warning] 보안 — 에러 메시지 절대 경로 제거** — `assertFrontmatter`의 에러 메시지에서 절대 경로를 제거하고 상대 식별자만 포함; `console.error`로 서버 측 로깅

8. **[Warning] 보안 — `javascript:` URI 차단** — `mdx-components.tsx`의 `<a>` 렌더러에 허용 프로토콜 목록 검증 추가

9. **[Info] `gray-matter` JS 엔진 비활성화** — `matter(source, { engines: { javascript: false } })`로 명시적 비활성화 (예방적 조치)

10. **[Info] draft 라우트 핸들러 재검증** — `/docs/[...slug]` 핸들러에서 `frontmatter.draft` 재확인 후 production에서 `notFound()` 호출