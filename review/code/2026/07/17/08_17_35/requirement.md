# 요구사항(Requirement) 리뷰 — rebase 후 재검토 (origin/main → f8c334947 #957 반영)

**검토 범위**: `git diff origin/main..HEAD` (merge-base = `f8c334947`, 즉 #957 그대로). 초점은
"#957 이 갱신한 main 의 새 내용과 이번 PR 의 spec 변경(`_layout.md` §2.2/R-3, `9-user-profile.md`
§3, `11-error-empty-states.md` §1.3, `data-flow/12-workspace.md`)이 의미 충돌하는가", 그리고
"구현이 여전히 spec 과 line-level 로 일치하는가"이다. 코드 본체(href.ts/sidebar.tsx/[...rest]/page.tsx)
자체의 기능 완전성·엣지케이스·에러 시나리오는 직전 리뷰(01_07_43 LOW·Critical 0 + 01_27_10 fix
커버)에서 이미 전수 검토됐고 diff 내용도 변경이 없어 본 재검토에서 반복하지 않는다.

## 실측 방법

- `git log --oneline` 으로 rebase 결과 확인: HEAD 의 6개 커밋(`f066fead0`→`aa01cf4f0`)이 `f8c334947`
  (#957) 위에 정확히 재배치됐음을 확인 (`git merge-base HEAD origin/main` = `f8c334947`).
- `git show f8c334947 --stat` 로 #957 이 실제로 건드린 파일 전수 확인 후, 본 PR 의
  `git diff origin/main..HEAD --stat` 결과와 파일 단위·라인 단위 겹침을 대조.
- 4개 spec 문서(`_layout.md`·`9-user-profile.md`·`11-error-empty-states.md`·
  `data-flow/12-workspace.md`) 및 `10-auth-flow.md` 의 현재(rebase 후) 본문을 worktree
  절대경로로 직접 Read.
- 실제 코드(`(main)/[...rest]/page.tsx`·`lib/workspace/href.ts`·`components/layout/sidebar.tsx`)를
  Read 해 spec 문언과 line-level 대조.
- `plan/complete/spec-update-catch-all-terminal-contract.md`(project-planner 위임 draft, 이제
  complete) 체크리스트 전항목 완료 여부 확인.
- 가드 테스트 실행: `spec-frontmatter.test.ts`·`spec-link-integrity.test.ts`·
  `spec-code-paths.test.ts`·`spec-frontmatter-parse.test.ts`(4 files, 793 tests) 전부 PASS,
  `plan-frontmatter.test.ts`(81 tests) PASS, `workspace-redirect.test.tsx`·
  `sidebar-nav-href.test.tsx`(17 tests) PASS.

## 발견사항

- **[INFO]** #957·본 PR 이 동시에 건드린 3개 파일 모두 실측 결과 텍스트 충돌 없음
  - 위치: `spec/2-navigation/9-user-profile.md`, `spec/conventions/spec-impl-evidence.md`,
    `plan/complete/ai-agent-tool-payload-budget-followups.md`
  - 상세:
    1. `9-user-profile.md` — #957 은 264행 `[^int-email]` 각주(알림 설정 필드명 정정,
       `notifyIntegrationExpiryByEmail`→`integrationExpiryEmail`)만 수정했고, 본 PR 은 158행
       §3 catch-all terminal 서술만 수정했다. `grep -n "int-email\|cold-load reconcile"` 로 현재
       파일을 실측한 결과 두 변경 모두 온전히 병합돼 공존한다(158행·270행). 라인 겹침 없음.
    2. `spec/conventions/spec-impl-evidence.md` — #957 이 링크 무결성 가드 서술을 정정(spec 본문의
       `plan/**` 링크도 스캔 대상임을 명시)했으나, 본 PR 은 이 파일을 전혀 건드리지 않는다
       (`git diff origin/main..HEAD --stat` 확인). 이 정정은 오히려 본 PR 에 유리하게 작용한다 —
       `spec-link-integrity.test.ts` 가 spec→plan 링크도 검사한다는 것이 명문화됐는데, 본 PR 의
       4개 spec 문서 어디에도 `plan/**` 링크가 없음을 `grep` 으로 확인(영향 없음).
    3. `ai-agent-tool-payload-budget-followups.md` — 오케스트레이터가 사전 지적한 대로, #957 이
       동일한 Gate C `spec_impact` 보정을 독립 수행했고 본 PR 의 중복 커밋은 rebase 시 정상
       drop 됐다(`git diff origin/main..HEAD --stat` 에 이 파일이 전혀 나타나지 않음 — 재도입
       흔적 없음).
  - 제안: 없음 — 조치 불요, 확인 완료.

- **[INFO]** #957 이 `spec/2-navigation/1-workflow-list.md`·`4-integration.md` 도 수정했으나 본 PR
  범위(catch-all/사이드바)와 겹치지 않음
  - 위치: 두 파일 모두 (`git diff origin/main..HEAD --stat` 에 미등장 확인)
  - 상세: `grep -rn "catch-all|\[\.\.\.rest\]|WORKSPACE_ROUTE_SEGMENT"` 두 파일 모두 매치 0건.
    #957 의 변경은 Cafe24 카탈로그 수치(485) 정정·알림 필드명 정정 등 본 PR 도메인과 무관.
  - 제안: 없음.

- **[INFO]** 구현이 갱신된 spec 4개 문서의 신규 문언과 line-level 로 정확히 일치 — 재확인
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx`, `codebase/frontend/src/lib/workspace/href.ts`,
    `codebase/frontend/src/components/layout/sidebar.tsx`
  - 상세:
    - `_layout.md` §2.2 각주의 3행 표(무-slug→forward / `/w/<slug>` 단독→dashboard forward /
      그 외→`notFound()`)는 `page.tsx` 의 `workspacePrefixed`/`workspaceRootSlug` 분기(각각
      `rest[0] === WORKSPACE_ROUTE_SEGMENT`, `rest.length === 2`) 및 render 단계 `notFound()`
      호출과 정확히 대응한다.
    - `_layout.md` §2.2 "사이드바는 이 예외를 `navItems` 의 `workspaceScoped: false` 로 표현"은
      `sidebar.tsx` 의 `/docs` 항목만 `workspaceScoped: false`(나머지 12개 전부 `true`)로 실측
      확인.
    - `_layout.md` R-3 의 기각 대안 2건(slug 재부착 무한루프·strip 후 재-forward ping-pong)과
      `buildWorkspaceHref` 비-idempotent 근거는 `href.ts` docstring 문언과 사실상 동일 텍스트로
      승격돼 있다.
    - `9-user-profile.md` §3 "이미 `/w/` 로 시작하는 경로는 흡수 대상이 아니다"·
      `11-error-empty-states.md` §1.3 "`/w/<slug>` 하위 미지의 경로 → 404" 행·
      `data-flow/12-workspace.md:311` 각주 모두 코드 동작과 모순 없이 대응.
  - 제안: 없음 — spec fidelity 정합 확인.

- **[INFO]** `frontmatter code:` 글로브 보강도 대상 파일 실존 확인 — 가드 green
  - 위치: `_layout.md`·`9-user-profile.md`·`10-auth-flow.md`·`11-error-empty-states.md` frontmatter
  - 상세: 4개 문서 모두 `(main)/[...rest]/page.tsx`(+`_layout.md`·`9-user-profile.md` 는
    `lib/workspace/href.ts`) 를 `code:` 에 추가했고, 대상 파일이 실제 존재. `spec-code-paths.test.ts`
    포함 4개 가드 테스트 793건 전부 PASS 로 재확인.
  - 제안: 없음.

- **[INFO]** developer/project-planner 권한 경계 준수 재확인 (CLAUDE.md §Skill 체계)
  - 위치: `plan/complete/user-guide-routing-loop-fix.md` frontmatter (`spec_impact: none`,
    owner: developer) vs. 커밋 `aa01cf4f0`(owner: project-planner, "docs(spec): 2-navigation —
    catch-all 의 /w/ 접두 terminal 계약 명문화")
  - 상세: developer plan 은 "본 PR 은 spec 을 수정하지 않았다 — 구현이 기존 spec 을 위반하던 것을
    spec 대로 되돌린 정합화"라 명시하고 `spec_impact: none` 을 선언했다. 실제 spec 4개 문서 수정은
    별도 project-planner 커밋(`aa01cf4f0`)이 수행했으며, 그 직전 `plan/complete/spec-update-catch-all-terminal-contract.md`
    체크리스트가 project-planner 검토→`/consistency-check --spec`(07_03_34, BLOCK:NO)→spec 반영→
    plan/complete/ 이동까지 전항목 `[x]` 로 완결돼 있다. 규약이 요구하는 정지점·위임 흐름과 정확히
    일치.
  - 제안: 없음.

- **[INFO]** 사소한 stale 문구 — `spec-update-catch-all-terminal-contract.md` 상단 "머지 대기" 표현
  - 위치: `plan/complete/spec-update-catch-all-terminal-contract.md:20` "선행 PR:
    `plan/complete/user-guide-routing-loop-fix.md` (구현 완료·**머지 대기**)"
  - 상세: 두 plan 문서 모두 이미 `plan/complete/` 로 이동되고 같은 PR 로 머지 직전인데, "머지 대기"
    라는 문구는 07_03_34 세션 당시(아직 in-progress) 작성된 잔재로 보인다. 기능·spec 정합에는
    영향 없는 서술적 사소함.
  - 제안: 비차단. 후속 편의상 정정 가능하나 필수 아님.

## 요약

rebase base 가 `origin/main`→`f8c334947`(#957)로 전진했음을 `git merge-base` 로 확인했고, #957 이
실제로 건드린 파일 전수(`spec/2-navigation/{1-workflow-list,9-user-profile,4-integration}.md`,
`spec/conventions/spec-impl-evidence.md`, `plan/complete/ai-agent-tool-payload-budget-*.md` 등)와
본 PR 의 diff 를 라인 단위로 대조한 결과 실질 충돌은 없다. 유일하게 파일이 겹치는
`9-user-profile.md` 는 #957 이 264행(알림 필드명 각주), 본 PR 이 158행(§3 catch-all terminal)으로
서로 다른 위치를 수정해 텍스트 충돌 없이 병합됐고, `grep` 실측으로 두 변경 모두 현재 파일에
온전히 공존함을 확인했다. `ai-agent-tool-payload-budget-followups.md` 관련 본 PR 의 중복 Gate C
보정 커밋은 rebase 시 정상적으로 drop 되어 재도입 흔적이 없다. 구현(`page.tsx`·`href.ts`·
`sidebar.tsx`)은 갱신된 4개 spec 문서(§2.2 각주·R-3·§3·§1.3·data-flow 각주)의 새 문언과
line-level 로 여전히 정확히 일치하며, 관련 문서 가드 테스트(spec-frontmatter·spec-link-integrity·
spec-code-paths·plan-frontmatter, 총 874 tests)와 대상 unit 테스트(17 tests) 전부 PASS 를 재확인했다.
developer→project-planner 위임 경계도 CLAUDE.md 규약대로 정확히 지켜졌다. CRITICAL/WARNING 없음.

## 위험도

NONE
