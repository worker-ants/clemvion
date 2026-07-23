# 테스트(Testing) 리뷰 — push-guard-worktree-scope

검증 방법: 프롬프트의 diff 는 크기 제한으로 일부 생략되어 있어, 실제 소스(`git diff origin/main...HEAD`
기준)와 `.claude/hooks/guard_review_before_push.py` / `.claude/tests/test_push_guard_worktree_scope.py`
전문을 직접 Read 하고, `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 실행해
회귀를 확인했다(538 tests, 1 실패 — 아래 참고, 본 diff 와 무관).

## 발견사항

- **[WARNING]** `_evaluate_over_targets` 의 `result is None` 분기가 테스트되지 않았고, 이 모듈이 스스로
  천명한 "fail-open 은 절대 침묵하지 않는다"(§E) 불변식과 충돌할 수 있는 상태로 방치되어 있다
  - 위치: `.claude/hooks/guard_review_before_push.py:627` (`_evaluate_over_targets` 안의
    `if result is None: continue`)
  - 상세: 이 diff 가 새로 추가한 분기다(`git diff origin/main...HEAD` 로 확인 — `+` 라인). 게이트 함수가
    `None` 을 반환하면 `continue` 로 건너뛰고, `answered = True` 로 표시하지 않는다. 그런데 만약 어떤
    target 에서도 verdict 를 못 얻어(`None`) 루프가 끝나면 그 게이트는 `outcome.answered` 에도
    `outcome.degraded` 에도 등재되지 않는다. `_lib/failopen_state.py::report()` 의 리셋 로직은
    `set(outcome.answered) != all_gates` 면 스트릭을 그대로 둔다(632-634행) — 즉 이 게이트는 배너도
    안 뜨고(침묵) 스트릭도 초기화되지 않는 채로 그냥 넘어간다. 이는 바로 이 파일 docstring 26-37행이
    "fail-open 은 관측되어야 한다, 침묵이 바로 이 메커니즘이 막으려는 실패다" 라고 못박은 원칙과
    정면으로 충돌하는 상태다. 실제로는 `evaluate_review`/`evaluate_plan` 이 `None` 을 반환하는 코드
    경로가 없어(직접 확인: `_lib/review_guard.py:836` `evaluate_review`, `_lib/plan_guard.py:291`
    `evaluate_plan` 모두 항상 dataclass 를 리턴) 오늘은 죽은 코드지만, 방어적으로 작성돼 있다는 것은
    작성자가 이 값을 유효한 리턴으로 염두에 뒀다는 뜻이고, 그렇다면 관측 불변식과의 상호작용이 검증
    없이 남아 있다. `test_push_guard_worktree_scope.py` 의 두 스텁(`_REVIEW_STUB`/`_PLAN_STUB`)도
    항상 dataclass 를 반환할 뿐 `None` 을 리턴하는 경로가 없다.
  - 제안: (a) 이 분기가 정말 도달 불가능하면 제거하고 `assert`/타입으로 "게이트는 항상 verdict 를
    반환한다" 를 명문화하거나, (b) 유효한 리턴값으로 유지한다면 스텁에 `None` 을 반환하는 케이스를
    추가해 "모든 target 이 None 을 반환하면 어떻게 되는가"(현재: 조용히 아무 일도 없음)를 테스트로
    고정하고, 이 상태가 §E 정책상 허용 가능한지(의도적 "관측 대상 아님" 인지, 아니면 `degraded` 로
    잡아야 하는지) 결정해서 docstring 에 남길 것.

- **[WARNING]** README 테스트 카탈로그와 테스트 docstring 이 병합(§`origin/main 재구조화 흡수`) 이후
  존재하지 않는 함수 이름 `_run_gate` 를 계속 참조
  - 위치: `.claude/tests/README.md:47` (표 행), `.claude/tests/test_push_guard_worktree_scope.py:247`
    (`test_per_target_fail_open_still_checks_remaining_targets` docstring)
  - 상세: 두 곳 모두 "`_run_gate`'s per-target `continue`" 라고 서술하지만, 실제 코드에는 `_run_gate`
    라는 이름의 함수가 없다(`grep -n "_run_gate\b" .claude/hooks/guard_review_before_push.py` 결과
    0건). plan 문서(`plan/in-progress/push-guard-worktree-scope.md`) 의 "origin/main 재구조화 흡수"
    절이 스스로 기록하듯, 이 브랜치가 추출했던 `_run_gate` 헬퍼는 병렬 세션(#999/#1000)이 들여온
    `_run_gates`(gate 오케스트레이션) + `_evaluate_over_targets`(per-target 루프, `None`/`continue`
    처리) 로 흡수되며 사라졌다. 코드는 갱신됐지만 두 문서(README 카탈로그, 테스트 docstring)의 이름은
    갱신되지 않았다. `.claude/tests/test_tests_readme_catalog.py` 는 README 행이 "존재하는 파일을
    가리키는가"(파일명)만 검사하고 행의 **본문 내용**은 검사하지 않으므로(직접 확인: `_ROW` 정규식은
    ``` `test_x.py` ``` 패턴만 파싱), 이 드리프트는 어떤 자동 가드에도 걸리지 않고 조용히 남는다.
    이 저장소가 반복적으로 겪은 "함수 이름으로 grep 했는데 안 나온다" 류 혼동을 그대로 재현할 소지가
    있다.
  - 제안: 두 곳을 `_evaluate_over_targets`(또는 `_run_gates`)로 정정. README 카탈로그는 이런
    코드-내부-식별자 참조가 리팩터 때마다 stale 해지기 쉬우므로, 가능하면 함수 이름보다 동작
    설명(예: "per-target fail-open 은 한 worktree 실패가 나머지 target 평가를 막지 않는다")으로
    서술하는 편이 이런 드리프트에 더 강건함.

- **[INFO]** `_PLAN_STUB` 의 스텁 dataclass 가 프로덕션 `PlanDecision` 의 필드를 완전히 미러링하지 않음
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:68-72` (`_Plan` 정의, 필드
    `untouched`/`reason`/`plan_path`) vs `.claude/hooks/_lib/plan_guard.py:78-84` (`PlanDecision`,
    필드 `untouched`/`complete_but_in_progress`/`reason`/`plan_path`)
  - 상세: 스텁은 `complete_but_in_progress` 필드가 없다. 오늘은 무해하다 — push 훅의 `_run_gates` 는
    `pl.untouched`/`pl.reason`/`pl.plan_path` 만 읽고(`guard_review_before_push.py:676-679`)
    `complete_but_in_progress` 는 Stop 훅 전용 SOFT 게이트 필드라 push 경로에서 참조되지 않는다.
    참조되더라도 `AttributeError` 는 `_evaluate_over_targets` 의 `except Exception` 에 걸려 안전한
    방향(fail-open, degraded 기록)으로 흡수된다. 그럼에도 스텁이 실제 프로덕션 타입의 부분집합이라는
    사실 자체는 향후 push 훅이 이 필드를 참조하게 될 때 조용한 실패(테스트는 여전히 통과, 실제 게이트만
    죽음)로 이어질 수 있는 mock-프로덕션 드리프트다.
  - 제안: 급하지 않음. 스텁에 `complete_but_in_progress: bool = False` 를 추가해 두면 향후 필드
    추가/참조 확장 시 이 스텁이 자동으로 유효한 채로 남는다.

- **[INFO]** 단일 push 명령이 2개 이상의 non-cwd worktree(branch)를 동시에 언급하는 시나리오가
  end-to-end 로 검증되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:459-477` (`_push_targets`, 여러 worktree를
    누적하는 for 루프) — 대응 테스트는 `.claude/tests/test_push_guard_worktree_scope.py` 전역(cwd
    + non-cwd 1개 조합만 등장)
    이 리포에는 setUp 에서 worktree 가 정확히 2개(`main_wt`, `side_wt`)만 만들어지므로, `targets`
    리스트가 3개 이상(cwd + 서로 다른 두 branch)으로 늘어나는 경로는 어떤 테스트에서도 만들어지지
    않는다. `_push_targets` 자체의 append/dedup 로직은 단순해 리스크는 낮지만("Order-stable,
    de-duplicated, cwd first" 는 docstring 상 명시적 계약인데 그 순서를 직접 단언하는 테스트도 없다),
    실제 사용 패턴(예: `git push origin A && git push other B` 같은 복합 명령)에 가장 가까운 케이스가
    미검증인 채로 남는다.
  - 제안: worktree 를 3개(cwd + branchA + branchB) 만들고 두 branch 를 모두 언급하는 명령으로
    `targets == [cwd, wt_a, wt_b]`(순서까지) 를 단언하는 테스트 1건 추가를 권장. 우선순위 낮음 — 기존
    mutation 매트릭스(M1-M9)가 핵심 분기는 이미 kill 확인함.

- **[INFO]** `BYPASS_PLAN_GUARD=1` 이 스코프된(cwd 아닌) target 의 PLAN 차단도 억제하는지는
  대칭적으로 검증되지 않음
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:184-203`
    (`test_bypass_still_applies_to_scoped_targets` — `BYPASS_REVIEW_GUARD` 만 검증)
  - 상세: `_run_gates`(`.claude/hooks/guard_review_before_push.py:663-683`)의 REVIEW/PLAN 두 분기는
    `os.environ.get(...) == "1"` 로 완전히 대칭 구조이므로 실제 리스크는 낮지만, 이 파일이 이미
    "PLAN 게이트도 REVIEW 와 동일하게 스코핑돼야 한다"(`test_plan_gate_is_scoped_too` — 1차 리뷰 지적을
    직접 겨냥해 추가된 테스트)는 원칙을 실천하고 있는 만큼, BYPASS 쪽도 같은 대칭성으로 커버하면
    감사 추적이 더 완결된다.
  - 제안: 급하지 않음 — 원한다면 `test_bypass_still_applies_to_scoped_targets` 를 파라미터화하거나
    `BYPASS_PLAN_GUARD` 버전을 1건 추가.

- **[INFO]** (본 diff 와 무관한 관찰) 전체 스위트 실행 시 `test_line_anchors.py::
  test_diff_blocks_are_annotated_and_correct` 1건이 실패하지만, `git diff origin/main...HEAD --stat --
  .claude/tests/test_line_anchors.py` 결과가 비어 있어(파일 자체가 이 브랜치에서 변경되지 않음) 이번
  코드 변경이 유발한 회귀가 아니다. 이 리뷰 라운드 자체가 review/ 히스토리 artifact 를 포함한 대형
  diff 라 그 self-referential 프롬프트-빌더 테스트의 임계치(`checked > 20`)에 우연히 걸린 것으로 보인다
  (오귀속 방지 차원에서만 기록, 조치 불필요).

## 검증한 항목 (양호)

- e2e 테스트가 실제 `subprocess.run([sys.executable, self.hook], ...)` 로 진짜 훅 프로세스를 띄우고,
  진짜 `git init`/`git worktree add` 로 만든 저장소를 대상으로 실행한다 — 내부 함수를 패치하는 대신
  블랙박스로 검증하는 견고한 접근. 스텁 게이트도 realpath 로 경로-키잉해 "cwd 가 아닌 다른 worktree 를
  실제로 평가했는가" 를 직접 증명한다(`test_false_allow_hole_is_closed`).
- `AcceptsCwdContractTest` 가 스텁이 아니라 **실제** `review_guard.evaluate_review`/
  `plan_guard.evaluate_plan` 을 import 해 `_accepts_cwd` 계약을 고정 — 이전 라운드(17_28_02
  WARNING 5, `architecture.md` 가 지적)의 실제 계약 미고정 갭을 정확히 닫았다.
- plan 문서에 mutation 실측(M1-M9, 8건이 아니라 9건 — merge 이후 `_evaluate_over_targets` 의 gate당
  degraded dedup 회귀를 M9 로 재확인)과 "뮤턴트를 심어 red 확인 전에는 커버된다고 쓰지 않는다"는
  자기교정 규율이 명시돼 있고, 직접 `python3 -m unittest discover` 로 재실행해 538 tests(1건은 본 diff
  와 무관한 실패)를 확인했다 — plan 의 "harness 전체 538 passed" 주장과 일치.
- 테스트 격리: 각 e2e 테스트가 `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree, ...)` 로 독립
  실행되고, streak 카운터를 건드리는 유일한 테스트(`test_degradation_is_counted_once_per_gate_not_
  per_target`)도 `CLAUDE_PROJECT_DIR=self.tmp` 로 실제 저장소의 상태 파일과 분리돼 있다. 실행 순서
  의존성 없음.
- 회귀: `test_guard_review_before_push_main.py`(무인자 스텁, legacy 경로) 등 기존 스위트가 이번
  `_evaluate_over_targets`/`_run_gates` 리팩터 후에도 전량 통과 — legacy(비-스코프) 호출 경로가
  깨지지 않았음을 직접 실행으로 확인.
- `_mentions_branch` 경계 매칭(`claude/foo` ≠ `claude/foo-abc`)이 전용 `MentionsBranchTest` 로 별도
  단위 검증되어 있고, 상한(`_MAX_REDACTION_INPUT`) 절단도 "상한 안쪽은 잡히고 바깥쪽은 안 잡힌다"는
  대조쌍으로 단언(`test_branch_mention_past_the_cap_is_not_scanned`)돼 상한 자체가 관측 가능하게
  고정돼 있다.

## 요약

테스트 설계·규율 수준은 이 저장소의 harness 코드 컨벤션 중에서도 상위권이다 — 실제 서브프로세스 +
실제 git worktree 를 쓰는 e2e, 4라운드에 걸친 리뷰-지적→테스트-추가 이력, mutation 실측(M1-M9)과
"뮤턴트로 red 확인 전엔 커버 주장 금지"라는 자기교정 규율이 plan 문서에 그대로 남아 있다. 회귀도 직접
전체 스위트를 실행해 확인했다(538 passed, 1건은 본 diff 와 무관). 남은 갭은 모두 비차단(WARNING 2건,
INFO 4건) 수준이다: (1) 이번에 새로 생긴 `_evaluate_over_targets` 의 `result is None` 분기가
테스트되지 않았고 이 모듈 스스로 강조하는 "fail-open 은 절대 침묵하지 않는다" 원칙과 상충할 수 있는
상태로 방치돼 있으며(오늘은 죽은 코드), (2) 병합 후 함수명이 바뀐 것을 README 카탈로그와 테스트
docstring 이 따라가지 못해 `_run_gate` 라는 존재하지 않는 이름을 계속 참조한다(자동 가드가 내용까지는
검사하지 않아 이 드리프트를 못 잡음). 나머지는 커버리지의 "여백"(다중-target 조합, BYPASS_PLAN_GUARD
대칭 케이스, 스텁-프로덕션 dataclass 필드 드리프트) 수준으로 즉각 조치는 불필요하다.

## 위험도
LOW
