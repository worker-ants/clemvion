# 테스트(Testing) Review

## 스코프 메모

이번 리뷰 대상 44개 파일은 전부 `review/code/2026/08/01/{00_03_38,00_33_34,01_17_35,01_17_47}/**`
하위의 리뷰 산출물(`*.md` 리포트, `meta.json`, `_retry_state.json`)이다 — 이전 4개 리뷰 라운드가
`.claude/_shared/block_integrity.py`·`.claude/_shared/retry_state.py`·hooks·orchestrator·
`.claude/tests/test_block_integrity.py`·`test_retry_state_shared.py` 등 실제 하네스 소스에 대해
남긴 기록이며, 그 소스 diff 자체는 이번 44개 파일 목록에 없다(이미 별도 커밋으로 병합돼 있음:
`30cc0f738`~`8b3be3ce6`). 따라서 이번 diff 가 "새로 도입한 미검증 코드"는 없다. 대신 이 리포트들이
서술하는 테스트 관련 주장(수정됨/커버됨/잔여 갭)이 현재 저장소 상태와 실제로 일치하는지를
`Read`/`Bash`(`grep`, `python3 -m unittest`)로 직접 대조 검증했고, 그 과정에서 이전 4라운드 중
어느 곳에서도 지적되지 않은 잔여 항목 1건을 추가로 발견했다.

## 검증 방법

- `python3 -m unittest discover -s .claude/tests -p "test_*.py"` 직접 실행 → **749 tests, OK**
  (`review/code/2026/08/01/01_17_35/RESOLUTION.md` 이 주장하는 "749 tests OK" 와 정확히 일치).
- `review/code/2026/08/01/01_17_35/RESOLUTION.md`(5R)·`.../testing.md`(5R, 4R)가 서술하는 CRITICAL/WARNING
  처분 각각에 대해 대응 코드·테스트를 직접 `Read` 로 열어 대조.
- `push_blocks`/`ReviewDecision`/`PlanDecision` duck-type 스텁이 등장하는 테스트 파일 전수
  (`test_block_integrity.py`, `test_stop_guard_failopen.py`, `test_guard_review_before_push_main.py`,
  `test_push_guard_worktree_scope.py`)를 교차 비교.

## 발견사항

- **[WARNING]** `test_stop_guard_failopen.py`의 `_CLEAN_PLAN` 스텁이 이 PR이 이미 한 번 고친 것과
  똑같은 결함("PlanDecision 흉내 스텁에 `push_blocks` 누락")을 그대로 갖고 있다 — 현재는 우연히
  트리거되지 않을 뿐, 잠복한 재발 지점이다.
  - 위치: `.claude/tests/test_stop_guard_failopen.py:49-51`(`_CLEAN_PLAN` 정의 — `untouched`/
    `complete_but_in_progress`/`reason`/`plan_path` 만 있고 `push_blocks` 없음). 트리거 지점:
    `.claude/hooks/guard_review_before_push.py:867`(`if result.push_blocks:` — REVIEW/PLAN
    두 게이트의 결과 객체 모두에 대해 무조건 접근). 이미 고쳐진 자매 스텁:
    `.claude/tests/test_block_integrity.py:361-365`(`NotesReachBothHooksTest._CLEAN_PLAN`, 지금은
    `push_blocks` property 를 갖춤), `test_guard_review_before_push_main.py:99-107`,
    `test_push_guard_worktree_scope.py:88-95`(둘 다 `push_blocks` 정상 포함).
  - 상세: 이번 diff(정확히는 그 원본 소스 커밋들)가 고친 W16 은 "`test_block_integrity.py`의
    `_CLEAN_PLAN` 이 `push_blocks` 를 빠뜨려, push 훅 테스트가 실제로는 PLAN 게이트
    `AttributeError`→최상위 `except`→fail-open(exit 0) 경로를 타면서도 REVIEW 게이트가 먼저
    쌓아 둔 notes 가 우연히 stdout 에 남아 '정상 통과'로 오인됐다"는 결함이었다. 그런데 거의
    동일한 손으로 짠 `_P`/`_Plan` 스텁이 이 저장소에 최소 4곳(`test_block_integrity.py`,
    `test_stop_guard_failopen.py`, `test_guard_review_before_push_main.py`,
    `test_push_guard_worktree_scope.py`) 존재하고, W16 수정은 그중 딱 하나(발견된 그 자리)만
    고쳤다. `test_stop_guard_failopen.py`를 직접 읽어 확인한 결과, 이 파일의 `_CLEAN_PLAN`
    (49-51행)은 지금도 `push_blocks` 가 없다. 다만 이 파일에서 `PUSH_HOOK`이 실제로 구동되는
    곳은 `test_push_and_stop_keep_separate_streaks`(209-216행) 단 한 곳뿐이고, 그 호출 시점엔
    `plan_guard.py`가 여전히 `raise RuntimeError('broken')`(211행에서 write, `_CLEAN_PLAN`으로
    덮어쓰기 전) 상태라 `evaluate_plan()`이 애초에 `_P` 인스턴스를 반환하지 못해 `push_blocks`
    접근까지 도달하지 않는다 — 그래서 **오늘은** 조용히 통과한다. 하지만 이는 설계된 보호가
    아니라 우연한 호출 순서 덕분이며, 이 파일에 "plan 이 clean 인 상태로 push 훅을 구동"하는
    테스트가 하나라도 추가되면(자연스러운 확장 — 파일이 이미 `PUSH_HOOK` 상수와 인프라를
    갖추고 있다) W16 과 똑같은 방식으로 "크래시 후 fail-open" 을 "정상 ALLOW" 로 오인하는
    테스트가 다시 생긴다. `guard_review_before_push.py:867`이 REVIEW/PLAN 두 게이트 결과 모두에
    대해 무조건 `.push_blocks`를 읽는 한, 이 계열의 모든 duck-type 스텁은 그 필드를 갖춰야
    하는데, 검증 메커니즘(가령 "실제 `PlanDecision`의 공개 인터페이스 vs 스텁"을 비교하는 테스트)
    은 여전히 없다 — 사람이 매번 눈으로 맞춰야 한다.
  - 제안: `test_stop_guard_failopen.py:49-51`의 `_CLEAN_PLAN`에 `@property def push_blocks(self):
    return self.untouched` 를 추가해 다른 3곳과 형태를 맞춘다. 근본적으로는, 이 네 스텁이 매번
    손으로 동기화되는 대신 공유 테스트 헬퍼(예: `.claude/tests/_harness.py`에 `make_clean_plan_stub()`
    같은 단일 소스)에서 나오게 하면 이 클래스의 결함이 구조적으로 재발할 수 없게 된다.

- **[INFO]** `evaluate_review()`의 Gate 2 notes 배선 — 4R에서 mutation으로 실측된 "실제 호출 경로
  무검증" 갭이 AST 구조 검증 + 헬퍼 직접호출로 상당 부분 메워졌지만, 여전히 "진짜 `evaluate_review()`
  를 스펙-연결 하향 픽스처로 호출"하는 통합 테스트는 없다.
  - 위치: `.claude/hooks/_lib/review_guard.py:975-1016`(`evaluate_review` Gate 2 — `notes: list[str] = []`
    선언과 이후 3개 `ReviewDecision(...)` 반환 모두 `tuple(notes)`를 실어 나름). 대응 테스트:
    `.claude/tests/test_block_integrity.py:484-550`(`NotesSurviveBlockingTest`).
  - 상세: `review/code/2026/08/01/00_33_34/testing.md`(4R)는 "`review_guard.py` 마지막 반환문에서
    `tuple(notes)` 를 제거해도 738개 테스트 전부 통과했다"는 mutation 실측으로 이 배선이 완전
    무방비임을 보였고, "실제(non-mock) `evaluate_review()`를 spec-linked + 하향-모순 `--impl-done`
    세션으로 호출해 `ReviewDecision.notes`가 비어있지 않음을 단언하는 통합 테스트"를 제안했다.
    현재 코드에 추가된 `NotesSurviveBlockingTest`를 직접 읽어 확인한 결과: (a)
    `test_the_contradiction_is_collected_for_the_adopted_session`은 `evaluate_review()`가 아니라
    한 단계 아래 헬퍼 `RG._newest_resolved_impl_done_mtime(root, dirty=set(), notes=notes)`를
    직접 호출한다 — 이는 이미 존재하던 `GateSurfacesTheContradictionTest`와 같은 층위이지,
    4R이 요청한 "`evaluate_review()` 자체를 구동"은 아니다. (b) `test_blocking_returns_carry_notes`
    는 `ast` 로 `evaluate_review` 소스를 파싱해 Gate 2 이후 모든 `ReviewDecision(...)` 반환이
    인자를 3개 이상 갖는지(= notes 자리를 채우는지)를 정적으로 확인한다 — 자체 docstring이 밝히듯
    "첫 버전은 정규식이라 3개 중 1개만 매치됐다"는 자기 발견까지 반영한 견고한 구조 검증이며,
    "`tuple(notes)` 인자를 통째로 제거"하는 원래의 mutation은 이제 이 테스트가 확실히 잡는다.
    다만 두 테스트 모두 "인자가 있는지/개수"만 보거나 헬퍼 하나만 부르므로, `notes` 자리에
    (인자 개수는 그대로 두고) 항상 빈 튜플 리터럴을 하드코딩하는 것과 같은 더 좁은 변이는 어떤
    테스트로도 걸러지지 않는다 — `evaluate_review()`를 실제로 실행해 반환된 `.notes`의 **값**을
    확인하는 테스트가 없기 때문이다. 실무적 영향은 낮다(advisory 전용 채널이고, 5R 이후 리뷰
    라운드들도 이 항목을 재차 지적하지 않아 현재 커버리지 수준을 충분하다고 판단한 것으로 보인다).
  - 제안: 여유가 되면 `test_review_guard_hardening.py`의 real-git-repo 통합 테스트 패턴(임시 repo에
    spec-linked 파일 + 하향-모순 `--impl-done` consistency 세션을 실제로 만들어 둠)을 Gate 2에도
    적용해, mock 없는 `evaluate_review()` 호출의 반환 `.notes`가 실제로 비어있지 않음을 한 곳에서
    고정한다. 급하지 않음.

- **[INFO]** `test_retry_state_shared.py::AtomicWriteTest`의 JSON 읽기 단언이 컨텍스트 매니저 없이
  파일을 열어 `ResourceWarning: unclosed file`을 낸다 — 실제로 스위트를 실행해 확인.
  - 위치: `.claude/tests/test_retry_state_shared.py:124`, `:137`
    (`self.assertEqual(json.load(open(f, encoding="utf-8")), ...)` 형태, 두 곳 모두).
  - 상세: `python3 -m unittest discover -s .claude/tests -p "test_*.py"`를 직접 실행하면 이 두
    지점에서 `ResourceWarning: unclosed file <_io.TextIOWrapper ...>`가 출력된다(스위트 자체는
    OK로 통과 — 기능 결함은 아님). 같은 파일의 다른 곳(`test_summary_state_exits_nonzero_when_the_state_file_is_missing`
    등)은 `subprocess`의 `capture_output=True`로 파일 핸들을 직접 다루지 않아 이 문제가 없고,
    이 클래스만 정리 없는 `open()`을 반복한다. temp 디렉터리는 `self.addCleanup(shutil.rmtree, ...)`
    로 꼼꼼히 정리하는 파일이라 이 부분만 상대적으로 허술하다.
  - 제안: `with open(f, encoding="utf-8") as fh: self.assertEqual(json.load(fh), ...)` 형태로
    바꾼다. 기능에 영향 없는 사소한 리소스 위생 문제라 우선순위는 낮음.

## 확인된 사항 (참고 — 새 발견 아님, 정확성 검증 결과)

- `review/code/2026/08/01/01_17_35/RESOLUTION.md`(5R)가 주장하는 CRITICAL 수정 —
  Stop 훅의 note throttle 마커가 `enumerate` 인덱스가 아니라 `hashlib.sha1(note...).hexdigest()[:12]`
  다이제스트로 키잉되도록 바뀐 것 — 을 `.claude/hooks/guard_review_before_stop.py:370-382`에서
  직접 확인했고, 회귀 테스트 `StopThrottleKeysOnTextTest.test_identical_note_is_throttled`/
  `test_a_different_note_still_gets_through`(`.claude/tests/test_block_integrity.py:472-482`)가
  동일 세션에 대해 훅을 실제로 두 번(subprocess) 호출해 "같은 문구는 억제/다른 문구는 통과"
  두 축을 정확히 고정하는 것도 확인했다 — 4R까지 스위트 전체에 훅을 두 번 부르는 테스트가
  하나도 없었다는 자기진단과 정확히 맞물리는 좋은 설계.
- W17(`contradiction_note()` 포맷팅 무단언)은 `DowngradedCriticalsTest.test_flags_the_real_downgrade_shape`
  (`.claude/tests/test_block_integrity.py:189-211`)에 `convention_compliance=2`/`plan_coherence=1`/
  `.md` 접미사 제거/`sorted()` 순서 단언이 실제로 추가돼 있음을 확인.
  같은 클래스의 `test_unreadable_reports_do_not_crash_the_gate`(229-232행, 리포트 자리에 디렉터리를
  둬서 `open()` 실패를 유도)는 fail-open 성격을 정확히 겨냥한 좋은 엣지 케이스.
- W18(merge-coordinator `--summary-state` 무테스트)은
  `MergeCoordinatorUsesTheSharedStateTest.test_summary_state_cli_reads_through_the_shared_helper`/
  `test_summary_state_exits_nonzero_when_the_state_file_is_missing`
  (`.claude/tests/test_retry_state_shared.py:173-216`)로 메워졌음을 확인 — 정상 경로의 6개 필드
  출력과 state 파일 부재 시 `exit 1` + 에러 메시지를 모두 subprocess 로 검증한다.
- `VerdictIsAnchoredTest.test_two_equally_anchored_verdicts_the_later_one_wins`
  (`.claude/tests/test_block_integrity.py:157-165`)가 동률 앵커 픽스처를 커버하고, RESOLUTION.md가
  스스로 "first-wins이 아니라 tie만 later-wins"로 서술을 정정한 이력과 일치함을 확인.
- `AtomicWriteTest.test_a_failed_write_leaves_the_original_intact`(`.claude/tests/test_retry_state_shared.py:128-139`)
  는 `json.dump`를 `mock.patch.object`로 좁게 모킹해 쓰기 실패를 강제하고 원본 보존 + temp 파일
  미잔존을 단언한다 — 외부 의존성을 정확한 지점에서만 대체한 적절한 mock 사용.
- 테스트 격리: `NotesReachBothHooksTest._hook_env`/`StopThrottleKeysOnTextTest.setUp`는
  `tempfile.mkdtemp()` + `shutil.copytree(HOOKS_DIR, ...)` + `CLAUDE_PROJECT_DIR=tmp` 환경변수로
  훅 파일·상태 파일 경로를 모두 격리하고 `addCleanup(shutil.rmtree, ...)`로 정리한다. 실행 순서
  의존성이나 공유 mutable 상태는 발견되지 않았다. 전체 스위트(749개) 재실행 결과도 OK.

## 요약

이번 44개 파일은 전부 이전 4개 리뷰 라운드(4R/5R 및 그 사이/이후 라운드)의 산출물(markdown
리포트 + `meta.json`/`_retry_state.json`)이며, 그 라운드들이 다룬 실제 하네스 소스(`block_integrity.py`,
`retry_state.py`, 훅, 세 orchestrator, `test_block_integrity.py`, `test_retry_state_shared.py`)는
이미 별도 커밋으로 병합돼 있어 이번 diff 자체가 새로 도입한 미검증 코드는 없다. 그 산출물이
주장하는 핵심 사실 — CRITICAL(스로틀 마커 인덱스 키잉) 수정과 그 회귀 테스트, WARNING
4건(`_CLEAN_PLAN`/`push_blocks`, `contradiction_note` 포맷팅, merge-coordinator
`--summary-state`, verdict tie-break)의 처분 — 을 코드와 테스트를 직접 읽고 스위트를 실행해
(749 tests, OK) 독립적으로 재확인했으며 모두 사실과 일치했다. 다만 그 검증 과정에서 이전
어느 라운드도 짚지 않은 잔여 항목 하나를 새로 찾았다 — `test_block_integrity.py`에서 고친
"`_CLEAN_PLAN` 스텁에 `push_blocks` 누락" 결함과 형태가 동일한 스텁이 `test_stop_guard_failopen.py`
에도 있고 아직 고쳐지지 않았다(오늘은 호출 순서 덕에 우연히 트리거되지 않을 뿐). 그 외
`evaluate_review()`의 notes 배선이 진짜 실행 경로가 아니라 AST 구조 검증으로 상당 부분(원래
mutation 을 확실히 잡는 수준까지) 메워졌지만 값 자체를 확인하는 통합 테스트는 여전히 없는 점,
그리고 `AtomicWriteTest`의 파일 핸들 정리 누락(ResourceWarning) 같은 사소한 잔여만 남아 있다.
전부 harness 내부 테스트 코드에 국한되고 제품 코드에는 영향이 없다.

## 위험도

LOW
