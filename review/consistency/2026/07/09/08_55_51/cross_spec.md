# Cross-Spec 일관성 검토 — 워크스페이스 슬러그 URL 라우팅 (spec/2-navigation/, 최종 상태)

검토 방식: payload 번들(target 7개 + `spec/0-overview.md`/`spec/1-data-model.md`)에 더해, payload 가 다시 누락한 SoT 문서(`spec/2-navigation/_layout.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/12-workspace.md`)를 절대경로로 직접 Read 하고, `git -C <worktree> diff origin/main -- spec/`(27개 spec 파일) 전건 + 실제 라우트 트리(`find codebase/frontend/src/app/(main)`)를 실사했다. 본 기능은 같은 세션 내 이전 두 차례 cross-spec 검토(`review/consistency/2026/07/08/16_58_17`, `18_55_19`)에서 이미 LOW 판정을 받았고, 그 사이 라운드(ai-review round-2/round-3, rerun-modal fix, plan 완료 커밋)로 지적사항이 반영된 **최종 상태**를 재검증하는 것이 본 회차의 목적이다.

## 발견사항

- **[INFO]** 이전 회차(18_55_19) WARNING/INFO 2건은 이번 diff 에서 모두 해소 확인됨
  - target 위치: `spec/2-navigation/11-error-empty-states.md` §1.3 (신규 행 "무효/비멤버 워크스페이스 slug | **404/403 아님**..."), `spec/3-workflow-editor/4-ai-assistant.md` §4.1.2 3번 항목, `spec/5-system/13-replay-rerun.md` "재실행" 버튼 행
  - 상세: (a) 11-error-empty-states.md 에 무효/비멤버 slug 처리가 404/403 카탈로그와 상보적임을 명시하는 각주가 추가됐다(9-user-profile §3 상호참조 포함). (b) 이전에 구 무-slug 표기(`/workflows/:workflowId/executions/:executionId`)로 남아있던 `4-ai-assistant.md`·`13-replay-rerun.md` 두 곳도 `/w/<slug>/workflows/...` + `_layout §2.2` 상호참조로 갱신됐다. 코드 레벨에서도 `rerun-modal.tsx` 의 재실행 성공 네비게이션이 `buildWorkspaceHref(slug, ...)` 로 교정되어(round-3 fix, 회귀 테스트 포함) 문서-코드 정합이 유지된다.
  - 제안: 없음 (확인만).

- **[INFO]** target 문서 번들이 이번에도 실제 diff 범위보다 좁음 (프로세스 반복 관찰)
  - target 위치: payload "Target 문서" 섹션 — `0-dashboard.md`·`1-workflow-list.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`13-user-guide.md`·`14-execution-history.md`·`15-system-status.md` 7개만 포함
  - 충돌 대상: 실제 `git diff origin/main --stat -- spec/` 는 27개 파일을 포함하며, 이번 기능의 핵심 SoT 문서인 `spec/2-navigation/_layout.md`·`9-user-profile.md`·`spec/data-flow/12-workspace.md`(신규 Rationale 20줄)가 이번에도 payload 에 빠져 있다
  - 상세: 직접 확인한 결과 이 세 문서는 "URL slug = FE 라우팅 SoT, backend 인가 SoT 아님" 이라는 계층 분리를 `_layout.md`(§2.2 각주·§3.1 slug 흡수 각주)·`9-user-profile.md`(§3 전면 재작성)·`data-flow/12-workspace.md`(신규 Rationale 절)에서 상호 일관되게 서술하고 있어 실질적 문제는 없었다. 다만 이전 회차(18_55_19)에서 이미 지적한 동일 프로세스 갭이 이번 회차에도 재발했다는 점은 orchestrator 쪽 target 번들링 스크립트가 아직 `git diff --stat` 전체를 반영하지 않는다는 신호다.
  - 제안: (spec 수정 불요) orchestrator 의 target 파일 선정 로직이 diff-base 기준 `git diff --stat` 전체를 포함하도록 재점검 권장 — 반복 지적이므로 우선순위를 올릴 것.

- **[INFO]** 에디터(`(editor)/workflows/[id]`)와 실행 내역(`(main)/w/[slug]/workflows/[id]/executions/**`)이 서로 다른 라우트 그룹으로 분리된 구조는 문서·코드 모두 일관됨 (확인, 결함 아님)
  - target 위치: `spec/2-navigation/14-execution-history.md` §7, `spec/2-navigation/9-user-profile.md` §3 "phase 1 범위 밖(slug 무관): 에디터(`/workflows/[id]`, ... slug화는 phase 2)"
  - 상세: 실제 코드 트리에 `codebase/frontend/src/app/(editor)/workflows/[id]` (slug 밖 에디터)와 `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/**` (slug 안 실행 내역)가 별개 라우트 그룹으로 존재해, "에디터는 phase 1 에서 slug 밖, 실행 내역은 slug 안" 이라는 여러 문서의 서술과 정확히 일치한다. Cross-spec 관점에서 두 표면의 책임 분리가 코드·spec 양쪽에서 어긋남 없이 유지되고 있음을 기록 목적으로 남긴다.

## 요약

이번 워크스페이스 슬러그 URL 라우팅(`/w/<slug>/...`) 기능은 spec/2-navigation/ 을 중심으로 27개 spec 파일을 스윕했으며, 데이터 모델(`Workspace.slug` UNIQUE·불변, 무변경 확인)·API 계약(`PATCH /api/workspaces/:id`, `POST /auth/workspaces/:id/switch` 등 무변경)·요구사항 ID·RBAC(`RolesGuard` header-first 모델 무번복)·상태 전이 어느 축에서도 CRITICAL 급 모순이 없다. 이전 두 차례 검토에서 발견된 WARNING(무효/비멤버 slug 의 404/403 관계 미문서화)과 INFO(구 무-slug 표기 잔존)는 각각 `11-error-empty-states.md` §1.3 각주 추가와 `4-ai-assistant.md`/`13-replay-rerun.md` 갱신으로 해소됐고, 코드 레벨의 잔여 버그(rerun-modal 슬러그 미부착)도 round-3 ai-review 에서 수정·회귀 테스트로 커버됐다. `9-user-profile.md §3`·`_layout.md`·`data-flow/12-workspace.md` 신규 Rationale 이 "URL slug = FE 라우팅 SoT, backend 인가 SoT 아님"이라는 계층 분리를 명시적으로 교통정리해 두어 완성도가 높다. 유일한 반복 관찰은 orchestrator payload 번들이 diff 전체를 담지 못하는 프로세스 갭(INFO, spec 수정 불요)이다.

## 위험도

NONE
