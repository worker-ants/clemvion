# 테스트(Testing) Review — harness-block-backstop

## 발견사항

- **[CRITICAL]** Stop 훅의 note throttle 마커가 "내용"이 아니라 "위치(idx)" 로 키잉되어, 실제로는 서로 다른 하향 경고가 영구히 삼켜진다 — 코드 주석의 명시적 계약을 위반하며, 이를 잡을 테스트가 전혀 없다.
  - 위치: `.claude/hooks/guard_review_before_stop.py:369-373` (주석 vs 구현 불일치), 테스트 부재 지점: `.claude/tests/test_block_integrity.py` `NotesReachBothHooksTest` 클래스(307-376행) — 동일 세션/브랜치에 대해 훅을 **두 번 이상** 호출하는 테스트가 스위트 전체에 단 하나도 없음(확인: `grep -rn "note0\|note{idx}\|decision.notes" .claude/tests/*.py` 결과 무관한 매치 1건뿐).
  - 상세: 369-370행 주석은 "The marker keys on the note text, so a DIFFERENT contradiction still gets through" 라고 명시하지만, 실제 구현(373행)은 `marker = _marker_path(session_id, token, f"note{idx}")` — `idx` 는 `enumerate(decision.notes)` 의 **위치 인덱스**이지 노트 텍스트의 해시/내용이 아니다. 직접 재현 스크립트로 검증한 결과:
    ```
    RUN1 (note="SESSION-A: first contradiction")   → stderr: "SESSION-A: first contradiction"
    RUN2 (note="SESSION-B: a totally different …") → stderr: "" (완전히 다른 문구인데도 억제됨)
    ```
    `decision.notes` 는 현재 항상 원소 0~1개(`_newest_resolved_impl_done_mtime` 이 "채택된 세션" 단 하나에 대해서만 append)이므로, 실질적으로는 "그 브랜치에서 처음 뜬 하향 경고 이후에는, 완전히 다른 세션·다른 checker 의 하향이 발생해도 Stop 넛지가 두 번 다시 뜨지 않는다" 는 뜻이다. 이 기능 자체가 막으려던 "하향이 조용히 지나간다" 실패 모드를 넛지 레이어에서 그대로 재현한다. (다만 hard gate 인 push 훅의 `_report_notes` 는 매번 무조건 출력하므로 — throttle 없음 — 실제 차단 경로 자체는 이 결함의 영향을 받지 않는다.)
  - 제안: 마커 키를 노트 텍스트 기반으로 바꾼다(예: `hashlib.sha1(note.encode()).hexdigest()[:10]`). 회귀 테스트로 동일 session_id/token 에 대해 (a) **동일 문구** 2회 호출 시 2번째는 억제, (b) **다른 문구**(같은 idx 위치) 2회 호출 시 2번째도 출력되는지를 함께 고정한다 — 현재 스위트는 훅을 세션당 1회만 호출하므로 이 축 자체가 전혀 커버되지 않는다.

- **[WARNING]** `NotesReachBothHooksTest` 의 `_CLEAN_PLAN` 스텁이 `push_blocks` 를 빠뜨려, push 훅 테스트가 "정상 ALLOW 경로" 가 아니라 "PLAN 게이트 크래시 → fail-open" 경로로 우연히 통과한다.
  - 위치: `.claude/tests/test_block_integrity.py:328-331`(`_CLEAN_PLAN` 정의), `:347-359`(`test_push_hook_surfaces_notes_on_stdout`). 원인 코드: `.claude/hooks/guard_review_before_push.py:860`(`if result.push_blocks:` — REVIEW/PLAN 두 게이트 결과 모두에 대해 무조건 접근).
  - 상세: 실제 `plan_guard.PlanDecision` 은 `push_blocks` 를 `@property`(`return self.untouched`)로 제공하지만, 테스트의 `_CLEAN_PLAN` 스텁 문자열은 `untouched`/`complete_but_in_progress`/`reason`/`plan_path` 만 정의하고 `push_blocks` 는 없다. 재현 결과, PLAN 게이트 평가 시 `AttributeError: '_P' object has no attribute 'push_blocks'` 가 발생 → `_evaluate_over_targets` 의 try/except 는 `evaluate()` 호출만 감싸므로 이 예외는 잡히지 않고 `main()` 최상위 `except` 로 전파되어 `outcome.degraded.append(("DETECTION", …))` 로 기록되고 fail-open(exit 0) 된다. 테스트가 기대하는 "하향 감지" 문자열은 REVIEW 게이트가 먼저 정상 처리되며 `outcome.notes` 에 이미 쌓아둔 노트가, 이 크래시-then-fail-open 경로에서도 `_report_notes(outcome, 0)` 로 출력되기 때문에 우연히 stdout 에 나타나 테스트가 green 이 된다(직접 subprocess 로 재현해 stderr 에 위 traceback 이 실제로 찍히는 것을 확인함). 클래스 docstring 은 "These drive the real hooks end to end" 라 주장하지만 push 훅 변형은 실제로 "정상 ALLOW" 시나리오를 구동하지 않는다 — 매 테스트 실행마다 무관한 traceback 이 stderr 에 남는 부작용도 있다. (다행히 "정상 ALLOW 시 stdout 출력" 계약 자체는 `AdvisoryReachesTheModelTest.test_push_hook_prints_notes_on_stdout_when_allowing` 가 `_report_notes` 를 격리 단위테스트로 별도 검증하므로 완전히 무방비는 아니다.)
  - 제안: `_CLEAN_PLAN` 스텁에 `push_blocks = False` (또는 `@property` 미러링)를 추가해 실제 `PlanDecision` 인터페이스와 맞춘다.

- **[WARNING]** `contradiction_note()` 의 메시지 포맷팅(체커명·개수 join) 을 검증하는 단언이 없다.
  - 위치: `.claude/_shared/block_integrity.py:137-139`(`parts = ", ".join(f"{k[:-3] if k.endswith('.md') else k}={v}" for k, v in sorted(found.items()))`). 관련 테스트: `.claude/tests/test_block_integrity.py:173-184`(`DowngradedCriticalsTest.test_flags_the_real_downgrade_shape`).
  - 상세: 이 테스트는 `BI.downgraded_criticals(d)` 의 dict 결과는 정확히 단언하지만(`{"convention_compliance.md": 2, "plan_coherence.md": 1}`), `BI.contradiction_note(d)` 에 대해서는 `assertIn("§planner 인계", …)` 만 확인한다. 이 문자열은 `found` 의 내용과 무관하게 템플릿에 항상 고정으로 들어있으므로, `parts` 변수(`.md` 접미사 제거, `sorted()` 정렬, `=`/`, ` 결합 로직)를 깨는 뮤테이션은 어떤 테스트로도 잡히지 않는다.
  - 제안: 위 테스트에 `self.assertIn("convention_compliance=2", note)` / `self.assertIn("plan_coherence=1", note)` 류의 단언을 추가한다.

- **[WARNING]** 신규 `MergeCoordinatorUsesTheSharedStateTest` 는 `merge_coordinator_orchestrator.py` 의 `--update` 만 검증하고, 같은 리팩터로 함께 바뀐 `--summary-state` 경로는 여전히(리팩터 전후 모두) 완전 무테스트다.
  - 위치: `.claude/tests/test_retry_state_shared.py:142-172`(`MergeCoordinatorUsesTheSharedStateTest`, `--update` 만 실행). 영향 코드: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85-98`(`_emit_summary_state` — 로컬에 남아 branch/base 필드를 다루지만 내부에서 `_load_state` 호출)와 `:113-114`(`_load_state` 가 이제 `_retry_state_lib.load_state` 로 위임).
  - 상세: `git grep` 결과 `merge_coordinator_orchestrator` 를 참조하는 테스트 파일은 이 신규 파일 하나뿐이며, `--summary-state`/`--resume` 를 구동하는 테스트는 프로젝트 전체에 없다. 이 PR 의 동기 자체가 "세 번째 소비자(merge-coordinator)가 그 어떤 테스트도 없었다" 는 것이었는데(`test_retry_state_shared.py` 클래스 docstring), `_load_state` 위임이 바뀐 지점(`--summary-state`→`_emit_summary_state`→`_load_state`)은 정확히 손대지 않은 채 남아 있다. `--load_state` 위임의 반환 튜플 순서나 예외 처리(missing state file 시 `sys.exit(1)`)가 회귀해도 이 소비자 하나만 조용히 깨질 수 있다.
  - 제안: `SummaryStateCliTest` 와 동일한 패턴으로 merge-coordinator 의 `--summary-state`(branch/base 필드 포함)를 커버하는 테스트를 추가한다.

- **[INFO]** `summary_block_verdict` 의 "두 배너가 동시에 존재할 때 파일상 먼저 나오는 쪽이 이긴다"는 동작(56-59행 주석)을 직접 겨냥하는 픽스처가 없다.
  - 위치: `.claude/_shared/block_integrity.py:56-65`. 관련 테스트: `.claude/tests/test_block_integrity.py:114-155`(`VerdictIsAnchoredTest`).
  - 상세: `test_an_override_banner_at_line_end_wins` 등 4개 케이스 모두, "오래된"(stale) 줄은 뒤에 프로즈가 붙어 있어 애초에 `_BLOCK_AT_LINE_END` 에 매칭되지 않는 형태다 — 즉 END 패턴에 매칭되는 줄이 파일 안에 정확히 1개뿐인 경우만 고정되어 있고, END 패턴에 매칭되는 줄이 **둘 이상**일 때 `.search()` 가 첫 번째(파일상 앞쪽) 매치를 취한다는 실제 우선순위 로직은 별도로 겨냥되지 않는다.
  - 제안: 두 줄 모두 END 앵커 형태(`... **BLOCK: NO**`)를 만족하되 값이 다른 픽스처를 추가해 "앞쪽이 이긴다" 를 직접 고정.

## 요약

`_shared/block_integrity.py`·`_shared/retry_state.py` 핵심 로직과 이를 review_guard/두 훅에 배선하는 부분은 테스트가 꼼꼼하다 — 실측 통계(732 세션 중 24건)를 근거로 한 엣지 케이스, prose 오탐 배제, AST 기반 checker-list 3중 교차검증, 정규식 대신 `ast` 로 3개 반환문 모두를 구조적으로 확인하는 `test_blocking_returns_carry_notes`, `save_state` 원자적 쓰기의 실패 시나리오까지 모두 잘 짜여 있고, 회귀 스위트(기존 169개 + 신규)는 실행 결과 전부 green 이었으며 `ReviewDecision.notes` 기본값 하위호환도 확인됐다. 다만 실제로 코드를 실행해 검증한 결과, Stop 훅의 note throttle 이 "내용이 아니라 위치로 키잉"되어 주석이 약속한 동작("다른 하향은 통과")을 위반하는 실질적 결함을 발견했고, 이를 잡을 반복호출 테스트가 스위트에 전무하다 — 이번 PR 이 막으려던 "하향이 조용히 지나간다" 실패 모드를 넛지 레이어에서 재현한 셈이다. 그 외에도 새 e2e 성격 테스트(`NotesReachBothHooksTest`) 하나가 불완전한 PLAN 스텁 때문에 의도한 "정상 ALLOW" 경로가 아니라 우연한 크래시-fail-open 경로로 통과하고 있는 점, `contradiction_note` 의 메시지 포맷 자체는 미검증인 점, 세 번째 소비자(merge-coordinator)의 커버리지가 `--update` 로만 절반 채워진 점을 확인했다.

## 위험도
HIGH
