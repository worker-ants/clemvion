# Rationale 연속성 검토 결과

> **payload 노트**: 본 세션 `prompt_file` 은 이전 두 세션(00_21_55·00_32_57)과 동일한 계열의 조립
> 문제를 반복한다 — `spec/2-navigation/` 8개 파일 중 `16-agent-memory.md` 가 누락돼 있고, "##
> 구현 변경 사항" diff 섹션이 문서 후반부(`3-workflow-editor/4-ai-assistant.md` Rationale 발췌
> 도중)에서 잘려 실제 이번 커밋들(`34008deb5`·`fdd206ee8e`)의 diff 가 전혀 포함되지 않았다.
> 지시문(§⚠️ 현재 구현 코드의 기준)에 따라 CWD 상대경로를 신뢰하지 않고, worktree 를 절대경로로
> 지목해 `git log/show/diff origin/main..HEAD`, `spec/2-navigation/_layout.md`,
> `spec/2-navigation/9-user-profile.md`, `codebase/frontend/src/app/(main)/[...rest]/page.tsx`,
> `codebase/frontend/src/lib/workspace/href.ts`, `codebase/frontend/src/components/layout/sidebar.tsx`,
> `plan/in-progress/user-guide-routing-loop-fix.md`,
> `plan/in-progress/spec-update-catch-all-terminal-contract.md`, 그리고 선행 두 세션의
> `rationale_continuity.md`(00_21_55·00_32_57)를 직접 대조해 분석했다.

## 검토 대상 커밋

- `34008deb5` — `(main)/[...rest]` catch-all terminal 화 + sidebar `workspaceScoped` 플래그 (본 fix).
- `fdd206ee8` — 선행 `/ai-review` 지적 반영(리팩터) + `plan/in-progress/spec-update-catch-all-terminal-contract.md` 신설(project-planner 위임 draft).

이 두 커밋은 `plan/in-progress/user-guide-routing-loop-fix.md` 체크리스트 1~10 을 구현하며, 본 검토는
체크리스트 항목 11(`--impl-done` 게이트)에 해당한다.

## 발견사항

- **[INFO]** catch-all 계약 확장(흡수-only → 흡수 ∪ terminal 404)이 spec 본문에는 아직 반영되지 않았으나, 정식 위임 경로로 추적 중 — 새 Rationale 부재의 "방치"가 아님
  - target 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx` (docstring 19–33행), `codebase/frontend/src/lib/workspace/href.ts` (24–30행)
  - 과거 결정 출처: `spec/2-navigation/_layout.md:85`("구 무-slug 경로로 진입하면 `(main)/[...rest]` catch-all 이 활성 slug 로 **흡수한다**"), `spec/2-navigation/9-user-profile.md:155`("구 무-slug 경로·알림 딥링크·`/`는 ... catch-all 이 활성 slug 로 **흡수한다**(query/hash 보존)"), `spec/2-navigation/10-auth-flow.md` §7.2("redirect-only 중간 경로라 flash 허용")
  - 상세: 실측 확인 결과 `_layout.md:85`·`9-user-profile.md:155` 는 이 커밋들 이후에도 옛 "흡수(redirect)만" 서술 그대로다 — 즉 spec 문언과 코드 실동작(이제 `/w/` 접두 미매칭 경로는 `notFound()` 로 terminal) 사이에 실제 drift 가 남아 있다. 다만 이는 발견되지 않은 채 방치된 것이 아니라: (a) 00_21_55 세션이 WARNING 으로 최초 지적 → (b) `user-guide-routing-loop-fix.md` 가 대응을 계획에 명시(§"consistency-check WARNING 대응") → (c) 00_32_57 세션이 재검토해 "기존 `11-error-empty-states.md` §1.3 404 정책과 정합하고 `10-auth-flow.md` 서술은 특정 흐름(로그인 후 `/dashboard`)에 한정돼 반증되지 않는다"는 근거로 INFO 로 하향하되 "project-planner 위임 draft 작성"을 명시적 후속 조건으로 남김 → (d) 본 세션 시점에 그 draft(`plan/in-progress/spec-update-catch-all-terminal-contract.md`)가 실제로 작성되어 `_layout.md` §2.2 각주·`9-user-profile.md` §3·`11-error-empty-states.md` §1.3 세 곳에 대한 구체적 patch 문구까지 제시하고 있다. `developer` 는 `spec/` 쓰기 권한이 없으므로(CLAUDE.md §Skill 체계) 이 상태(코드 완료·spec 위임 대기)는 정확히 규약이 요구하는 정지점이다.
  - 제안: CRITICAL/WARNING 상향 불요. 다만 이 draft 가 실제로 project-planner 에 의해 처리되어 spec 본문에 반영되기 전까지는 `_layout.md`/`9-user-profile.md`/`10-auth-flow.md` 세 문서가 실제 코드 동작(terminal 404 분기)을 서술하지 않는 drift 창이 열려 있다는 점을 병합 전 인지할 것. `plan/in-progress/user-guide-routing-loop-fix.md` 체크리스트 #11(본 게이트)이 끝나면 곧바로 `spec-update-catch-all-terminal-contract.md` 를 project-planner 에게 실행시켜 창을 닫는 것을 권고(이미 두 plan 문서 모두 서로를 명시적으로 참조하고 있어 추적 유실 위험은 낮음).

- **[INFO]** 선행 두 WARNING(00_21_55) 은 이번 diff 시점에 실제로 완전히 해소됨 — 재확인
  - target 위치: `codebase/frontend/src/lib/workspace/href.ts` `buildWorkspaceHref` docstring(24–30행)
  - 과거 결정 출처: 00_21_55 WARNING #3("`buildWorkspaceHref` idempotent 화 미채택 결정에 근거가 계획 텍스트에 없음"), `no-raw-execution-href.test.ts`/`no-raw-editor-href.test.ts` guard 가 대표하는 "호출부 산재 → 구조적 제거" 관행
  - 상세: 00_32_57 세션은 이 항목을 "구현 단계에서 docstring 에 반영 예정"으로 INFO 하향했다. 실측 결과 `href.ts` 의 `buildWorkspaceHref` 문서 주석에 "비-idempotent 는 의도된 것" 단락이 실제로 추가되어 (a) 조용히 삼키면 호출자 버그를 은폐한다는 점, (b) `("team-a", "/w/team-b/x")` 의 정답이 정의되지 않는다는 점, (c) 저장소의 `no-raw-*-href` guard 관행은 "호출부 리터럴 직접 조립 금지"이지 "헬퍼 idempotency 요구"가 아니라는 구분을 명시적으로 기록했다. 결정 번복이 아니라 기존 미문서 결정에 사후 Rationale 을 붙인 사례로, 합의 원칙과 충돌 없음.
  - 제안: 없음(완결).

- **[INFO]** `workspaceScoped` 플래그 도입은 기존 spec 합의를 코드로 되살리는 정합화 — 재확인
  - target 위치: `codebase/frontend/src/components/layout/sidebar.tsx` (navItems 배열 + docstring)
  - 과거 결정 출처: `spec/2-navigation/_layout.md:85`("예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지"), `spec/2-navigation/9-user-profile.md:158`(동일)
  - 상세: 00_21_55·00_32_57 두 세션이 이미 "재도입/번복이 아니라 정합화"로 판정한 항목이며, 실제 커밋도 그 판정과 정확히 일치하게 구현됐다(`/docs` 만 `workspaceScoped: false`, 나머지 전부 `true`). 새로운 우려 없음.
  - 제안: 없음.

- **[INFO]** query/hash 보존 invariant — 00_32_57 이 지적한 미검증 항목이 실측으로 확인됨
  - target 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 61–78행
  - 과거 결정 출처: `spec/2-navigation/9-user-profile.md:155`("...흡수한다(**query/hash 보존**)")
  - 상세: 00_32_57 세션은 "신규 `/w/<slug>` → `/w/<slug>/dashboard` forward 분기가 기존 query/hash 보존 패턴을 재사용하는지 plan 에 명시가 없다"고 지적했다. 실측 코드(`workspaceRootSlug` 분기, 67행: `buildWorkspaceHref(...) + search + hash`)는 이 분기에도 동일한 `search`/`hash` 캡처를 재사용해 invariant 를 유지한다. 우려 해소.
  - 제안: 없음.

## 요약

`origin/main..HEAD` 두 커밋(`34008deb5`·`fdd206ee8e`)은 앞선 두 consistency-check 세션(00_21_55 WARNING → 00_32_57 INFO 하향)이 추적하던 항목들을 실제 구현·docstring·plan 위임 draft 로 성실히 완결했다. "URL slug = FE 라우팅 SoT ≠ backend 인가 SoT" 계층 분리, `/docs`·`(auth)` 의 slug-밖 예외, token-first 모델 기각 등 기존에 합의된 원칙 중 이유 없이 재도입되거나 위반된 것은 없다(CRITICAL 없음). 유일하게 남은 상태는 catch-all 의 실제 계약(흡수 ∪ terminal 404)이 `_layout.md`/`9-user-profile.md`/`10-auth-flow.md` spec 본문에는 아직 반영되지 않은 **의도된·추적된** drift 창인데, 이는 developer 권한 밖이라 project-planner 위임 draft(`plan/in-progress/spec-update-catch-all-terminal-contract.md`)로 정확히 처리되고 있어 "결정의 무근거 번복"에 해당하지 않는다(WARNING 이 아니라 INFO). 병합 차단 사유 없음.

## 위험도

LOW
