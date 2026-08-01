# 성능(Performance) 리뷰 결과

## 검토 범위

`git diff origin/main...HEAD` 기준 11개 파일 (harness 훅/오케스트레이터 리팩터 + 신규 backstop 모듈). 3개
파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`)은 프롬프트 크기
제한으로 잘려 `Read`/`git diff` 로 직접 전문을 확인했다. 실제 diff 는 다음 성격이다:

1. **신규** `.claude/_shared/block_integrity.py` — SUMMARY 의 `BLOCK:` 판정과 checker `[CRITICAL]` 태그
   불일치를 잡는 backstop.
2. **신규** `.claude/_shared/retry_state.py` — `code_review_orchestrator.py`/`consistency_orchestrator.py`
   가 각자 들고 있던 5개 상태 bookkeeping 함수를 추출 (AST 비교로 동작 보존 확인, 문서에 명시).
3. `review_guard.py` / `guard_review_before_push.py` — 위 두 모듈을 배선해 advisory(`notes`)를 gate 결정
   객체에 실어 stdout/stderr 로 흘려보냄.
4. `code_review_orchestrator.py` / `consistency_orchestrator.py` / `merge_coordinator_orchestrator.py` —
   자체 구현을 `_shared/retry_state.py` 위임으로 교체 (순수 추출, 로직 변경 없음).
5. 테스트 2종 신설, `plan/*.md` 갱신(문서), `tests/README.md` 갱신(문서) — 실행 성능과 무관.

## 발견사항

- **[INFO]** 유계(bounded)된 "N+1 형태" 다중 파일 read — 실질적 문제 아님
  - 위치: `.claude/_shared/block_integrity.py:110-118` (`downgraded_criticals`)
  - 상세: `SUMMARY.md` 를 읽은 뒤 `CHECKER_REPORTS`(5개 고정 상수, `ALL_CHECKERS` 로스터 길이)를 순회하며
    각 checker 리포트를 개별 `open()`/`read()` 한다. 형태만 보면 "반복문 내 반복 I/O"이지만 N 이 세션 수나
    리포트 크기에 비례해 커지는 값이 아니라 고정된 checker 목록 길이(5)라 데이터 성장에 안전하다.
    게다가 호출부인 `review_guard._newest_resolved_impl_done_mtime`(`.claude/hooks/_lib/review_guard.py:744-759`)이
    이 함수를 **"게이트가 실제 채택하는 세션 1개"에만** 호출하도록 설계돼 있고, 그 근거로 "전 이력을
    재검사하면 +0.39초(732 세션 기준)"라는 실측치를 주석에 남겼다 — 세션이 누적돼도 이 backstop 비용은
    O(1)로 고정된다는 뜻. 의도적으로 잘 설계된 부분이라 조치 불필요.
  - 제안: 현행 유지. `ALL_CHECKERS` 로스터가 향후 수십 개로 늘어나는 경우에만 재검토.

- **[INFO]** 소규모 리스트 멤버십 dedup — 실질적 영향 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:857-859` (`_evaluate_over_targets` 내부
    `for note in getattr(result, "notes", ()) or (): if note not in notes: notes.append(note)`)
  - 상세: `notes` 누적에 `in` 멤버십 검사를 사용해 형식적으로는 O(targets × notes)다. 다만 targets(같은
    push 가 걸치는 worktree 수)와 notes(현재 advisory 종류는 1개 — downgrade contradiction)가 모두 실제
    운영 범위에서 한 자릿수라 유의미한 비용이 되지 않는다.
  - 제안: 현 상태로 문제 없음. advisory 종류가 여러 개로 늘어날 경우 `dict.fromkeys` 기반 순서 보존
    set 으로 교체 고려(지금 당장 필요는 없음).

- **[INFO]** `_shared/retry_state.py` 추출은 동작 보존이 (문서상) 검증된 순수 리팩터
  - 위치: `.claude/_shared/retry_state.py:1-29` (모듈 docstring), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 위임 변경
  - 상세: 두 오케스트레이터가 각자 들고 있던 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/
    `_apply_status_update`/`_emit_summary_state` 를 AST 비교(docstring 제외)로 "4개 동일, `_emit_summary_state`
    만 4-node 차이"임을 확인한 뒤 추출했다고 문서화돼 있다. 알고리즘·I/O 패턴 변경 없이 코드 위치만
    옮긴 것이라 성능 회귀 위험이 없다. `emit_summary_state`가 `reconcile_state_with_disk` 를 정확히 1회만
    호출하도록 (콜백형 `extra_fields` 파라미터로) 구성돼 있어, 오히려 "호출자가 먼저 reconcile 하고
    공유 함수가 다시 reconcile 하는" 이중 reconcile 회귀를 사전에 피한 설계다.
  - 제안: 없음.

## 실측 확인

새/영향받은 테스트를 직접 실행해 hang·급격한 지연이 없는지 확인했다(모두 통과, 초 단위):
- `test_block_integrity.py`: 20 tests / 0.044s
- `test_retry_state_shared.py`(subprocess 기반, orchestrator 2종을 실제 실행): 4 tests / 0.265s
- `test_review_guard*.py`: 84 tests / 0.547s
- `test_guard_review_before_push*.py`: 38 tests / 2.147s
- `test_push_guard*.py`: 113 tests / 3.355s

## 범위 밖 확인 사항 (this diff 아님)

`plan/in-progress/harness-review-gate-ci-backstop.md` 후속 항목 7번이 `consistency_orchestrator.collect_context`
의 `_rank_plan_text` 이중 read(세션당 I/O 2배, 실측 ≈3.5ms, 무해)를 "이번 PR 이 도입한 회귀"라 적어 두고
있으나, `git diff origin/main...HEAD -- .claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
로 확인한 결과 `collect_context`/`_rank_plan_text` 는 **이번 diff 에서 건드리지 않았다** — 이미 병합된
이전 커밋(`e7fef2510`)에서 도입된 것이다. 문서(plan) 자체는 이번 diff 에 포함돼 있지만 가리키는 코드는
아니므로 본 리뷰의 발견사항으로 중복 계상하지 않았다.

## 요약

이번 변경은 (1) 상태 bookkeeping 5종을 `_shared/retry_state.py` 로 추출한 순수 리팩터(AST 비교로 동작
보존 확인됨)와 (2) Critical 하향 금지 backstop(`block_integrity.py`) 신설 및 게이트 배선이 핵심이며, 알고
리즘 복잡도·N+1·캐싱·블로킹 I/O·데이터 구조 어느 관점에서도 CRITICAL/WARNING 급 회귀를 찾지 못했다.
특히 backstop 설계 자체가 성능을 의식적으로 고려했다는 근거가 코드 주석에 실측치(+0.39초 비교)로 남아
있어("전 이력 재경고 대신 게이트가 채택하는 세션 1개만 검사"), 세션 이력이 계속 쌓여도 이 훅의 비용이
늘지 않도록 설계돼 있다. `report_paths.has_report` 재사용도 파일 전체를 읽지 않고 `os.path.getsize()`
로만 존재/비어있음을 판정해 I/O 를 최소화한다. 새로 추가된 정규식(`_CRITICAL_TAG`, `_BLOCK_LINE`)도
중첩 quantifier 가 없는 단순 패턴이라 ReDoS 위험이 없다. 실제 테스트 실행으로도 hang 이나 급격한 지연은
관측되지 않았다. 발견된 사항은 모두 INFO 수준(유계 소규모 반복, 무영향 dedup)이며 조치가 필요하지
않다.

## 위험도

NONE
