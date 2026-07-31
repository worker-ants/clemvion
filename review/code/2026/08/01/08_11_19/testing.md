# 테스트(Testing) Review — round 8

대상: `.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py`,
`.claude/hooks/_lib/{failopen_state,review_guard}.py`,
`.claude/hooks/guard_review_before_{push,stop}.py`,
`.claude/skills/{code-review-agents,consistency-checker,merge-coordinator}/scripts/*.py`,
`.claude/tests/{test_block_integrity,test_retry_state_shared,test_consistency_orchestrator_state,test_stop_guard_failopen,README}.*`,
`plan/in-progress/harness-review-gate-ci-backstop.md`.

방법: 잘린 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`,
`test_block_integrity.py`)은 전부 `Read` 로 원본을 열어 확인했고, `origin/main...HEAD`
diff 로 각 파일의 실제 변경 범위를 재확인했다. 하네스 테스트 전체(753개)를 1회 실행했고
(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → OK), round 7 이 고친
두 결함(정규식 O(n²), 차단 시 advisory 유실)의 회귀 테스트가 **실제로 vacuous 하지 않은지**
파일을 원상복구 가능한 방식(`cp` 백업 → mutate → 실행 → `cp` 복원, `git diff` 로 clean 확인)으로
3건 직접 측정했다. 아래 발견 중 WARNING 1건은 같은 방식으로 실제 mutation 을 적용해
"현재 테스트 스위트가 통과시키는지"를 직접 실행으로 확인한 것이다.

## 발견사항

- **[WARNING]** `evaluate_review()` 의 Gate 2 downgrade-advisory(`notes`) 배선이 실 데이터로
  end-to-end 검증된 적이 없다 — 관련 테스트 전부가 그 값을 채우는 함수 자체를 mock 으로
  대체한다.
  - 위치: `.claude/hooks/_lib/review_guard.py:975-979` (`evaluate_review`, Gate 2 —
    `notes: list[str] = []` 선언 후 `_newest_resolved_impl_done_mtime(repo_root, dirty, notes)`
    호출) / `.claude/tests/test_review_guard.py:369-385` (`SpecConsistencyGateTest._evaluate`)
  - 상세: `SpecConsistencyGateTest._evaluate` 는
    `mock.patch.object(rg, "_newest_resolved_impl_done_mtime", return_value=impl_done_mtime)`
    로 **notes 를 실제로 채우는 그 함수 자체**를 완전히 대체한다 — mock 은 자신에게 전달된
    `notes` 리스트를 절대 건드리지 않으므로, 이 클래스의 4개 테스트는 전부 `d.notes == ()`
    상태에서 실행되고 애초에 `.notes` 를 단언하지도 않는다. `test_block_integrity.py` 의
    notes 관련 테스트들도 이 갭을 메우지 못한다: `NotesSurviveBlockingTest.
    test_the_contradiction_is_collected_for_the_adopted_session`(674-706줄 앞)은
    `_newest_resolved_impl_done_mtime` 을 **직접** 호출해 그 함수 자신의 로직만 보고,
    `test_blocking_returns_carry_notes`(674-706줄)는 `ast` 로 각 `ReviewDecision(...)` 호출의
    **위치 인자 개수**(`len(args) >= 3`)만 세지 변수가 실제로 `notes` 를 가리키는지는
    확인하지 않는다. 즉 "`evaluate_review()` 를 실제로 호출했을 때 Gate 2 에서 수집한
    downgrade note 가 정말로 반환값까지 전달되는가" 를 검증하는 테스트가 스위트 전체에 하나도
    없다.
  - **직접 실측(mutation)**: `review_guard.py:979` 를 `_newest_resolved_impl_done_mtime(repo_root,
    dirty, notes)` → 새 throwaway 리스트로 shadow(`_newest_resolved_impl_done_mtime(repo_root,
    dirty, _shadowed_notes)`, 바깥 `notes` 는 영원히 빈 리스트)로 바꾼 뒤(파일은 `cp` 로
    백업/복원, 최종 `git diff` 로 clean 확인) 관련 테스트 파일 전부를 실행했다:
    `test_review_guard.py`(37), `test_block_integrity.py`(33),
    `test_review_guard_hardening.py`(47), `test_stop_guard_failopen.py`(17),
    `test_forced_coverage_selection.py`(7), `test_consistency_impl_done.py`(2) —
    **143개 전부 GREEN.** round 7 이 `_evaluate_over_targets` 에서 고친 것과 같은 클래스
    ("advisory 가 조용히 유실")의 결함이 `evaluate_review()` 자신에게 재도입돼도 현재는
    아무도 못 잡는다.
  - 제안: `test_review_guard_hardening.py::RebaseAuthorDateTest` 가 이미 쓰는 "실제 임시
    git repo + Gate 1 충족" 패턴과 `test_block_integrity.py::GateSurfacesTheContradictionTest.
    _repo_with_session` 가 이미 쓰는 "downgrade 된 consistency 세션 생성" 패턴을 결합해,
    spec `code:` glob 에 매칭하는 실제 파일 변경 + `--impl-done`/`BLOCK: NO`/`[CRITICAL]`
    체커 리포트를 갖춘 저장소에서 `_newest_resolved_impl_done_mtime` 을 **mock 하지 않고**
    `rg.evaluate_review(root)` 를 호출해 `d.notes` 가 비어있지 않음을 단언하는 테스트를
    추가할 것. 필요한 헬퍼가 이미 두 파일에 흩어져 있어 비용이 낮다.

- **[INFO]** 멀티 워크트리 end-to-end 픽스처(`_REVIEW_STUB`)에 `notes` 필드가 없어, round 7
  이 고친 "target 순서 의존 advisory 유실" 결함이 **실제 `_push_targets` 워크트리 선정 경로**를
  통해서는 재발 감지되지 않는다.
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:55-80` (`_REVIEW_STUB`)
  - 상세: 이 결함의 핵심 재현 테스트인 `NotesFromLaterTargetsSurviveAnEarlierBlockTest`
    (`test_block_integrity.py`)는 `_evaluate_over_targets` 를 합성 문자열 target(`/w/0`,
    `/w/1`)으로 직접 구동한다 — 실제 로직 검증으로는 타당하지만, 실제 `git worktree list`
    파싱·경로 해석을 거치는 `test_push_guard_worktree_scope.py` 의 2-워크트리 subprocess
    스위트는 `_REVIEW_STUB`/`_PLAN_STUB` 어느 쪽도 `notes` 를 정의하지 않아 이 결함 클래스를
    전혀 건드리지 않는다. `_evaluate_over_targets` 는 `targets` 를 문자열로만 다루므로 위험은
    좁지만(target 선정 로직과 note 수집 로직이 얽히는 미래 변경에서만 노출), 두 스위트가
    같은 결함을 서로 다른 각도에서 커버한다는 인상을 주는 것과 달리 실제로는 한쪽만 커버한다.
  - 제안: `_REVIEW_STUB` 의 `_Decision` 에 `notes: tuple = ()` 필드와 이를 채우는 env 훅
    (`STUB_NOTES_PATHS` 류)을 추가해 2-워크트리 시나리오에서도 순서 보존을 검증.

- **[INFO]** (결함 아님, 확인됨) `merge_coordinator_orchestrator.py` 는 `_load_state`/
  `_save_state`/`_apply_status_update` 만 `_shared/retry_state.py` 로 위임하고
  `_reconcile_state_with_disk` 자기치유는 갖지 않는다 — 다른 두 orchestrator 와 달리 Agent
  tool 직접 fan-out 세션에서 상태가 prepare 스냅샷에 멈출 수 있다는 뜻. 코드 주석과
  `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 #9 양쪽에 **정직하게 기록된
  의도적 defer** 이므로 이번 라운드의 테스트 갭으로 지적하지 않는다 — 다만 나중에 이 gap 이
  닫히면 `test_retry_state_shared.py::MergeCoordinatorUsesTheSharedStateTest` 에 대응
  테스트(`test_consistency_orchestrator_state.py::test_summary_state_reconciles_before_reporting`
  와 대칭)가 필요하다는 점만 남긴다.

## 확인된 사항 (긍정 — 직접 측정)

- **정규식 O(n²) 회귀 테스트는 vacuous 하지 않다.** `_BLOCK_AT_LINE_START` 를 옛
  `[\s>#*_\`-]*` (줄바꿈 포함) 패턴으로 되돌려 동일 20,000줄 입력(`("> "*3+"\n")*20000`)을
  직접 실행 — **27.34초** (테스트의 5초 timeout 을 훨씬 초과). 현재 패턴은 같은 입력에서
  1ms 미만. `VerdictParserStaysLinearTest.test_no_verdict_in_a_large_document_returns_fast`
  가 실제로 재발을 잡는다는 것을 실행으로 확인.
- **"차단 시 advisory 유실" 회귀 테스트도 vacuous 하지 않다.** `guard_review_before_push.py`
  사본에서 `_evaluate_over_targets` 의 수정 후 코드(`blocked = render(...)` 후 loop 계속)를
  옛 코드(`if result.push_blocks: return render(...)`, 즉시 반환)로 되돌려 2-target 시나리오
  ([블록+note A], [비블록+note B])를 실행 — note B 가 `outcome.notes` 에서 사라짐을 확인.
  `NotesFromLaterTargetsSurviveAnEarlierBlockTest` 가 이 정확한 재발을 잡는다.
- **Stop 훅의 텍스트-다이제스트 스로틀 회귀 테스트도 vacuous 하지 않다.** 다이제스트 키를
  옛 `enumerate()` 인덱스 키로 되돌려 실행 — 첫 호출의 note("WARN_A_TEXT")는 통과하지만
  **다른 텍스트의 두 번째 note("WARN_B_TEXT")도 억제됨**을 확인(정확히 문서가 서술하는
  회귀). `StopThrottleKeysOnTextTest.test_a_different_note_still_gets_through` 가 이를 잡는다.
- 세 실측 모두 파일을 실제로 mutate 하기 전 `cp` 로 절대경로 백업 후 실행, 종료 직후 `cp` 로
  원복하고 `git status`/`git diff` 로 clean 함을 확인했다(작업 트리에 잔여 변경 없음).
- 하네스 테스트 스위트 전체(753개, `.claude/tests/test_*.py`)를 1회 실행 — 전부 GREEN. 이번
  라운드가 세 orchestrator 에 걸쳐 5개 상태 함수를 `_shared/retry_state.py` 로 옮기고
  `block_integrity.py` 를 신설한 리팩터임에도 회귀가 없음을 확인(회귀 테스트 유효성 항목).
- `test_tests_readme_catalog.py`(README 카탈로그 1:1 동기화), `PlanStubsMirrorTheRealInterfaceTest`
  (모든 손수작성 `evaluate_plan`/`evaluate_review` 스텁이 `push_blocks` 를 갖는지 자동 감사)
  같은 "메타 테스트" 가 잘 설계돼 있어 스텁 드리프트·문서 드리프트를 구조적으로 차단한다.

## 항목별 평가

1. **테스트 존재**: 매우 좋음 — `test_block_integrity.py`(33개, 신규), `test_retry_state_shared.py`
   (9개, 신규)가 이번 변경의 핵심 로직을 촘촘히 덮는다.
2. **커버리지 갭**: 위 WARNING 1건(Gate 2 notes 의 실제 데이터 경로) 외에는 갭이 작다.
3. **엣지 케이스**: 우수 — verdict anchor 4가지 실제 사례 재현, 빈/손상 리포트, 누락 매니페스트,
   worktree 삭제 등 폭넓게 커버.
4. **Mock 적절성**: `SpecConsistencyGateTest` 가 Gate 2 임계값 로직을 격리하는 것 자체는
   타당하지만, 그 결과로 "실 데이터가 `notes` 까지 도달하는가" 를 검증할 자리가 통째로
   비게 된 것이 이번 리뷰의 핵심 지적.
5. **테스트 격리**: 좋음 — temp dir + `addCleanup`, subprocess 테스트의 `CLAUDE_PROJECT_DIR`
   격리, `SuiteLeavesNoRealStateTest` 로 실제 저장소 오염 여부까지 스위트가 자체 감시.
6. **테스트 가독성**: 매우 우수 — 거의 모든 테스트 클래스/메서드에 "왜 이 테스트가 존재하는가"
   (과거 결함·실측치·재현 사례)가 docstring 으로 박혀 있다.
7. **회귀 테스트**: round 7 의 두 핵심 수정 모두 vacuous 하지 않음을 직접 실측 확인(위 참조).
8. **테스트 용이성**: 좋음 — `now`/`marker_dir` 주입, `_accepts_cwd` 명시적 프로빙,
   `emit_summary_state` 의 callable `extra_fields` 설계 모두 테스트를 쉽게 만든다.

## 요약

이번 라운드(8R)는 round 7 이 남긴 두 결함(판정 정규식 O(n²), push target 순서에 따른 advisory
유실)에 대해 명확한 회귀 테스트를 갖추고 있으며, 세 가지 모두 실제로 mutate-and-run 방식으로
"vacuous 하지 않음"을 직접 확인했다(정규식 되돌리면 27초로 timeout 초과, 루프 조기 return
되돌리면 뒤 target 의 note 소실, 인덱스 키로 되돌리면 다른 텍스트 note 도 억제). 하네스
테스트 스위트 753개 전체가 GREEN 이라 이번 리팩터(5개 상태 함수의 `_shared/retry_state.py`
추출, `block_integrity.py` 신설)로 인한 회귀도 없다. 다만 Gate 2 의 downgrade advisory
(`notes`)가 `evaluate_review()` 라는 공개 진입점을 통해 실제로 흘러나오는지 검증하는 테스트가
스위트 전체에 없다는 점을 직접 mutation 으로 확인했다 — 관련 테스트(`SpecConsistencyGateTest`)
가 그 값을 채우는 함수 자체를 mock 으로 대체하기 때문이며, 이는 정확히 round 7 이 지적한
"advisory 가 조용히 유실될 수 있다"는 결함 클래스가 `evaluate_review()` 자신에게 재도입돼도
현재 아무 테스트도 잡지 못한다는 뜻이다(코드 자체는 현재 올바름 — 순수 커버리지 갭). 부차적으로
멀티 워크트리 실제 subprocess 스위트의 스텁에도 `notes` 필드가 없어 같은 결함 클래스를 실
워크트리 선정 경로에서는 검증하지 못한다. 두 갭 모두 기존 헬퍼 패턴을 조합하면 낮은 비용으로
닫을 수 있다.

## 위험도

LOW — CRITICAL 급 결함은 없고(코드 자체는 정확함이 직접 실측으로 확인됨), 지적된 WARNING 은
활성 결함이 아니라 "향후 회귀를 못 잡는" 커버리지 갭이다. 회귀 테스트 3건의 비-vacuous 함은
직접 실측으로 확인됐고 전체 스위트도 GREEN 이라 이번 라운드의 테스트 품질은 전반적으로 견고하다.
