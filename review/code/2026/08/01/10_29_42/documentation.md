# 문서화(Documentation) 리뷰

## 검증 방법 (요약)

말로만 판단하지 않고 아래는 실제로 실행/대조했다.

- `.claude/tests/test_review_gate_ci.py` 13개 테스트 전량 `unittest discover` 로 실행 → 전부 PASS.
- 연관 메타 가드 3종(`test_tests_readme_catalog.py`, `test_harness_checks_paths_coverage.py`,
  `test_workflow_yaml_structure.py`) 실행 → 전부 PASS(이 PR 이 README 카탈로그·paths 커버리지·
  YAML 구조 불변식을 깨지 않았음을 확인).
- `git diff HEAD~1 HEAD --stat` 로 이 커밋이 정확히 6개 파일(README +1줄, harness-checks.yml
  +3줄, test_review_gate_ci.py/신규 269줄, review-gate.yml/신규 62줄, plan 문서 +46/-8줄,
  check-review-gate.py/신규 120줄)만 바꿨음을 확인 — 번들의 "전체 파일 컨텍스트" 중 어디까지가
  이번 diff 이고 어디가 기존 컨텍스트인지 라인 단위로 갈랐다.
- 문서가 인용하는 커밋 해시(`fa3cf81ad`, `e96ef1b45`, `75967fab3`)와 문서 경로
  (`plan/complete/harness-push-gate-did-not-fire.md` §M, `harness-consistency-summary-downgrade-rule.md`,
  `harness-guard-followups.md`)를 전부 `git cat-file`/`ls`/`grep` 으로 실존 확인 — 조작된 인용 없음.
- `.gitignore` 를 직접 읽어 "review/**/_prompts/ 만 제외" 주장을 대조(참). `git ls-tree -r
  origin/main` 로 review/code, review/ 트리 파일 수를 직접 세어 문서의 8,851/14,517 과 대조
  (실측 9,113/14,779 — 아래 발견 참조).
- `plan_guard._linked_plans()` 를 이 worktree 에서 직접 호출해 plan frontmatter 연결 여부를
  실측(아래 발견 참조) — 문서만 읽고 추정하지 않았다.

## 발견사항

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 frontmatter `worktree:`
  값이 실제 작업 worktree 와 달라, 이 티켓이 `plan_guard` 의 PLAN 절반 게이트에서 "연결된 plan
  없음"으로 취급된다 — 문서가 실제로 갱신되고 있음에도 안전망은 무력화된 상태.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:3` (`worktree:
    harness-block-backstop-b56163`)
  - 상세: 이 worktree 의 실제 브랜치는 `claude/harness-review-ci-backstop-91f379`
    (`git branch --show-current` 로 확인, `git worktree list` 에도 이 이름으로만 등록돼 있고
    `harness-block-backstop-b56163` 는 더 이상 존재하지 않는다). `plan_guard.py` 의
    `_linked_plans()`/`_normalize_worktree_value()` 는 frontmatter `worktree:` 값과 현재
    worktree 디렉토리명(또는 `claude/` 를 뗀 브랜치명)을 **정확히 일치**시켜 연결을 판정한다
    (`.claude/docs/plan-lifecycle.md:54`, `plan_guard.py:32-37`). 이 저장소에서
    `plan_guard._linked_plans(cwd, cwd)` 를 직접 호출해 실측한 결과 `[]` — 즉 이 브랜치에는
    연결된 in-progress plan 이 **하나도 없다**고 판정된다. `plan-lifecycle.md` 자신이 명시하듯
    "연결된 plan 이 없는 ad-hoc 작업은 차단되지 않는" 설계라 push 는 막히지 않지만, 그 결과
    이 커밋이 실제로 plan 문서를 정성껏 갱신했는지 여부와 **무관하게** 같은 방식으로 통과한다 —
    PLAN 게이트가 이 티켓에 대해 아무 보증도 제공하지 못하는 상태다. `git log -p` 로 이력을
    보면 이 값은 `(unstarted)` → `harness-review-gate-fixes-1bd6aa` →
    `harness-block-backstop-b56163` 순으로 갱신돼 왔고, 이번 라운드(새 worktree
    `harness-review-ci-backstop-91f379`)에서만 갱신이 누락됐다. 이번 diff 자체가 이 파일의
    frontmatter 를 건드리지 않았으므로(`diff HEAD~1 HEAD` 로 frontmatter 블록 무변경 확인)
    **이 PR 이 새로 만든 결함은 아니다** — 다만 이 PR 이 바로 이 파일의 본문을 크게 갱신하면서도
    frontmatter 는 그대로 둔 것이라, "파일을 열어 고치는 중" 이었던 이번이 고치기 가장 쌌던
    시점이다.
  - 제안: `worktree: harness-review-ci-backstop-91f379` 로 갱신. (일반화하면: 이 필드가 지금처럼
    작업 재개 때마다 손으로 갱신해야 하는 자유 텍스트인 한 같은 drift 가 재발한다 — 별도
    가드/자동화는 이 PR 범위 밖.)

- **[INFO]** 리뷰 산출물 파일 수 실측치가 문서상 수치와 약간 어긋난다 — 결함이 아니라 시점 차이.
  - 위치: `scripts/check-review-gate.py:21-23`, `plan/in-progress/harness-review-gate-ci-backstop.md:180`
  - 상세: 두 곳 모두 "`origin/main` 이 `review/code` 아래 8,851개(`review/` 전체 14,517개)를
    추적한다" 고 적는다. 지금 `git ls-tree -r origin/main --name-only` 로 직접 세면
    `review/code/` 9,113개, `review/` 전체 14,779개다 — 하루 사이 다른 리뷰 세션들(이 리뷰가
    실행되는 시점 자체도 포함해)이 계속 커밋되며 자연 증가한 것으로 보인다. plan 문서는
    "2026-08-01 실측" 이라고 날짜를 박아 뒀지만(:180 근처), `check-review-gate.py` 의 docstring
    은 같은 수치를 "착수 전 실측" 이라고만 적어 날짜가 없다 — 스크립트를 읽는 사람이 이 숫자를
    "지금도 정확한 값" 으로 오인할 여지가 plan 문서보다 크다. 핵심 주장("review 산출물은
    gitignore 안 된다")은 다르지 않으므로 차단 사유는 아니다.
  - 제안: 스크립트 docstring 에도 "(2026-08-01 기준)" 정도의 시점 표기를 붙이면 향후 재측정
    필요 여부를 읽는 사람이 스스로 판단할 수 있다. 선택 사항.

- **[INFO]** `PROJECT.md` "## 보조 스크립트 (검증·운영)" 섹션에 `check-review-gate.py` 항목이
  없다 — 다만 기존 관행과 일치하므로 결함으로 보지 않는다.
  - 위치: 참고용 교차확인이며 이번 diff 대상 파일은 아님(`PROJECT.md:323` 이하)
  - 상세: 이 섹션은 `check-doc-links.py`/`report_playwright_flaky.py` 처럼 사람이 수동으로도
    돌릴 법한 스크립트를 사용법·종료코드·의존성과 함께 카탈로그화한다. 그런데 같은 성격의
    CI 전용 preflight 스크립트인 `check-e2e-playwright-config.py` 도 이 섹션에 없다(확인:
    `grep -n check-e2e-playwright-config PROJECT.md` 무결과) — 즉 "CI 가 자동으로만 부르는
    검증 스크립트는 이 카탈로그에 넣지 않는다" 는 기존 관행이 이미 있고, `check-review-gate.py`
    도 review-gate.yml 안에서만 호출되는 같은 성격이라 그 관행을 그대로 따른 것으로 읽힌다.
  - 제안: 없음(현행 유지가 기존 관행과 일치). 발견성을 높이고 싶다면 `check-override-floors.py`
    가 받은 것과 같은 한 줄 언급만 추가하는 선택지는 있으나 강제하지 않는다.

## 검증했지만 문제 없음으로 확인한 항목 (참고)

- `.claude/tests/README.md` 신규 행(`test_review_gate_ci.py`)의 서술 4항목(판정자 단일성 /
  관측 모드 기본 / fail-open / advisory 무관) 전부 실제 코드·테스트와 대조해 정확함을 확인.
- `harness-checks.yml` 신규 3줄(`scripts/check-review-gate.py` 등재)은 그 파일 자신이 명시한
  "scripts/ 는 개별 등재, 포괄 글롭 없음" 정책과 일치하며, 등재가 실제로 필요했음을
  `test_harness_checks_paths_coverage.py` PASS 로 확인.
  `review-gate.yml`/`check-review-gate.py` 는 CHANGELOG.md 에 등재되지 않았는데, 이 저장소의
  CHANGELOG 는 `codebase/` 제품 변경 전용이고 과거 어떤 harness-only 변경도 실린 적이 없어(전수
  grep 확인) 갭이 아니다.
- `check-review-gate.py` 의 docstring/인라인 주석이 실제 종료 코드·fail-open 분기·advisory 출력
  순서와 정확히 일치함을 코드 대조로 확인. 사용법(`사용:\n    python3
  scripts/check-review-gate.py [--enforce] [--root <repo-root>]`)도 실제 `argparse` 정의와 일치.
  공개 함수 `_load_gate`/`main` 모두 docstring 보유.
  `test_review_gate_ci.py::OneJudgeTest` 는 "판정을 자기가 계산하지 않는다" 는 주장을 문자열이
  아니라 AST 상 호출·import 부재로 단언하므로(banned: `os.walk`/`re.compile`/`subprocess.*`/
  `open` 등), 스크립트가 실제로 그 계약을 어기면 이 테스트가 반드시 실패한다 — 우회 불가능한
  방식으로 확인.
- 신규 테스트 4개(`test_a_missing_gate_module_does_not_fail_ci`,
  `test_a_gate_that_raises_does_not_fail_ci`, `test_notes_are_printed_on_both_verdicts`,
  `test_a_resolved_review_lets_the_branch_through`)를 각각 논리적으로 "가드를 제거하면 실패
  하는가" 로 되짚었다 — 넷 다 해당 분기·출력·실제 `review_guard` 로직에 직접 의존해, 지난
  라운드들에서 지적된 "실패할 수 없는 테스트" 부류에 해당하지 않는다.
  `test_it_is_still_observation_only` 는 YAML 주석(`--enforce` 를 설명하는 산문)을 걷어낸 텍스트로
  단언해, 주석이 그 문자열을 언급한다는 이유로 거짓 실패하지 않도록 설계돼 있고 이유도 docstring
  에 정확히 적혀 있다.
- 상호 참조 정합성: plan 문서가 인용하는 커밋 6개(`fa3cf81ad`, `e96ef1b45`, `75967fab3` 등)와
  문서 경로(`harness-push-gate-did-not-fire.md` §M, `harness-consistency-summary-downgrade-rule.md`,
  `harness-guard-followups.md`) 전부 실존 확인. 지어낸 인용 없음.
- plan 문서 안 수치(435 / 355(81%) / 80(18%) = dependabot 11 + 그 외 69)는 산술적으로 정합
  (355+80=435, 80/435≈18%, 355/435≈82%→81% 반올림 오차 범위, 11+69=80).

## 요약

이번 diff 는 harness CI 백스톱(리뷰 게이트의 훅-독립 GitHub Actions 판정)에 대한 문서화 수준이
전반적으로 높다 — 스크립트 docstring, 워크플로 YAML 인라인 주석, `.claude/tests/README.md` 신규
행, plan 문서가 서로 같은 근거(판정자 단일성·관측 모드 기본값·fail-open·advisory 무관)를 반복
강조하며 정확히 일치하고, 인용된 커밋 해시·경로·수치를 전수 대조한 결과 조작되거나 깨진 참조가
없었다. 신규 테스트 13개는 전부 실행해 통과를 확인했고 핵심 4개는 "가드 제거 시 실패하는가" 를
개별 검증해 vacuous 하지 않음을 확인했다. 유일한 실질적 흠은 이번 diff 가 만들지 않았지만 이번
diff 가 바로 그 파일의 본문을 갱신하면서도 고치지 않은 `plan/in-progress/
harness-review-gate-ci-backstop.md` 의 stale `worktree:` frontmatter 로, 실측 결과
`plan_guard` 가 이 브랜치에 연결된 plan 을 0개로 판정한다 — push 를 막지는 않지만 PLAN 게이트가
이 티켓에 대해 사실상 무력화돼 있다는 뜻이라 이번 참에 함께 고치는 편이 낫다. 그 외 발견은 모두
INFO 수준(측정 시점 미표기, PROJECT.md 카탈로그 누락)이며 기존 관행과 상충하지 않는다.

## 위험도

LOW
