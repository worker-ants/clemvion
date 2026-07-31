# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `notes` 어드바이저리 전파가 두 형제 훅에서 서로 다른 모양으로 중복 구현됨 — 이 브랜치가 없애려는 "Change both" 패턴의 새 인스턴스
  - 위치: `.claude/hooks/guard_review_before_push.py:733-750`(`_report_notes` 헬퍼) 및 `:809-866`(`_evaluate_over_targets` 의 `outcome.notes` 누적) vs `.claude/hooks/guard_review_before_stop.py:360-361`(`decision.notes` 직접 순회)
  - 상세: push 훅은 `_evaluate_over_targets` 에서 `result.notes` 를 `outcome.notes` 에 누적해 두었다가 `main()` 의 `finally` 에서 `_report_notes(outcome, exit_code)` 로 한 번에 스트림을 선택해 출력한다(`guard_review_before_push.py:960-962`). stop 훅은 같은 `ReviewDecision.notes` 필드를 `outcome` 을 거치지 않고 평가 지점에서 곧바로 `for note in ...: print(note, file=sys.stderr)` 로 처리한다. 그 결과 공유 `failopen_state.Outcome`(`.claude/hooks/_lib/failopen_state.py:47-54`)에는 이번 diff 로 `.notes` 필드가 추가됐고 push 훅의 폴백 `_Outcome`(`guard_review_before_push.py:793-799`)도 대칭으로 갱신됐지만, stop 훅 자신의 폴백 `_Fallback`(`guard_review_before_stop.py:103-107`)은 갱신되지 않아 `.notes` 필드 자체가 없다. 지금은 stop 이 `outcome.notes` 를 전혀 읽지 않아 죽은 필드라 실행에 영향은 없지만, "같은 규칙이 두 곳에 따로 있으면 drift 한다"는 이 PR 자신의 근거(`_shared/retry_state.py`, `_shared/block_integrity.py` 추출 사유와 동일한 논리)와 정확히 반대 방향으로 새로 생긴 사례다. `_report_notes` 내부의 "exit_code==2 → stderr, 그 외 stdout" 스트림 선택 로직도 바로 위 `_report_fail_open`(`guard_review_before_push.py:753-768`)과 한 줄이 그대로 중복된다.
  - 제안: 스트림 선택 + 출력 로직을 `failopen_state.py` 에 `emit_notes(notes, stream)` 류의 공유 헬퍼로 옮겨 두 훅이 동일 함수를 호출하도록 통일. 최소한 `_Fallback` 에 `.notes` 필드를 추가해 `failopen_state.Outcome` 과 형태를 맞출 것.

- **[WARNING]** 하향-모순 경고가 stop 훅에서 스로틀 없이 매 턴마다 반복될 수 있음 — 바로 아래 nudge 는 1회로 제한하는 것과 비대칭
  - 위치: `.claude/hooks/guard_review_before_stop.py:360-361` (nudge 스로틀 대비: `:365-370`, `_nudge_once` 정의 `:231-240`)
  - 상세: 같은 함수 안에서 실제로 턴 종료를 막는 nudge 는 `_nudge_once()`(marker 파일 기반, "session/branch 당 1회"로 명시 제한)를 거치는데, 그 몇 줄 위의 `notes` 출력 루프는 어떤 스로틀도 없이 `evaluate_review()` 가 예외 없이 반환할 때마다 — 즉 턴 종료 시도마다 — 무조건 stderr 에 다시 찍힌다. 이 PR 자신이 `review_guard.py`(`_newest_resolved_impl_done_mtime`)와 `block_integrity.py` 양쪽 docstring/코멘트에서 "채택된 세션 하나만 검사한다, 그렇지 않으면 매번 우는 경고는 아무도 안 읽는다"는 원칙을 명시적으로 세워 놓고, 정작 그 경고를 최종 전달하는 이 지점에서는 세션이 다른 SUMMARY 로 교체되기 전까지 동일 경고가 세션의 모든 턴에서 무제한 반복되게 방치했다.
  - 제안: PLAN-COMPLETE nudge 처럼 `_nudge_once(session_id, token, kind="downgrade_note", ...)` 로 branch/세션당 1회로 제한하거나, 최소한 동일 세션·동일 사유의 반복 출력을 억제하는 marker 를 추가.

- **[INFO]** `ALL_CHECKERS` 정본이 "무결성 검증" 모듈에 얹혀 SRP 경계가 약간 흐려짐
  - 위치: `.claude/_shared/block_integrity.py:67-78`
  - 상세: `block_integrity.py` 의 선언된 책임은 "SUMMARY 의 BLOCK 판정이 checker 리포트와 모순되는지 검사"인데, 5-checker 레지스트리(`ALL_CHECKERS`)의 SSOT 자리까지 겸하게 됐다. 코멘트가 근거("이 모듈이 절대 놓치면 안 되는 곳이라 여기 둔다")를 명시하고 `test_block_integrity.py::CheckerListIsCanonicalTest` 가 `consistency_orchestrator.ALL_CHECKERS` / `role_instructions.CHECKER_INSTRUCTIONS` 와의 일치를 교차검증해 drift 리스크는 낮췄지만, 개념적으로는 "체커 레지스트리"가 "그 체커들의 산출물을 사후 검증하는 모듈"의 부속물이 된 형태다. 테스트가 없었다면 드러나지 않았을 결합이라는 점에서, 다음에 이 목록의 4번째 소비자가 생기면 이 파일을 "검증 로직"으로만 여기고 놓칠 여지가 남는다.
  - 제안: 시급하지 않음. 목록의 소비자가 하나 더 늘면 중립적인 `_shared/checkers.py` 로 레지스트리만 분리하고 `block_integrity`/`consistency_orchestrator` 양쪽이 거기서 import 하는 편이 책임 경계가 더 뚜렷.

- **[INFO]** `_shared/retry_state.py` 는 이제 3개 orchestrator 의 소비를 받는데 모듈 docstring 은 여전히 "shared by both orchestrators"(2개)로 서술 — 3번째 소비자는 부분 채택 + 무테스트
  - 위치: `.claude/_shared/retry_state.py:1` / 소비 지점 `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-121`(코멘트), `:113-121`(위임 3개 함수), `:85-97`(위임 안 된 자체 `_emit_summary_state`)
  - 상세: 이 브랜치 자체의 커밋 이력(`7b54b088a` 로 모듈 신설 → `a0dcebea2` 로 merge_coordinator 를 세 번째 소비자로 부분 통합)이 이미 이 서술을 stale 하게 만들었다. `merge_coordinator_orchestrator.py` 는 `load_state`/`save_state`/`apply_status_update` 3개 함수는 위임하지만 `reconcile_state_with_disk`/`emit_summary_state` 는 여전히 없어(자기치유 부재 — Agent tool 로 직접 fan-out 한 세션이 prepare 스냅샷에 멈춰있을 수 있음) 3개 소비자가 이 모듈의 계약을 균일하게 따르지 않는다. 이 부분 채택 자체는 코멘트가 밝히듯 "동작 변경을 다른 skill 에 몰래 끼워넣지 않는다"는 원칙에 따른 신중한 결정이고 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 로 이미 후속 등재돼 있어 은폐된 부채는 아니다. 다만 그 결과로 (a) 모듈 docstring 의 "both" 표현이 실제 소비자 수와 어긋나고, (b) 신설된 `test_retry_state_shared.py` 도 code-review/consistency 2개 경로만 검증해 merge-coordinator 쪽 위임은 이 PR 테스트 어디에서도 실행되지 않는다(`.claude/tests/` 에 merge-coordinator 전용 테스트 파일이 아예 없음).
  - 제안: docstring 을 "세 orchestrator, 단 merge-coordinator 는 3/5 함수만" 정도로 정정. 여유가 되면 `test_retry_state_shared.py` 류에 merge-coordinator `--summary-state`/`--update` 위임 경로도 한 케이스 추가.

## 요약

이번 변경의 핵심은 두 가지 잘 짜인 구조적 이동이다 — ① `code_review_orchestrator.py`/`consistency_orchestrator.py`(및 부분적으로 `merge_coordinator_orchestrator.py`)에 "Change both" 주석으로만 동기화되던 5개 상태-bookkeeping 함수를 AST 비교로 진짜 동일한 4개만 검증 후 `_shared/retry_state.py` 로 추출하고 유일하게 다른 `emit_summary_state` 는 `extra_fields` 콜러블(OCP 를 제대로 적용한 확장점)로 처리했고, ② `consistency-summary.md` 의 하향-금지 규약을 기계적으로 집행하는 작고 단일 책임의 `_shared/block_integrity.py` 백스톱을 신설했다. 두 모듈 모두 hooks/`_lib` 와 skills/`lib` 의 기존 네임스페이스 충돌을 피하려 만들어진 중립 `_shared` 패키지에 정확히 배치돼 있고, 의존 방향이 항상 hooks/skills → `_shared` 로만 흘러 순환 참조나 레이어 역전이 없다. 남은 지적사항은 구조적 결함이라기보다 일관성 다듬기에 가깝다 — 새로 도입한 `notes` 어드바이저리 채널이 push/stop 두 형제 훅에서 서로 다른 모양으로 배선되어 이 PR 이 다른 곳에서 애써 없애는 중복 패턴을 작게 재현했고, 그 채널이 바로 옆 nudge 메커니즘과 달리 스로틀이 없어 "우는 경고는 아무도 안 읽는다"는 이 코드 자신의 원칙과 어긋날 수 있으며, 3번째 orchestrator 의 부분 채택(의도적으로 별도 PR 로 미룸)이 모듈 문서/테스트 커버리지를 살짝 뒤처지게 남겨두었다. 어느 것도 순환 의존성·레이어 위반·확장성 저해로 이어지지 않는다.

## 위험도

LOW
