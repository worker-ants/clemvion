# Plan 정합성 검토 — spec/2-navigation/ (impl-done, diff-base origin/main)

## 검토 대상

- 지배 plan: `plan/in-progress/workspace-slug-routing.md` (worktree `workspace-slug-routing-de2b12`, 이 세션의 구현 대상 자체 — payload 의 "진행 중 plan 문서 모음"에는 포함되지 않아 리포지토리에서 직접 확인)
- target: `spec/2-navigation/**` (diff-base `origin/main` 대비 15개 파일 변경) + 연쇄 확인한 `spec/data-flow/12-workspace.md`, `spec/5-system/1-auth.md`, `plan/in-progress/spec-sync-user-profile-gaps.md`

## 발견사항

- **[WARNING]** plan item 10 이 명시한 두 파일의 bare-path 산문 갱신이 diff 에서 누락
  - target 위치: `spec/2-navigation/0-dashboard.md` §1 개요("대시보드(`/dashboard`)는…"), §4 "View All" 링크(`/workflows`), §5 "행 클릭"(`/workflows/:workflowId/executions/:executionId`) / `spec/2-navigation/1-workflow-list.md` §2.6 "실행 내역"(`/workflows/:id/executions`)
  - 관련 plan: `plan/in-progress/workspace-slug-routing.md` 체크리스트 item 10 — "…+ `0-dashboard §5`·`1-workflow-list §2.6` bare-path 산문 slug-aware 갱신 + spec-sync-user-profile-gaps 트래커 체크" (아직 미체크 `[ ]`)
  - 상세: 이번 diff(`git diff origin/main -- spec/2-navigation/`)는 이동된 11개 페이지 spec 문서 전부의 frontmatter `code:` glob 을 `(main)/<page>` → `(main)/w/[slug]/<page>` 로 일괄 정정했고, 그 중 `14-execution-history.md`(Overview 문장 + §7 라우팅 트리)·`15-system-status.md`(개요 "경로" 문장)·`16-agent-memory.md`(개요 "경로" 문장)는 URL 산문까지 `/w/<slug>/…` + "(활성 워크스페이스 slug 기준 — `_layout §2.2`)" 각주로 갱신됐다. 반면 plan item 10 이 **이름까지 명시**한 `0-dashboard.md`/`1-workflow-list.md` 는 frontmatter 만 바뀌고 본문 URL 산문은 그대로 bare 다 — 같은 PR 안에서 형제 문서 간 처리가 불일치한다. `spec-sync-user-profile-gaps.md` 트래커의 슬러그 라우팅 항목은 이미 `[x]` 로 체크돼 "frontend 완료"로 기록됐고, `data-flow/12-workspace.md`·`5-system/1-auth.md`·`9-user-profile.md §3`·`_layout.md §2.2/§3.1` 도 모두 갱신됐다 — item 10 의 나머지 서브 항목은 사실상 완료됐는데 이 두 파일만 남아 있다.
  - 제안: item 10 을 체크하기 전에 (a) `0-dashboard.md`/`1-workflow-list.md` 의 위 4곳에도 형제 문서와 동일한 slug 각주(또는 `_layout.md §3.1` 에 이미 쓰인 "slug 흡수" 각주 패턴)를 추가해 완결하거나, (b) 완결하지 않기로 한다면 그 판단 근거를 plan §비고 또는 spec Rationale 에 남기고 item 10 을 명시적으로 재스코프(체크 처리 + 잔여 서브항목만 별도 후속으로 분리)할 것. 기능적 영향은 없음(런타임은 `(main)/[...rest]` catch-all 이 이미 두 페이지 모두 흡수) — 순수 문서 완결성 문제.

## 교차 확인 (충돌 없음 — 참고용)

- **미해결 결정과의 충돌**: `plan/in-progress/workspace-slug-routing.md` 의 5개 확정 결정(URL slug = FE 라우팅 SoT, backend header-first 불변, slug 불변, reconcile URL 우선, FE 멤버십 체크=UX 전용)과 target 의 `9-user-profile.md §3`·`data-flow/12-workspace.md` 신설 절·`10-auth-flow.md §7.2` 서술이 정확히 일치 — 번복·우회 없음.
- **선행 plan 미해소**: 같은 plan 이 "backend spec/코드 변경 불요(FE-only)"라고 명시했고 실제로 diff 는 `spec/5-system/1-auth.md`(frontmatter 경로 1줄)·`spec/data-flow/12-workspace.md`(Rationale 절 추가) 외 backend 코드 변경이 없다 — 전제 충족.
- **다른 in-progress plan과의 충돌 스캔**: `plan/in-progress/*` 전체에서 이번에 이동된 옛 bare 경로(`(main)/dashboard`, `(main)/workflows`, `(main)/profile`, `(main)/workspace`, `(main)/triggers`, `(main)/schedules`, `(main)/integrations`, `(main)/system-status`, `(main)/agent-memory`, `(main)/knowledge-bases`, `(main)/models`, `(main)/statistics`, `(main)/authentication`, `(main)/invitations`)를 참조하는 문서가 없음(grep 0건) — 다른 plan 의 후속 항목을 무효화하지 않음. `ai-agent-tool-connection-rewrite.md`/`cafe24-backlog-residual.md`/`chat-channel-*.md` 는 네비게이션과 무관한 별도 트랙.
- **item 9 (본 게이트)**: 체크리스트 item 9("/ai-review + fix + /consistency-check --impl-done")는 본 검토 자체이므로 미체크 상태가 정상 — 이 리뷰 결과 반영 후 체크 처리 대상.

## 요약

target(`spec/2-navigation/**`)은 `plan/in-progress/workspace-slug-routing.md` 가 확정한 5개 결정을 우회·번복 없이 충실히 반영했고, 이동된 11개 페이지의 frontmatter `code:` 경로 전수 정정 + 대다수 문서의 URL 산문 slug화 + `spec-sync-user-profile-gaps.md` 트래커 체크까지 plan item 10 의 범위를 대부분 완결했다. 유일한 잔여 갭은 plan 이 이름을 지목한 `0-dashboard.md`/`1-workflow-list.md` 두 파일의 URL 산문(§1/§4/§5, §2.6)이 형제 문서와 달리 slug-aware 각주 처리를 받지 못한 것으로, 기능에는 영향이 없으나 item 10 을 완료 처리하기 전 정리가 필요한 문서 완결성 갭이다. 다른 in-progress plan 과의 충돌·선행조건 미해소는 발견되지 않았다.

## 위험도

LOW
