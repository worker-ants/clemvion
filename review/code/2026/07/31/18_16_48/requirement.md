STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[WARNING]** 신규 backstop 경고가 "게이트 판정에 실제로 쓰인 세션" 이 아니라 `review/consistency/**` 전체 이력을 매 호출마다 훑어, 과거에 이미 알려진 모순 세션까지 매번 다시 stderr 에 출력한다. 게다가 이 호출부는 `git push` 시점뿐 아니라 `guard_review_before_stop.py` 를 통해 spec-linked `codebase/` 변경이 있는 브랜치의 **매 턴 종료(Stop)** 마다도 실행된다. 실측: 이 저장소에서 지금 바로 `review_guard._newest_resolved_impl_done_mtime(repo_root)` 를 호출하면 2026-06-03 ~ 2026-07-25 세션 8건에 대해 경고 8줄이 즉시 출력되며(직접 실행으로 확인), 세션을 정리/재작성하지 않는 한 이 개수는 이후로도 줄지 않고 늘어나기만 한다. de-dup·rate-limit·"현재 판정에 실제로 쓰인 세션만 경고" 같은 축소 장치가 전혀 없다. 이는 같은 파일의 `_CRITICAL_TAG` 설계 근거로 스스로 명시한 원칙("a backstop that cries wolf is one nobody reads")과 정면으로 부딪히는 지점이다 — 반복되는 오래된 경고 더미에 실제 신규 위반이 묻힐 위험이 있다.
  - 위치: `.claude/hooks/_lib/review_guard.py:716-733` (함수 `_newest_resolved_impl_done_mtime` 안 `_block_integrity.contradiction_note` 호출·출력 루프)
  - 상세: 루프는 `_iter_consistency_summaries` 로 찾은 **모든** `--impl-done` + `BLOCK: NO` 세션에 대해 무조건 `contradiction_note` 를 호출·출력하고, 그 세션이 최종적으로 `best`(게이트가 실제로 근거로 삼는 최신 세션)로 채택되는지와 무관하다. `evaluate_review(in_flight_ok=True)` 는 Stop 가드가 매 턴 호출하므로(코드-리뷰/consistency 무관하게 spec-linked 변경이 브랜치에 있는 한) 이 경고는 push 전용이 아니라 turn-by-turn 로 반복된다.
  - 제안: (a) 경고를 "이번 판정에 실제로 채택된 `best` 세션"에만 한정하거나, (b) 세션별로 1회만 경고하도록 상태 파일/캐시로 중복 억제하거나, (c) `dirty` 집합(이번 실행에서 새로 작성된 세션)에만 경고를 한정해 과거 이력 재출력을 막는다.

- **[WARNING]** `.claude/_shared/block_integrity.py` 의 `CHECKER_REPORTS` 5종 파일명이 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `ALL_CHECKERS` 리스트와 공유 소스도, 상호 검증 테스트도 없이 독립적으로 하드코딩돼 있다(`grep` 확인 결과 두 이름을 함께 참조하는 코드·테스트 없음). 이번 PR 이 바로 옆 파일(`retry_state.py`)에서 "두 orchestrator 가 'Change both' 주석으로만 동기화되던" 패턴을 없애는 작업을 하면서, 정확히 같은 종류의 drift 위험을 새 파일에 다시 만들었다. 향후 checker 가 이름 변경/추가/제거될 때 `CHECKER_REPORTS` 를 함께 갱신하지 않으면, 하향 금지 backstop 이 그 checker 에 대해서만 조용히 무력화된다 — 이 기능이 막으려는 바로 그 실패 양상(하향이 아무도 모르게 게이트를 통과)이 checker 개명 시 재발할 수 있다.
  - 위치: `.claude/_shared/block_integrity.py:44` (`CHECKER_REPORTS`) vs `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:50` (`ALL_CHECKERS`)
  - 상세: 두 목록은 현재는 값이 일치(5개, 순서까지 동일)하지만 이는 사람이 손으로 맞춘 상태일 뿐, 어긋남을 잡아줄 장치가 없다.
  - 제안: `CHECKER_REPORTS` 를 `consistency_orchestrator.ALL_CHECKERS` 로부터 파생(`f"{name}.md"`)시키거나, 이 저장소의 기존 관례(`test_router_safety_policy_doc.py` 류)를 따라 두 목록이 일치하는지 확인하는 유닛 테스트를 추가한다.

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md:36-41` 의 "신규 후속 (defer)" 2번 항목이 여전히 "**하향 금지 정책에 기계적 backstop 이 없다**" 라고 서술하며 미착수 상태로 남아 있는데, 이번 diff(커밋 `30cc0f738`, `.claude/_shared/block_integrity.py` 신설 + `review_guard.py` 배선)가 정확히 그 항목("orchestrator/게이트가 checker 리포트의 `[CRITICAL]` 수를 세어 최종 `BLOCK:` 와 모순되면 stderr 경고")을 구현했다. 커밋 메시지 자체가 "규약이 산문으로만 있던 상태 해소"라고 밝히면서도 plan 문서는 갱신되지 않아, 이 항목의 서술이 이제 사실과 어긋난다(철회 없는 stale 서술).
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:36-41`
  - 상세: 같은 worktree 계열의 자매 plan(`harness-consistency-summary-downgrade-rule.md`)은 관련 작업 완료를 상단 배너에 명시적으로 기록해 두었으나, 이 backstop 항목은 그 갱신에서 빠졌다.
  - 제안: 이 항목을 완료로 갱신하고 커밋/파일 경로를 근거로 남긴다(예: `harness-consistency-summary-downgrade-rule.md` 상단 배너와 동일한 방식으로 교차 기록).

- **[INFO]** `_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)` 가 `.claude/_shared/block_integrity.py:42` 와 `.claude/hooks/_lib/review_guard.py:141`(기존 코드) 양쪽에 문자 그대로 중복 정의돼 있다. 현재는 완전히 동일해 동작 불일치는 없지만, 이번 PR 이 없애려는 "두 곳에 같은 규칙" 패턴의 축소판이 새로 하나 더 생긴 셈이다. `review_guard._summary_block_is_no` 가 `block_integrity.summary_block_verdict` 를 호출하도록 정리하면 이 중복이 사라진다. 낮은 우선순위.

- **[INFO]** 이번 변경은 `codebase/`/`spec/` 가 아닌 `.claude/` 하네스 도구 영역이라 이를 규정하는 `spec/` 문서가 없다(CLAUDE.md 의 도메인 분리와 일치, 예상된 상태). 가장 가까운 "spec" 역할을 하는 `.claude/agents/consistency-summary.md` §요약 지침 3/4, `.claude/skills/consistency-checker/SKILL.md §4 BLOCK 처리` 는 새 코드의 경고 문구(`§요약 지침 3`, `§planner 인계`)와 정확히 대응하며, 변경 후에도 두 문서의 기존 서술("하향이 게이트를 실제로 통과시킨다")은 여전히 참이다(여전히 차단이 아니라 경고만 하므로). `SKILL.md §4` 는 이 기계적 경고 신호의 존재를 언급하도록 보강할 수는 있으나 현재 서술이 틀린 것은 아니다.

### 검증 메모 (참고)

- `.claude/tests/` 전체(724개) 를 `python3 -m unittest discover` 로 실행해 통과 확인(기존 725→ 이번 PR 로 8개 신규 케이스가 `test_block_integrity.py`/`test_retry_state_shared.py` 로 추가되고 전량 OK).
- `retry_state.py` 추출이 두 orchestrator 의 기존 stdout 포맷(공백 구분 `key=value` 나열, code-review 쪽 `skipped=`/`routing=` 필드 포함)을 정확히 보존하는지 `git diff` 로 대조하고 `test_retry_state_shared.py` 실행으로 재확인 — 일치.
- `block_integrity.downgraded_criticals`/`contradiction_note` 의 예외 경로(요약 없음/파일 대신 디렉터리/BLOCK 파싱 불가 등)는 모두 빈 값(`{}`/`""`)으로 안전하게 수렴하며 `test_block_integrity.py` 로 커버됨. `GateSurfacesTheContradictionTest` 는 predicate 단위 테스트가 아니라 `review_guard._newest_resolved_impl_done_mtime` 호출 지점까지 검증해 "함수는 맞는데 호출부가 빠졌다" 류의 vacuous 실패를 방지하는 구조로, 이 반복되어 온 실패 유형에 대한 대응이 적절하다.
- Gate 2(spec-linked) 판정 로직(`newest_impl_done <= 0.0` / `< newest_spec_code` 분기) 자체는 이번 diff 에서 변경되지 않았고, 새 경고는 판정 결과(`blocked`/`reason`)에 영향을 주지 않는 순수 side-effect(stderr 출력)로 확인됨 — 게이트의 BLOCK/ALLOW 정확도 자체를 흔들지는 않는다.

### 요약

핵심 기능(Critical 하향 금지 규약의 기계적 backstop, `code_review_orchestrator.py`/`consistency_orchestrator.py` 상태 bookkeeping 5종의 `_shared/retry_state.py` 통합)은 의도한 대로 동작한다 — `contradiction_note`/`downgraded_criticals` 는 문서화된 예시(하향 사례, prose 오탐 배제)에 대해 정확히 검출/침묵하고, `review_guard._newest_resolved_impl_done_mtime` 호출부까지 실제로 배선되어 있으며(호출 누락형 vacuous 실패 방지 테스트 포함), `retry_state.py` 로의 함수 이관은 두 orchestrator 의 CLI 출력 포맷을 바이트 단위로 보존한다(직접 실행 및 724개 하네스 테스트 전체 통과로 확인). 다만 세 가지 개선 여지가 있다: (1) 신규 경고가 게이트 판정과 무관하게 과거 전체 이력을 매 push/Stop 마다 무제한 재출력해 — 특히 Stop 훅 경유로 매 턴마다 — 스스로 경계한 "cries wolf" 위험을 실제로 안고 있고(현재 저장소에서 8건 즉시 재현), (2) `CHECKER_REPORTS` 가 `ALL_CHECKERS` 와 공유 소스·검증 없이 하드코딩돼 있어 이 PR 이 없애려는 것과 같은 종류의 drift 위험을 새로 만들었으며, (3) 정확히 이 작업을 가리키는 `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "backstop 없음" 서술이 이제 stale 하다. 셋 다 게이트의 BLOCK/ALLOW 정확도 자체를 깨뜨리지는 않는 비차단성 결함/문서 위생 문제다.

### 위험도

LOW
