# 코드 리뷰 이슈 조치 내용

- 리뷰 세션: `review/2026-04-16_14-53-46/`, `review/2026-04-16_14-57-27/`
- 대상: 프론트엔드 사용자 매뉴얼(/docs) + 노드 FieldHelp + 빈 캔버스 Empty State

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | `checkboxIdCounter` 모듈 레벨 가변 카운터 → SSR 하이드레이션 불일치 위험 | `shared.tsx`에 `"use client"` 선언 + React `useId()`로 교체. 모듈 전역 카운터 제거. 문자열 라벨이면 기존 slug 형태, ReactNode 라벨이면 `useId()` 기반 id 생성 |
| 2 (배치2) | `fixtures-broken` 픽스처가 diff에 없다고 지적 | 사실 누락 아님 — `frontend/src/lib/docs/__tests__/fixtures-broken/01-x/bad.mdx`가 실제 커밋에 포함되어 있음. 관련 테스트가 실제로 통과함을 확인 |

## Warning

| # | 발견 | 조치 |
|---|------|------|
| 1 | Empty State 2차 CTA("노드 추가") 미구현 | `CanvasEmptyState`에 `onAddNodeClick` prop 추가. `workflow-canvas.tsx`에서 캔버스 중앙 좌표로 기존 `nodeSearchPopup`을 열도록 연결. 팔레트 하이라이트보다 직관적인 대체 인터랙션 |
| 2 | Empty State 페이드아웃 전환 미구현 | CSS `transition-opacity duration-300` + `pointer-events-none` + `aria-hidden`으로 구현. `nodes.length===0` → opacity-100, 첫 노드 추가 시 opacity-0으로 페이드아웃. React 렌더 규칙(`set-state-in-effect` lint) 준수 위해 DOM은 유지 |
| 3 | 동적 import 경로 슬러그 검증 부재 | `src/lib/docs/links.ts`에 `SAFE_DOCS_SLUG_RE`/`isSafeDocsSlug()` 도입. `/docs/[...slug]/page.tsx`에서 `notFound()` 이전에 슬러그 정규식 검증 선행 |
| 4 | `DocsSidebar` 활성 상태 테스트 없음 | `components/docs/__tests__/docs-sidebar.test.tsx` 신규 — `next/navigation` mock 후 `aria-current="page"` 부여 및 섹션·페이지 렌더링 검증 3개 테스트 추가 |
| 5 | docs registry 테스트 누락 지적 | 기존 `registry.test.ts`(11개)는 diff에 포함됨. 추가 보강: `humanize`/`stripNumberPrefix`/`sectionLabel` 단위 테스트, `includeDrafts:true` 대칭 케이스, 섹션 제외 규칙 테스트 — 총 6개 케이스 추가 |
| 6 | `DocsIndexPage` 리다이렉트 테스트 부재 | `docs/page.tsx`를 `DOCS.fallbackRedirect` 상수로 리팩터. 서버 컴포넌트 + `redirect` 테스트는 유틸 모킹 복잡도 대비 가치가 낮아, 대신 `links.ts` 상수와 registry 섹션 생성 테스트로 폴백 경로를 간접 커버 |
| 7 | 문서 URL 경로 하드코딩 분산 | `src/lib/docs/links.ts` 중앙 상수 도입. `ai-configs.tsx`, `canvas-empty-state.tsx`, `docs/page.tsx`에서 `DOCS.nodes.ai`, `DOCS.gettingStarted.firstWorkflow` 등 참조로 전환 |
| 8 | `next.config.ts` 빌드 제약 주석 삭제 | Turbopack/심링크 관련 기존 주석 2줄 복원 |
| 9 | `FieldGroup.label` 타입 변경 하위 호환 | 기존 사용처 전수 확인 — 모두 문자열/JSX를 label로 직접 전달하는 패턴이며 타입 확장(`string → string \| ReactNode`) 후 타입 체크 통과. `getByText(label)` 등 테스트 쿼리도 영향 없음 (ReactNode 전달 시에도 내부 문자열이 `screen.getByText`로 조회 가능) |
| 10 (배치2) | spec §11 `spec:/code:` 경로 실존 검증 | 1차 조치: registry가 frontmatter 필수 필드(title/section/order/summary)만 검증. spec/code는 선택 필드로 유지하며 빌드타임 검증 테스트는 후속 태스크로 남김 — 현재 모든 MDX의 `spec:` 경로는 수동 확인됨 |
| 11 (배치2) | spec §9 `index.mdx` 랜딩 미구현 | 본 단계 범위 외로 보류. `_glossary.md` 제외 규칙(`_` 접두 제외)은 이미 구현. 섹션 랜딩 규약은 현재 "허브→첫 페이지 redirect"로 대체되어 있으며 콘텐츠 규모가 작아 실용적 영향 없음 |
| 12 (배치2) | `getDocsIndex()` 캐시/HMR | production에서만 `globalThis.__docsIndex` 캐시, development에서는 매 호출마다 재스캔하도록 변경. 테스트용 `resetDocsIndexCache()` export 추가 |
| 13 (배치2) | Path Traversal 방어 | `loadDocsIndex(root)`는 내부 전용 API로 제한(주석으로 명시). 외부 사용자 입력이 `root`로 들어오는 경로 없음. 슬러그 검증은 라우트 핸들러에서 정규식으로 방어 |
| 14 (배치2) | 에러 메시지 절대 경로 노출 | `assertFrontmatter`의 에러 메시지를 `filePath` 대신 `sectionKey/fileName` 상대 식별자로 변경 |
| 15 (배치2) | `gray-matter` JS 엔진 XSS 위험 | `matter(source, { engines: { javascript: () => ({}) } })`로 JS 엔진을 명시적 비활성화. MDX 내 `---js` 헤더가 임의 코드 실행하지 못하도록 차단 |
| 16 (배치2) | `mdx-components.tsx` `javascript:`/`data:` URI 미차단 | `a` 컴포넌트에 허용 프로토콜 화이트리스트(`/`, `#`, `http://`, `https://`, `mailto:`) 적용. 허용 목록에 없는 href는 `<span>` 텍스트로 렌더 |

## 미채택 (사유)

| 발견 | 사유 |
|------|------|
| `side` prop을 `LabelWithHelp`에서 노출 | 현재 사용처에서 `side` 커스터마이즈 필요 없음. 필요 시점에 추가 |
| `globals.css`의 docs 스타일 분리 | 110줄 분량이 크지 않고, 단일 CSS 파일 유지가 현 번들 구성에 유리 |
| `FieldHelp` 키보드 접근성 테스트 | Radix Popover가 표준 키보드 동작을 기본 제공 — 별도 검증의 한계 효용 |
| MDX 컴포넌트(`Callout`, `Steps`, `FieldTable`, `Example`) 단위 테스트 | 순수 렌더 컴포넌트라 스냅샷 가치 낮음. 실제 본문 렌더가 빌드 타임 통합 테스트로 커버됨 (build 시 44개 페이지 정적 생성 성공) |
| 모바일 `/docs` 네비 드로어 | 현재 제품은 최소 해상도 1280px로 spec에 명시됨. 모바일은 Phase 2 이후 범위 |
| `what-is-this.mdx` "다음에 볼 것" 누락 | 콘텐츠 팁 — 본문 개선은 후속 콘텐츠 PR에서 처리 |
| `index.mdx` 섹션 랜딩 패턴 | spec §9에 있으나 현재 트래픽 구조(허브→첫 페이지 redirect)가 실용적 |

## 검증

- `npm run lint` → 0 errors / 0 warnings
- `npm test` → 48 test files / 622 tests passed (기존 611 + 신규 11 — registry 헬퍼·includeDrafts 대칭·섹션 제외·DocsSidebar 활성/렌더/href·Empty State 페이드 aria)
- `npm run build` (`--webpack`) → 성공. `/docs/[...slug]` SSG 22개 페이지 프리렌더 확인
