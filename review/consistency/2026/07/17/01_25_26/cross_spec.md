# Cross-Spec 일관성 검토 — 사용자 가이드(/docs) 라우팅 무한 중첩 fix (--impl-done)

**검토 모드**: `--impl-done spec/2-navigation/`, diff-base `origin/main..HEAD`
**실제 diff 범위 실측** (`git diff origin/main..HEAD --stat`): `spec/**` 텍스트 변경 **없음**.
실제 변경 파일은 `codebase/frontend/src/lib/workspace/href.ts` · `.../components/layout/sidebar.tsx` ·
`.../app/(main)/[...rest]/page.tsx` (+ 신규 e2e/unit 테스트, plan, CHANGELOG) 뿐이다.
prompt payload 의 "Target 문서"는 `spec/2-navigation/` 중 7개 파일(`0-dashboard`·`1-workflow-list`·
`10-auth-flow`·`11-error-empty-states`·`13-user-guide`·`14-execution-history`·`15-system-status`)
만 담고 있어, 실제로 이 fix 의 계약이 서술된 `_layout.md`(§2.2 각주)·`9-user-profile.md`(§3)는
빠져 있었다 — 아래 분석은 이 두 파일과 `data-flow/12-workspace.md`, `1-data-model.md`, `0-overview.md`
를 worktree 절대경로로 직접 Read 해 보강했다.

## 발견사항

- **[INFO]** payload 의 target 범위가 실제 계약 SoT 파일(`_layout.md`·`9-user-profile.md`)을 누락
  - target 위치: prompt 의 "Target 문서" 절 (`spec/2-navigation/` 7개 파일만 포함)
  - 충돌 대상: 없음 (payload 조립 이슈, spec 내용 자체의 모순 아님)
  - 상세: 이번 fix 의 핵심 계약("`/docs` 는 워크스페이스 밖 라우트로 slug 를 붙이지 않는다", "구 무-slug
    경로는 catch-all 이 흡수한다")은 `spec/2-navigation/_layout.md:85`, `9-user-profile.md:158`,
    `11-error-empty-states.md §1.3`(이건 payload 에 포함됨) 세 곳에 흩어져 있는데, 이 중 두 곳이
    이번 checker 입력에서 빠져 있었다. 결과적으로 checker 가 실제 SoT 를 확인하려면 절대경로로
    별도 Read 를 수행해야 했다(수행함 — 아래 분석은 그 결과).
  - 제안: 향후 `--impl-done spec/2-navigation/` 류 payload 조립 시, 코드 diff 가 참조하는
    `_layout.md`/`9-user-profile.md` 처럼 같은 영역 내 다른 파일도 diff 대상 코드의 `code:`
    프론트매터 역참조로 포함하는 규칙을 orchestrator payload 조립 로직에 반영 고려.

- **[정보성 확인 — 신규 충돌 아님]** 이번 fix 는 기존 spec 문언과 모순되지 않고 오히려 그것을 준수하도록 코드를 정렬한 것
  - target 위치: `codebase/frontend/src/components/layout/sidebar.tsx` `navItems`(`workspaceScoped: false` for User Guide)
  - 대조 대상: `spec/2-navigation/_layout.md:85` — "**예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지**한다" / `spec/2-navigation/9-user-profile.md:158` — "**slug 밖 유지(워크스페이스 무관·별 그룹)**: 유저 가이드(`/docs`, 워크스페이스 무관 콘텐츠)"
  - 상세: 두 문서 모두 이 fix 이전부터 이미 "`/docs` 는 slug 밖" 규칙을 명문화하고 있었다. 버그(전
    `navItems` 가 무조건 `buildWorkspaceHref` 를 태워 `/w/<slug>/docs` 라는 존재하지 않는 라우트를
    만든 것)는 코드가 이 기존 spec 규칙을 어긴 것이었고, 이번 diff 는 `workspaceScoped` 플래그로
    코드를 spec 에 맞춰 정정한 것이다. 새로운 spec-code 충돌은 발생하지 않았다.
  - 조치 불요 — cross-spec 관점에서 정합.

- **[INFO]** catch-all 의 신규 "terminal(`/w/` 접두 흡수 안 함)" 분기가 3개 spec 문서의 기존 "흡수(absorb)" 서술과 아직 명문 동기화되지 않음 (이미 별도 plan 으로 추적 중 — 신규 발견 아님, cross-spec 관점에서 재확인만)
  - target 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx` (신규 `workspacePrefixed`/`workspaceRootSlug` 분기 + `notFound()`)
  - 충돌 대상: `spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155`, `spec/2-navigation/10-auth-flow.md` §7.2(redirect-only 중간 경로) — 세 곳 모두 catch-all 을 "흡수(redirect)만 하는 중간 경로"로만 서술
  - 상세: 코드의 실제 계약은 이제 이원화(무-slug 입력=흡수 / `/w/…` 입력=`/w/<slug>` 단독만 forward, 그 외는 `notFound()`)됐지만, 위 세 문서 문언은 여전히 "흡수" 단일 서술이다. 다만 `11-error-empty-states.md §1.3`("404 감지 = 존재하지 않는 라우트 접근")과 직접 모순되지는 않는다 — `/w/<slug>/docs` 는 실제로 존재하지 않는 라우트이므로 `notFound()` 는 기존 404 정책의 준수다. 이 항목은 이미 `plan/in-progress/spec-update-catch-all-terminal-contract.md` 로 문서화 반영이 별도 추적 중이며, 직전 세션(`review/consistency/2026/07/17/00_32_57`)에서 Rationale-Continuity 관점으로 WARNING→INFO 하향 재확인된 사안이다. 본 세션에서 Cross-Spec 관점으로 재확인한 결과도 동일 — CRITICAL/WARNING 아님.
  - 제안: 기존대로 `spec-update-catch-all-terminal-contract.md` 의 project-planner 반영을 대기. 추가 조치 불요.

- **[INFO]** `AuthProvider` 의 `"/w/"` 접두 휴리스틱과 신규 terminal 404 분기 사이의 경계 정밀도 (자기치유되는 잠재적 gap — data-flow ↔ navigation 교차)
  - target 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 신규 terminal 분기 (`workspacePrefixed && !workspaceRootSlug` → `notFound()`)
  - 충돌 대상: `codebase/frontend/src/components/auth/auth-provider.tsx:58` `onWorkspaceSlugRoute = pathname.startsWith("/w/")` + `spec/data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절("cold-load reconcile = URL 우선")
  - 상세: `AuthProvider.restoreSession()` 은 `pathname.startsWith("/w/")` 이면 자신의 localStorage-기준 워크스페이스 재조정(`switchWorkspaceApi(persisted)`)을 건너뛴다 — 그 경우 하위 `(main)/w/[slug]` 또는 `(editor)/w/[slug]` 의 `WorkspaceSlugGate` 가 URL-우선으로 재조정할 것이라는 전제다. 그러나 이번 fix 로 새로 생긴 terminal 분기(`/w/<slug>/docs` 등, specific route 미매칭)는 **`w/[slug]` 트리 바깥의 sibling 라우트**(`(main)/[...rest]`)로 렌더되므로 `WorkspaceSlugGate` 가 전혀 마운트되지 않는다 — 즉 이 특정 요청 사이클에서는 AuthProvider 도, Gate 도 재조정을 수행하지 않는 사각지대가 생긴다. 실측 결과 **지속적 피해는 없음**: 이 사각지대는 (a) 정적 404 페이지만 렌더해 워크스페이스 스코프 데이터를 소비하지 않고, (b) 페이지의 "대시보드로 이동" CTA(`error-page.tsx` `DASHBOARD_PATH = "/dashboard"`, bare)를 클릭하면 catch-all 의 일반(non-`/w/`) 분기가 다시 `resolveFallbackWorkspace` 로 활성 워크스페이스를 결정해 `/w/<slug>/dashboard` 로 forward 하고, 그 경로가 `WorkspaceSlugGate` 를 마운트시켜 자체적으로 URL-우선 재조정(`switchWorkspace`)을 수행하기 때문이다(코드 실측: `workspace-slug-gate.tsx:48-54`). 다만 이 `"/w/"` 휴리스틱 자체는 이번 fix 이전(슬러그 라우팅 phase 2)부터 존재했고, 이번 fix 는 그 사각지대를 **새로 만든 것이 아니라 무한 리다이렉트에 가려져 있던 것을 안정적으로 도달 가능한 상태로 드러낸 것**이다.
  - 제안: 기능 결함은 아니므로 이번 PR 의 필수 수정 대상은 아니다. 다만 `auth-provider.tsx:51-57` 주석("슬러그 없는 라우트(catch-all·docs)에서만 localStorage 힌트로 재조정한다")과 `data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절의 이분법(slug 라우트=layout reconcile / 무-slug 라우트=localStorage reconcile)에 "`/w/` 접두이지만 specific route 미매칭이라 어느 쪽도 재조정하지 않는 terminal 404 케이스"를 각주로 추가하면 문서 정밀도가 높아진다. `spec-update-catch-all-terminal-contract.md` 반영 시 함께 처리 고려 가능(선택, 비차단).

## 요약

이번 --impl-done 검토 대상은 `spec/2-navigation/` 을 스코프로 지정했으나 실측 결과 이번 PR 은 spec 텍스트를 전혀 변경하지 않은 순수 프론트엔드 라우팅 버그 수정(WORKSPACE_ROUTE_SEGMENT 상수화 + `workspaceScoped` 선언적 플래그 + catch-all terminal 가드)이다. 데이터 모델·API 계약·요구사항 ID·RBAC·상태 전이 어느 축에서도 신규 변경이 없어 그 네 범주의 cross-spec 충돌 가능성은 원천적으로 낮았고, 실측으로도 위반이 없었다. 가장 중요한 확인은 이번 fix 가 "`/docs` 는 워크스페이스 밖 유지" 라는 기존 spec 규칙(`_layout.md:85`, `9-user-profile.md:158`)을 **어기던 코드를 spec 대로 정정**한 것이라는 점 — 신규 spec-code 충돌이 아니라 기존 충돌의 해소다. 유일하게 남는 항목은 catch-all 의 확장된 terminal 계약이 아직 관련 3개 문서에 명문 반영되지 않은 것인데, 이는 이미 전용 plan(`spec-update-catch-all-terminal-contract.md`)으로 추적 중이고 직전 세션에서 기존 404 정책과의 정합이 재확인(WARNING→INFO)됐다. 본 세션에서 추가로, `AuthProvider` 의 `"/w/"` 휴리스틱과 신규 terminal 분기 사이의 경계 정밀도 이슈를 data-flow 영역과 교차 확인했으나, 코드 실측 결과 후속 네비게이션으로 자기치유되어 지속적 피해가 없음을 확인했다. 전체적으로 이번 PR 을 차단할 CRITICAL/WARNING 급 cross-spec 위반은 없다.

## 위험도

LOW
