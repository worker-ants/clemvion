# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-done)

검토 대상: `spec/2-navigation/` 전체 (target 임베드 — `0-dashboard.md`·`1-workflow-list.md`·`10-auth-flow.md`·
`11-error-empty-states.md`·`13-user-guide.md`·`14-execution-history.md`·`15-system-status.md`)
diff-base: `origin/main..HEAD` (사용자 가이드 `/docs` 진입 시 `/w/<slug>` 무한 중첩 라우팅 fix + CHANGELOG
Unreleased 절 + plan 2건 + 무관 plan Gate C 보정 1건).

## 사전 확인 (실측)

- `git log --oneline origin/main..HEAD`: 4 커밋(라우팅 fix·ai-review 반영·무관 plan Gate C 보정·CHANGELOG SoT 트레일러).
- `git diff --stat origin/main..HEAD`: **`spec/2-navigation/**.md` 는 이번 diff 에서 단 한 줄도 변경되지 않았다.**
  변경은 `codebase/frontend/**`(라우팅) 4파일 + `CHANGELOG.md` + `plan/in-progress/*.md` 2건 + `plan/complete/*.md` 1건(무관) +
  `review/**` 산출물뿐이다. 따라서 본 검토는 (a) target spec 문서 자체의 기존 규약 준수 상태(변경 없음 — 직전 세션
  `00_32_57` 판정 유효)와 (b) 이번 diff 가 그 규약과 어긋나는 신규 산출물을 만들었는지를 함께 본다.
- `pnpm --filter frontend test -- spec-code-paths` (실측, 256 passed) — frontmatter-evidence 빌드 가드는 현재 GREEN.
  아래 WARNING 은 가드를 깨는 항목이 **아니라** 규약의 취지(“spec 이 약속한 surface”)와의 완결성 간극이다.

## 발견사항

- **[WARNING]** `_layout.md`(+ `9-user-profile.md`, `10-auth-flow.md`) frontmatter `code:` 가 이번에 대폭 보강된
  catch-all/href 파일을 가리키지 않음
  - target 위치: `spec/2-navigation/_layout.md` frontmatter `code:` (`components/layout/**` · `lib/stores/sidebar-store.ts` ·
    `lib/notifications/*.ts`), 본문 §2.2 line 85("구 무-slug 경로로 진입하면 `(main)/[...rest]` catch-all 이 활성 slug 로
    흡수한다" · "User Guide(`/docs`)는 슬러그 밖으로 유지") · line 126. 동일 갭이 `9-user-profile.md`(§3, "catch-all 이
    활성 slug 로 흡수") · `10-auth-flow.md`(§7.2, "`(main)/[...rest]` catch-all 이 … 해소한다")에도 있음.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로".
    `PROJECT.md` §변경 유형 매핑 "자주 누락되는 항목" 목록의 "spec frontmatter `code:` 글로브 stale — … SoT:
    `spec/conventions/spec-impl-evidence.md`" 항목과 정확히 같은 클래스(경로 누락)다.
  - 상세: 위 세 문서 모두 `(main)/[...rest]/page.tsx` 의 catch-all 흡수 규칙을 본문에서 직접 설명하는데, 세 문서의
    `code:` 어디에도 `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 나 `codebase/frontend/src/lib/workspace/href.ts`
    가 없다(`grep` 실측 — 세 파일의 frontmatter `code:` 블록 어디에도 `href.ts`/`\.\.\.rest` 매치 0건). 이번 PR 이 바로 그
    두 파일을 크게 확장했다(`WORKSPACE_ROUTE_SEGMENT` 상수 도입, catch-all 을 terminal 로 만드는 로직 +30줄, 상세
    docstring). `spec-code-paths.test.ts` 는 glob **≥1 매치**만 요구해 `components/layout/**`(→ `sidebar.tsx`)가 대신
    통과시키므로 build 는 green 이지만(실측 확인), "spec 이 약속한 surface = 실제 구현 경로" 라는 규약의 취지 자체는
    이 두 핵심 파일을 누락한 채 불완전하다.
  - 완화 요인: 이 갭은 developer 가 이미 인지하고 있다 — `plan/in-progress/spec-update-catch-all-terminal-contract.md`
    "반영 후 코드 측 후속" 절이 "`_layout.md` frontmatter `code:` 에 `(main)/[...rest]/page.tsx` 가 이미 포함돼 있는지만
    확인한다(미포함이면 추가)" 를 체크리스트 항목(`- [ ]`)으로 명시했다 — 즉 CRITICAL 로 격상할 사안은 아니고, 미완료
    후속으로 이미 추적 중이다.
  - 제안: project-planner 가 그 plan 의 제안 1·2(§2.2 각주 보강·§3 문장 보정)를 spec 에 반영하는 같은 커밋에서
    `_layout.md`(및 가능하면 `9-user-profile.md`) `code:` 에 `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 와
    `codebase/frontend/src/lib/workspace/href.ts` 를 명시적으로 추가할 것. 현재 plan 체크리스트 문구가 "이미 포함돼
    있는지만 확인" 으로 다소 약하게 적혀 있어 실제로는 **미포함 상태이므로 추가가 필요**하다는 점을 체크리스트에
    분명히 반영하는 편이 안전하다(추측 확인이 아니라 이번 검토로 미포함이 실측 확정됨).

- **[INFO]** CHANGELOG 신규 항목 제목에 spec 절 참조 부재 — 인접 항목과의 표기 일관성
  - target 위치: `CHANGELOG.md` 신규 절 제목 — `## Unreleased — 사용자 가이드(/docs) 진입 시 워크스페이스 slug 무한
    중첩 fix`
  - 위반 규약: 정식 `spec/conventions/*.md` 로 명문화된 규약은 아니다(레포에 별도 CHANGELOG 컨벤션 파일 없음) —
    다만 CHANGELOG.md 안에서 반복 관찰되는 **관행**(예: 바로 아래 항목 "… 타임아웃 (defense-in-depth, §12.16)",
    "… escape (F-5 근본 fix, 5-system/15-chat-channel §4.1.1)")은 제목에 spec 경로+절 번호를 괄호 병기해 grep 가능성을
    높인다.
  - 상세: 본 항목은 제목에 spec 참조가 없고 본문 끝 "SoT:" 줄에만 세 경로를 나열한다. 기능상 문제는 없으나(본문에
    SoT 가 명시돼 있어 추적 가능), 최근 항목 다수의 제목 병기 관행과는 결이 다르다.
  - 제안: 정식 규약이 아니므로 지금 target 을 고칠 필요는 없다. 굳이 통일하려면 제목 끝에
    "(2-navigation/_layout.md §2.2)" 를 덧붙이는 정도로 충분 — 다만 이는 규약이 아니라 스타일 제안이므로 우선순위 낮음.

## 준수가 확인된 항목 (참고 — 발견사항 아님)

- **plan 위임 경로 준수**: developer 가 spec 오류/보강 필요를 발견하고 직접 `spec/` 를 고치는 대신
  `plan/in-progress/spec-update-catch-all-terminal-contract.md` (파일명이 `PROJECT.md` §140 이 지정한
  `plan/in-progress/spec-update-<name>.md` 패턴과 정확히 일치) 를 작성해 `project-planner` 에게 위임한 것은
  CLAUDE.md §Skill 체계("구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임") 의 모범적 준수다.
- **plan frontmatter 스키마**: 신규 plan 2건 모두 `worktree`/`started`/`owner` 필수 필드를 갖추고 있으며,
  아직 착수되지 않은 `spec-update-catch-all-terminal-contract.md` 는 placeholder 대신 정식 sentinel
  `worktree: (unstarted)` 를 사용해 `.claude/docs/plan-lifecycle.md` §4 의 가드 요구사항(및 MEMORY 의
  "Plan frontmatter frontend guard" 교훈)을 정확히 따른다.
- **Gate C(`spec_impact`) 준수**: 이번 diff 에 포함된 무관 보정 커밋(`89c4b1f6b`)이 `plan/complete/
  ai-agent-tool-payload-budget-followups.md` 에 추가한 `spec_impact:` 가 bare string 이 아니라 YAML 리스트
  형식으로 올바르게 작성됐다(`.claude/docs/plan-lifecycle.md` §5 Gate C 의 "흔한 실패형" 경고와 정반대로 올바름).
- **i18n Principle 1 (하드코딩 금지)**: 이번 diff 의 프론트엔드 변경(`sidebar.tsx`·`(main)/[...rest]/page.tsx`·
  `href.ts`)에 신규 사용자 가시 문자열이 없다 — 기존 `labelKey`/`t()` 호출 구조를 그대로 유지하며 `workspaceScoped`
  boolean 필드만 추가했다. 주석은 전부 한국어지만 `spec/conventions/i18n-userguide.md` Principle 1 은 주석·JSDoc 을
  명시적으로 허용 범위에 둔다.
- **PROJECT.md §변경 유형 매핑 자가점검**: plan 체크리스트 4번 항목이 "해당 행 없음 — 신규 UI 문자열·노드 schema·
  API·가이드 본문 변경이 없다"고 명시적으로 대조한 기록을 남겼다. 실제 diff 확인 결과도 그 판단과 일치(순수 라우팅
  로직 변경, i18n/API/노드 표면 변경 없음).
- **e2e 파일 명명**: 신규 `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` 는 같은 디렉토리의 기존
  `members.spec.ts` 와 동일한 kebab-case `.spec.ts` 패턴을 따른다.

## 범위 밖 — 기존(pre-existing) 항목 (참고, 이번 diff 무관)

직전 세션(`review/consistency/2026/07/17/00_32_57/convention_compliance.md`)이 지적한 아래 항목들은 이번 diff 가
건드리지 않은 문서/API 에 대한 것이라 상태 불변이며, 본 세션의 새 발견사항이 아니다: (1) `14-execution-history.md`
§5 의 `GET /api/executions/workflow/:workflowId` 가 `api-convention.md` §2.2 URL 중첩 패턴과 다른 점, (2)
`ExportWorkflowDto` 가 `dto/responses/` 대신 `import-workflow.dto.ts` 에 위치한 점, (3) `dashboard`/`system-status`
단수 명사 경로가 §2.2 "복수형 명사" 원칙과 표면적으로 다른 점. 모두 WARNING/INFO 수준으로 이미 처분됐고 이번 PR
과 무관하므로 재열거만 하고 등급을 다시 매기지 않는다.

## 요약

이번 diff 는 `spec/2-navigation/**.md` 를 전혀 수정하지 않았으므로, target 문서 자체의 규약 준수 수준은 직전
`--impl-prep` 세션(`00_32_57`, LOW)과 동일하다. 이번 세션에서 새로 확인할 것은 diff 가 만든 코드·CHANGELOG·plan
산출물이 그 규약과 충돌하지 않는가였고, 결과는 대체로 양호하다 — plan 위임 경로·frontmatter 스키마·Gate C·i18n
Principle 1 모두 정확히 준수됐다. 유일한 실질 WARNING 은 `_layout.md`/`9-user-profile.md`/`10-auth-flow.md` 의
frontmatter `code:` 가 이번에 핵심적으로 확장된 `(main)/[...rest]/page.tsx`·`lib/workspace/href.ts` 를 여전히
가리키지 않는다는 점이다 — `spec-code-paths.test.ts` 빌드 가드는 다른 글로브 매치로 여전히 green(실측 확인)이라
CRITICAL 은 아니며, 이미 `plan/in-progress/spec-update-catch-all-terminal-contract.md` 의 미완료 체크리스트
항목으로 추적되고 있어 project-planner 의 spec 반영 시 함께 닫히면 된다. `--impl-done` 게이트를 차단할 사유는
없다.

## 위험도

LOW
