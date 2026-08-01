# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 새로 도입된 `ReviewDecision.notes` advisory 가 두 소비자(push/Stop) 중
  한쪽에서만 표면화되어, Stop 가드 경로에서는 계산되고도 조용히 버려진다.
  - 위치:
    - `.claude/hooks/_lib/review_guard.py:173` — `ReviewDecision.notes: tuple[str, ...] = ()` 필드 신설
    - `.claude/hooks/_lib/review_guard.py:964`, `:968`, `:988-998` — `evaluate_review()` 가 Gate 2 에서
      `notes` 를 수집해 반환값에 실음 (push/Stop 양쪽 호출부가 공유하는 **동일 함수**)
    - `.claude/hooks/guard_review_before_push.py:733-750` (`_report_notes`), `:847-859`
      (`_evaluate_over_targets` 의 notes 수집) — push 가드는 이 필드를 읽어 exit code 에 맞는
      스트림(stdout/stderr)에 출력하도록 새로 배선됨
    - `.claude/hooks/guard_review_before_stop.py:344` (`decision = evaluate_review(in_flight_ok=True)`),
      `:349-358` — Stop 가드는 같은 함수를 호출하지만 `decision.blocked`/`decision.reason` 만 읽고
      `decision.notes` 는 이 파일 전체에서 **단 한 번도 참조되지 않는다** (`grep -n "\.notes\b"` 매치 0건)
  - 상세: `_shared/block_integrity.py` 의 존재 이유는 "하향이 조용히 통과하는 것"을 끝내는 것이고,
    `ReviewDecision.notes` 필드 주석도 "advisories that... must still reach the model" 이라고
    명시한다. 그런데 이 필드를 채우는 Gate 2(`_newest_resolved_impl_done_mtime` → 신규
    `notes` 파라미터)는 `in_flight_ok` 여부와 무관하게 항상 실행되므로, Stop 가드가 호출하는
    `evaluate_review(in_flight_ok=True)` 도 정확히 같은 `notes` 를 계산한다. 하지만 이번 diff 는
    `guard_review_before_push.py` 에만 `_report_notes`/`_evaluate_over_targets` 배선을 추가했고
    `guard_review_before_stop.py` 는 전혀 건드리지 않았다(`git diff origin/main...HEAD --stat` 에
    이 파일이 없음). 결과: 동일한 "BLOCK:NO 인데 checker 가 CRITICAL" 모순이 발생해도, **push 가
    실제로 일어나기 전까지는** 그 사실이 모델에게 전혀 보이지 않는다 — 정작 이 조건을 가장 자주
    관측할 기회(턴이 끝날 때마다 도는 Stop nudge)에서는 계산만 하고 버린다. 실측: 전체 735개
    하네스 테스트가 전부 통과하며(회귀 없음), `.claude/tests/*.py` 중 "notes" 를 참조하는 5개
    파일 어디에도 Stop 가드 케이스가 없다 — 이 gap 은 테스트로도 잡히지 않는다.
    다만 기능 자체가 이번 PR 로 신설된 것이라 **회귀는 아니다**(이전에는 push/Stop 둘 다 이
    advisory 가 없었다) — push 쪽만 개선되고 Stop 쪽은 기존과 동일하게 침묵을 유지하는 "불완전한
    롤아웃"이다.
  - 제안: `guard_review_before_stop.py` 에도 `decision.notes` 를 읽어 출력하는 동등한 배선을
    추가할 것. 단, `_lib/failopen_state.py` 자체 docstring 이 못박듯 Stop 훅의 stdout 은
    `{"decision": ...}` JSON 프로토콜이므로, push 가드가 쓰는 "exit code 로 stdout/stderr 선택"
    규칙을 그대로 재사용하면 안 되고 **항상 stderr** 로 내보내야 한다(`_report_fail_open` 이 Stop
    쪽에서 이미 그렇게 하듯). 당장 배선하지 않는다면 최소한 `ReviewDecision.notes` 필드 주석과
    `block_integrity.py` 모듈 docstring에 "현재 push 경로에서만 표면화됨" 이라는 스코프를 명시해
    다음 사람이 "이미 양쪽 다 됐다"고 오인하지 않게 할 것.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 `_load_state`/`_save_state` 만
  `_shared/retry_state.py` 로 위임하고 `_reconcile_state_with_disk` 자기치유는 여전히 없다 —
  Agent tool 로 직접 fan-out 된 세션은 `--update` 를 거치지 않으므로 상태가 prepare 시점
  스냅샷에 멈춘 채 SUMMARY 는 실제 성공을 보고하는 모순을 그대로 겪는다(다른 두 orchestrator는
  이미 고침). 이번 diff 의 회귀는 아니며, `merge_coordinator_orchestrator.py:100-109` 의 명시적
  주석과 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 로 이미 후속 작업으로
  기록·추적되고 있어 새로 지적할 필요는 낮다(완결성 확인 차원에서만 기재).

## 확인했으나 문제 없음 (부작용 관점)

- `ReviewDecision` 신규 필드(`notes`, 기본값 `()`)·`_newest_resolved_impl_done_mtime` 신규 파라미터
  (`notes=None`) 모두 기본값이 있어 기존 호출부(전부 grep 으로 확인: `review_guard.py` 내부 8곳,
  `test_review_guard_hardening.py`, `test_push_guard_worktree_scope.py`)가 깨지지 않는다.
- `_shared/block_integrity.py`·`_shared/retry_state.py` 는 순수 함수 + 조건부 파일 쓰기(기존과
  동일한 `_retry_state.json` 갱신, AST 로 사전 검증된 byte-identical 이관)뿐이며 새 전역 가변
  상태·새 env var 읽기/쓰기·새 네트워크 호출은 도입하지 않았다(diff 전체에 `os.environ`/
  `subprocess`/`requests`/`socket` 신규 사용 없음, grep 확인).
  `retry_state.emit_summary_state` 의 "조건부 write" 부작용은 리팩토링 이전부터 있던 동작이
  그대로 이관된 것으로 이번 PR 이 만든 것이 아니다(모듈 docstring 도 "Caveat" 으로 이미 명시).
- `consistency_orchestrator.ALL_CHECKERS` 를 하드코딩 리스트에서
  `list(_block_integrity.ALL_CHECKERS)` 로 바꾼 것은 내용·순서가 완전히 동일(원본 5개, 같은
  순서)하고 어디서도 in-place mutate 되지 않아(grep 확인) 인터페이스 회귀 없음.
  `guard_review_before_push.py` 의 `_evaluate_over_targets` 가 `outcome.notes` 를 `getattr`
  로 방어적으로 초기화하는 방식은 `failopen_state.Outcome`(다른 파일, 이번 diff 밖)에 `__slots__`
  이 없어 동적 속성 부여가 안전하게 동작하며, `failopen_state.report()` 는 `answered`/
  `bypassed`/`degraded` 만 읽으므로 `notes` 부여가 fail-open 카운팅 로직과 충돌하지 않는다.
  PLAN 게이트(`PlanDecision`)에도 같은 `_evaluate_over_targets` 가 재사용되지만
  `getattr(result, "notes", ()) or ()` 로 방어되어 있어 `PlanDecision` 에 `.notes` 가 없어도
  예외가 나지 않는다.
- 전체 하네스 자체 테스트(`python3 -m unittest discover -s .claude/tests`) 735건 전부 통과 —
  이번 리팩토링·신규 파일이 기존 동작을 깨지 않았음을 실측으로 확인.

## 요약

이번 diff 는 대부분 "Change both" 주석으로 유지되던 상태 bookkeeping 5종을
`.claude/_shared/retry_state.py` 로, Critical 하향 감지 로직을 `.claude/_shared/block_integrity.py`
로 이관하는 리팩토링 + 그 감지 결과를 `ReviewDecision.notes` 라는 새 경로로 모델에 노출하는
기능 추가다. 이관된 함수들은 AST 비교로 동일성이 사전 검증됐고 새 파라미터/필드는 전부 기본값이
있어 기존 호출부·테스트(735건)를 깨지 않는다. 새 파일시스템 쓰기·env var·네트워크 호출은
도입되지 않았다. 유일하게 실체가 있는 부작용은 신설된 `notes` advisory 경로가 push 가드에만
배선되고 Stop 가드(`guard_review_before_stop.py`)는 동일한 `evaluate_review()` 를 호출해 같은
`notes` 를 계산하면서도 전혀 읽지 않는다는 비대칭이다 — 기능이 신설이라 회귀는 아니지만, "조용한
하향을 보이게 한다"는 이 backstop 의 설계 의도가 Stop 경로에서는 여전히 미완성 상태로 남는다.

## 위험도

LOW
