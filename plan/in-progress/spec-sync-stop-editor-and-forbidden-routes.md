---
title: spec 동기화 후속 — /executions/:id/stop 의 Editor+ 반영 · 잔여 61 라우트 403 문서화
worktree: (unstarted)
started: 2026-08-08
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/3-workflow-editor/3-execution.md
  - spec/conventions/node-cancellation.md
  - spec/conventions/swagger.md
---

## Overview

[`auth-workspace-membership-guard`](auth-workspace-membership-guard.md) (P0 cross-tenant fix)의
`--impl-done`(`review/consistency/2026/08/08/22_43_48`, **BLOCK: NO**) WARNING 1건 + INFO 2건을
분리 등재한다. 셋 다 **문서 동기화**이고 `spec/` 쓰기라 planner 트랙이다.

미룬 이유: 그 PR 은 이미 게이트를 4회(`--impl-prep` ×2 · `--spec` ×2 · `--impl-done` ×2 ·
`/ai-review` ×2) 돌았고, spec 을 한 줄이라도 더 건드리면 방금 통과한 `--impl-done` 이 다시
stale 이 돼 사이클이 한 번 더 열린다. 그 대가가 P0 보안 fix 의 착지 지연이라 분리했다.

## 1. `/executions/:id/stop` 의 Editor+ 가 에디터 문서에 미반영 (W1)

P0 PR 이 `executions.controller.ts` `stop` 에 `@Roles('editor')` 를 부착하고 FE
`editor-toolbar.tsx` 에 `canEdit` 가드를 넣었다(viewer 는 Stop 버튼 미노출). 근거는
`1-auth.md §3.2` 의 `Workflow 실행 | Owner ✅ | Admin ✅ | Editor ✅ | Viewer —` 다.

그런데 **워크플로우 에디터 쪽 문서 3곳이 이를 반영하지 않는다**:

- [ ] `spec/3-workflow-editor/3-execution.md` §9 API 표 (L335) — `/stop` 행에
      **인접 행과 달리 "Editor+" 주석이 없다**. 인접 행이 이미 그 표기를 쓰므로 형태를 맞춘다
- [ ] `spec/3-workflow-editor/3-execution.md` §4 "실행 중단(Stop)" (L170-177) — 권한 한 줄 보강
- [ ] `spec/conventions/node-cancellation.md` L63 — "Editor+ 전용(viewer 는 버튼 미노출,
      FE `canEdit` 가드)" 문구 추가

> **신규 결정이 아니다** — §3.2 가 이미 확정한 권한을 파생 문서에 반영하는 것뿐이다.
> 따라서 `--spec` 에서 Rationale 신설은 불요하고 표기 동기화로 족하다.

## 2. 잔여 ~61개 라우트의 `@ApiForbiddenResponse` (INFO 4)

P0 PR 은 **자기가 건드린 5개 컨트롤러의 12곳**에만 부착했다. 저장소 전체로는
`@WorkspaceId()` 를 소비하며 `@Roles()` 가 없는 라우트가 73건이라 **~61건이 남는다**
(`workflows.controller.ts`·`integrations.controller.ts` 등).

종전엔 이 항목이 두 plan 의 **산문 권고**로만 있었다 — checker 가 "review/ 에만 있다가
유실되는 패턴" 을 지적해 여기 체크리스트로 승격한다.

- [ ] 전수 스캔으로 대상 확정 — `@WorkspaceId()` 소비 **&&** `@Roles()` 부재 **&&**
      `@ApiForbiddenResponse` 부재. (P0 PR 이 쓴 triage 스크립트와 같은 형태 —
      **데코레이터 기준 파싱**이어야 한다. 문자열 매칭은 첫 판에서 0건을 냈다)
- [ ] 코드모드로 일괄 부착 (`swagger.md §5-4` 가 이제 이 케이스를 요구한다)
- [ ] 설명 문자열은 `@Roles()` 없는 경우 **"워크스페이스 멤버가 아님"** 으로 통일 (§5-4)

## 3. `swagger.md` 교차링크 앵커 (INFO 3)

- [ ] `spec/conventions/swagger.md` 의 `12-workspace.md` 인용 2곳(§5-4 체크리스트·§Rationale)에
      앵커 프래그먼트 `#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` 추가 —
      `error-codes.md` 인용 스타일과 통일

## 체크리스트

- [ ] 위 §1·§2·§3 처리
- [ ] `/consistency-check --spec` (spec 본문 편집이므로 의무)

## Rationale

**왜 P3 인가.** 셋 다 **동작 영향 0** 이다. 권한 자체는 코드·`§3.2`·FE 가드로 이미 강제되고
있고, 여기서 고치는 것은 **파생 문서가 그 사실을 말하지 않는다**는 표기 갭이다. 다만 §1 은
방치하면 에디터 문서만 읽은 사람이 "viewer 도 중단할 수 있다" 로 오독하므로 won't-do 는 아니다.

**§2 의 트리거**: `swagger.md §5-4` 가 P0 PR 에서 확장됐으므로, 이제 규약을 그대로 따르는
신규 라우트는 올바르게 부착된다. 잔여 61건은 **소급 정리**라 급하지 않다.
