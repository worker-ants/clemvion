# 유지보수성(Maintainability) Review

## 발견사항

- **[CRITICAL]** 새 `_default_branch_ref()` 만 이 파일의 git 에러 처리 컨벤션을 어겨 예외가 그대로 전파된다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1092-1101` (`_default_branch_ref`), 호출부 `:1104-1141` (`warn_if_committed_work_is_missing`), `:1182`(`collect_change_infos` 기본 경로), `:1337`(`main()`)
  - 상세: 이 파일에서 `_git([...])` 를 호출하는 지점은 총 11곳인데, `_default_branch_ref()` 안의 2곳(1094, 1098행)만 유일하게 `try/except` 로 감싸지 않았다. 나머지 9곳(`get_git_diff_files`, `get_git_diff_content`, `get_git_commit_files`, `get_git_commit_diff`, `get_git_range_files`, `get_git_range_diff`, `get_git_branch_diff_files`, `get_git_branch_diff`, `get_file_at_commit`) 은 전부 `try/except Exception as e: debug_log(...)` 로 `subprocess.TimeoutExpired`/`FileNotFoundError`/`OSError` 를 흡수하고 안전한 기본값을 반환한다. `_git()` 자체는 예외를 흡수하지 않는 얇은 wrapper(`subprocess.run(..., timeout=timeout)`)이므로, `_default_branch_ref()` 가 감싸지 않으면 git 타임아웃·바이너리 부재 시 예외가 그대로 `warn_if_committed_work_is_missing()` → `collect_change_infos()`(인자 없는 기본 `--prepare` 경로, 1182행) → `main()`(1337행)까지 전파되어 리뷰 준비 CLI 전체가 크래시한다. 이는 바로 위 `warn_if_committed_work_is_missing` 자신의 docstring 이 명시한 계약("Advisory only — never blocks... Silent on any git failure: a review must not fail because the warning could not be computed.")과 정면으로 어긋난다. 즉 "일관성(기존 스타일 준수)" 위반이 그대로 기능적 크래시 위험으로 이어지는 사례다.
  - 제안: `_default_branch_ref()` 본문을 다른 9개 헬퍼와 동일하게 `try/except Exception as e: debug_log(...)` 로 감싸고 실패 시 `None` 을 반환하도록 통일한다.

- **[WARNING]** `review_guard.py` 모듈 docstring 이 이번 수정으로 깨진 불변식("push guard 는 무조건 안 열린다")을 그대로 서술하고 있다
  - 위치: `.claude/hooks/_lib/review_guard.py:72-75` (모듈 docstring), 대조: 같은 파일 `:138-147`(`_IN_FLIGHT_TTL_SECONDS` 주석, 이번 diff 에서 정정됨), `:859-880`(`evaluate_review` docstring, 이번 diff 에서 신설)
  - 상세: 이번 fix 의 핵심은 "시작됐지만 끝나지 않은 리뷰 억제"가 실수로 push 게이트까지 무조건 열어버렸던 결함을, `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 opt-in 화해 Stop 가드에만 적용되도록 스코프를 좁힌 것이다. 이번 diff 는 이 정정을 `_IN_FLIGHT_TTL_SECONDS` 위 주석과 `_code_review_in_flight` docstring 두 곳에서는 정확히 반영했지만("The push guard is unaffected in the first place: the suppression only applies when the caller passes `in_flight_ok=True`..."), 파일 맨 위 모듈 docstring 은 그대로 남아 "a review that has *started but not finished* (...) suppresses **the gate** — the async `/ai-review` is mid-flight" 라고 쓰여 있다. `in_flight_ok` 로 스코프가 좁혀졌다는 언급이 전혀 없어, 독자가 이 문단만 보면 여전히 "억제가 gate 전체(=push 포함)에 적용된다" 는 방금 고친 바로 그 오류를 다시 믿게 된다. 이 PR 의 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`) 자체가 "주석 2곳이 둘 다 거짓 불변식을 적어 놨었다"고 지적한 바로 그 실패 패턴이 세 번째 자리에 남아있는 셈이다.
  - 제안: 72-75행을 "Stop 가드가 opt-in(`in_flight_ok=True`)할 때만 *nudge* 를 억제하며 push 게이트는 영향받지 않는다"는 취지로 정정한다.

- **[WARNING]** "기본 브랜치 ref 해석" 로직이 한 PR 안에서 세 번째로 독립 구현됐다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1092-1101` (신규 `_default_branch_ref`)
  - 상세: 이미 이 저장소엔 동일 개념("origin 의 기본 브랜치를 구하라")을 처리하는 정본 헬퍼 `branch_guard._origin_default_branch()` (`.claude/hooks/_lib/branch_guard.py:73-112`) 가 있고, `review_guard.py:197` 의 `_default_branch()` 가 이를 재사용한다. 그런데 이번 diff 가 추가한 `_default_branch_ref()` 는 이를 재사용하지 않고 `symbolic-ref` → `origin/main`/`origin/master` rev-parse 검증이라는 별도 fallback 체인을 새로 작성했다(반환 형태가 `origin/` 접두 유무로 달라 그대로 재사용은 어렵지만, 핵심 git 해석 로직 자체가 3번째로 중복됐다). 같은 문제 영역(`consistency_orchestrator.py:427`) 은 또 다른 세 번째 방식으로 `args.diff_base or "origin/main"` 리터럴 하드코딩을 쓴다. 세 곳이 서로 다른 알고리즘으로 같은 개념을 풀고 있어, 향후 저장소 기본 브랜치 정책이 바뀌면(예: `main`→`trunk`) 세 곳을 모두 찾아 고쳐야 하고 하나만 갱신되는 drift 위험이 있다.
  - 제안: 최소한 git 해석 알고리즘(symbolic-ref → 후보 ref 검증) 부분만이라도 공유 헬퍼로 뽑아 세 곳이 같은 우선순위 규칙을 따르게 한다.

- **[WARNING]** `prioritize_bundle_files(...)` 호출 블록이 두 분기에 그대로 복제됐다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:491-495` (`--impl-prep` 분기), `:504-508` (`--impl-done` 분기)
  - 상세: 두 블록은 인자(`scope_files`, `root`, `changed_rels=_branch_changed_rels(_rank_diff_base, root, target_path_rel)`, `plan_text=_rank_plan_text`)가 완전히 동일하다 — 서로 다른 `elif` 분기 안에 있다는 것만 다르다. `collect_context` 하단(555-558행)에서는 동일 패턴을 `_rank = dict(...)` 로 한 번 만들어 두 번 재사용하는 방식으로 이미 중복을 피했는데, 정작 먼저 나오는 두 분기에는 그 처리를 적용하지 않아 같은 함수 안에 "중복 회피"와 "중복 방치"가 공존한다.
  - 제안: `_prioritized(files, target_path_rel)` 같은 내부 헬퍼(또는 하단처럼 `dict(...)` 캡처)로 뽑아 두 분기가 호출만 하도록 통일한다.

- **[WARNING]** 동일 값을 계산하는 변수 두 개가 서로 다른 이름으로 공존한다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:427` (`_rank_diff_base = args.diff_base or "origin/main"`, 이번 diff 신설), `:512` (`diff_base = args.diff_base or "origin/main"`, 기존 코드)
  - 상세: 두 변수는 같은 함수(`collect_context`) 안에서 동일한 표현식으로 계산되며 항상 같은 값을 갖지만 이름이 다르다(`_rank_diff_base` vs `diff_base`). 지금은 우연히 무해하지만, 훗날 둘 중 하나(예: `--impl-done` 전용 diff-base 로직)만 바뀌면 "왜 두 변수가 다른가"를 조사해야 하는 혼란을 낳는다.
  - 제안: 함수 최상단에서 한 번만 계산해 두 자리 모두 그 변수를 참조하게 통합한다.

- **[INFO]** `collect_context` 가 이미 길었던 함수인데 이번 diff 로 더 길어졌다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:412-608` (약 196줄; origin/main 기준 344-511, 약 167줄)
  - 상세: 4개 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 분기 + 공용 코퍼스 수집이 이미 한 함수에 몰려 있었는데, 이번 diff 가 순위 매김(ranking) 관심사를 각 분기와 하단에 흩뿌려 추가하면서 분기 수·지역 변수 수가 더 늘었다. 기능적으로는 옳지만 이 함수의 순환 복잡도는 계속 상승 중이다.
  - 제안: 당장 리팩터링이 필요한 정도는 아니나, 다음 확장 전에 모드별 분기를 각각의 함수로 추출하는 것을 고려할 만하다.

- **[INFO]** 잘린 목록 개수 상한이 이름 없는 매직 넘버로 두 번 등장한다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1133` (`missing[:10]`), `:1136` (`len(missing) - 10`)
  - 상세: 두 자리 모두 캡 값 `10` 을 문자 그대로 반복한다. 이 파일이나 인접 파일 어디에도 유사한 이름 상수(`_MAX_LISTED_*` 류)가 없어 컨벤션 위반은 아니지만, 하나만 고치고 다른 하나를 놓치는 실수를 유발하기 쉬운 자리다.
  - 제안: `_MAX_LISTED_MISSING_FILES = 10` 같은 모듈 상수로 뽑는다.

- **[INFO]** `_rank_plan_text` 가 쓰이지 않는 모드에서도 무조건 계산된다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:428-430`
  - 상세: `plan/in-progress/` 하위 모든 `.md` 를 읽어 이어붙이는 이 계산은 `--impl-prep`/`--impl-done` 분기와 하단 공용 번들에서만 쓰이는데, 함수 최상단에서 `--spec`/`--plan` 모드 여부와 무관하게 항상 실행된다. 세션당 1회 실행되는 CLI 라 체감 비용은 미미하지만, "항상 계산되는 값"처럼 보여 실제 소비 지점을 찾기 번거롭게 한다.
  - 제안: 필요한 분기 안으로 lazy 하게 늦추거나, 최소한 주석에 "일부 모드에서는 미사용" 임을 명시한다(현재 주석은 "Read WITHOUT excluded" 이유만 설명하고 미사용 모드 언급이 없음).

- **[INFO]** `_default_branch_ref()` 의 git 해석 분기 자체는 단위 테스트가 없다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1092-1101`, 대조: `.claude/tests/test_review_changeset_warning.py:76` (`orch._default_branch_ref = lambda: ARG["base"]` 로 통째 mock)
  - 상세: 새 테스트 파일은 `_default_branch_ref` 를 항상 통째로 mock 하므로, 함수 내부의 4가지 실제 분기(symbolic-ref 성공 / 실패 후 origin/main 존재 / 실패 후 origin/master 존재 / 전부 실패) 는 어디에서도 직접 검증되지 않는다.
  - 제안: 위 CRITICAL 항목의 try/except 보강과 함께, `_git` 를 patch 해 4가지 분기를 직접 pin 하는 소규모 단위 테스트를 추가한다.

## 요약

이번 diff(11개 파일, review-guard/orchestrator 계열 harness 코드)는 전반적으로 근거·회귀 배경을 docstring/주석에 충실히 남기고 각 수정마다 대응하는 테스트(`test_review_guard_hardening.py`, `test_stop_guard_failopen.py`, 신규 `test_consistency_bundle_priority.py`·`test_review_changeset_warning.py`)를 갖춰 유지보수성 측면에서 전반적으로 양호하다. 다만 세 가지 축의 결함이 발견됐다: (1) 새로 추가된 `_default_branch_ref()` 가 같은 파일의 다른 9개 git 헬퍼가 전부 지키는 예외 처리 컨벤션을 유일하게 어겨, "advisory only, never fails" 라는 자신의 계약을 실제로 깰 수 있는 크래시 경로를 남겼다(CRITICAL). (2) `review_guard.py` 는 이번에 고친 "in-flight 억제가 push 게이트까지 열던" 불변식 오류를 두 곳(주석·`_code_review_in_flight` docstring)에서는 정확히 정정했지만, 정작 가장 먼저 읽히는 모듈 최상단 docstring 은 옛 서술을 그대로 남겨 동일한 오해를 재생산할 소지가 있다. (3) "기본 브랜치 해석"과 "번들 우선순위 매김 호출"이 각각 3중 재구현·2중 복제로 흩어져 있어 향후 drift 위험을 안고 있다. 전부 국소적이고 고치기 쉬운 지점이며, 특히 CRITICAL 항목은 다른 9곳과 동일한 try/except 패턴만 적용하면 해결된다.

## 위험도

HIGH
