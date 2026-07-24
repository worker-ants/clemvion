# 테스트(Testing) 리뷰 — push 가드 worktree 스코프 (2차, `_run_gate` 추출 이후)

이 라운드는 1차 리뷰(17_28_02) 반영분 위에서 진행된다. 1차 WARNING 1~5·7 은 RESOLUTION.md 대로 실측
재확인됨: 신규 테스트 18건(`test_push_guard_worktree_scope.py`) + 기존 20건
(`test_guard_review_before_push_main.py`, 무변경) 을 직접 재실행해 전부 green 확인했다(로컬 재현,
`python3 -m unittest discover`). `AcceptsCwdContractTest`(WARNING 5)·`test_plan_gate_is_scoped_too`
(WARNING 1)·`test_worktree_listing_failure_degrades_to_cwd`/`test_stale_worktree_entry_is_skipped`
(WARNING 2/3)·`_MAX_REDACTION_INPUT` 절단 테스트 2건(WARNING 7) 모두 실제로 대상 코드를 자극함을
확인했다. 이번 라운드는 그 위에서 신설된 `_run_gate()` 자체와 잔여 갭을 점검한다.

## 발견사항

- **[WARNING]** `_run_gate` 의 "per-target fail-open" 불변식(docstring 이 스스로 "load-bearing" 이라
  명시한 두 불변식 중 2번) 이 어떤 테스트로도 검증되지 않음 — 뮤테이션으로 실측 확인(0/38 실패)
  - 위치: `.claude/hooks/guard_review_before_push.py:494-520`(`_run_gate`), 특히 `:511-519`
    (per-target 루프의 `try/except Exception: continue`)
  - 상세: `_run_gate` 는 스스로 "target 단위 fail-open — 한 worktree 의 내부 오류가 그 worktree 만
    건너뛰고 나머지 target 은 계속 검사된다" 를 load-bearing invariant 로 문서화하지만, 이를 **2개
    이상의 target 이 있는 상태에서 그중 하나의 `evaluate()` 호출이 실제로 예외를 던지는** 케이스로
    검증하는 테스트가 어디에도 없다.
    - `test_guard_review_before_push_main.py` 의 `raise`/`import_error` 케이스들(`test_review_evaluate_exception_fails_open_and_runs_plan` 등)은 전부 **무인자 스텁**(`def evaluate_review():`)을 쓴다 → `_accepts_cwd` 가 False 로 판정해 `targets if scoped else [None]` 이 `[None]` 이 되어 루프가 **정확히 1회** 돈다. 즉 "나머지 target 은 계속 검사된다" 는 애초에 검증할 대상(target)이 하나뿐이라 원리적으로 확인 불가능하다.
    - `test_push_guard_worktree_scope.py` 의 `_REVIEW_STUB`/`_PLAN_STUB` 은 `cwd` 를 받는 scoped 스텁이라 2개 이상 target 이 만들어지지만, 이 스텁들은 **절대 예외를 던지지 않는다**(경로 존재 여부로만 분기) — 따라서 scoped 다중-target 경로에서 "한 target 이 raise 해도 다음 target 은 정상 평가된다"는 시나리오 자체가 어느 테스트에도 없다.
    - **실측(직접 재현)**: `_run_gate` 의 `continue  # fail open on internal error` 를
      `return False  # abort the whole gate instead of skipping the target` 로 치환(원복은 `cp`
      백업 → 절대경로 복원, 복원 후 `git diff` 0줄 확인)한 뒤 `test_push_guard_worktree_scope.py`
      18건 + `test_guard_review_before_push_main.py` 20건을 재실행 — **38건 전부 green**. 즉 이
      변형(첫 target 에서 예외가 나면 이후 target 을 아예 검사하지 않고 gate 전체를 통과시킴)이 어떤
      테스트에도 잡히지 않는다.
    - 이 불변식이 깨졌을 때의 실제 결과는 이 PR 이 닫으려는 바로 그 결함(false ALLOW)의 재발이다:
      cwd(첫 target)에서 `evaluate_review(cwd)` 가 우연히 내부 오류를 던지면(예: 그 worktree 의
      `.git` 메타데이터가 일시적으로 이상 상태), push 실제 대상인 두 번째 target(명령이 이름을 언급한
      branch 의 worktree)이 미리뷰 상태여도 검사되지 않고 통과한다 — plan 문서의 mutation
      표(M1~M5)에도 이 케이스는 없다.
  - 제안: `test_push_guard_worktree_scope.py` 에 REVIEW 또는 PLAN 스텁을 "특정 경로에서만 raise" 하도록
    확장한 시나리오 1건을 추가 — cwd 는 스텁이 예외를 던지도록, side worktree(명령이 이름을 언급한
    branch)는 dirty 로 설정하고, 훅이 여전히 `returncode == 2`(side worktree 를 검사해 block)임을
    단언. 이것이 `_run_gate` 의 두 번째 load-bearing invariant 를 실제로 pin 하는 유일한 테스트가 된다.

- **[INFO]** (1차 대비 잔존, deprioritized) `_push_targets` 가 명령이 **2개 이상**의 worktree branch 를
  동시에 언급하는 케이스(order-stable·dedup 계약) 여전히 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py:431-449`(`_push_targets`)
  - 상세: RESOLUTION.md 가 SUMMARY INFO 13 으로 이미 "미조치(선택)" 분류한 항목으로, 이번 라운드에서도
    코드·테스트 모두 변화 없음(재확인만). docstring 의 "Order-stable, de-duplicated, cwd first" 계약
    자체를 자극하는 테스트는 여전히 없다. 차단 사유는 아니며 재차 지적하지 않는다 — 재확인 기록용.

- **[INFO]** (1차 대비 잔존) `_worktree_branches` 의 porcelain 파서가 **detached HEAD** worktree(그 블록에
  `branch ` 줄이 없는 경우) 를 만나는 경로가 직접 자극되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:370-383`
  - 상세: 코드를 직접 추적하면 각 worktree 블록이 항상 `worktree <path>` 줄로 시작해 `path` 를
    매번 덮어쓰므로, detached 항목(뒤이어 `branch ` 줄이 없는 경우) 이 다음 정상 항목의 `path`/`branch`
    짝짓기를 오염시키지는 않는 것으로 보인다(pure 코드 리딩 기준, 버그 아님). 다만 이 경로를 실제
    porcelain 텍스트로 자극하는 테스트가 전혀 없어, 향후 파서가 리팩터될 때(예: `path=None` 리셋
    위치가 옮겨지는 변경) 조용히 깨질 수 있는 지점이다. 낮은 우선순위.
  - 제안: `_worktree_branches` 의 subprocess 호출부만 별도로 분리하거나(현재는 subprocess+파싱이
    한 함수), 캔 porcelain 텍스트 문자열(파일에 상수로 인라인)을 파싱하는 순수 단위 테스트를 추가하면
    실제 detached worktree fixture 없이도 이 분기를 pin 할 수 있음. 선택.

- **[INFO]** (1차 대비 잔존) `MentionsBranchTest`/`AcceptsCwdContractTest` 의 `setUp` 이 프로젝트 컨벤션
  (`.claude/tests/README.md` 의 `_harness.load_module_by_path`) 대신 수동 `sys.path.insert` +
  `importlib.import_module` 사용
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:296-300`, `:333-340`
  - 상세: 1차 리뷰(INFO 12/SUMMARY)에서 이미 지적됐고 RESOLUTION.md 미조치 목록에는 명시되어 있지 않지만
    실제 diff 확인 결과 여전히 미반영 상태다. 기능 결함은 아니며(현재 이 훅 모듈명이 다른 곳과 충돌하지
    않음), `sys.modules` 캐시 오염 가능성만 있는 위생 이슈.
  - 제안: 조치 불요(낮은 가치) 또는 `_harness.load_module_by_path` 로 통일.

## 검증한 항목 (문제 없음)

- 신규 테스트 18건 + 기존 20건(무변경) 을 직접 재실행 — 전부 green, RESOLUTION.md 의 "485 passed /
  253 subtests" 주장과 상충하지 않음(로컬은 두 파일만 discover 했으나 결과 일치).
- 테스트 격리: 각 테스트가 `tempfile.mkdtemp()` + `self.addCleanup(shutil.rmtree, ..., ignore_errors=True)` 로 독립된 실제 git 저장소를 만들고, env 변수(`STUB_*_BLOCKED_PATHS`, `BYPASS_*`)를 매 호출마다
  명시적으로 pop/set 해 부모 셸 환경 누수를 차단한다. 순서 의존성 없음.
- Mock 적절성: `_REVIEW_STUB`/`_PLAN_STUB` 이 실제 `evaluate_review`/`evaluate_plan` 의 반환 dataclass
  필드(`blocked`/`reason`, `untouched`/`reason`/`plan_path`)를 그대로 미러하고, `AcceptsCwdContractTest`
  가 실제 `_lib/review_guard.py`/`_lib/plan_guard.py` 를 import 해 시그니처 계약을 직접 대조하므로
  mock 과 실제 구현의 괴리 위험이 낮다.
- 회귀: `test_guard_review_before_push_main.py`(무인자 스텁, unscoped 경로)는 diff 대상이 아님에도
  `_run_gate` 추출 후 20건 전부 그대로 통과 — 리팩터가 legacy(unscoped) 경로의 동작을 바꾸지 않았음을
  실측으로 확인.
- 가독성: 각 테스트 docstring 이 "무엇을 방지하는 회귀 핀인지"를 구체적으로 서술(예:
  `test_false_allow_hole_is_closed`, `test_branch_mention_past_the_cap_is_not_scanned` 가 대조 절반을
  같이 단언한다는 설명)해 의도 파악이 쉽다.

## 요약

`_run_gate()` 로의 추출과 1차 리뷰 WARNING 1/2/3/5/7 반영은 실측 재확인 결과 정확하다 — 새 테스트
18건이 주장한 경로를 실제로 자극하며, 기존 20건도 회귀 없이 통과한다. 다만 `_run_gate` 자신이 명시한
두 load-bearing invariant 중 "target 단위 fail-open"(하나의 worktree 평가가 예외를 던져도 나머지
worktree 는 계속 검사된다)은 어떤 테스트로도 검증되지 않으며, 직접 뮤테이션(`continue`→`return False`)
을 적용해 재현한 결과 38건 전원이 통과해 이 갭이 실재함을 확인했다. 이 불변식이 깨지면 정확히 이 PR
이 닫으려던 false-ALLOW 결함이 재발하므로(첫 target 평가 중 우연한 내부 오류가 실제 push 대상
worktree 검사를 통째로 무력화) WARNING 으로 분류한다. 그 외 잔여 갭(다중-branch 언급, detached HEAD
파싱, 테스트 컨벤션 미준수)은 1차에서 이미 저위험으로 분류된 항목의 재확인이며 신규 결함은 아니다.

## 위험도
MEDIUM
