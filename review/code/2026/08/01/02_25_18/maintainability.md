# 유지보수성(Maintainability) Review

대상: `origin/main...HEAD` diff 16개 파일 (`.claude/_shared/*`, `.claude/hooks/**`, `.claude/skills/**/scripts/*orchestrator*.py`,
`.claude/agents/consistency-summary.md`, `.claude/skills/consistency-checker/SKILL.md`, `.claude/tests/*`,
`plan/in-progress/harness-review-gate-ci-backstop.md`). 프롬프트에서 크기 제한으로 생략된 5개 파일
(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`, `tests/README.md`, `test_block_integrity.py` 후반부)은 워크트리에서 직접
`Read` 해 확인했고, 전 파일에 대해 `git diff origin/main...HEAD`로 실제 변경분을 대조했다.

## 발견사항

- **[WARNING]** `merge_coordinator_orchestrator.py`만 위임 함수 정의 순서가 뒤집혀 forward-reference 로 읽힌다
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85` (`_emit_summary_state` 정의부, 내부에서 `_load_state` 호출) / `:113` (`_load_state` 정의부)
  - 상세: 이번 PR은 세 orchestrator의 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`를 `_shared/retry_state.py`로 위임하는 동일한 리팩터를 적용했다. `code_review_orchestrator.py`(`_load_state` L189 → … → `_emit_summary_state` L205)와 `consistency_orchestrator.py`도 위임 함수 4개를 `_emit_summary_state`보다 먼저 배치해 위→아래로 자연스럽게 읽힌다. 그런데 `merge_coordinator_orchestrator.py`는 옛 `_load_state`/`_save_state` 정의를 지우고 새 위임 버전을 `_emit_summary_state`(L85) "다음"에 붙였다. 그 결과 이 파일만 `_emit_summary_state`가 아직 정의되지 않은 `_load_state`를 30여 줄 앞서 호출하는 모양이 됐다. Python은 호출 시점에 이름을 찾으므로 런타임 오류는 없지만(모듈이 전부 로드된 뒤에만 실제 호출됨), 같은 커밋이 만든 세 파일 중 이 파일만 정의-전-사용 순서가 깨져 있어 형제 파일과의 일관성이 없다.
  - 제안: `_load_state`/`_save_state`/`_apply_status_update` 정의 블록(L100-122)을 `_emit_summary_state`(L85) 위로 옮겨 다른 두 orchestrator와 동일한 순서로 맞춘다.

- **[WARNING]** `guard_review_before_stop.py`의 `_run()`이 세 번째 책임(advisory 통지)을 인라인으로 흡수해 길이·응집도가 저하됨
  - 위치: `.claude/hooks/guard_review_before_stop.py:328-434` (`_run` 전체), 신규 블록은 `:366-392`
  - 상세: `_run()`은 `origin/main` 기준 이미 REVIEW 게이트 평가+nudge, PLAN-COMPLETE 게이트 평가+nudge 두 책임을 가진 ~70줄 함수였다. 이번 PR이 "note 하나마다 SHA1 다이제스트로 마커 파일을 만들어 스로틀링 후 stderr 출력"하는 27줄짜리 블록(L366-392)을 그 함수 몸통에 그대로 끼워 넣어 ~106줄로 늘었다. 형제 파일 `guard_review_before_push.py`는 동일 개념(advisory notes 출력)을 `_report_notes()`라는 독립 함수로 뽑아 `main()`의 `finally`에서 호출하는데, 이 파일은 같은 개념을 `_run()` 내부에 직접 펼쳐 놓아 같은 PR 안에서 같은 기능이 두 가지 다른 구조로 구현됐다. 다음에 세 번째 훅이나 새 advisory 종류가 추가될 때 어느 패턴을 따라야 할지 기준이 없다.
  - 제안: note 스로틀 블록을 `_emit_review_notes(decision, session_id, token)` 같은 별도 함수로 추출해 `_run()`은 REVIEW/PLAN 두 게이트의 오케스트레이션만 남긴다.

- **[INFO]** `_evaluate_over_targets`가 스스로 "세 번째 책임" 누적을 문서화하고 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:809-873` (`_evaluate_over_targets`), note 드레인 로직은 `:857-866`
  - 상세: 함수 docstring이 "Third responsibility, added later: advisory collection"이라고 스스로 적어 뒀다. 원래 fail-open 관측(#999 §E) + per-target 평가 두 책임이던 헬퍼가 이번 PR에서 advisory 수집까지 맡게 됐다. 각 책임은 문서화가 잘 돼 있고 `NotesReachBothHooksTest`/`AdvisoryReachesTheModelTest` 테스트도 갖춰 당장 문제는 아니지만, "added later"라고 자인한 패턴은 다음 확장도 이 함수에 얹힐 신호다.
  - 제안: 네 번째 책임이 붙기 전에 note 드레인 로직(L857-866)을 `_drain_notes(outcome, result)` 헬퍼로 분리해 두면 이후 확장이 쉬워진다.

- **[INFO]** 조밀하게 중첩된 조건식 한 줄
  - 위치: `.claude/hooks/guard_review_before_stop.py:380`
  - 상세: `for note in ((getattr(decision, "notes", ()) or ()) if decision else ()):` 는 삼항식 + `getattr` 기본값 + `or` 세 겹이 한 줄에 뭉쳐 있어 "decision이 있고 notes가 있으면 순회"라는 의도를 한눈에 읽기 어렵다. `decision`은 `None`이거나 `notes` 필드를 가진 `ReviewDecision` 인스턴스뿐이라 `getattr` 방어는 실질적으로 불필요하다.
  - 제안: `notes = decision.notes if decision is not None else ()` 처럼 이름 붙은 중간 변수로 풀어서 쓰면 가독성이 개선된다.

- **[INFO]** 테스트 셋업 보일러플레이트 반복
  - 위치: `.claude/tests/test_retry_state_shared.py:150-216` (`MergeCoordinatorUsesTheSharedStateTest`의 세 테스트 메서드)
  - 상세: 세 메서드 모두 "mkdtemp → addCleanup → makedirs → `_retry_state.json` 작성 → subprocess.run" 골격을 각각 손으로 반복한다. 같은 파일 상단의 `SummaryStateCliTest._session()`처럼 헬퍼로 뽑을 수 있는 모양인데 이 클래스만 인라인으로 남아 있다.
  - 제안: 우선순위는 낮음(테스트 명확성과의 트레이드오프) — 공통 셋업을 `_session(...)` 류 헬퍼로 추출하면 좋다.

## 참고 — 이미 추적 중이라 재기재하지 않은 항목

`plan/in-progress/harness-review-gate-ci-backstop.md`가 이미 등재한 후속 항목(예: `merge_coordinator_orchestrator.py`의
`reconcile_state_with_disk` 부재, git 브랜치-diff 헬퍼 중복, `build_files_section` 책임 분리 등)은 이번 라운드의 신규
발견이 아니라 스스로 defer 처리된 상태이므로 본 리뷰에서 다시 지적하지 않았다.

## 요약

이번 변경의 핵심은 세 orchestrator에 흩어져 있던 `_retry_state.json` bookkeeping 5종을 `_shared/retry_state.py`로,
그리고 "BLOCK: 하향" 판정 로직을 `_shared/block_integrity.py`로 뽑아낸 것이다. AST 비교로 실제 동일성을 측정한 뒤
추출했고("Change both" 주석을 지우는 것 자체가 목적), 각 함수는 짧고 단일 책임이며, 이름 규약도 기존
`_shared/report_paths.py`와 일관된다(밑줄 없는 공개 함수 + 각 orchestrator의 `_`-prefixed 위임 래퍼). 새 backstop
기능(`block_integrity` 기반 하향 경고)은 push/stop 두 훅에 대칭적으로 배선됐고 전용 테스트(`test_block_integrity.py`,
`test_retry_state_shared.py`)가 핵심 불변식(체커 목록 단일 출처, 앵커링된 BLOCK 파서, 세션당 1회 스로틀 등)을 각각
직접 pin 한다. `pyflakes` 미가용으로 자동 린트는 못 돌렸으나 수동 대조로 미사용 import·죽은 코드는 발견되지 않았다.
남은 결함은 전부 스타일/구조 수준(정의 순서 하나가 형제 파일과 어긋남, 게이트 함수 두 개가 새 책임을 떠안으며
길어짐, 압축된 한 줄 조건식, 테스트 보일러플레이트 반복)이라 기능적 위험은 없다. 다만 `guard_review_before_push.py`
와 `guard_review_before_stop.py`는 이미 여러 라운드에 걸쳐 책임이 누적돼 온 파일이고, 이번 PR도 그 위에 한 겹을 더
얹었다는 점은 다음 확장 전에 리팩터를 고려할 신호로 남겨 둔다.

## 위험도

LOW
