# 정식 규약 준수 검토 — convention_compliance

- target: `spec/2-navigation/**` (워크스페이스 슬러그 라우팅, impl-done, diff-base=`origin/main`)
- 정식 규약 대조 대상: `spec/conventions/**` (+ 직접 인용되는 `spec/5-system/2-api-convention.md`, `spec/conventions/spec-impl-evidence.md`)
- 검증 방법: `git diff origin/main -- spec/2-navigation/` 로 실제 변경분 추출 → 각 규약 문서 원문 대조 → 근거가 필요한 부분은 워킹트리(`codebase/frontend/src/...`)를 절대경로로 직접 확인. `spec-frontmatter` / `spec-code-paths` / `spec-status-lifecycle` / `spec-link-integrity` / `spec-area-index` / `spec-pending-plan-existence` 6개 build-time 가드를 로컬에서 직접 실행(982 tests, 전부 pass).

## 발견사항

- **[WARNING]** 신규 서술 문장 내 API 경로 표기가 `/api` prefix 를 누락 — 규약(§2.1 URL 구조)·타 spec 의 동일 엔드포인트 표기와 불일치
  - target 위치: `spec/2-navigation/9-user-profile.md` §3 "워크스페이스 전환" (diff 신규 라인) — "`useWorkspaceStore.currentWorkspaceId`(localStorage 영속) → axios `X-Workspace-Id` 헤더 → **`POST /auth/workspaces/:id/switch`** 토큰 재발급"
  - 위반 규약: `spec/5-system/2-api-convention.md` §2.1 "기본 패턴" — 모든 엔드포인트는 `{base_url}/api/{resource}` 형태로 표기. 같은 문서 §2.2 의 RPC-예외 표조차 이 엔드포인트를 `/api/auth/workspaces/:id/switch` 로 정확히 표기하고 있음(대조 기준 그 자체)
  - 상세: 같은 diff 라인 안에서 바로 옆에 언급된 `GET /api/workspaces` 는 prefix 가 맞게 붙어 있는데, `switch` 엔드포인트만 `/api` 가 빠짐. `spec/data-flow/12-workspace.md` (§Overview, §1.5, 시퀀스 다이어그램 3곳)와 `spec/5-system/2-api-convention.md` §2.2·§2.3 은 모두 동일 엔드포인트를 `POST /api/auth/workspaces/:id/switch` 로 일관되게 표기한다 — 즉 프로젝트 전체 SoT 표기와 어긋나는 것은 이번에 새로 들어간 이 한 곳뿐이다. (참고: 프론트 코드 `lib/api/auth.ts`/`workspace-store.ts` 내부에서는 axios `baseURL`(`API_BASE_URL`, 이미 `/api` 포함)에 대한 상대경로라 `/auth/...` 로 쓰는 것이 코드 관례상 맞다 — 그러나 spec 문서 표기 관례는 `{base_url}/api/{resource}` 풀 패스이며 실제로 같은 개념을 다루는 모든 다른 spec 문서가 그렇게 쓴다). 기능·빌드에 영향은 없는 문서 전용 이슈이나, spec 간 동일 엔드포인트 표기가 갈리면 향후 독자·자동 문서 크로스체크에 혼선을 준다.
  - 제안: `POST /auth/workspaces/:id/switch` → `POST /api/auth/workspaces/:id/switch` 로 정정 (plan/complete/workspace-slug-routing.md §L65 에도 동일 오탈자가 선행 존재하니 참고용으로만 두고 spec 쪽만이라도 정정 권장).

- **[INFO]** 슬러그 라우팅 핵심 구현 파일이 어떤 nav spec 의 `code:` frontmatter 에도 등재되지 않음 (evidence 완전성 갭 — 가드는 통과하나 빈틈)
  - target 위치: `spec/2-navigation/9-user-profile.md` frontmatter `code:` (L4-19), `spec/2-navigation/_layout.md` frontmatter `code:` (L4-7)
  - 위반 규약: 엄밀히는 위반 아님 — `spec/conventions/spec-impl-evidence.md` §4 `spec-code-paths.test.ts` 는 `status ∈ {partial, implemented}` spec 의 `code:` 글로브가 **≥1개**만 매치하면 되고 완전 열거를 요구하지 않는다(§Rationale R-1 이 이 한계를 명시적으로 인지하고 `/spec-coverage` standing audit 로 보완한다고 명시). 두 문서 모두 이미 다른 glob 로 gate 통과(예: `codebase/frontend/src/lib/stores/workspace-store.ts`, `codebase/frontend/src/components/layout/**`).
  - 상세: 그럼에도 이번 기능의 실제 구현 핵심 — `codebase/frontend/src/lib/workspace/href.ts` / `resolve-fallback.ts` / `use-workspace-slug.ts` / `use-workspaces.ts`, `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx`, `codebase/frontend/src/app/(main)/[...rest]/page.tsx` — 는 `spec/2-navigation/*.md` 어디의 `code:` 배열에도 없다. `11-error-empty-states.md` 만 본문 **prose** 안에서 `w/[slug]/layout.tsx` 를 1회 언급할 뿐, frontmatter 상 evidence 로는 잡히지 않는다. `9-user-profile.md §3` 이 이 파일들의 동작(URL 우선 reconcile·fallback redirect·buildWorkspaceHref)을 가장 상세히 서술하는 SoT 인데 정작 그 spec 의 `code:` 목록에 없다.
  - 제안: `9-user-profile.md` frontmatter `code:` 에 `codebase/frontend/src/lib/workspace/**` 와 `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx` 를, `_layout.md` 에 `codebase/frontend/src/app/(main)/[...rest]/**` 를 추가하면 evidence 완전성이 높아진다. 필수 아님(가드 통과 상태) — 여유 있을 때 반영하거나 `/spec-coverage` 다음 회차에 위임 가능.

## 점검했으나 위반 없음 (참고)

- **명명 규약**: 백엔드 API 엔드포인트·DTO 변경 없음(이번 기능은 순수 FE 라우팅 — `git diff origin/main --stat -- codebase/backend/` 결과 0). `/w/[slug]` 세그먼트 명명은 `spec/5-system/2-api-convention.md` §2.2 (`/api/{resource}` 전용 규칙)의 적용 대상이 아님(FE 페이지 라우트).
- **출력 포맷/API 문서 규약**: 신규 에러 코드·응답 envelope·Swagger 데코레이터 변경 없음 — 해당 없음.
- **금지 항목**: `i18n-userguide.md` Principle 1 (하드코딩 한글 금지) — 신규 파일(`href.ts`/`resolve-fallback.ts`/`use-workspace-slug.ts`/`use-workspaces.ts`/`layout.tsx`/`[...rest]/page.tsx`) 전부 사용자 노출 문자열 없음(순수 로직·스피너만). `_glossary.md` 금지어("엣지"·"작업 흐름"·"아웃풋") 도 diff 안에 없음.
- **문서 구조 규약**: 변경된 11개 nav spec 모두 기존 Overview/본문/Rationale 3단 구조를 깨지 않고 인라인 삽입만 함. 슬러그 라우팅 설계 근거(Rationale)는 `data-flow/12-workspace.md` 로 외부화되어 있고, 이는 이미 다수 다른 nav spec(예: Re-run/Replay)이 쓰는 기존 SoT-외부화 패턴과 동일 — 위반 아님.
- **spec-impl-evidence 빌드 가드**: `spec-frontmatter` / `spec-code-paths` / `spec-status-lifecycle` / `spec-link-integrity` / `spec-area-index` / `spec-pending-plan-existence` 6개 vitest 전부 로컬 실행 통과(982 tests). `id` 중복 회피 패턴(`nav-agent-memory` vs `agent-memory`) 등 기존 예외도 diff 로 훼손되지 않음.
- **spec 서술 ↔ 구현 일치**: "에디터 canvas `/workflows/:id` 는 phase 1 에서 slug 밖" 이라는 반복 서술을 실제 라우트 트리로 검증 — 에디터는 `(editor)/workflows/[id]/page.tsx` 에 있고 `(main)/w/[slug]/workflows/[id]` 아래에는 `executions/` 서브트리만 존재. 서술과 구현이 정확히 일치.

## 요약

이번 diff(`spec/2-navigation/**` 11개 파일 + `_layout.md`)는 워크스페이스 슬러그 라우팅(`/w/<slug>/...`)을 FE 라우팅 SoT 로 반영하는 문서 정정이며, 관련 build-time evidence 가드(spec-frontmatter/spec-code-paths/spec-status-lifecycle/spec-link-integrity/spec-area-index/spec-pending-plan-existence) 를 모두 통과하고 실제 코드(에디터가 slug 밖에 남아있다는 서술 등)와도 일치해 구조적으로는 견고하다. 발견된 문제는 규약 위반이라기보다 사소한 표기 결함 두 건뿐이다 — (1) 신규 삽입 문장의 `switch` 엔드포인트 표기에서 `/api` prefix 가 누락돼 동일 엔드포인트를 다루는 다른 spec 문서들과 표기가 갈리는 WARNING, (2) 이번 기능의 핵심 구현 파일들이 어떤 nav spec 의 `code:` frontmatter 에도 등재되지 않은 evidence 완전성 갭(가드 자체는 통과, INFO). 둘 다 문서 정정만으로 해소 가능하며 코드 변경이나 아키텍처 재검토는 필요 없다.

## 위험도

LOW
