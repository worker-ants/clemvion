---
worktree: editor-slug-phase2-f9a46b
started: 2026-07-09
owner: developer
---

# 워크스페이스 슬러그 라우팅 phase 2 — 에디터 slug화

phase 1(#865)에서 slug 밖으로 남겼던 에디터 캔버스(`/workflows/[id]`)를 `/w/<slug>/workflows/<id>` 로 편입.
FE-only, backend 무변경(X-Workspace-Id 헤더·header-first 인가 불변 — phase 1 규약 계승).

## 잠금된 결정 (사용자 확인)

- **라우트 구조 = 전용 에디터 slug 그룹**: `(editor)/w/[slug]/workflows/[id]/` 신설 + `(editor)/w/[slug]/layout.tsx`
  자체 slug 게이트. `(main)/w/[slug]/layout.tsx` 의 slug-해소·reconcile·무효-slug-redirect 로직을 **공용
  훅/컴포넌트로 추출**해 (main)·(editor) 양쪽이 공유(복붙 아님). 에디터는 `EditorContent` 풀스크린 chrome 유지.
  → `(main)/layout.tsx` 의 chrome/게이트 커플링을 건드리지 않아 phase-1 머지 코드 blast-radius 최소.
- **reconcile 게이트**: 에디터에도 동일 적용(URL=SoT, 정합 전 캔버스 렌더 gate).
- **구 bare `/workflows/<id>` 하위호환**: 별도 redirect stub 없이 `(main)/[...rest]` catch-all 이 흡수(현행).
- **알림 딥링크(`lib/notifications/href.ts`)**: 기본 bare 유지 + catch-all 흡수(저위험 현행).
- **에디터 내 워크스페이스 전환**: 기존대로 새 slug `/dashboard` 로 이동(에디터 이탈).
- **무효 slug**: (main) 과 동일 default redirect(공용 게이트로 자동 상속).

## 작업 표면 (조사 결과 기반)

- [x] **S1. slug 게이트 로직 추출** — `(main)/w/[slug]/layout.tsx` 의 slug→워크스페이스 해소 + reconcile(URL 우선)
  + 무효-slug redirect + 정합 전 gate 를 `lib/workspace/workspace-slug-gate.tsx` 공용 컴포넌트
  **`<WorkspaceSlugGate>`** 로 추출(impl-prep naming_collision WARNING: 기존 `WorkspaceSlugLayout`/
  `useWorkspaceSlug` 와 어순 일치 — `Slug`+`Workspace` 역순 anagram 회피). (main) layout 은 이를 소비하도록
  리팩터(동작 불변). (+unit)
- [x] **S2. 에디터 라우트 이동** — `(editor)/workflows/[id]/{page,editor-loader}.tsx` →
  `(editor)/w/[slug]/workflows/[id]/`. 신규 `(editor)/w/[slug]/layout.tsx` = 추출 게이트 소비 + EditorContent chrome.
  기존 `(editor)/layout.tsx`(AuthProvider+chrome)는 부모로 유지. `params.id` 파싱 불변(저장 흐름 리다이렉트 없음).
- [x] **S3. 에디터 딥링크 slug화** — bare `/workflows/${id}`(캔버스) 11리터럴/7파일:
  workflows/page.tsx(235·340·617)·dashboard/page.tsx(107·233)·triggers/page.tsx(716)·schedules/page.tsx(1087)
  는 slug 소비 가능 → `buildWorkspaceHref(slug, \`/workflows/${id}\`)`. **usage-node-list.tsx(42·76)·
  overview-card.tsx(151)** 는 slug 미소비 → slug prop/hook 신규 배선. (create-then-push 포함)
- [x] **S4. AuthProvider 갱신** — `auth-provider.tsx:51-56` `/w/` 분기 주석: 이제 에디터도 `/w/` 아래라
  persisted-reconcile skip 대상에 포함(slug 게이트가 reconcile 주체). 코드 동작은 이미 맞음, 주석·의도 정정.
- [x] **S5. 가드/헬퍼 주석 갱신** — `no-raw-execution-href.test.ts:59` 의 bare `/workflows/${id}` "safe form"
  화이트리스트 재검토(에디터 slug화 반영). `editor-toolbar.tsx:52-53`·`href.ts:26-28` 의 "editor=bare 예외" 문구 갱신.
  (에디터 캔버스 링크 guard 추가 여부는 구현 중 판단 — notification bare 예외 보존 필요)
- [x] **S6. catch-all 하위호환 확인** — 구 북마크/알림 bare `/workflows/<id>` → `(main)/[...rest]` 이
  `/w/<slug>/workflows/<id>` 로 흡수(flash 동반) 동작 e2e/수동 확인.
- [x] **S7. spec flip (project-planner 위임 or spec-update draft)** — "에디터 = slug 밖(phase 2)" 서술 정정:
  `9-user-profile.md:158`·`_layout.md:85`(+**§3.1 line 126**, impl-prep INFO)·`0-dashboard.md:21`·
  `1-workflow-list.md:103`·`14-execution-history.md:20` + `spec/3-workflow-editor/2-edge.md:10` frontmatter
  `code:` 경로((editor)/w/[slug]/... 로).
  - **+ `data-flow/12-workspace.md` `## Rationale`** (impl-prep rationale_continuity WARNING): "URL slug =
    FE 라우팅 SoT" 절의 "reconcile 방향 = URL 우선 / 에디터는 localStorage 힌트" 문단이 이제 에디터도
    URL-우선임을 반영하도록 갱신(에디터를 예시에서 제거 or "phase 2 이후 에디터도 URL 우선"). spec_impact 명시.
    → **에디터 reconcile 방향 번복의 근거 SoT 라 누락 시 invariant 문서가 구현과 모순.**
- [~] TEST WORKFLOW — lint(0-err)·unit(265 files, 5170 pass, 신규 게이트/에디터 layout/양 가드 포함)·
  build(101/101, **두 그룹 /w/[slug] 공존 충돌 없음 실증**) 통과. e2e(slug-routing.spec.ts 에 에디터
  deep-link·bare 리다이렉트 2건 추가) 실행 중.
- [ ] REVIEW WORKFLOW — `/ai-review` + `/consistency-check --impl-done`.

## 구현 노트
- **라우트 구조 검증**: `next build` 산출에 `/w/[slug]/workflows/[id]`(에디터, (editor) 그룹) +
  `/w/[slug]/workflows/[id]/executions`((main) 그룹)가 충돌 없이 공존 — 잠금한 두-그룹 접근 확정.
- **guard 가치 실증**: `no-raw-editor-href` 가드가 스코핑에서 놓친 bare 에디터 링크 2곳(executions
  목록 "Open in Editor" 171·202)을 발굴 → 이관.
- **환경**: fresh 워크트리 `@workflow/*` dist 미빌드 → `pnpm install` 재실행으로 워크스페이스 심링크 생성(1회).

## 주의 (조사 발견)

- `(main)/w/[slug]/workflows/[id]/` 는 현재 `executions/` 만 있고 `page.tsx` 없음 — `[id]`+`[slug]` 공존은
  이미 실증됨(에디터 편입에 param 충돌 없음, docs 와 다름).
- spec 의 "Phase 2"(ai-assistant verify·실행엔진 단계)는 slug phase 2 와 **무관** — 혼동 금지.
- S7 은 spec 변경이라 developer 권한 밖 → 코드 PR 과 원자적으로 갈지, spec-update draft→planner 로 뺄지
  impl-prep 후 결정(phase-1 은 code+spec 원자 PR 였음).
