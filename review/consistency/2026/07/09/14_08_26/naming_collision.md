# 신규 식별자 충돌 검토 — spec/2-navigation/ (에디터 slug화 phase 2, impl-done)

검토 대상 diff: `origin/main..HEAD` 중 `spec/2-navigation/*`, `spec/3-workflow-editor/2-edge.md`,
`spec/data-flow/12-workspace.md`, `plan/in-progress/editor-slug-phase2.md` + 대응 코드
(`codebase/frontend/src/app/(editor)/w/[slug]/**`, `lib/workspace/workspace-slug-gate.tsx`,
`lib/workspace/href.ts` 의 `buildEditorHref`).

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** 3-way 유사 명명(`WorkspaceSlugLayout` / `EditorWorkspaceSlugLayout` / `WorkspaceSlugGate`)은 의도적으로 구분되어 충돌 아님
  - target 신규 식별자: `WorkspaceSlugGate` (`codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`), `EditorWorkspaceSlugLayout` (`codebase/frontend/src/app/(editor)/w/[slug]/layout.tsx` 의 default export)
  - 기존 사용처: `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx` 의 기존 default export `WorkspaceSlugLayout`(phase 1), `codebase/frontend/src/lib/workspace/use-workspace-slug.ts` 의 `useWorkspaceSlug`(phase 1)
  - 상세: `plan/in-progress/editor-slug-phase2.md` S1 항목이 스스로 "impl-prep naming_collision WARNING: 기존 `WorkspaceSlugLayout`/`useWorkspaceSlug` 와 어순 일치 — `Slug`+`Workspace` 역순 anagram 회피"를 명시하고 있어, 이전 impl-prep 라운드에서 이미 이 명명 이슈가 지적·해소된 이력이 확인된다. 실제 코드 확인 결과 세 식별자는 역할이 뚜렷이 분리된다: `WorkspaceSlugGate` = (main)·(editor) 공용 게이트 컴포넌트(신규 추출), `WorkspaceSlugLayout` = (main) 라우트 전용 default export(기존, 이제 게이트를 소비하도록 리팩터), `EditorWorkspaceSlugLayout` = (editor) 라우트 전용 신규 default export. 모듈 경로가 달라(`(main)/w/[slug]/layout.tsx` vs `(editor)/w/[slug]/layout.tsx` vs `lib/workspace/workspace-slug-gate.tsx`) import 충돌 가능성 없음 — `grep` 결과 실제 충돌 사용처 0건.
  - 제안: 조치 불필요(이미 명확히 구분됨). 향후 세 번째 라우트 그룹이 생길 경우 동일 패턴(`<Group>WorkspaceSlugLayout`)을 유지할 것.

## 검증한 항목 (충돌 없음 확인)

1. **요구사항 ID** — 이번 diff 는 신규 요구사항 ID를 부여하지 않음(기존 `9-user-profile.md`/`_layout.md`/`0-dashboard.md`/`1-workflow-list.md`/`14-execution-history.md`/`data-flow/12-workspace.md` 문구만 정정, ID 신설 없음).
2. **엔티티/타입명** — 신규 함수 `buildEditorHref(slug, workflowId)` (`codebase/frontend/src/lib/workspace/href.ts`)는 `grep -rn buildEditorHref`로 전체 코드베이스 검색 시 유일한 정의이며, 기존 `buildWorkspaceHref`/`buildExecutionHref`와 같은 파일·같은 명명 규칙(동사+명사+Href)으로 일관. 다른 의미로 이미 쓰이는 곳 없음.
3. **API endpoint** — 이번 변경은 FE-only(plan 명시: "backend 무변경 — X-Workspace-Id 헤더·header-first 인가 불변"). 신규/변경 endpoint 없음.
4. **이벤트/메시지명** — webhook·queue·SSE 이벤트 변경 없음.
5. **환경변수·설정키** — 신규 ENV/config key 없음.
6. **파일 경로** —
   - `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/{page.tsx,editor-loader.tsx}` (기존 `(editor)/workflows/[id]/` 에서 이동) 와 `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx` (기존)는 Next.js route group 이 달라(`(editor)` vs `(main)`) URL 세그먼트가 겹치지 않음 — `/w/[slug]/workflows/[id]`(에디터) vs `/w/[slug]/workflows/[id]/executions`(실행 목록). plan 자체가 `next build` 산출로 두 그룹 공존 무충돌을 실증(101/101 라우트 생성) 기록.
   - `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`, `__tests__/workspace-slug-gate.test.tsx`, `__tests__/no-raw-editor-href.test.ts`, `__tests__/href-guard-utils.ts` — 기존 `lib/workspace/` 디렉토리 명명 컨벤션(`use-workspace-slug.ts`, `no-raw-execution-href.test.ts` 등 kebab-case)과 일치, 기존 파일과 경로 겹침 없음.
   - `plan/in-progress/editor-slug-phase2.md` — `plan/complete/workspace-slug-routing.md`(phase 1)와 파일명이 명확히 구분되고 `plan/in-progress/` 내 다른 slug 관련 plan 없음(중복 없음).

## 요약

target diff(`spec/2-navigation/` 중심 + 대응 코드)가 도입하는 신규 식별자는 `WorkspaceSlugGate`(공용 게이트 컴포넌트) · `EditorWorkspaceSlugLayout`(에디터 라우트 layout) · `buildEditorHref`(에디터 href 헬퍼) · `(editor)/w/[slug]/workflows/[id]` 라우트 · 관련 테스트 파일 4개 · `plan/in-progress/editor-slug-phase2.md` 로 정리된다. 전수 검색 결과 기존 사용처와의 실질적 의미 충돌(CRITICAL/WARNING)은 발견되지 않았다. 유일하게 짚을 점은 `WorkspaceSlugLayout`/`EditorWorkspaceSlugLayout`/`WorkspaceSlugGate` 3개 유사 명명인데, 이는 이전 impl-prep naming_collision 라운드에서 이미 지적·해소된 사안이며 실제 파일 경로·역할이 뚜렷이 분리돼 있어 정보성(INFO) 확인 외 추가 조치가 불필요하다.

## 위험도

NONE
