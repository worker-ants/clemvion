# 요구사항(Requirement) 리뷰 — push 가드 worktree 스코프 (2차, 17_51_28)

## 검증 방법

정적 대조 외에 실측을 수행했다.

- `.claude/hooks/guard_review_before_push.py` 전체와 `_lib/review_guard.py::evaluate_review` /
  `_lib/plan_guard.py::evaluate_plan` 실제 시그니처를 직접 Read/Grep 해 `_accepts_cwd` probe 가
  실제 production 함수(둘 다 `cwd: str | None = None`)에 대해 `True` 를 반환함을 코드 레벨로 확인.
- `.claude/tests/test_push_guard_worktree_scope.py` 단독 실행: **18 tests, OK** (plan 체크리스트 ·
  RESOLUTION.md 의 "9 → 18건" 주장과 정확히 일치, `grep -c "def test_"` 로도 18 확인).
- harness 전체(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 재실행: **485 tests,
  OK** — plan 체크리스트·RESOLUTION.md 의 "485 passed" 주장과 일치.
- `_run_gate`/`_push_targets`/`_worktree_branches`/`_mentions_branch`/`_accepts_cwd` 전체를 라인
  단위로 Read, `main()` 배선과의 호출부 대조.

## 1차 리뷰(17_28_02) 반영 상태 — 코드 레벨 재검증

RESOLUTION.md 가 주장하는 7건의 WARNING 반영을 코드에서 직접 대조했다. 전부 실제로 반영되어 있다.

| # | 1차 WARNING | 코드상 반영 여부 |
|---|---|---|
| 1 | PLAN 게이트 스코핑 미검증 | 반영 확인 — `_PLAN_STUB.evaluate_plan(cwd=None)` 이 경로-키(`STUB_PLAN_BLOCKED_PATHS`) 방식으로 교체됐고 `test_plan_gate_is_scoped_too`(+2건) 가 실제로 PLAN 게이트의 scoped 분기를 탄다(테스트 통과 확인) |
| 2 | `_worktree_branches` fail-open 미검증 | 반영 확인 — `test_worktree_listing_failure_degrades_to_cwd`(비-git cwd) · `test_stale_worktree_entry_is_skipped`(삭제된 worktree) 모두 통과 |
| 3 | `_push_targets` 실패 폴백 미검증 | 반영 확인 — 위 2건이 `main()` 의 `except Exception: targets = [base_cwd]` 경로(524-539행 상당)를 실질적으로 커버 |
| 4 | REVIEW/PLAN 루프 DRY 위반 | 반영 확인 — `_run_gate()` 로 추출됨(494-520행), REVIEW(542-550행)/PLAN(553-561행) 양쪽에서 재사용 |
| 5 | `_accepts_cwd` 계약 미고정 | 반영 확인 — `AcceptsCwdContractTest.test_real_gates_accept_a_positional_cwd` 가 실제 `review_guard.evaluate_review`/`plan_guard.evaluate_plan` 을 import 해 `_accepts_cwd(...)  is True` 를 단언, 통과 |
| 6 | mutation 수치 오기재("5건" vs "9건") | plan 문서가 M3a(review만, 5건)/M3b(양쪽, 9건) 로 분리·각주 추가 — 코드 변경 불필요 항목이었고 실제로 코드는 변경되지 않음. plan 문서만 대조했고 두 수치 모두 서로 다른 mutation 에 대응한다는 설명이 근거와 일치 |
| 7 | 커맨드 길이 상한 부재 | 반영 확인 — `_push_targets` 진입부(439행) `command = command[:_MAX_REDACTION_INPUT]`, `test_oversized_command_still_checks_cwd`/`test_branch_mention_past_the_cap_is_not_scanned` 통과 |

## 발견사항

- **[INFO]** `_run_gate` 의 `base_cwd` 파라미터가 함수 본문에서 전혀 사용되지 않음(죽은 매개변수)
  - 위치: `.claude/hooks/guard_review_before_push.py` 494행(`def _run_gate(evaluate, bypass_env, targets, base_cwd, is_blocked, render) -> bool:`), 함수 본문 495-520행
  - 상세: `_run_gate` 시그니처에 `base_cwd` 가 5번째 위치 인자로 선언돼 있고 두 호출부(546행 REVIEW, 557행 PLAN)에서 실제로 `base_cwd` 를 전달하지만, 함수 본문 어디에서도 `base_cwd` 를 참조하지 않는다(`grep -n "base_cwd"` 로 직접 확인). 유일하게 관련된 문장은 509-510행 주석 "Unscoped legacy fallback evaluates the process cwd, so report that as the worktree rather than `base_cwd` (the payload's), which it never consulted." 인데, 이는 오히려 "왜 안 쓰는지"를 설명할 뿐 "그럼 왜 파라미터로 받는지"에는 답하지 않는다. 기능적으로는 무해하다 — `targets[0]` 이 이미 `_push_targets` 호출 시점에 `base_cwd` 와 동일한 값으로 채워지고(431-441행), unscoped 폴백 경로는 `os.getcwd()` 를 독립적으로 사용하므로 `base_cwd` 없이도 두 호출부 모두 정확히 동작한다(18건 테스트 전부 통과가 이를 뒷받침).
  - 제안: 조치 불요(회귀 위험 없음) 또는 후속 정리로 `_run_gate` 시그니처에서 `base_cwd` 파라미터 자체를 제거해 "이 함수가 실제로 무엇을 소비하는가"와 시그니처를 일치시킬 것을 권장. 기능 결함이 아니므로 이번 push 를 막을 사안은 아님.

- **[INFO]** 관련 spec 문서 없음 — 정상 (harness 전용 변경, 1차 리뷰와 동일 결론 재확인)
  - 위치: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_worktree_scope.py` 전체
  - 상세: `spec/` 및 `.claude/docs/` 를 grep 한 결과 이 push 가드 훅의 worktree 스코핑 행위를 규정하는 `spec/` 문서는 없다(`guard_review_before_push` 를 참조하는 문서는 `plan-lifecycle.md`·`orchestrator-workflow-migration.md` 뿐이며 둘 다 파일 존재만 언급, 이번 fix 의 상세 행위와는 무관). CLAUDE.md 폴더 구조상 `spec/` 는 `codebase/` 제품 정의이고 `.claude/` harness 자동화는 범위 밖이므로 기대된 결과다. 대신 `plan/in-progress/push-guard-worktree-scope.md` 가 설계 문서 역할을 하며, 본문(문제 정의 §·설계 §·"시그니처 probe 가 load-bearing" §·Rationale §)과 실제 구현을 라인 단위로 재대조한 결과 서술된 항목(`_push_targets`/`_mentions_branch`/`_accepts_cwd`/`worktree:` 메시지 라인) 전부가 코드에 정확히 반영돼 있다.
  - 제안: 조치 불요.

## 요약

이번 2차 리뷰 대상은 1차 리뷰(17_28_02)에서 발견된 CRITICAL 0 / WARNING 7건에 대한 실제 코드 수정이다. 7건 전부를 코드·테스트 레벨에서 직접 대조·재실행한 결과 주장대로 반영되어 있음을 확인했다(`_run_gate` 추출, PLAN 스코핑 테스트, fail-open 폴백 테스트 2건, `_accepts_cwd` 계약 테스트, 길이 상한 적용, plan mutation 표 분리). 핵심 기능(교차-worktree false-ALLOW 차단)은 여전히 정확히 구현되어 있고, 신규/전체 테스트(18건 단독, 485건 전체)를 직접 재실행해 전부 통과함을 확인했다. 새로 발견된 이슈는 `_run_gate` 의 죽은 파라미터(`base_cwd`) 하나뿐이며 기능적 영향은 없다(INFO). 회귀·반환값 누락·TODO/FIXME·엣지 케이스 미처리·spec 불일치는 발견되지 않았다.

## 위험도
LOW
