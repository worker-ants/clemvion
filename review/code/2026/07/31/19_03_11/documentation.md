# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 공유 모듈로 옮기며 독스트링이 유실됨 — `apply_status_update`
  - 위치: `.claude/_shared/retry_state.py:138`
  - 상세: `code_review_orchestrator.py` 의 원래 `_apply_status_update` 는
    `"""Move agent between pending/success/fatal buckets and record history."""`
    한 줄 독스트링을 갖고 있었다(`git diff origin/main...HEAD` 로 확인). `_shared/retry_state.py`
    로 추출되며 이 독스트링이 사라졌다. 모듈 최상단 docstring 이 "AST comparison, docstrings
    excluded" 로 5개 함수를 비교했다고 명시하는데, 그 비교 방식 자체는 정확하고 정직하지만
    (`consistency_orchestrator.py` 쪽 원본엔 애초에 독스트링이 없었으므로 "동일" 판정 자체는
    맞다), 병합 결과로 두 원본 중 한쪽이 갖고 있던 설명이 조용히 사라졌다. 같은 파일의
    `reconcile_state_with_disk`(56-59행) 와 `emit_summary_state`(96-115행)는 모두 독스트링을
    유지했는데 `apply_status_update` 만 완전히 벌거벗은 채 남아 비대칭적이다. 이제 이 함수는
    3개 orchestrator 중 2곳(code-review, consistency)이 공유하는 SSOT 이므로, 개별 사본에 있던
    것보다 오히려 더 문서화가 필요한 위치다.
  - 제안: 원본에 있던 한 줄(또는 그 이상)을 `apply_status_update` 에 복원. `load_state`/
    `save_state` 는 두 원본 모두 독스트링이 없었던 자명한 I/O 한 줄짜리라 그대로 둬도 무방.

- **[WARNING]** 새 하향-모순 backstop 이 Stop 훅에는 닿지 않는데, 그 비대칭이 어디에도 설명돼
  있지 않음
  - 위치: `.claude/hooks/_lib/review_guard.py:718-760` (`_newest_resolved_impl_done_mtime` 가
    `notes` 를 채우는 지점), `.claude/hooks/guard_review_before_push.py:733`·`962`
    (`_report_notes` 정의 및 호출부 — 여기만 연결됨), `.claude/hooks/guard_review_before_stop.py:344-356`
    (`decision = evaluate_review(in_flight_ok=True)` 이후 `decision.blocked`/`decision.reason`
    만 읽고 `decision.notes` 는 전혀 참조하지 않음)
  - 상세: `evaluate_review()` 는 push/stop 두 훅이 공유하는 단일 함수이고, Gate 2 의 ALLOW
    분기(`review_guard.py:988-999`)에서 `notes` 가 채워지면 그 값은 호출자가 누구든 같은
    `ReviewDecision.notes` 에 담겨 반환된다. 그런데 실제로 그 값을 읽어 사용자에게 노출하는
    코드(`_report_notes`)는 `guard_review_before_push.py` 에만 배선됐다. `guard_review_before_stop.py`
    는 `decision.blocked` 가 `True` 일 때만 넛지를 발화하는데(354행), notes 가 채워지는 경로는
    정의상 항상 `blocked == False` 일 때뿐이므로(988행 `return ReviewDecision(False, ..., tuple(notes))`
    가 유일하게 `tuple(notes)` 를 넘기는 지점) 현재 Stop 훅 코드 구조로는 notes 를 읽어도 발화할
    자리가 없다 — 즉 침묵이 우연이 아니라 코드 구조상 필연이다.
    이 스코프 축소(push 전용)를 설명하는 주석이나 plan 기록이 어디에도 없다. `ReviewDecision.notes`
    필드 주석(review_guard.py:167-173)은 "the push hook reads stderr..." 라고 push 훅을 특정해
    적어 최소한의 스코프 힌트는 있지만, `evaluate_review` 자신의 docstring(895-911행)이나
    `guard_review_before_stop.py` 어디에도 "왜 Stop 은 이 신호를 못 받는가" 에 대한 설명이 없다.
    오히려 이 백스톱을 도입한 커밋(`e364b4159`) 메시지는 "스트림 선택은 호출자가 한다" 고
    호출자-무관하게 서술해, 마치 두 훅 모두 적용된 것처럼 읽힌다. 이 저장소는 push/stop 간
    다른 비대칭들(in-flight 억제·resolution-in-flight 억제)은 `review_guard.py` docstring 에서
    그 이유까지 명시적으로 설명하는 강한 관례를 갖고 있는데(69-84행), 이번 비대칭만 그 관례를
    벗어난다. `plan/in-progress/harness-review-gate-ci-backstop.md` 의 후속 목록도 `merge_coordinator`
    쪽 유사 갭(#9)은 등재했지만 이 갭은 등재하지 않았다.
  - 제안: 의도된 축소라면 `review_guard.py` docstring 또는 `evaluate_review` docstring 에
    "notes 는 현재 push 훅에서만 소비된다 — Stop 훅 확장은 [이유]로 후속" 같은 한 줄과 plan
    후속 항목을 추가. 의도치 않은 누락이라면 `guard_review_before_stop.py` 에도 notes 를
    stderr 로 내보내는 동등한 배선이 필요(단, MEMORY 에 기록된 대로 Stop 훅의 stdout 은
    `{"decision": ...}` 프로토콜 전용이므로 push 와 달리 **항상 stderr** 로 내야 함 — 스트림을
    exit code 로 고르는 push 쪽 로직을 그대로 복사하면 안 됨).

- **[WARNING]** 이 diff 로 인해 두 인접 문서의 "게이트는 BLOCK 한 줄만 파싱한다" 서술이 부분적으로
  낡음 (문서 자체는 diff 밖이지만, 서술 대상 코드가 이 diff 에서 바뀜)
  - 위치: `.claude/skills/consistency-checker/SKILL.md:114`, `.claude/agents/consistency-summary.md:49-51`
  - 상세: 두 문서 모두 "`review_guard.py` 는 `BLOCK:` 한 줄만 파싱하므로 그 하향이 게이트를
    실제로 통과시킨다(시켰습니다)" 라고 적어 하향 금지 규약의 근거로 삼는다. 이 diff 이전에는
    정확한 서술이었지만, 지금은 `review_guard._newest_resolved_impl_done_mtime` 가
    `_block_integrity.contradiction_note()` 를 통해 각 checker 리포트의 `[CRITICAL]` 개수까지
    대조해 모순이 있으면 경고를 낸다(다만 차단은 여전히 안 함 — BLOCK 값 자체는 안 바뀐다).
    즉 "한 줄만 파싱한다" 는 이제 문자 그대로는 틀렸고, 정확히는 "판정 자체는 BLOCK 한 줄로
    내려지지만, 게이트가 이제 그 판정과 checker 리포트의 모순을 감지해 경고는 낸다" 가 맞다.
    핵심 규범(하향 금지)과 결론(그 하향이 여전히 차단으로 이어지진 않는다)은 그대로 유효하므로
    독자를 오도할 위험은 낮지만, 정확히 이 리뷰 항목(#4 주석 정확성 — 오래된 주석)이 잡아야 할
    사례다.
  - 제안: 두 문서에 "(2026-07-31 부터 `block_integrity.py` 가 이 모순을 감지해 경고하지만
    차단하지는 않는다)" 정도의 짧은 각주 추가. 이 PR 범위 밖이면 최소한 plan 후속 항목으로
    등재.

- **[INFO]** 두 훅의 최상단 "Contract/Policy" docstring 에 새 notes 채널이 언급되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:2-41` (모듈 docstring, 특히 "Contract"
    단락), `.claude/hooks/_lib/review_guard.py:1-89` (모듈 docstring)
  - 상세: 두 docstring 모두 이 훅이 낼 수 있는 관측 가능한 신호를 상세히 열거하는 강한 관례를
    갖고 있다(예: `guard_review_before_push.py` 의 "Fail-open is OBSERVED, not silent" 단락이
    배너·카운터를 명시). 이번에 추가된 세 번째 채널(ALLOW 경로에서의 하향-모순 advisory)은
    함수 수준(`ReviewDecision.notes` 필드 주석, `_report_notes` docstring)에서는 잘 설명돼
    있지만, 두 최상단 docstring 에는 한 줄도 언급되지 않는다. 정확성 문제는 아니고 완결성
    문제(생략)라 INFO.
  - 제안: 필수는 아니나, "Contract" 절 끝에 "ALLOW 시 stdout 으로 하향-모순 advisory 가 추가될
    수 있다(`_block_integrity`)" 한 줄을 추가하면 관례와의 일관성이 회복됨.

- **[INFO]** `subagent-call-contract.md` 의 "자가 reconcile" 서술이 merge-coordinator 세션에는
  적용되지 않음 (이 diff 이전부터 있던 갭, 이미 plan 에 후속으로 등재됨)
  - 위치: `.claude/docs/subagent-call-contract.md:120` ("`--summary-state`/`--resume` 가 읽을 때
    디스크로 자가 reconcile 한다")
  - 상세: 이번 diff 로 `code_review_orchestrator`/`consistency_orchestrator` 의
    `reconcile_state_with_disk` 는 `_shared/retry_state.py` 로 통합됐지만,
    `merge_coordinator_orchestrator.py` 는 애초에 이 함수가 없어(`_emit_summary_state` 가
    reconcile 를 호출하지 않음, 코드 확인 완료) 자가 reconcile 이 안 된다. 이 문서는 orchestrator
    종류를 구분하지 않고 일반화해서 서술한다. `plan/in-progress/harness-review-gate-ci-backstop.md`
    항목 #9 이 이 코드 갭 자체는 이미 정확히 추적하고 있으므로 새로운 발견은 아니고, 이
    cross-cutting 계약 문서에도 같은 각주가 필요하다는 부수 참고 사항.
  - 제안: 우선순위 낮음. `merge_coordinator` 의 `reconcile_state_with_disk` 이식(plan #9)이
    선행되면 자동으로 해소되므로, 그때 이 문서도 함께 확인.

## 긍정적으로 확인된 사항

- `.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py` 신규 모듈 모두 모듈
  docstring 에 "왜(측정 수치 포함)"·"왜 아닌가"까지 갖춘 상세한 근거를 담고 있고, 함수별
  독스트링(위 1건 제외)도 충실하다. 인용된 측정치(732/698/24/10, 242/400, 154/113)가 코드·
  테스트·`README.md`·plan 문서 네 곳 모두에서 서로 정확히 일치함을 직접 대조로 확인했다.
- `.claude/tests/README.md` 는 신규 테스트 파일 2개(`test_block_integrity.py`,
  `test_retry_state_shared.py`) 행을 정확한 설명과 함께 추가했다 — `test_tests_readme_catalog.py`
  가 요구하는 동기화 그대로.
  카탈로그
- `plan/in-progress/harness-review-gate-ci-backstop.md` 는 항목 #2 를 취소선 + "구현 완료"로
  정확히 갱신했고, 리팩터 중 발견한 `merge_coordinator_orchestrator.py` 의 결여(자기치유 없음)를
  새 항목 #9 로 등재하며 뒤 항목 번호를 10 으로 올바르게 재조정했다(중복·누락 없음, 직접 확인).
- 코드 내 인라인 주석이 예외적으로 촘촘하다 — 특히 `_evaluate_over_targets` 의
  `_Outcome.notes` 처리(`.claude/hooks/guard_review_before_push.py`)가 "`_lib.failopen_state`
  의 `_Outcome` 는 이 필드를 모른다" 고 적은 주장을 실제 `failopen_state.py` 소스로 대조해 정확함을
  확인했다.
- 새 환경변수·설정 옵션 없음(diff 전수 grep 확인), API 엔드포인트 변경 없음, CHANGELOG.md 는
  이 저장소 관례상 product 변경 전용이라 harness-only 인 이 PR 은 대상 아님(과거 harness 전용
  커밋들도 CHANGELOG 미기재로 확인) — 해당 체크리스트 항목들은 이번 diff 에 적용 대상 없음.

## 요약

이번 변경은 문서화 수준이 전반적으로 높다 — 신규 공유 모듈 2개(`block_integrity.py`,
`retry_state.py`) 모두 실측 근거를 곁들인 모듈/함수 독스트링을 갖췄고, 테스트 README 와 plan
문서 갱신도 정확하며 서로 다른 4곳(코드·테스트·README·plan)의 수치 인용이 전부 일치한다. 다만
세 가지는 손볼 가치가 있다: (1) 공유 모듈로 옮기며 `apply_status_update` 하나가 원래 갖고 있던
한 줄 독스트링을 잃었고, (2) 신규 하향-모순 backstop 이 실제로는 push 훅에만 배선돼 있는데 그
스코프 축소가 코드 어디에도 설명돼 있지 않으며 도입 커밋 메시지는 오히려 양쪽 다 적용된 것처럼
읽힌다, (3) 이 diff 가 바꾼 `review_guard.py` 의 동작 때문에 두 인접 문서(SKILL.md,
consistency-summary.md)의 "BLOCK 한 줄만 파싱한다" 서술이 부분적으로 낡았다. 셋 다 안전이나
차단 로직 자체에 영향을 주지는 않는 문서/설명 완결성 문제다.

## 위험도

LOW
