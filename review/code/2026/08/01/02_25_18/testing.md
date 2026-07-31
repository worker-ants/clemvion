# Testing Review — harness-block-backstop-b56163 (round 7, first proper review of current source)

리뷰 대상: merge-base(`e7fef2510`) 대비 16개 `.claude/**` 파일 + 1개 plan 문서. 핵심은
`_shared/block_integrity.py`(신규) — consistency SUMMARY 의 `BLOCK:` 판정이 checker 의
`[CRITICAL]` 태그와 모순되면 경고를 내는 backstop — 과 `_shared/retry_state.py`(신규) — 세
orchestrator 가 중복 구현하던 상태 bookkeeping 5종의 단일화. 이 리뷰는 실제로
`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 실행(750 tests, 전부 OK)했고,
핵심 회귀 가드 3곳에 대해 실제 뮤테이션(코드 변형 후 RED 확인)을 수행해 "테스트가 진짜로 무는지"를
검증했다. 그 결과를 findings 에 반영한다.

## 발견사항

- **[WARNING]** `evaluate_plan` 손-스텁만 `push_blocks` 프로퍼티 유무를 구조적으로 가드하고,
  동일한 결함 클래스에 노출된 `evaluate_review` 손-스텁은 무방비
  - 위치: `.claude/tests/test_block_integrity.py:416-459`
    (`class PlanStubsMirrorTheRealInterfaceTest`, `test_every_plan_stub_defines_push_blocks`,
    특히 443행 `if "def evaluate_plan" not in src: continue`)
  - 상세: 이 클래스가 잡으려는 결함은 "손으로 만든 스텁이 `push_blocks` 를 안 갖고 있으면
    `guard_review_before_push.py::_evaluate_over_targets`(809행, `result.push_blocks` 읽는 지점은
    867행)가 `AttributeError`→ 그 예외를 잡는 `except Exception`(`main()` 최상위) → fail-open(exit 0)
    으로 새고, 테스트는 그 상태로도 통과해 버려 아무것도 검증하지 못한다" — 실제로 이번 diff 에서
    두 파일(`test_block_integrity.py` 자신의 `NotesReachBothHooksTest._CLEAN_PLAN` 과
    `test_stop_guard_failopen.py` 의 `_CLEAN_PLAN`)에서 발견·수정됐다. 그런데 `push_blocks` 는
    `_evaluate_over_targets` 가 REVIEW/PLAN **두 게이트 모두**에 대해 동일하게 읽는 공용
    프로퍼티(`_run_gates` 가 `evaluate_review`/`evaluate_plan` 을 같은 함수에 넘긴다)인데, 이
    가드는 소스에 `"def evaluate_plan"` 문자열이 있는 파일만 스캔한다. 확인 결과 현재
    `test_guard_review_before_push_main.py` · `test_push_guard_worktree_scope.py` ·
    `test_block_integrity.py` 의 기존 `evaluate_review` 스텁은 이미 전부 `push_blocks` 를
    정의하고 있어 **지금 당장 살아있는 결함은 아니다.** 다만 이 클래스 자신의 목표("An audit
    fixes the instances; this fixes the class")에 비추면, 향후 새 `evaluate_review` 스텁이
    `push_blocks` 없이 추가돼도 이 가드는 잡지 못한다 — 절반짜리 일반화다.
  - 제안: `test_every_plan_stub_defines_push_blocks` 의 스캔 조건을
    `"def evaluate_plan" in src or "def evaluate_review" in src` 로 넓히거나, 대칭적인
    `test_every_review_stub_defines_push_blocks` 를 추가.

- **[WARNING]** multi-worktree push 시나리오에서 `notes` 어드바이저리가 조기 return 으로
  유실될 수 있는 경로가 테스트되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:809-873`
    (`_evaluate_over_targets`), 특히 857-866행의 notes 수집 루프와
    867-870행의 `if result.push_blocks: ... return render(...)`
  - 상세: `_push_targets()`(646행)는 cwd 외에 커맨드가 언급하는 다른 worktree 도 target 으로
    추가할 수 있다(다중 target). `_evaluate_over_targets` 는 target 을 순서대로 평가하다
    **어느 하나라도 `push_blocks` 이면 그 자리에서 즉시 return** 한다. 그 시점까지 평가된
    target 들의 notes 는 이미 `outcome.notes` 에 합류했겠지만, **아직 평가되지 않은 이후
    target 들의 notes 는 영영 수집 기회를 못 얻는다.** 이는 정확히 이 기능의 존재 이유를
    설명하는 828-834행 주석("A note filed by a target that then blocks is the one most worth
    keeping")이 다루지 않는 반대 경우 — blocking 되는 target 이 앞서 평가되고 notes 를 가진
    다른(clean 한) target 이 뒤에 있는 경우 — 인데, 이 조합을 구성하는 테스트가 스위트에 없다.
    `test_push_guard_worktree_scope.py` 는 멀티 target scoping 만 보고 `notes` 는 전혀 다루지
    않으며, `test_block_integrity.py::NotesReachBothHooksTest` 는 git 저장소가 없는 tmp dir 에서
    실행되어 `_worktree_branches` 가 실패 → `[]` 반환 → `_push_targets` 가 사실상 단일
    target(cwd)으로 축소된 상태로만 검증한다(직접 실행해 확인). "하향을 조용히 넘어가지
    않겠다"는 게 이 backstop 전체의 취지인데, 그 취지가 스스로 조용히 실패할 수 있는 경로가
    미검증인 점이 이 항목을 INFO 대신 WARNING 으로 매긴 이유다.
  - 제안: `test_push_guard_worktree_scope.py` 스타일로 2-worktree 환경을 구성하고, 먼저
    평가되는 worktree 는 block, 다른 worktree 는 (block 과 무관하게) notes 를 보유하는 조합을
    만들어 실제 동작(유실을 의도된 것으로 문서화하든, 수집 순서를 바꿔 항상 먼저 모으게
    고치든)을 명시적으로 고정하는 테스트를 추가.

- **[INFO]** `BLOCK:` 판정의 대소문자 무시(`re.IGNORECASE`) 동작이 신규 테스트에서 별도
  검증되지 않음
  - 위치: `.claude/_shared/block_integrity.py:60-65`
    (`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`, 둘 다 `re.IGNORECASE`)
  - 상세: 이 동작은 기존 `review_guard._BLOCK_LINE` 에서 그대로 이관된 것이고
    `test_block_integrity.py::VerdictIsAnchoredTest` 의 9개 테스트는 전부 대문자
    `BLOCK: NO/YES` 만 사용한다(구 `test_review_guard.py` 도 마찬가지로 대소문자 케이스가
    없었음 — 이 diff 가 만든 회귀는 아니다). 실사용 템플릿이 항상 대문자라 실질 위험은
    낮지만, 회귀 시 조용히 깨질 수 있는 미검증 분기다.
  - 제안: 여유가 되면 소문자/혼합 대소문자 케이스 1개를 `VerdictIsAnchoredTest` 에 추가
    (낮은 우선순위 — 이 라운드의 필수 항목은 아님).

## 검증 절차 (참고용 — 이번 리뷰에서 직접 수행)

- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **750 tests, OK** (leftover
  fail-open state 없음, `git status` 로 확인). 이 diff 가 건드린 16개 파일 전부 회귀 없음.
- `test_block_integrity.py`(30 tests) / `test_retry_state_shared.py`(9 tests) 단독 실행 모두
  green.
- 실제 뮤테이션 3건으로 핵심 backstop 테스트의 "이빨"을 확인(모두 의도대로 RED):
  1. `guard_review_before_stop.py` 의 note 스로틀 키를 digest 기반에서 `enumerate` 인덱스
     기반으로 되돌림 → `StopThrottleKeysOnTextTest.test_a_different_note_still_gets_through`
     류 시나리오가 실제로 이 회귀를 잡음(서로 다른 note 가 억눌림).
  2. `review_guard._newest_resolved_impl_done_mtime` 에서 `notes.append(...)` 호출부 삭제 →
     `GateSurfacesTheContradictionTest.test_the_adopted_session_is_reported` /
     `NotesSurviveBlockingTest.test_the_contradiction_is_collected_for_the_adopted_session`
     둘 다 FAIL.
  3. Gate 2 의 한 `ReviewDecision` 반환에서 `tuple(notes)` 인자 제거 →
     `NotesSurviveBlockingTest.test_blocking_returns_carry_notes` (AST 기반 구조 검사) FAIL.

## 요약

신규 로직(`_shared/block_integrity.py`, `_shared/retry_state.py`, push/stop 훅의 `notes`
어드바이저리 배선, 세 orchestrator 의 상태 bookkeeping 통합) 전체에 걸쳐 테스트가 이례적으로
두텁다 — 신규 파일 2개(`test_block_integrity.py` 600줄·`test_retry_state_shared.py` 220줄)가
함수 단위 커버리지뿐 아니라 "테스트 자신이 무는지"를 검증하는 메타 테스트(AST 로 return 문
구조 검사, 손-스텁이 실제 인터페이스와 일치하는지 전수 스캔, 호출 사이트를 지워보는 실험을
docstring 에 명시)까지 갖추고 있고, 본 리뷰에서 그 주장을 실제 뮤테이션으로 3건 재현해 전부
확인했다. 기존 회귀 스위트(`test_review_guard.py`/`test_stop_guard_failopen.py`/
`test_consistency_orchestrator_state.py`/`test_orchestrator_state.py`)도 리팩터 후 그대로
유효하며 전수 green 이다. 남은 갭은 두 가지 WARNING(플랜 스텁 전용 가드가 대칭적인 review
스텁까지 커버하지 못함, 멀티 worktree push 에서 notes 조기-return 유실 경로 미검증)과 낮은
우선순위 INFO 하나(대소문자 무시 파싱 미검증, 기존부터 있던 갭)로, 모두 "지금 당장 깨진
동작"이 아니라 "다음 회귀를 못 잡을 수 있는 커버리지 완성도" 문제다.

## 위험도

LOW
