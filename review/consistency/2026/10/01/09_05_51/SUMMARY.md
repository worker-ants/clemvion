# Consistency Check 통합 보고서

**BLOCK: NO**

5개 checker 전문을 모두 확보했고 Critical 발견은 없다.

- 모드: `--impl-done`, scope=`.claude/docs`(이 브랜치의 scope 델타 0개 파일), diff-base=`origin/main`
- 검토 상태: 개발 브랜치(`claude/nerv-cutover-1-69b98d`)와 먼저 머지될 짝 planner 브랜치(`claude/nerv-cutover-1-docs-c46df0`)를 합친 상태를 기준으로 한다. 단 cross_spec 은 개발 브랜치만 보고 판단했다.
- 이 브랜치의 실제 변경: `codebase/frontend/src/lib/docs/__tests__/` 의 가드 테스트 5개 파일(`inNervMirror` 신설). 같은 브랜치의 NERV 미러 하네스(`guard_nerv_owned_paths.py`, `settings.json` 배선, consistency 오케스트레이터 필터, `pull.py`, CI 잡, `spec/` 미러 169편)도 함께 읽었다.
- 짝 브랜치의 `.claude/docs` 변경: `plan-lifecycle.md`, `worktree-policy.md` 두 개.
- 전문 미확보 checker: 없음(5/5 반영). 5개 checker 파일이 모두 디스크에 있어 따로 영속화할 것은 없었다.
- checker 가 직접 실측한 것: `pull.py --check` 는 미러 169편에 문제 0이다. vitest 가드 4파일은 69/69 통과다. 미러 판정 정규식은 `git ls-files spec` 566개 경로 중 정확히 170개(미러 169 + README)만 고른다.
- SUMMARY.md 쓰기: 하네스가 Write 를 거부해 파일로 남기지 못했다(`Subagents should return findings as text, not write report files`). 우회하지 않고 전문을 이 메시지로 돌려준다. 호출자가 `PATH` 위치에 기록해야 한다.

## 전체 위험도
**MEDIUM**

차단할 Critical 은 없다. 다만 WARNING 7건이 남았다. 대부분 짝 planner 브랜치의 문서 문구와 머지 순서에 달려 있고, 일부는 이 브랜치의 주석·루브릭 문구로 닫을 수 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| - | - | (없음) | - | - | - |

## planner 인계 (권한 밖 Critical)

(없음) Critical 이 없어 인계 대상도 없다.

아래 WARNING 2·3·4·5·7 은 근본 원인이 developer 권한 밖이다. 거버넌스 문서, 에이전트 정의, `plan/` 이 대상이므로 짝 planner 브랜치 또는 후속 planner 턴에서 다룬다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence | 두 가드의 스코프를 적은 SoT 가 둘로 갈린다. 코드 주석과 `PROJECT.md` 가 가리키는 옛 `spec/conventions/spec-impl-evidence.md` §4.2 는 "생성형 카탈로그(와 `spec/conventions/`)만 제외"로 남아 있다. 미러 제외는 NERV 미러본 `CLE-ENG-SPECEVIDENCE` 의 표(L176·L177)와 R-12 에만 있다. 옛 문서를 그대로 읽으면 "미러가 두 가드의 대상"으로 읽혀 실제 동작과 반대다. 옛 문서는 훅이 막아 도구로 고칠 수 없다. 코드와 `PROJECT.md` 어디에도 `R-12` 나 `CLE-ENG-SPECEVIDENCE` 를 적은 곳이 없다. R-12 는 미러 frontmatter 가 `status: "draft"`, `read_as: "approved_fallback"` 이라 승인 여부도 확인되지 않았다. | `spec-link-integrity.test.ts:37`, `spec-area-index.test.ts:19` 와 헤더, `spec-links.ts:12` `NERV_MIRROR` 주석, `PROJECT.md` 두 가드 항목과 `### 검사 스코프 3가지` 절 | `spec/conventions/spec-impl-evidence.md` §4.2 표(L133·L134)·R-9, `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md` L176·L177·L184·L255·R-12 | developer 가 이 브랜치에서 할 수 있다. 세 테스트·`spec-links.ts` 주석과 `PROJECT.md` 두 항목에 "근거: NERV `CLE-ENG-SPECEVIDENCE` R-12" 한 줄을 더한다. 두 문서가 다른 스코프를 말하는 기간(단계 4f~5)을 `PROJECT.md` 에 한 문장으로 적는다. push 전에 R-12 승인 여부를 확인한다. 옛 `spec-impl-evidence.md` 는 고치지 않는다. |
| 2 | cross_spec, convention_compliance | 편집 훅은 이 브랜치에 있고, 그 훅을 안내하는 거버넌스 문서는 병합 전인 짝 브랜치에만 있다. 이 브랜치 HEAD 에서 `CLAUDE.md`·SKILL 은 NERV 를 한 번도 언급하지 않는데 훅은 `spec/**` 를 모든 역할에서 막는다. 이 브랜치가 먼저 머지되면 planner 의 `spec/` 쓰기, developer 의 자기-반증형 소정정, plan 이동 때의 인입 링크·`status` 승격이 훅에 막힌다. `BYPASS_NERV_OWNED_PATHS=1` 을 안내하는 문서는 그때 `main` 에 없다. 훅 docstring 이 스스로 세운 원칙("문서가 안내하지 않을 때 더한다")을 순서에 따라 어긴다. | `.claude/hooks/guard_nerv_owned_paths.py`(`OWNED_ROOTS`, docstring), `.claude/settings.json` PreToolUse 등록 | `CLAUDE.md` §Skill 체계·§자기-반증형 소정정·§정보 저장 위치, `.claude/skills/project-planner/SKILL.md` L14·L22·L36, `.claude/docs/plan-lifecycle.md` §3, `.claude/docs/worktree-policy.md` §5, `spec-status-lifecycle` (c) | 짝 planner 브랜치를 먼저 머지하거나 같은 시점에 머지한다. 두 PR 본문에 "`claude/nerv-cutover-1-docs-c46df0` 가 먼저"를 적는다. 순서 강제가 어려우면 이 브랜치의 병합 전 점검에 "`.claude/docs` 에 훅 안내가 있는지"를 넣는다. 짝 브랜치가 `CLAUDE.md`·SKILL 의 `spec/` 쓰기 안내까지 이미 고쳤는지는 머지 전에 한 번 확인한다. |
| 3 | rationale_continuity, convention_compliance | 짝 브랜치의 옛 트리 편집 우회 예외가 기존 "좁은 예외" 규약을 따르지 않는다. 허용 경우를 열거하지 않는다. 우회는 세션 환경 변수 하나로 `spec/` 전체를 여는데 문서는 "그 줄만"이라고 약속한다. 훅은 `file_path` 단위 허용 목록을 볼 수 없어 이 약속은 장치가 아닌 규범이다. 우회 중 고친 옛 트리는 어느 층도 잡지 않는다. developer SKILL §4 가 요구하는 `status: partial`·`pending_plans` 신규 등록이 허용 경우에 드는지도 문서가 말하지 않는다. 동결 기간에 R-5 의 역방향 강제(`spec-status-lifecycle` (b))를 누가 유지하는지도 없다. 문장 "이 두 가지"는 항목이 둘인지 셋인지 모호하고 모호함이 범위 확대로 읽힌다. | 짝 브랜치 `.claude/docs/plan-lifecycle.md` §3 "인입 참조" 인용 블록, `.claude/docs/worktree-policy.md` §5.1 "우회" 항목 | `plan-lifecycle.md` §3 "흡수 시 삭제 (좁은 예외)"의 "왜 좁게 쓰는가", `worktree-policy.md` §5·§3 의 `BYPASS_*` "단발성·의식적 우회", `spec-impl-evidence` R-5 | 짝 브랜치에서 예외의 허용 경우를 열거한다(plan 링크 정정, `pending_plans` 에서 완료 plan 제거, `status` 승격, partial 신규 등록 중 무엇이 드는지). "우회 중에는 옛 트리 전체가 열리고 어느 층도 다른 편집을 잡지 않는다"를 한 문장으로 적어 "그 줄만"을 규범으로 낮춘다. 「이 두 가지」는 "plan 링크 줄과 frontmatter 의 `pending_plans`·`status` 줄"처럼 대상을 직접 적는다. developer SKILL §4 의 partial 등록 의무가 전환 중 어디로 가는지 한 줄 더한다. |
| 4 | rationale_continuity | 근거 문장 "실측상 스펙 정정이 우회 설계보다 쌌다(3줄)"가 측정 조건이 바뀐 흐름에 그대로 옮겨졌다. 원문의 3줄은 planner 턴이 `spec/` 을 즉시 고치던 흐름에서 잰 값이다. 새 흐름은 NERV 초안 저장, 사람 승인, `pull.py --task` 재수신을 거친다. 같은 PR 의 developer SKILL 도 "승인본이 있는 문서의 동작은 아직 재지 않았다"고 밝힌다. 새 경로에서는 측정된 적이 없는 수치다. 다음 사람이 이 수치를 새 경로의 비용으로 읽는다. 금지와 경로를 함께 둔다는 원칙은 지켜졌다. | 짝 브랜치 `consistency-checker/SKILL.md` "근본 원인이 스펙이면 (`developer` 턴의 스펙 drift 등) 스펙 초안으로 넘긴다" 문단 | 같은 SKILL 의 "근본 원인이 호출자 권한 밖이면 planner 로 즉시 인계한다" 문단과 각주(2026-07-25 요약 에이전트의 Critical 하향 사건) | 문장을 "옛 흐름(planner 턴)에서 실측"으로 한정하거나 삭제한다. 새 흐름은 "승인 대기가 들어간다"는 사실만 적고 수치는 새 실측 뒤에 채운다. |
| 5 | plan_coherence | 옛 `spec/` 동결 훅이 막는 spec 편집 항목이 `plan/in-progress` 여러 곳에 열려 있는데 plan 쪽에 동결 사실 표시가 없다. 다음 세션이 그 항목을 집으면 훅에 막히고 `BYPASS_NERV_OWNED_PATHS=1` 로 우회하고 싶어진다. 우회하면 옛 트리와 미러가 갈라진다. 해당 plan: `spec-update-node-cancellation-shutdown-classification.md`(`spec/5-system/6-websocket-protocol.md` L524, `spec/3-workflow-editor/3-execution.md §4` L535), `spec-draft-nullable-notation-followups.md`(`[ ]` 140건 중 53건이 `spec/` 언급), `spec-sync-external-interaction-api-gaps.md` L18. checker 는 상위 3건만 근거로 들었고, 같은 형태의 항목이 더 있을 수 있다. | 이 브랜치 전체(`spec/` 동결, `plan/**` 델타 0), `guard_nerv_owned_paths.py` `OWNED_ROOTS["spec"]`, `CHANGELOG.md` "옛 `spec/<영역>/` 트리는 그대로 두되 동결한다" | 위 세 plan, NERV 단계 3 Task `CLE-T-FN2JWK`, 4d Task `CLE-T-BR8BNZ` | 단계 3·4d Task 가 "열린 spec 편집 항목이 있는 plan 의 NERV 이관"을 이미 포함하는지 확인한다. 포함하면 plan 머리말에 한 줄을 단다(예: "2026-10-01 부터 옛 `spec/` 동결, 남은 spec 편집은 NERV 초안으로, 이관은 Task `CLE-T-FN2JWK`"). 포함하지 않으면 그 Task 본문에 plan 목록을 추가한다. `grep -l '^\s*- \[ \].*spec/' plan/in-progress/*.md` 로 전수 확인한다. 이 표지는 plan 이라 planner 턴 몫이다. |
| 6 | naming_collision | 미러 169편의 frontmatter `status: "draft"` 가 옛 트리의 `status` 와 같은 키에 다른 뜻을 싣는다. 옛 트리에서는 구현 상태(`implemented`·`partial`·`spec-only`·`backlog`·`archived`)이고 미러에서는 NERV 문서 상태다. `"draft"` 는 옛 enum 에 없다. `read_as: "approved"` 인 문서도 `draft` 로 적혀 있어 승인 여부를 오해하기 쉽다. 지금은 프런트 가드·spec-coverage·`review_guard` 가 미러를 보지 않거나 `code:` 만 읽어서 깨지지 않는다. `spec/**` 전체를 훑어 `status` 를 읽는 다음 도구는 enum 오류를 낸다. | 미러 `spec/CLE-*` 169편 전부의 `status: "draft"`, `.claude/tools/nerv-mirror/pull.py` `render_readme()` 템플릿 | `spec/conventions/spec-impl-evidence.md` §3 `status` enum, 같은 문서의 `status:` 키 주석(spec·plan 이 `status` 를 문서 타입으로 가른다) | 키를 바꾸지 않는다(NERV 가 주는 값이다). `render_readme()` 템플릿에 "미러의 `status` 는 NERV 문서 상태이고 옛 트리의 구현 상태와 다르다. 구현 상태는 본문 머리의 `> 구현 상태:` 줄을 본다"를 한 줄 더한다. 이 줄은 developer 가 `pull.py` 에서 추가할 수 있다. 옛 SoT 의 `status:` 키 주석에 세 번째 의미를 적는 일은 NERV `CLE-ENG-SPECEVIDENCE` 초안 쪽에서 한다. |
| 7 | naming_collision | 검토 루브릭이 가리키는 "명명 컨벤션"의 출처 절을 짝 PR 이 지운다. 루브릭은 `project-planner/SKILL.md` 의 `## 명명 컨벤션` 을 가리키는데 짝 PR 은 이 절을 `## 트리 규칙` 으로 바꾸고 옛 규칙(`_product-overview.md`, `N-name.md`)을 지운다. 네 곳의 루브릭은 그대로라 참조가 어디도 가리키지 않는다. 그 뒤로 새 스펙 파일 `spec/CLE-*/CLE-*.md` 는 모두 "기존 명명 컨벤션을 깬다"는 판정을 받을 수 있다. 이 checker 자신이 그 루브릭으로 돈다. | `.claude/agents/convention-compliance-checker.md:16`, `.claude/agents/naming-collision-checker.md:19`, `.claude/skills/code-review-agents/lib/role_instructions.py:243`·`:266` | 짝 PR 의 `project-planner/SKILL.md` `## 트리 규칙`(NERV 키 규칙 `CLE-<영역>-<슬러그>`, 미러 경로 `spec/<영역 키>/<KEY>.md`) | 네 곳의 문구를 "옛 트리는 `N-name.md` 등, NERV 스펙은 `CLE-<영역>-<슬러그>` 키와 미러 경로 `spec/<영역 키>/<KEY>.md`"로 바꾼다. 에이전트 정의 두 개는 짝 planner 브랜치에, `role_instructions.py` 는 이 PR(developer 소유)에 넣는 것이 소유 경계에 맞다. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, plan_coherence | consistency 코퍼스(`related_specs`·`conventions`·`rationale_excerpts`)에서 미러가 빠져 단계 4e 전까지 로컬 검사는 동결 시점 옛 트리 기준이다. 전환 이후에 NERV 쪽에서 쓰는 Rationale(R-12 등)은 이 checker 가 볼 수 없다. 짝 SKILL 각주는 옛 트리를 scope 로 돌릴 때 대조가 낡았을 수 있다는 점을 적지 않았다. `spec_impact` 가 미러를 가리키는 새 plan 은 4e 전까지 후보가 될 수 없다. `spec-sync-external-interaction-api-gaps.md` L287 의 처방("`spec_impact` 를 무조건 포함")을 구현하는 사람이 이 제외와 부딪힐 수 있다. 서버의 `nerv_spec_check` 가 같은 일을 하므로 그물은 있다. | `consistency_orchestrator.py` `is_nerv_mirror` · `collect_context`, 짝 브랜치 `consistency-checker/SKILL.md` "NERV 미러와 대조 코퍼스" 각주 | 각주에 "단계 4e 전까지 전환 이후 Rationale 의 연속성은 `nerv_spec_check` 가 맡는다" 한 문장을 더한다. L287 항목에 "미러 파일은 4e 전까지 코퍼스에서 제외된다. `spec_impact` 가 미러를 가리킬 때의 처방은 4e 와 함께 정한다"를 더한다. 4e Task 에 "코퍼스 이전 시 번들 절단 백로그의 측정 기준선 재측정"을 추가한다. |
| 2 | cross_spec | 옛 트리 가드 정리 시점이 문서마다 4f 와 5 로 다르게 적혀 있다. 코드 동작에는 영향이 없다. | `spec-links.ts` 주석("단계 5, Task `CLE-T-7M4C4X`"), `guard_nerv_owned_paths.py` docstring(4f `CLE-T-RXMB2X`, 5), `CLE-ENG-SPECEVIDENCE` R-12 | 다음에 해당 문서를 만질 때 한쪽으로 맞춘다. R-12 는 NERV 스펙이라 `/nerv:spec edit` 경로다. |
| 3 | cross_spec | "미러 제외" 테스트가 `spec/CLE-*.md` 최상위 파일이 1개 이상이라는 전제에 묶여 있다. 지금은 `CLE-VISION.md`·`CLE-GLOSSARY.md` 가 있어 통과한다. 미러가 부분 스냅샷이라는 문서 전제와 같지 않다. | `spec-link-integrity.test.ts` "excludes the NERV spec mirror from scope" | 필요해지면 후보를 최상위 `CLE-*.md` 로 한정하지 말고 `inNervMirror` 가 참인 어떤 `.md` 든(영역 폴더 안 포함)으로 넓힌다. |
| 4 | rationale_continuity, naming_collision | "자기-반증형 소정정" 제거는 결정 D8 안 A 를 따르고 사유 각주도 있다. 다만 틀린 예고가 옛 트리에 있으면 정정은 NERV 에만 들어가고 옛 트리는 4e 까지 checker 코퍼스로 남는다. 또 결정 번호 D1~D11 의 정의가 저장소에 없고 `worktree-policy.md` §5 의 "D. PreToolUse" Layer D 와 글자가 겹쳐 §5 근처에서 오독할 수 있다. | 짝 브랜치 `CLAUDE.md` §Skill 체계 각주, `developer/SKILL.md` 경로 표 `spec/` 행, `pull.py` 주석("결정 D1·D2·D3·D4") | 번호를 "NERV 결정 D3"처럼 출처를 붙여 쓰고 처음 나오는 문서(`CLAUDE.md`)에 결정 목록이 있는 Task 키(`CLE-T-…`)를 한 번 적는다. 승인 전 틀린 예고는 NERV `spec_change` 로 남긴다는 한 줄을 더한다. |
| 5 | rationale_continuity | 미러를 "구현된 스펙의 스냅샷"이라 부르는 문구가 첫 미러의 내용과 맞지 않는다. 첫 미러는 `--all` 로 169편 전체를 받았고 "부분 구현" 49편·"미구현" 1편이 있으며 1편은 승인본 없이 초안으로 들어왔다. 사람이나 checker 가 미러를 구현 완료의 증거로 읽을 수 있다. | `spec/README.md`, 짝 브랜치 `CLAUDE.md` §정보 저장 위치 각주, `pull.py` `render_readme` | "구현 시점에 받은 스펙 버전의 스냅샷"으로 고치고, 상태는 frontmatter `read_as` 와 본문 머리 줄의 구현 상태로 본다고 덧붙인다. |
| 6 | convention_compliance, naming_collision | `.claude/docs/README.md` 의 `worktree-policy.md` 색인 행("4-layer default-branch guard")이 짝 브랜치의 새 §5.1(NERV 소유 경로 가드)을 말하지 않는다. §5.1 은 4-layer 와 별개라 이 설명으로는 찾을 수 없다. | `.claude/docs/README.md` 9행 | 짝 PR 에서 그 행에 "NERV-owned path guard" 를 덧붙인다. |
| 7 | convention_compliance | `stray-tool-tags.test.ts` 의 하한 `MIN_EXPECTED_MD_FILES.spec = 190` 과 "2026-09-01 실측 … spec 386" 주석이 미러 편입으로 낡았다. 지금 `spec/` 의 `.md` 는 557개(옛 387 + 미러 170)다. 단계 5 에서 옛 트리를 지우면 170개만 남아 190 아래로 내려가 가드가 RED 가 된다. | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` | 규약 위반은 아니라 지금 수정을 강제하지 않는다. 주석에 "단계 5 에서 재조정"을 적고 단계 5 작업 목록(Task `CLE-T-7M4C4X`)에 이 상수를 넣는다. |
| 8 | plan_coherence | 이 consistency 세션의 scope 를 `.claude/docs` 로 줬다. 바뀐 가드의 spec 은 `spec/conventions/spec-impl-evidence.md` 인데 동결돼 올바른 scope 가 없는 형태다. `harness-review-gate-followups.md` §O 의 사례가 하나 더 생겼다. | 이 세션의 scope 지정, `plan/in-progress/harness-review-gate-followups.md` §O | §O 의 "실측 비용" 아래에 "2026-10-01 NERV 전환 1: spec 이 동결돼 올바른 scope 가 없는 형태" 한 줄을 추가한다. 이 PR 안에서 처분할 일은 없다. |
| 9 | naming_collision | 사용자 가이드 누출 가드가 새 내부 식별자 모양을 모른다. `spec/CLE-…` 경로, `CLE-*` 키, `REQ-<접두>-<nnn>` 는 `no-internal-refs.test.ts` 의 두 정규식 어디에도 걸리지 않는다. 지금 가이드 MDX 에는 0건이다. 단계 4b 가 키를 MDX 근처로 끌어온다. | `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` `spec/ path leak`, `internal anchor id` | 4b 또는 4f Task 범위에 "`CLE-`/`REQ-` 모양과 `spec/CLE-` 경로를 누출 패턴에 더한다"를 적는다. 지금 패턴 두 줄을 더해도 비용이 작다. |
| 10 | cross_spec, naming_collision, convention_compliance, plan_coherence | `BYPASS_NERV_OWNED_PATHS` 와 새 PreToolUse 훅이 `worktree-policy.md` §5 Enforcement 열거에 아직 없다(짝 브랜치 §5.1 이 채운다). 이름은 기존 `BYPASS_*_GUARD` 접미사 관례와 다르다. 겹치는 이름은 없다. | `guard_nerv_owned_paths.py:24,84`, 짝 브랜치 `worktree-policy.md` §5.1 | 이름은 그대로 둔다. 바꾼다면 `BYPASS_NERV_OWNED_PATHS_GUARD` 로 한 번에 바꾼다. 훅의 stderr 안내와 §5.1 이 같은 이름을 쓰는지만 유지한다. |
| 11 | naming_collision | `.nerv/cache/mirror/<KEY>.md`(`pull.py --task` 의 원문 캐시)가 NERV 플러그인 소유 네임스페이스 안에 있다. `pull.py` 는 `NERV_CACHE_DIR` 를 무시하고 경로를 고정한다. `worktree-policy.md` §8 표는 이 사용을 말하지 않는다. 지금은 충돌이 없고 캐시를 잃어도 조건부 요청을 안 할 뿐이다. | `.claude/tools/nerv-mirror/pull.py` | §8 의 `.nerv/` 행에 "미러 도구 캐시(`cache/mirror/`, 지워도 된다)"를 덧붙이거나 `pull.py` 가 `NERV_CACHE_DIR` 를 따르게 한다. |
| 12 | naming_collision | `area` 와 `영역` 이 두 가지 뜻으로 쓰인다. `pull.py` 의 `mirror_relpath(key, area)` 는 폴더를, `folder_of(key, type_, area)` 는 frontmatter 값을 가리킨다. docstring 이 예외를 밝히고 동작은 맞다. | `pull.py` `Doc.area`, `mirror_relpath`, `area_map()`, `folder_of` | 선택 사항이다. 폴더 쪽 인자를 `folder` 로 바꾸면 docstring 의 예외 문장이 필요 없다. 문서는 "영역 키"를 붙이는 규칙을 유지한다. |
| 13 | naming_collision | "mirror" 어휘와 `--spec` 플래그가 기존 쓰임과 겹친다. CI 잡 `mirror-guard`(`.github/workflows/repo-guards.yml:62`)와 `pull.py --spec <KEY>` 대 오케스트레이터 `--spec <path>`. 새 이름은 모두 `spec-`·`nerv-` 한정어가 붙어 실행 충돌은 없다. | CI 잡 `spec-mirror-integrity`, 폴더 `nerv-mirror/`, `inNervMirror`·`is_nerv_mirror`·`NERV_MIRROR` | 문서에서 "mirror-guard" 를 한정어 없이 쓰지 않는다. `--spec` 을 적을 때는 전체 명령으로 쓴다. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | WARNING 2, INFO 3. 가드 스코프 SoT 가 옛 문서와 미러본으로 갈림. 훅과 `CLAUDE.md`·SKILL 권한 안내의 어긋남. |
| rationale_continuity | LOW | WARNING 2, INFO 4. 옛 트리 우회 예외가 "좁은 예외" 규약을 따르지 않음. "3줄" 실측이 새 흐름으로 옮겨짐. |
| convention_compliance | LOW | WARNING 1, INFO 4. 훅은 이 브랜치, 안내 문서는 짝 브랜치라 머지 순서에 의존. 코드·테스트의 정식 규약 직접 위반 0건. |
| plan_coherence | MEDIUM | WARNING 1, INFO 3. 옛 `spec/` 동결로 열린 plan 의 spec 편집 항목이 실행 불가가 됐는데 plan 쪽 표시 없음. |
| naming_collision | LOW | WARNING 2, INFO 7. 실제 충돌 0건. 미러 `status` 의미 중복, 검토 루브릭이 짝 PR 이 지우는 절을 가리킴. |

## 권장 조치사항

1. **BLOCK 해소**: 해당 없음(Critical 0건). `--impl-done` push 게이트 관점에서 차단 사유는 없다.
2. **머지 순서 고정(WARNING 2)**: 짝 planner 브랜치를 먼저 머지하거나 `/merge-coordinate` 로 같은 시점에 머지한다. 두 PR 본문에 순서를 적는다. 역순이면 훅이 문서가 시키는 쓰기를 막는 상태가 된다.
3. **지금 developer 가 이 브랜치에서 할 수 있는 것**:
   - 세 가드 테스트와 `spec-links.ts` 주석, `PROJECT.md` 두 항목에 "근거: `CLE-ENG-SPECEVIDENCE` R-12"를 적고 R-12 승인 여부를 확인한다(WARNING 1).
   - `render_readme()` 템플릿에 미러 `status` 의미와 옛 트리 구현 상태의 차이를 한 줄 적는다(WARNING 6).
   - `role_instructions.py:243`·`:266` 의 "명명 컨벤션" 문구를 NERV 키 규칙을 포함하도록 고친다(WARNING 7).
   - `stray-tool-tags.test.ts` 주석에 "단계 5 에서 재조정"을 적는다(INFO 7).
4. **짝 planner 브랜치에서 고칠 것**:
   - `plan-lifecycle.md` §3·`worktree-policy.md` §5.1 의 우회 예외에 허용 경우를 열거하고 "그 줄만"을 규범으로 낮춘다(WARNING 3).
   - `consistency-checker/SKILL.md` 의 "3줄" 실측 문장을 옛 흐름으로 한정한다(WARNING 4).
   - 에이전트 정의 두 개의 명명 컨벤션 문구를 고친다(WARNING 7).
   - `.claude/docs/README.md` 색인 행에 §5.1 을 반영한다(INFO 6).
   - 결정 번호 D1~D11 의 출처 Task 키를 적는다(INFO 4).
5. **plan 정리(planner 턴)**: 단계 3·4d Task 가 열린 spec 편집 plan 의 이관을 포함하는지 확인하고, 해당 plan 머리말에 동결 표시를 한 줄 단다(WARNING 5). 4e Task 에 코퍼스 이전 시 재측정을 추가한다(INFO 1). `harness-review-gate-followups.md` §O 에 사례 한 줄을 더한다(INFO 8).
6. **전환 단계 Task 범위에 넣을 것**: 4b·4f 에 누출 가드 패턴 추가(INFO 9), 5 에 하한 상수·`inNervMirror`·`is_nerv_mirror` 정리(INFO 7).

STATUS=success BLOCK=NO PATH=/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/review/consistency/2026/10/01/09_05_51/SUMMARY.md
