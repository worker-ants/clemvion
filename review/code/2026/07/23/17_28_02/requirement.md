# 요구사항(Requirement) 리뷰 — push 가드 worktree 스코프

## 검증 방법
정적 분석 외에 실제로 harness 전체 스위트(476 tests)를 재실행해 통과를 확인했고, `_accepts_cwd`
프로브를 무력화하는 mutation(`scoped = True` 고정)을 직접 주입해 `test_guard_review_before_push_main.py`
9건이 실제로 red 로 전환되는지 재현했다 (plan/코드 docstring 의 "9건" 주장 검증). 재현 후 `cp` 백업으로
원복하고 `git status --porcelain` 로 클린 상태를 재확인했다.

## 발견사항

- **[WARNING]** plan 의 mutation 실측표(M3 행)가 코드 자체의 docstring 및 실측과 모순된다 — "5건" 이 아니라 "9건"
  - 위치: `plan/in-progress/push-guard-worktree-scope.md:83` (`| M3 | ... | legacy 스위트 **5건** ... |`) vs `.claude/hooks/guard_review_before_push.py:409` (`_accepts_cwd` docstring: "an early draft of this change made all 9 blocking tests exit 0 instead of 2")
  - 상세: `_accepts_cwd` probe 를 제거하고 `scoped = True` 로 고정하는 동일한 mutation 을 직접 주입해 `test_guard_review_before_push_main.py` 를 재실행한 결과 **9건**이 실패했다(`test_bypass_review_still_enforces_plan_gate`, `test_push_blocked_by_review_gate`, `test_push_blocked_by_plan_gate_when_review_clean`, `test_review_gate_precedes_plan_gate`, `test_bypass_plan_still_enforces_review_gate`, `test_review_evaluate_exception_fails_open_and_runs_plan`, `test_review_import_failure_disables_only_that_gate`, `test_push_via_input_alias_key_is_detected` 등). 이는 코드 자체 docstring 의 "9건" 주장과 정확히 일치하지만, plan 문서의 mutation 실측표는 같은 mutation 을 "legacy 스위트 5건" 으로 과소 기록하고 있다. 코드는 옳고(실측 재현됨) plan 의 감사 기록만 어긋난 것 — `_accepts_cwd` 가 load-bearing 이라는 결론 자체는 맞지만 기록된 숫자가 코드/독립 재현과 다르면 감사 추적성이 훼손된다.
  - 제안: plan 문서 M3 행의 "5건" 을 "9건" 으로 정정(또는 실제 측정 시점에 어떤 서브셋을 셌는지 명시). 코드 수정 불필요 — plan 문서만 정정 대상(project-planner/developer 소관, 본 리뷰어는 spec 아님).

- **[INFO]** unscoped(legacy) fallback 경로에서 차단 메시지의 `worktree:` 값이 실제 평가된 cwd 와 불일치할 수 있음 (현재는 도달 불가능한 방어적 경로)
  - 위치: `.claude/hooks/guard_review_before_push.py:507-509`, `:516` (REVIEW), `:525-527`, `:536` (PLAN)
  - 상세: `evaluate_review`/`evaluate_plan` 이 `_accepts_cwd()` 검사를 통과하지 못하면(`scoped=False`) `evaluate_review()` 를 인자 없이 호출한다 — 이 legacy 호출은 게이트 함수 내부에서 `cwd = cwd or os.getcwd()` 로 **hook 프로세스의 실제 `os.getcwd()`** 를 평가 대상으로 삼는다. 그런데 이때 출력 메시지는 `worktree=target or base_cwd` → `target=None` 이므로 `base_cwd`(`payload["cwd"]`, 즉 Bash 툴이 알려준 cwd)를 표시한다. `os.getcwd()` 와 `payload["cwd"]` 는 이 변경이 고치려는 바로 그 간극(다른 worktree 에서 훅이 실행)일 때 서로 다를 수 있어, fallback 이 발동하면 메시지가 실제 평가 대상이 아닌 worktree 를 가리킬 수 있다. 실측 확인 결과 `_lib/review_guard.py:836`, `_lib/plan_guard.py:291` 의 실제 함수는 모두 `cwd: str | None = None` 을 받으므로 `_accepts_cwd` 는 항상 True 를 반환해 이 경로는 현재 프로덕션에서 도달하지 않는다(오직 `test_guard_review_before_push_main.py` 의 무인자 stub 에서만 연습됨, 그 테스트들은 `worktree:` 값을 assert 하지 않음).
  - 제안: 현재는 실질적 영향이 없으나, 향후 실제 게이트 함수의 시그니처가 바뀌어 이 fallback 이 다시 살아날 경우를 대비해 fallback 분기에서는 `worktree=os.getcwd()` 를 표시하도록 정정하면 메시지-실제평가 불일치를 원천 차단할 수 있음.

- **[INFO]** 커밋 메시지 등에 다수의 checked-out branch 이름이 언급되면 REVIEW/PLAN 게이트가 그 수만큼 직렬로 전체 git 평가(`evaluate_review`/`evaluate_plan`, 각각 여러 git subprocess 호출 포함)를 반복해 훅의 동기 실행 시간이 늘어날 수 있음
  - 위치: `_push_targets` (`.claude/hooks/guard_review_before_push.py:429-441`), `main()` 의 `for target in targets if scoped else [None]:` 루프 (`:507`, `:525`)
  - 상세: 설계 docstring(`:339-345`)은 "브랜치가 언급되면 그 worktree 도 평가된다 → 더 엄격해질 뿐 약해지지 않는다" 를 의도적 trade-off 로 명시하지만, 매칭되는 worktree 수에 상한이 없다. 현재 15개 worktree 규모(plan 본문 명시)에서 커밋 메시지가 여러 브랜치명을 나열하면(예: 체인지로그성 커밋) 그만큼 `evaluate_review()` 전체 파이프라인(diff/log/status 다중 git 호출)이 반복돼 지연이 누적될 수 있다. `_mentions_branch` 자체의 반복 스캔은 실측상 선형에 가까워(별도로 pathological 문자열로 재현 시도했으나 quadratic blow-up 미재현) 안전하지만, 매칭된 각 worktree 에 대한 `evaluate_review`/`evaluate_plan` 풀 실행 비용은 이 diff 범위 밖(기존 함수)이라 여기서 상한 없이 곱해진다.
  - 제안: 기능적 결함은 아님(회귀 아님, 상한 없는 성능 트레이드오프일 뿐). 필요시 `_push_targets` 가 반환하는 targets 수에 soft cap(예: cwd + 상위 N개)을 두는 것을 고려할 수 있으나, 현재 15개 규모에서는 실용적 영향이 낮아 즉시 조치 불요.

- **[INFO]** 관련 spec 문서 없음 — 정상 (harness 전용 변경)
  - 위치: `.claude/hooks/guard_review_before_push.py` 전체, `.claude/tests/test_push_guard_worktree_scope.py` 전체
  - 상세: `spec/` 를 grep 했으나 이 push 가드(`.claude/hooks/`)를 규정하는 spec 문서는 없다 — CLAUDE.md 폴더 구조상 `spec/` 는 제품(`codebase/`) 정의이고 harness 자동화(`.claude/`)는 그 범위 밖이라 기대된 결과다. 대신 `plan/in-progress/push-guard-worktree-scope.md` 가 설계 문서 역할을 하며, 본문(문제 정의 §, 설계 §, "시그니처 probe 가 load-bearing" §, Rationale §)과 실제 구현을 라인 단위로 대조한 결과 `_push_targets`/`_mentions_branch`/`_accepts_cwd`/메시지 `worktree:` 라인 추가 등 서술된 항목 전부가 코드에 그대로 반영돼 있다(위 mutation-count 항목 제외).
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트의 모듈 로딩이 README 에 문서화된 컨벤션(`_harness.load_module_by_path`)을 쓰지 않고 `sys.path.insert` + 평문 `importlib.import_module` 을 사용
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:205-209` (`MentionsBranchTest.setUp`)
  - 상세: `.claude/tests/README.md` "Conventions for new tests" 는 "Load harness modules via `_harness.load_module_by_path` when they would collide on the shared `_lib` package name" 를 명시하고, 같은 대상 모듈(`guard_review_before_push`)을 로드하는 `test_push_guard_allowlist.py:44-45` 는 이미 그 컨벤션을 따른다. 이 신규 테스트는 대신 `sys.path.insert(0, str(_harness.HOOKS_DIR))`(이미 `_harness` import 시점에 수행돼 중복) + `importlib.import_module("guard_review_before_push")` 를 쓴다. `HOOKS_DIR` 가 이미 `sys.path` 에 있고 `sys.modules` 캐싱 덕에 실제로는 정상 동작함을 전체 스위트(476 tests, OK) 로 확인했다 — 기능적 결함은 아니고 컨벤션 일관성 문제일 뿐이다.
  - 제안: 일관성을 위해 `_harness.load_module_by_path("guard_review_before_push", HOOK_SRC)` 로 통일 고려. 급하지 않음.

## 요약

핵심 기능(교차-worktree false-ALLOW 차단)은 정확히 구현되어 있고, `_push_targets`/`_mentions_branch`/`_accepts_cwd` 3개 신규 함수 모두 plan 문서의 설계 서술과 라인 단위로 일치한다. 신규 테스트 9건 + 기존 20건(main 엔트리포인트) + harness 전체 476건을 직접 재실행해 전부 통과를 확인했고, `_accepts_cwd` 프로브가 실제로 load-bearing 인지(제거 시 9건 red) 독립적으로 mutation 재현까지 마쳤다. 발견된 이슈는 모두 비차단급이다: (1) plan 자체의 mutation 실측표(M3 "5건")가 코드 docstring·독립 재현("9건")과 어긋나는 문서 정확도 문제(코드 결함 아님, plan 정정 대상), (2) 현재 프로덕션에서 도달 불가능한 legacy fallback 경로의 메시지 worktree 값 잠재적 불일치, (3) 매칭 worktree 수에 상한이 없어 발생 가능한 성능 스케일링 여지, (4) 신규 테스트의 모듈 로딩 컨벤션 미준수. 회귀·false-negative·반환값 누락·TODO/FIXME·spec 불일치(관련 spec 없음, harness 범위이므로 기대된 결과)는 발견되지 않았다.

## 위험도
LOW
