# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — SSR 하이드레이션 불일치를 유발하는 모듈 레벨 가변 카운터와 스펙 대비 미구현 항목(Empty State 2차 CTA, 페이드아웃 전환)이 핵심 위험 요인

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 / 동시성 | `checkboxIdCounter` 모듈 레벨 가변 카운터 — SSR 환경에서 서버/클라이언트 카운터가 독립 증가해 `<label htmlFor>`↔`<input id>` 연결이 끊기는 hydration 불일치 발생. React Strict Mode 이중 렌더 및 리렌더 시마다 ID가 변경되어 접근성도 깨짐 | `shared.tsx` — `let checkboxIdCounter = 0` / `nextCheckboxId()` | `useId()` (React 18+) 훅으로 교체. `const uid = useId(); const id = typeof label === "string" ? \`cb-${label…}\` : \`cb-${uid}\`` |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 미구현 | Empty State 2차 CTA("노드 추가" → 팔레트 하이라이트) 미구현 — 스펙 §3.6에 명시된 요구사항 | `canvas-empty-state.tsx`, `spec/3-workflow-editor/0-canvas.md §3.6` | 팔레트 하이라이트용 store/signal 연결과 두 번째 버튼 추가, 또는 스펙에 단계적 구현 계획 명시 |
| 2 | 요구사항 미구현 | Empty State 페이드 아웃 전환 미구현 — 스펙 "첫 노드 추가 시 페이드 아웃" 요구사항이 즉시 언마운트로만 처리됨. 테스트도 해당 동작 미검증 | `workflow-canvas.tsx:477-481` | CSS `fade-out` 트랜지션 또는 Framer Motion 적용 후 테스트 케이스 추가 |
| 3 | 보안 / 아키텍처 | 동적 import 경로에 URL 파라미터 직접 삽입 — `dynamicParams = false`가 1차 방어이나 레지스트리 슬러그 정규화 품질에 의존하는 설계. 레지스트리 캐시 오염 시 `../../` 경로 탐색 가능 | `docs/[...slug]/page.tsx` — `` await import(`@/content/docs/${slugPath}.mdx`) `` | import 전 `const SAFE_SLUG_RE = /^[a-z0-9\-\/]+$/i`로 슬러그 검증 추가, 또는 registry에서 MDX 모듈을 직접 resolve하는 정적 맵으로 전환 |
| 4 | 테스트 누락 | `DocsSidebar` 활성 상태 테스트 없음 — `usePathname()` 기반 `aria-current="page"` 설정이 핵심 동작임에도 테스트 부재 | `docs-sidebar.tsx` | `next/navigation` mock 후 현재 경로 일치 항목의 `aria-current` 및 스타일 적용 검증 테스트 추가 |
| 5 | 테스트 누락 | 문서 레지스트리(`registry.ts`) 테스트 파일 미확인 — fixture 디렉터리는 있으나 실제 테스트 파일이 diff에 없음. `getAllSlugs`, `getDocBySlug`, `_` 접두사 파일 제외 등 라우팅 핵심 로직 미검증 | `frontend/src/lib/docs/__tests__/` | `registry.test.ts` 존재 여부 확인 후 없으면 정상 파싱·frontmatter 없는 파일 처리·`_` 접두사 제외·slug 불일치 케이스 추가 |
| 6 | 테스트 누락 | `DocsIndexPage` 리다이렉트 폴백 테스트 없음 — 빈 섹션 시 `/dashboard` 리다이렉트 경로 미검증 | `docs/page.tsx` | `getDocsIndex` mock으로 빈 섹션 케이스 및 정상 케이스 테스트 추가 |
| 7 | 유지보수성 | 문서 URL 경로가 컴포넌트 파일에 분산 하드코딩 — 경로 변경 시 여러 파일을 찾아 수정해야 함 | `ai-configs.tsx` (`/docs/02-nodes/ai` 3회 중복), `canvas-empty-state.tsx` (여러 href 인라인) | `src/lib/docs/links.ts`에 `export const DOCS = { nodes: { ai: '/docs/02-nodes/ai' } }` 형태로 중앙화 |
| 8 | 범위 이탈 | `next.config.ts`에서 빌드 제약 설명 주석 삭제 — `--webpack` 플래그 사용 이유(Turbopack 심볼릭 링크 미지원)가 이번 기능과 무관하게 제거됨 | `next.config.ts` — `transpilePackages` 위 주석 2줄 | 삭제된 주석 복원 또는 README 빌드 명령 섹션에 제약 기록 |
| 9 | 하위 호환성 | `label` prop 타입 `string → React.ReactNode` 변경 — 기존 사용처에서 label 값으로 문자열 연산이나 `getByText(label)` 쿼리를 수행하는 코드가 있으면 런타임/테스트 오류 발생 가능 | `shared.tsx` — `FieldGroup`, `SelectField`, `NumberField`, `CheckboxField` | 기존 사용처 전체 확인 후 필요 시 `labelText?: string` 별도 prop 추가로 구분 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `docsHref`에 앵커 없음 — 스펙은 `/docs/<section>/<slug>#<anchor>` 딥링크 형태 요구, 현재 앵커 미포함 | `ai-configs.tsx` 내 `LabelWithHelp` 사용부 | MDX heading의 `rehype-slug` 생성 id 확인 후 `#text-classifier` 형태 앵커 추가 |
| 2 | 요구사항 | 모바일 사이드바 네비게이션 부재 — 1024px 미만에서 섹션 이동 불가 | `docs/layout.tsx` — `hidden lg:block` | 모바일 드로어 사이드바 또는 상단 select 네비게이션 추가, 또는 스펙에 모바일 처리 방침 명시 |
| 3 | 콘텐츠 품질 | `what-is-this.mdx` "다음에 볼 것" 섹션 불완전 — "아래 순서를 권해요" Callout 뒤 실제 순서 목록 없음 | `content/docs/01-getting-started/what-is-this.mdx` | `<Steps>`로 UI 투어 → 첫 워크플로우 두 단계 추가, 또는 해당 섹션 제거 |
| 4 | 성능 / 아키텍처 | `getDocsIndex()` 요청당 최대 3회 호출 — 파일시스템 I/O 포함 시 불필요한 반복 실행 | `docs/layout.tsx`, `docs/page.tsx`, `docs/[...slug]/page.tsx` | Next.js `cache()` 래퍼 또는 모듈 레벨 `Map` 캐시로 요청당 1회 실행 보장 |
| 5 | 아키텍처 | `shared.tsx` 파일과 `shared/` 디렉터리 동명 공존 — 인덱스 역할 여부 불명확 | `node-configs/shared.tsx` & `node-configs/shared/` | `shared.tsx`를 `shared/index.tsx`로 이동해 디렉터리 구조 명확화 |
| 6 | 아키텍처 | MDX 렌더링 에러 바운더리 부재 — 콘텐츠 오류 시 페이지 전체 크래시 | `docs/[...slug]/page.tsx` — `<MDXContent />` | `docs/` 하위 `error.tsx` 경계 파일 존재 여부 확인 및 추가 |
| 7 | 번들링 | 템플릿 리터럴 동적 import — 번들러 정적 분석 불가로 전체 `.mdx` 파일이 단일 청크에 묶일 수 있음. 현재 20개 규모에선 실용적 문제 없으나 100개 이상 시 빌드 성능 모니터링 필요 | `docs/[...slug]/page.tsx` — `` `@/content/docs/${slugPath}.mdx` `` | 문서 수 증가 시 registry 기반 정적 import 맵으로 전환 검토 |
| 8 | 유지보수성 | `FieldHelp`의 `side` prop이 `LabelWithHelp`에서 재정의 불가 — 레이아웃에 따른 팝오버 방향 변경 불가 | `field-help.tsx` — `LabelWithHelpProps`의 `help: Omit<FieldHelpProps, "side" \| "className">` | `side`를 `Omit` 목록에서 제거하거나 `LabelWithHelpProps`에 노출 |
| 9 | 유지보수성 | `globals.css`에 docs 전용 스타일 110줄 추가 — 파일 책임 증가 | `globals.css` L108-215 | `docs.css`로 분리 후 `globals.css`에서 import, 또는 Tailwind `@layer` 방식 이동 |
| 10 | 유지보수성 | `DocsIndexPage` fallback href `/dashboard` 인라인 하드코딩 | `docs/page.tsx:L7` — `redirect(first?.href ?? "/dashboard")` | `FALLBACK_REDIRECT = "/dashboard"` 상수 추출 또는 `notFound()` 처리 |
| 11 | 테스트 | `FieldHelp` 키보드 접근성 테스트 없음 — Tab → Enter → Escape 흐름 미검증 | `field-help.test.tsx` | `userEvent`로 Escape 키 팝오버 닫힘 및 포커스 반환 테스트 추가 |
| 12 | 테스트 | MDX 컴포넌트(`Callout`, `Steps`, `FieldTable`, `Example`) 테스트 없음 | `components/docs/mdx/` | `type`별 CSS 클래스, `required` 렌더링, `marker` 순서 등 스냅샷 또는 role 기반 단위 테스트 추가 |
| 13 | 보안 | `docsHref` URL 스킴 검증 부재 — 현재는 하드코딩이라 위험 낮으나 향후 외부 데이터 연결 시 `javascript:` URI XSS 가능 | `field-help.tsx` — `<a href={docsHref}>` | `const safeDocs = docsHref?.startsWith("/") ? docsHref : undefined` 방어 코드 추가 |
| 14 | 보안 | `gray-matter` 의존성 — `js-yaml` 프로토타입 오염 이력. 현재 정적 파일만 처리하므로 위험도 낮음 | `package.json` | `npm audit` CVE 확인. 사용자 업로드 MDX 처리 추가 시 별도 샌드박스 도입 |
| 15 | 문서화 | MDX 공개 컴포넌트(`Callout`, `Steps`, `FieldTable`, `Example`) JSDoc 부재 | `components/docs/mdx/` 전체 | 허용 `type` 값, 필드 의미, 중첩 제약 등 사용 예시 포함 JSDoc 추가 |
| 16 | 문서화 | `_glossary.md` 제외 규칙이 레지스트리 코드에 주석 없음 | `lib/docs/registry` 필터 로직 | `// "_"로 시작하는 파일은 내비게이션에서 제외 (예: _glossary.md)` 주석 추가 |
| 17 | 의존성 | `rehype-autolink-headings`, `rehype-slug`, `remark-gfm`이 `dependencies`에 배치 — 빌드 타임 전용 패키지 | `package.json` | 엄밀히는 `devDependencies`로 이동 가능. CI/CD `--production` 플래그 미사용 시 현재 위치도 허용됨. 팀 기준 확인 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM | `checkboxIdCounter` SSR 하이드레이션 불일치 (CRITICAL 수준 지적), 동적 import 번들링 위험 |
| requirement | MEDIUM | Empty State 2차 CTA 및 페이드아웃 미구현, `docsHref` 앵커 미적용, 모바일 네비 부재 |
| architecture | MEDIUM | 모듈 레벨 카운터 hydration 위험, 동적 import 레지스트리-파일 암묵적 결합, URL 분산 하드코딩 |
| testing | MEDIUM | `DocsSidebar`·레지스트리·`DocsIndexPage` 테스트 누락, `checkboxIdCounter` 테스트 격리 파괴 |
| security | LOW | 동적 import 경로 탐색 가능성(현재 완화됨), `docsHref` URL 스킴 미검증 |
| performance | LOW | `checkboxIdCounter` SSR 불일치, 템플릿 리터럴 동적 import 번들 분석 불가 |
| maintainability | LOW | `checkboxIdCounter` 비관용적 패턴, URL 하드코딩 분산, `globals.css` 책임 증가 |
| concurrency | LOW | `checkboxIdCounter` SSR/Concurrent 렌더 비결정성 |
| scope | LOW | `next.config.ts` 설명 주석 불필요 삭제, `checkboxIdCounter` 범위 외 도입 |
| documentation | LOW | 빌드 제약 주석 삭제, MDX 컴포넌트 JSDoc 부재, README 미갱신 |
| dependency | LOW | 동적 import 번들 분석 한계, rehype/remark `devDependencies` 미분류 |
| database | NONE | 해당 없음 (프론트엔드 전용 변경) |
| api_contract | NONE | 해당 없음 (백엔드 계약 변경 없음) |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| database | 프론트엔드 전용 변경으로 DB 관련 코드 없음 |
| api_contract | 백엔드 엔드포인트·요청/응답 스키마 변경 없음 |

---

## 권장 조치사항

1. **[즉시 필수]** `shared.tsx`의 `checkboxIdCounter`를 `useId()` 훅으로 교체 — SSR hydration 불일치 및 리렌더 시 접근성 연결 파괴 방지
2. **[즉시 필수]** Empty State 2차 CTA("노드 추가" + 팔레트 하이라이트) 구현 — 스펙 명시 요구사항
3. **[즉시 필수]** Empty State 첫 노드 추가 시 페이드 아웃 전환 구현 — 스펙 명시 요구사항
4. **[테스트 보완]** `lib/docs/registry.test.ts` 존재 여부 확인 및 없으면 생성 — 라우팅 핵심 로직 커버
5. **[테스트 보완]** `DocsSidebar` 활성 상태 및 `DocsIndexPage` 리다이렉트 테스트 추가
6. **[보안 강화]** 동적 import 전 슬러그 정규식 검증(`/^[a-z0-9\-\/]+$/i`) 추가
7. **[유지보수]** 문서 URL을 `src/lib/docs/links.ts` 상수로 중앙화
8. **[복원]** `next.config.ts`에서 삭제된 `--webpack` 빌드 제약 주석 복원
9. **[콘텐츠]** `what-is-this.mdx` "다음에 볼 것" 섹션 완성 및 `docsHref`에 앵커 추가
10. **[아키텍처]** `shared.tsx`를 `shared/index.tsx`로 이동해 디렉터리 구조 명확화 및 `getDocsIndex()` 캐싱 추가