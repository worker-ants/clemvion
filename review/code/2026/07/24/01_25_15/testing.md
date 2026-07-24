### 발견사항

- **[WARNING]** `BYPASS_PLAN_GUARD`가 scoped(multi-worktree) PLAN 차단을 억제하는지 검증하는 테스트가 없음 (REVIEW 쪽과 비대칭)
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py` — `test_bypass_still_applies_to_scoped_targets` (196번 줄 부근, REVIEW gate 전용)
  - 상세: 같은 파일에 `test_bypass_still_applies_to_scoped_targets`(REVIEW gate가 다른 worktree를 차단할 때 `BYPASS_REVIEW_GUARD=1`이 그 차단을 억제하는지 확인)는 있지만, `BYPASS_PLAN_GUARD=1`이 `test_plan_gate_is_scoped_too`(222번 줄, `plan_blocked_paths=[self.side_wt]`)가 만드는 동일한 scoped PLAN 차단을 억제하는지 확인하는 대응 테스트가 없다. `.claude/hooks/guard_review_before_push.py`의 `_run_gates`(704번 줄)는 REVIEW·PLAN 두 gate를 완전히 대칭 구조(`os.environ.get("BYPASS_*_GUARD") == "1"` → `_evaluate_over_targets` 호출)로 처리하므로 오늘은 실제 버그일 가능성은 낮지만, 이 테스트 스위트 자체가 "PLAN 쪽이 REVIEW 쪽 대비 테스트가 비어 있었다"는 정확히 같은 패턴을 이미 한 번 실측했다(같은 파일 223번 줄 `test_plan_gate_is_scoped_too`의 docstring: "it was the untested half of the fix (review 17_28_02 WARNING 1)"). `test_guard_review_before_push_main.py`의 `BYPASS_PLAN_GUARD` 테스트는 no-arg 스텁(`_accepts_cwd`가 False로 판정하는 legacy 경로)만 사용하므로 scoped 경로를 대신 커버하지 못한다(동일 파일 상단 주석 "the stub gates ... take no argument" 참고 — `guard_review_before_push.py` 495-497번 줄도 이 사실을 명시).
  - 제안: `test_bypass_still_applies_to_scoped_targets` 옆에 대칭 테스트(`plan_blocked_paths=[self.side_wt]` + `BYPASS_PLAN_GUARD=1` → returncode 0)를 추가해 두 gate의 override 대칭성을 pin.

- **[INFO]** `_evaluate_over_targets`의 `result is None` 방어 분기가 pin 테스트 없이 남아 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:646-653` (`if result is None: ... continue` — 주석에 §E streak 의미론까지 상세 서술)
  - 상세: 주석은 "이 gate가 아무것도 답하지 않았다면 `answered`를 세우면 안 된다"는 명시적 불변식을 설명하지만, 이를 실제로 검증하는 테스트가 없다. 이 파일의 다른 방어 분기들(예: `test_per_target_fail_open_still_checks_remaining_targets`의 `continue`→`return False` mutation, `test_degradation_is_counted_once_per_gate_not_per_target`의 per-target dedup)은 "이 mutation이 나머지 테스트를 모두 green으로 통과시켰다"는 서술과 함께 명시적으로 pin되어 있는데, 이 분기만 예외로 남아 있다.
  - 제안: `evaluate_review(cwd=None) -> None`을 반환하는 스텁으로 "None을 반환한 target은 `outcome.answered`에 그 gate를 추가하지 않는다"를 pin하는 테스트를 추가(현재는 "어느 gate도 None을 반환하지 않는다"는 전제 때문에 dead code이지만, 향후 gate 구현이 바뀌면 조용히 §E streak 로직이 깨질 수 있음).

- **[INFO]** `_accepts_cwd`의 `except Exception: return False` 분기 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py:471-472`
  - 상세: `AcceptsCwdContractTest`(`test_push_guard_worktree_scope.py` 524번 줄)는 실제 gate 함수·keyword-only·zero-arg 세 가지 시그니처는 pin하지만, `inspect.signature(fn)`이 자체적으로 raise하는 callable(예: 일부 C-구현 built-in)에 대한 fallback 경로는 다루지 않는다. 이 hook은 매 push마다 동기 실행되는 gate라 방어적 fallback이 실제로 도달할 확률은 낮지만, `_accepts_cwd`의 docstring이 이 fallback을 "silently disabled gate"를 막기 위한 명시적 설계 의도로 서술하고 있는 만큼(490-499번 줄) 대응 pin이 있으면 그 의도가 코드 변경에도 살아남는다.
  - 제안: `inspect.signature`가 raise하도록 만드는 최소 stub(예: `functools.partial`이 아닌, `__signature__` 프로퍼티가 raise하는 클래스)로 `_accepts_cwd(...) is False`를 pin. 우선순위는 낮음.

- **[INFO]** `_worktree_branches`의 `except Exception: return []`(subprocess 자체가 raise하는 경로) 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py:413-415`
  - 상세: `test_worktree_listing_failure_degrades_to_cwd`(`test_push_guard_worktree_scope.py` 391번 줄)는 `git worktree list`가 non-zero returncode를 내는 케이스(`nogit` 디렉터리)만 실사용으로 커버한다. `subprocess.run` 자체가 예외를 던지는 경로(예: `subprocess.TimeoutExpired`, `git` 바이너리 부재 시 `FileNotFoundError`)는 실 환경에서 재현이 어려워 테스트가 없다. 이 hook의 다른 subprocess 호출(`_MAX_REDACTION_INPUT`, 5초 timeout 등)은 hang 방지 목적의 명시적 설계인데, 그 fallback이 실제로 `[]`를 반환하는지는 코드 리딩으로만 확인 가능한 상태.
  - 제안: `subprocess.run`을 monkeypatch해 `TimeoutExpired`를 raise시키는 unit 테스트(hermetic, `unittest.mock.patch`)를 별도로 추가하면 이 경로만은 mock 기반으로 pin 가능. e2e 스위트 철학(실제 git 사용)과는 다른 예외로 취급.

### 회귀·검증 결과 (참고)

`python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py'` 23건 전체 통과, `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 하네스 전체 540건도 통과(관측된 `⚠️ stop guard: 게이트가 판정하지 못하고...` 출력은 fail-open 정책을 검증하는 테스트 자신의 의도된 stdout이며 실패 아님). 기존 테스트는 변경 후에도 유효하다.

### 요약

`.claude/hooks/guard_review_before_push.py`의 worktree scoping 추가분은 이 harness 전체를 통틀어 손꼽히게 두터운 테스트를 동반한다 — false-ALLOW 회귀 pin, PLAN gate 대칭 검증, per-target fail-open, §E streak 중복집계 방지, `_accepts_cwd` 시그니처 계약, 대용량 커맨드 truncation, stale worktree, 심볼릭 링크 등 경계 케이스까지 실측(실제 git repo/worktree, subprocess e2e)으로 pin되어 있고 mutation 근거(“N/N green 유지” 서술)도 각 테스트 docstring에 명시돼 있다. 실행 결과 새 테스트 23건과 하네스 전체 540건이 모두 통과해 회귀 문제는 없다. 발견된 갭은 모두 방어적/희귀 분기 수준이며, 그중 `BYPASS_PLAN_GUARD`의 scoped-target 비대칭 커버리지 하나만 이 코드베이스 자신의 과거 이력(동일 클래스의 버그가 REVIEW/PLAN 비대칭으로 이미 한 번 발생)에 비추어 WARNING으로 볼 가치가 있고, 나머지 3건(`_evaluate_over_targets`의 None 분기, `_accepts_cwd`의 시그니처-조회-실패 분기, `_worktree_branches`의 subprocess-raise 분기)은 오늘 도달 불가능하거나 매우 희귀한 방어 코드라 INFO로 충분하다.

### 위험도
LOW
