# Maintainability Review — review/code/2026/08/01/09_09_19

## 검증 방법 (요청된 "측정 우선" 원칙에 따라)

이번 라운드 컨텍스트는 "라운드 7이 정규식 quadratic 서브식 하나를 고치고 같은 패턴 안의 두 번째를
남겼고, 라운드 8의 성능 회귀 테스트는 크기를 다른 결함에서 그대로 복사해 깨진 코드에도 통과했다"는
교훈을 명시했다. 이를 검사 지시가 아니라 실제 재현 대상으로 다뤘다:

1. `.claude/tests/test_block_integrity.py` 전체 38개 테스트를 실행 — 전부 통과, 0.562초.
2. `.claude/_shared/block_integrity.py` 사본을 만들어 `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`
   양쪽의 `BLOCK:` ~ 판정값 사이 gap 을 옛 패턴(`\s*\**\s*`)으로 되돌리고, `VerdictParserStaysLinearTest`
   가 쓰는 정확히 그 세 입력(20,000줄 no-`BLOCK:` 케이스, `"BLOCK:" + " "*45000`, `"BLOCK: YES" + " "*45000 + "x"`)
   을 서브프로세스+8초 타임아웃으로 재실행했다.
   - leading-class 케이스(20,000줄): 0.02초 — 이 케이스는 gap 되돌리기와 무관하므로 예상대로 빠름.
   - gap 두 케이스: **둘 다 8초 타임아웃** — 즉 `test_a_bare_block_followed_by_a_long_run_returns_fast` 와
     `test_a_trailing_run_after_a_real_verdict_returns_fast` 는 실제로 이 결함이 재발하면 RED 로
     떨어진다. Vacuous 하지 않음을 직접 확인.
3. 되돌린 사본은 삭제하고 원본 저장소는 건드리지 않았다.

결론: 라운드 7/8 이 남겼던 "같은 패턴 안 두 번째 quadratic" 결함 클래스는 `_BLOCK_AT_LINE_START` /
`_BLOCK_AT_LINE_END` 양쪽에서 실제로 닫혀 있고, 회귀 테스트 3종은 각기 다른 서브식(leading class /
gap-after-literal / gap-before-`$`)을 정확히 겨냥해 되돌리면 실패하는 것으로 측정 확인됐다. 이번
라운드에 새로 도입된 코드에서 동일 클래스(quadratic 서브식이 하나만 고쳐지고 자매 서브식이 남는 패턴)
가 반복되는 곳은 발견하지 못했다 — `guard_review_before_push.py` 의 `_GIT_PUSH`/`_MESSAGE_ARG`/
`_commit_heredoc_spans` 계열은 이미 §J~§O 에 걸쳐 여러 라운드가 반례를 측정하며 다듬은 상태이고,
`review_guard.py` 의 `_glob_to_regex` 도 `_MAX_GLOB_WILDCARDS` 캡 + `SpecGlobCompilationIsBoundedTest`
로 봉쇄되어 있음을 확인했다(같은 테스트 실행에서 통과 확인).

## 발견사항

- **[WARNING]** `build_files_section` 이 서로 다른 예산 전략 3개를 한 함수에 유지
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:509`(함수 시작)~`709`(함수 끝, 다음 정의 `build_agent_prompt_body` 는 `712`)
  - 상세: `max_total_size<=0`(무예산) / `base_size>=max_total_size`(헤더+diff 만으로 상한 초과) /
    일반 콘텐츠 할당, 세 경로가 "이 함수가 붙이는 모든 안내문(생략 표시·`_truncated_note`)도 예산에
    계상해야 한다"는 같은 불변식을 각각 손으로 재구현한다. 파일 자신의 주석(469-480줄 `_charge_notice`
    docstring, 630-636줄)이 이 구조에서 실제로 CRITICAL 이 재발했던 이력을 기록하고 있다 — 한 경로를
    고쳤는데 다른 규모(파일 수가 아주 많은 경우)에서 같은 계상 누락 클래스가 다시 나왔다는 것.
    함수 길이(~200줄)·중첩된 조건/루프·같은 불변식의 3중 재구현이 겹쳐 순환 복잡도가 높다.
  - 제안: 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속 #3 이 `_render_unbounded`
    / `_render_diff_only_overflow` / `_allocate_content_budget` 분리 + 예산 계상 단일 헬퍼 공유를
    제안해 두었다. 이번 라운드에도 미착수 상태로 남아 있어 재확인차 기록한다 — 새 결함이 아니라
    이미 추적된 부채가 아직 그대로임을 재확인.

- **[INFO]** `_import_reason` 두 사본의 포맷이 서로 다름 (신규 관찰)
  - 위치: `.claude/hooks/guard_review_before_push.py:805`-`806` vs `.claude/hooks/guard_review_before_stop.py:118`-`122`
  - 상세: push 훅 쪽은 `return f"..." if error else \`  뒤에 이어지는 연속줄(`806`)이 들여쓰기 없이
    컬럼 0 에 붙어 있다(`grep -n ' \\$' .claude/hooks/*.py` 로 저장소 전체에서 이 한 곳뿐임을 확인).
    문법적으로는 유효하지만 `return` 문의 계속인지 최상위 문인지 시각적으로 혼동을 준다. 완전히
    동일한 역할을 하는 stop 훅의 `_import_reason`(118-122줄)은 같은 삼항식을 괄호로 감싸 들여쓰기를
    유지한다 — 같은 일을 하는 두 함수의 스타일이 갈렸다.
  - 제안: push 쪽도 stop 쪽처럼 `return (... if error\n            else ...)` 형태로 통일.

- **[INFO]** 이미 추적된 기존 유지보수성 부채 — 이번 번들에서도 그대로 관찰되어 재확인만 기록 (새 발견 아님, `plan/in-progress/harness-review-gate-ci-backstop.md` 교차 참조)
  - `merge_coordinator_orchestrator.py` 의 `--resume` 처리(`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:535`-`544`)는 `_reconcile_state_with_disk` 를 호출하지 않는다. 자매 오케스트레이터인 `code_review_orchestrator.py:1402`-`1420` 와 `consistency_orchestrator.py:885`-`903` 는 둘 다 resume 직전 명시적으로 reconcile 한다 — 세 orchestrator 가 `_shared/retry_state.py` 로 위임을 통일한 이후에도 이 자기치유 동작만은 셋 중 하나에 없어 일관성이 깨져 있다. plan 신규 후속 #9 로 이미 추적·defer 됨(별도 skill 의 동작 변경이라 분리).
  - "origin 기본 브랜치" 해석 로직이 `review_guard._default_branch()`(`.claude/hooks/_lib/review_guard.py:219`-`232`), `code_review_orchestrator._default_branch_ref()`(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1128`-`1149`), `consistency_orchestrator` 의 `args.diff_base or "origin/main"` 리터럴(`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:406`), `branch_guard._origin_default_branch()` 총 4곳에 독립 구현돼 있다. 반환 계약이 서로 달라(로컬 `main` vs `origin/main`) 단순 통합이 불가능하고, `_lib` 네임스페이스 충돌 해소가 선행돼야 해서 plan 말미에 defer 로 명시돼 있다.
  - fresh-interpreter 테스트 보일러플레이트(`run_in_orchestrator` + `_PREAMBLE`, ~35줄, 두 `_lib` 패키지 충돌을 피하기 위한 장치)가 `.claude/tests/test_review_changeset_warning.py:44`-`72` 를 포함해 최소 4개 테스트 파일에 복제돼 있다(파일 자신의 docstring 이 "the same dodge test_consistency_context_budget uses" 라고 스스로 지목). plan 신규 후속 #12 로 추적됨.
  - 제안: 위 세 항목 모두 plan 파일에 이미 다음 조치가 적혀 있으므로 별도 제안 없음 — 이번 리뷰에서는 "여전히 그 상태인지"만 재확인했다.

## 요약

전체적으로 이 번들의 코드는 유지보수성 관점에서 양호하다. 매직 넘버는 사실상 없다시피 한데 —
`ESCALATE_AT`, `_IN_FLIGHT_TTL_SECONDS`, `_MAX_GLOB_WILDCARDS`, `_OWNER_WINDOW`, `_MAX_REDACTION_INPUT`,
`_GUTTER_OVERHEAD`, `CHECKER_BUDGET_RATIO` 등 상수 전부가 측정치와 근거를 담은 주석을 동반한다.
네이밍은 일관되고 목적을 잘 드러내며, `_shared/retry_state.py`·`_shared/block_integrity.py`·
`_lib/failopen_state.py` 로의 추출은 "Change both" 로 관리되던 실제 중복(코드리뷰/일관성 오케스트레이터
간, push/stop 훅 간)을 AST 비교 등으로 검증한 뒤 제거한 모범적인 리팩터링이다. 라운드 9의 핵심
우려사항이었던 "정규식 fix 가 같은 클래스의 다른 사례를 놓쳤는지, 회귀 테스트가 실제로 실패할 수
있는지"는 직접 측정으로 확인했고, 두 우려 모두 이 코드에서는 해소되어 있다(위 §검증 방법 참고).
남은 발견사항은 함수 길이/복잡도(`build_files_section`) 하나의 WARNING 과, 사소한 포맷 불일치
하나의 INFO, 그리고 이미 plan 파일에 등록·defer 된 기존 부채 3건의 재확인뿐이다. 새로 도입된
코드가 유지보수성을 후퇴시킨 지점은 발견하지 못했다.

## 위험도

LOW
