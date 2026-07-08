# Cross-Spec 일관성 검토 — 워크스페이스 슬러그 URL 라우팅 (spec/2-navigation/)

검토 방식: payload 에 번들된 target 문서(7개) + payload 의 `spec/0-overview.md`/`spec/1-data-model.md` 참고, 그리고 payload 가 누락한 나머지 변경분·주변 영역을 실제 워킹트리(`git -C <worktree> diff origin/main..HEAD -- spec/`, 절대경로 Read/Grep)로 직접 확인해 보완했다 (25개 spec 파일 + codebase 라우트 트리 실사).

## 발견사항

- **[WARNING]** 무효/비멤버 워크스페이스 slug 처리와 기존 403/404 정책의 관계가 문서화되지 않음
  - target 위치: `spec/2-navigation/11-error-empty-states.md` §1.2 "에러 페이지 정의 (5종)" / §1.3 "에러 페이지 동작 규칙" (이번 diff 에서 `code:` frontmatter 만 `/w/[slug]/...` 로 갱신되고 본문은 무변경)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §3 (이번 diff 신설 — "무효/비멤버 slug 는 default 워크스페이스로 redirect — UX 편의이며 인가 경계가 아니다") + 실제 구현 `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx` (`resolveFallbackWorkspace` 로 무효·비멤버 slug 를 항상 조용히 fallback 워크스페이스로 `router.replace`)
  - 상세: 11-error-empty-states.md §1.2 는 "페이지 없음(404) = 존재하지 않는 라우트 접근" 을, §1.2 "권한 없음(403)" 은 "워크스페이스 관리자에게 문의" 안내를 정의한다. 그러나 실제로 `/w/<존재하지-않는-slug>/dashboard` 나 `/w/<내가-속하지-않은-팀-slug>/dashboard` 로 직접 진입해도 404/403 페이지는 전혀 뜨지 않고 layout 단계에서 조용히 다른 워크스페이스로 redirect 된다(코드로 직접 확인). 두 문서 모두 "다른 화면으로 흡수"(`_layout.md` catch-all 흡수 각주)는 다뤘지만, "URL 이 가리키는 워크스페이스 자체가 resolve 되지 않는 경우" 가 404/403 카탈로그와 어떻게 상보적인지 상호 참조가 없어, 이 문서만 읽으면 "존재하지 않는 slug = 404" 로 오해할 수 있다.
  - 제안: `11-error-empty-states.md` §1.3 에 한 줄 각주 추가 — "워크스페이스 slug 해석 실패(무효/비멤버)는 404/403 이 아니라 FE 레벨 편의 redirect 로 처리한다 (인가 경계 아님, [9-user-profile §3](./9-user-profile.md#3-워크스페이스-전환))". spec 파일 수정만 필요, 코드 변경 불요.

- **[INFO]** 타 영역 문서 2건이 이번 슬러그 마이그레이션 스윕에서 누락되어 구(舊) 무-slug 경로 표기가 남음
  - target 위치: (간접 대상) `spec/2-navigation/14-execution-history.md` §7 라우팅 — 이번 diff 로 `/w/<slug>/workflows/:id/executions` 로 이미 갱신됨
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.2 (3번 항목: `` `/workflows/:workflowId/executions/:executionId` ``) / `spec/5-system/13-replay-rerun.md` ("재실행" 버튼 행: `` `/workflows/:workflowId/executions/:newId` ``) — 두 파일 모두 `git diff origin/main..HEAD -- spec/` 의 25개 변경 파일 목록에 없어 이번 스윕에서 빠졌다.
  - 상세: 실제 구현(`(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx`)은 `buildWorkspaceHref(slug, …)` 로 이미 slug-aware 이고, `(main)/[...rest]` catch-all 이 bare 경로도 흡수하므로 **기능적으로 깨지지는 않는다**(추가 redirect 1회). 다만 `_layout.md`·`15-system-status.md`·`16-agent-memory.md`·`10-auth-flow.md` 등 이번에 손댄 모든 문서가 공통으로 붙인 "활성 워크스페이스 slug 기준" 각주가 이 두 문서에는 없어, 같은 URL 표면(실행 상세 페이지)에 대한 표기가 영역마다 다르다.
  - 제안: 두 파일에 동일한 "실제 URL 은 활성 워크스페이스 slug 하위(`/w/<slug>/...`)" 각주를 추가해 표기를 맞출 것 — 문서 동기화만 필요, 로직 변경 없음.

- **[INFO]** 본 검토 payload 의 target 문서 번들이 실제 diff 범위보다 좁음 (프로세스 노트)
  - target 위치: 본 checker 에게 전달된 payload 의 "Target 문서" 섹션 — `spec/2-navigation/0-dashboard.md`·`1-workflow-list.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`13-user-guide.md`·`14-execution-history.md`·`15-system-status.md` 7개만 포함
  - 충돌 대상: 실제 `git diff origin/main..HEAD --stat -- spec/` (워킹트리 실측) 결과에는 위 7개 외에 `spec/2-navigation/_layout.md`·`9-user-profile.md`·`16-agent-memory.md`·`2-trigger-list.md`·`3-schedule.md`·`4-integration.md`·`5-knowledge-base.md`·`6-config.md`·`7-statistics.md`, 그리고 `spec/data-flow/12-workspace.md`(20줄 신규 Rationale) 등 25개 파일이 포함됨
  - 상세: payload 만으로는 이번 기능의 핵심 결정문("URL slug = FE 라우팅 SoT", `9-user-profile.md §3` 및 `data-flow/12-workspace.md` 신규 Rationale)을 볼 수 없어 cross-spec 판단 근거가 불완전했다. 본 검토는 워킹트리를 직접 diff 해 보완했고, 그 결과 위 두 WARNING/INFO 를 제외하면 **실질 충돌은 발견되지 않았다** — 오히려 `9-user-profile.md §3`/`_layout.md`/`data-flow/12-workspace.md` 신규 문구가 backend header-first 불변식·RBAC·slug 불변성·reconcile 방향(URL 우선 vs store 우선)까지 명시적으로 교통정리해 두어 완성도가 높다.
  - 제안: (spec 수정 불요) 다음 회차부터 orchestrator 가 target 파일 선정 시 `git diff --stat`(diff-base 기준) 전체를 target 번들에 포함하도록 점검 권장.

## 요약

이번 워크스페이스 슬러그 URL 라우팅(`/w/<slug>/...`) 변경은 25개 spec 파일에 걸쳐 코드 경로·URL 예시를 정확하게 스윕했고, 특히 `9-user-profile.md §3` + `data-flow/12-workspace.md` 신규 Rationale 이 "URL slug = FE 라우팅 SoT, backend 인가 SoT 아님"(header-first 불변, RolesGuard 가 유일한 강제 지점, slug 불변·rename≠URL변경, reconcile 방향의 URL-vs-store 우선순위 분리)을 명시적으로 못박아 두어 데이터 모델·API 계약·RBAC·상태 전이 어느 축에서도 CRITICAL 급 모순은 없었다 (`Workspace.slug` 필드·`PATCH /api/workspaces/:id` 계약도 이번 diff 전후 무변경으로 확인). 남은 두 항목(무효/비멤버 slug 의 404/403 정책과의 관계 미문서화, 3-workflow-editor/5-system 영역에 남은 구 경로 표기)은 모두 기능적으로는 안전하고(FE 레벨 redirect·catch-all 흡수로 실제 동작은 유지) 문서 동기화 수준의 간극이라 WARNING/INFO 로 충분하다.

## 위험도

LOW
