# 테스트(Testing) 리뷰

대상: `guard_review_before_push.py` 교차-worktree 스코핑 fix (3차 리뷰 라운드).
`.claude/tests/test_push_guard_worktree_scope.py`(19건) + 기존
`test_guard_review_before_push_main.py`(15건) + `test_push_guard_allowlist.py` 확인.
로컬 재실행 확인: `python3 -m pytest .claude/tests/` → **486 passed / 253 subtests**
(plan/RESOLUTION 의 수치와 일치). 대상 파일만 재실행해도 **39 passed / 4 subtests**.

## 발견사항

- **[WARNING]** `main()`의 `_push_targets` 예외 폴백 경로가 실제로는 테스트되지 않음 —
  RESOLUTION.md 의 "커버됨" 주장이 부정확
  - 위치: `.claude/hooks/guard_review_before_push.py:535-539`
    ```python
    try:
        targets = _push_targets(command, base_cwd)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        targets = [base_cwd]  # fail open to legacy single-worktree behaviour
    ```
  - 상세: `review/code/2026/07/23/17_28_02/RESOLUTION.md` WARNING 3 은 "`_worktree_branches`
    fail-open" 을 검증하는 `test_worktree_listing_failure_degrades_to_cwd` /
    `test_stale_worktree_entry_is_skipped` 두 테스트가 "같은 경로를 커버" 한다고 적었다.
    그러나 두 테스트 모두 `_worktree_branches` **내부**의 fail-open(`except Exception: return
    []` / `git worktree list` non-zero exit)만 태우며, 이 경우 `_push_targets` 자체는
    예외 없이 정상 반환한다(`targets=[cwd]`). 즉 `main()` 의 이 `try/except`(535-539행)를
    실제로 트리거하는 테스트는 저장소 전체에 **없다**
    (`grep -rn "_push_targets\|monkeypatch" .claude/tests/*.py` → 정의부/설명 텍스트만 매칭,
    호출부를 강제로 raise 시키는 테스트 0건).
    이 경로는 이 PR 이 닫으려는 것과 **같은 클래스의 false-ALLOW 위험**을 안고 있다 — 예를
    들어 `targets = [base_cwd]` 를 `targets = []` 로 바꾸는 mutation(모든 게이트를 완전히
    건너뜀)이 있어도 어떤 테스트도 감지하지 못한다. plan 의 mutation 표(M1~M6)에도 이
    분기를 겨냥한 항목이 없다.
  - 제안: `_push_targets` 를 직접 monkeypatch(혹은 `os.path.realpath`/`_mentions_branch` 를
    실패하도록)해 `main()` 이 실제로 `except Exception` 분기를 타는 경로를 만들고, 그 상황에서
    "cwd 기준 검사는 여전히 살아있다"(폴백이 REVIEW/PLAN 게이트를 완전히 건너뛰지 않는다)를
    단언하는 테스트를 추가할 것. 최소한 RESOLUTION.md 의 커버리지 주장을 정정.

- **[INFO]** legacy(unscoped) 폴백에서 렌더링되는 `worktree:` 값의 정확성(`os.getcwd()`)을
  직접 assert 하는 테스트가 없음
  - 위치: `_run_gate` 렌더 호출부(`guard_review_before_push.py:511-518`), 소비하는 테스트는
    `test_guard_review_before_push_main.py` 전체(스텁이 전부 무인자라 이 파일의 15건 전부
    unscoped 경로를 태움)
  - 상세: 이전 라운드 INFO 3 이 "legacy fallback 의 `worktree:` 표시를 `base_cwd` 대신 실제
    평가 대상인 `os.getcwd()` 로 정정" 했다고 기록돼 있다(942412ea3 diff 상으로도 그렇게
    바뀜). 그런데 `test_guard_review_before_push_main.py` 의 어떤 테스트도 stderr 의
    `worktree:` 줄 값을 확인하지 않는다(`grep -n "worktree:" test_guard_review_before_push_main.py`
    → 0건). 향후 누군가 `os.getcwd()` 를 다시 `target`(unscoped 루프에서는 `None`)으로
    되돌려도 기존 15건은 전부 green 으로 남는다.
  - 제안: 그 파일의 아무 blocking 테스트 1건에
    `self.assertIn(f"worktree:  {os.getcwd()}", r.stderr)` 류의 단언을 추가해 이 특정
    정정을 고정.

- **[INFO]** `_worktree_branches` 의 detached-HEAD 워크트리 파싱(“branch ” 라인이 없는
  엔트리를 건너뜀)이 코드 리딩으로만 검증되고 테스트로 고정되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:372-383` (porcelain 파싱 루프)
  - 상세: `git worktree add --detach` 로 만든 워크트리는 `branch ` 라인이 없어 `path`가
    다음 `worktree ` 라인까지 리셋되지 않는다. 현재 로직은 다음 엔트리가 자신의 `path`를
    바로 덮어써서 정상 동작하지만(코드 리딩 확인), 실제 detached-HEAD 워크트리를 만들어
    "그 경로는 targets 후보에서 제외되고 나머지 파싱은 안 깨진다"를 확인하는 e2e 케이스는
    없다. 이 저장소는 워크트리 기반 워크플로(reaper, 리뷰 워크트리 등)라 detached HEAD 가
    드문 시나리오는 아니다.
  - 제안: `PushGuardWorktreeScopeTest.setUp` 에 `git worktree add --detach <dir>` 워크트리를
    하나 추가하고, 그 이름이 없는데도 `_worktree_branches`/`_push_targets` 가 정상 동작함을
    확인하는 테스트 1건.

- **[INFO]** `_accepts_cwd` 의 `except Exception: return False` 분기(427-428행)가 미검증
  - 상세: `AcceptsCwdContractTest` 는 positional-cwd / keyword-only / zero-arg 세 시그니처는
    고정하지만, `inspect.signature()` 자체가 실패하는 callable(일부 C 확장 함수 등)에 대한
    안전 degrade 는 테스트되지 않는다. 실사용 경로(`evaluate_review`/`evaluate_plan` 은
    항상 순수 Python 함수)상 위험은 낮아 우선순위는 낮음.
  - 제안: 선택 사항. `_accepts_cwd(some_builtin_without_signature)` 케이스 1건 추가 고려.

- **[INFO]** plan 체크리스트의 "테스트 **18건** 신설" 표기가 최신 커밋 이후 실제 수치(19건)와
  불일치
  - 위치: `plan/in-progress/push-guard-worktree-scope.md:85`
  - 상세: `grep -c "    def test_" .claude/tests/test_push_guard_worktree_scope.py` → 19.
    커밋 `942412ea3` 메시지 자체는 "테스트 18 → 19건" 으로 정확히 기록했으나, plan 본문
    체크리스트는 이전 라운드(17_28_02) 시점 숫자 그대로 남아 있다. 차단 사유는 아니며
    testing 관점에서 "테스트 존재 여부/개수" 서술의 사실성 문제로만 기록.
  - 제안: 체크리스트 항목을 "19건" 으로 갱신.

- **[INFO]** 여러 target 이 동시에 block 될 때 어느 target 이 먼저 보고되는지(cwd-first
  순서 계약)를 직접 단언하는 테스트가 없음
  - 위치: `_push_targets`(431-449행, "cwd 항상 첫 원소" docstring) + `_run_gate` 의
    순차 순회(511행)
  - 상세: `test_per_target_fail_open_still_checks_remaining_targets` 는 cwd 가 raise, 두
    번째 target 이 block 되는 케이스라 순서를 간접적으로만 증명한다. cwd 와 named-branch
    worktree 둘 다 동시에 "block" 상태일 때 항상 cwd 쪽 메시지가 먼저 나오는지(디버깅
    편의성과 직결)는 명시적으로 고정돼 있지 않다.
  - 제안: 선택 사항 — 결정론적 순서 계약이 중요하다면 최소 1건 추가.

## 긍정적인 부분 (테스트 설계 관점)

- 실제 git 저장소 + linked worktree 를 만들어 subprocess 로 실제 훅을 구동하는 e2e 설계는
  이 파일의 blind-matching 철학과 일관되고, mock 이 실제 동작(`git worktree list
  --porcelain` 출력 형식)에서 유리되지 않는다.
- 두 테스트 파일의 스텁 시그니처가 정확히 실제 `evaluate_review(cwd=None)` /
  `evaluate_plan(cwd=None)` 계약을 반영하고 있고, 그 자체를 `AcceptsCwdContractTest` 로
  실제 함수에 대해 고정한 설계(스텁-실물 드리프트 가드)는 이 종류의 "가짜 커버리지"를
  막는 좋은 패턴.
- `_run_gate` 추출 후에도 게이트 격리 · target 단위 fail-open 두 불변식을 각각 겨냥한
  전용 테스트(`test_bypass_still_applies_to_scoped_targets`,
  `test_per_target_fail_open_still_checks_remaining_targets`)가 있어 회귀 방지력이 높음.
- 각 테스트가 `tempfile.mkdtemp()` + `addCleanup`으로 완전히 격리되어 있고, 서로의 git
  상태에 의존하지 않음 — 순서 무관 독립 실행 가능.
- `test_branch_mention_past_the_cap_is_not_scanned` 가 "cap 밖은 안 잡힘" 과 "cap 안쪽은
  잡힘"을 대조쌍으로 넣어, cap 자체가 없어지거나 과도하게 좁아지는 회귀를 모두 잡는
  이중 단언 설계는 특히 견고함.
- 실측: 대상 테스트 39건, harness 전체 486건 모두 green — 회귀 없음.

## 요약

핵심 fix(교차-worktree false-ALLOW 차단)와 그 직접 위험 경로(PLAN 스코핑, per-target
fail-open, `_accepts_cwd` 시그니처 계약, 길이 상한)는 이미 2차례 리뷰를 거치며 실제
mutation 실측으로 뒷받침된 전용 테스트로 잘 고정되어 있다. 다만 `main()` 레벨의
`_push_targets` 예외 폴백(535-539행)은 RESOLUTION.md 가 "커버됨"이라 기재했음에도 실제로는
어떤 테스트도 도달하지 못하는 경로이며, 이 지점이 실패하면 이 PR 이 막으려는 것과 동일한
false-ALLOW 클래스가 재발할 수 있어 문서상 커버리지 주장을 정정하고 전용 테스트를
추가할 가치가 있다. 나머지는 detached-HEAD 파싱·legacy 메시지 값·테스트 개수 표기 등
저위험 엣지케이스/문서 정확성 수준의 갭이다.

## 위험도

LOW
