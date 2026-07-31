# Side Effect Review — 2026/08/01 02_25_18

리뷰 대상: `.claude/_shared/block_integrity.py`(신규), `.claude/_shared/retry_state.py`(신규),
`.claude/agents/consistency-summary.md`, `.claude/hooks/_lib/failopen_state.py`,
`.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_push.py`,
`.claude/hooks/guard_review_before_stop.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/skills/consistency-checker/SKILL.md`,
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`,
`.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`(신규),
`.claude/tests/test_consistency_orchestrator_state.py`,
`.claude/tests/test_retry_state_shared.py`(신규), `.claude/tests/test_stop_guard_failopen.py`,
`plan/in-progress/harness-review-gate-ci-backstop.md`.

트렁크 진행 상황을 반영해, 프롬프트에서 잘려 있던 4개 파일(`review_guard.py` /
`guard_review_before_push.py` / `code_review_orchestrator.py` / `consistency_orchestrator.py`)은
`Read`로 직접 열었고, `origin/main...HEAD` 실제 diff로 이 라운드가 도입한 변경분만 골라 대조했다.
`codebase/**`(제품 코드)는 이 diff에 전혀 없다 — 변경은 `.claude/` 하네스 전용.

## 발견사항

- **[INFO]** `retry_state.save_state()`가 truncate 쓰기에서 temp-file + `os.replace` 원자적
  쓰기로 바뀌며 세션 디렉토리에 새로운 임시 파일 부산물이 생긴다.
  - 위치: `.claude/_shared/retry_state.py:81` (`save_state`, 81~92행)
  - 상세: 기존에는 3개 orchestrator(`code_review_orchestrator.py` /
    `consistency_orchestrator.py` / `merge_coordinator_orchestrator.py`)가 각자
    `open(state_file, "w")`로 즉시 truncate 후 쓰는 사본을 갖고 있었다. 이번에 `_shared/retry_state.py`로
    통합되며 `<state_file>.tmp.<pid>`를 같은 디렉토리에 만든 뒤 `os.replace()`로 치환하는 방식으로
    바뀌었다 — 동시 리더가 절반만 쓰인 JSON을 보는 경쟁을 막기 위한 의도된 개선이고,
    `test_retry_state_shared.py::AtomicWriteTest`가 "임시 파일 잔존 없음"과 "쓰기 실패 시 원본 보존"을
    모두 확인한다. 다만 두 가지는 부작용으로 남는다: (a) 정상 경로에서도 세션 디렉토리 안에
    `.tmp.<pid>` 파일이 짧게라도 생성됐다 사라진다는 점, (b) `os.replace`는 새로 만든 temp 파일의
    inode를 그대로 옮기므로 결과 파일의 권한은 (기존 파일이 아니라) 새 파일 생성 시 umask를 따른다 —
    `_retry_state.json`에 이례적으로 별도 권한이 걸려 있었다면 그 권한이 조용히 초기화된다. 이
    저장소에서 그 파일에 별도 chmod를 하는 코드는 없어 실질 위험은 낮다. `os.walk` 기반의 다른 판정
    로직(`_iter_summaries`, `_forced_coverage_missing` 등)은 `SUMMARY.md`/`<checker>.md` 이름만
    보므로 `.tmp.<pid>` 파일이 리포트로 오인될 위험은 없음을 확인했다.
  - 제안: 의도된 개선이라 조치 불요. 향후 세션 디렉토리를 스캔하는 코드가 추가될 때
    `*.tmp.*` 패턴을 명시적으로 배제하는 관례를 문서화해두면 재발을 막기 쉽다.

- **[INFO]** Stop 훅의 하향-경고 스로틀이 브랜치 수명 동안 마커 파일을 계속 누적시킨다(제거 로직 없음).
  - 위치: `.claude/hooks/guard_review_before_stop.py:380-386`
  - 상세: 이번 PR은 `decision.notes`(SUMMARY의 `BLOCK: NO`가 checker의 `[CRITICAL]`과 모순될 때의
    경고)를 세션당 1회만 stderr로 내보내기 위해 `hashlib.sha1(note...)` 다이제스트를 `kind`로 쓰는 새
    마커(`_marker_path(session_id, token, f"note{digest}")`)를 도입했다. `note` 문자열 자체가
    `os.path.relpath(best_dir, repo_root)`(모순이 발견된 consistency 세션 경로, `review_guard.py:770`에서
    조립)를 포함하므로, 같은 브랜치에서 서로 다른 모순 세션을 만날 때마다
    `.claude/state/review_stop_nudged/`에 새 파일이 하나씩 쌓이고 지워지지 않는다. 기존 `""`/
    `"plan_complete"` kind 마커도 동일하게 영구 보존되는 이미 있던 설계라 부작용의 "종류"는 새롭지
    않지만, 이번 변경으로 마커 파일 개수가 (이론상) 세션 수만큼 늘어나는 축이 하나 더 생겼다.
    `.claude/state/`는 gitignored라 커밋 오염은 없고, 실사용 스케일(브랜치당 모순 세션 수)에서는
    무시 가능하다.
  - 제안: 현재 스케일에서 조치 불요. `.claude/state/` 정리(reaper) 대상에 이 하위디렉토리를 포함시킬지는
    별도 트래킹 항목으로 남길 만하나 이번 PR 범위는 아니다.

## 점검했으나 문제 없음 (명시적으로 기록)

- **시그니처 변경 (④)**: `code_review_orchestrator.py` / `consistency_orchestrator.py` /
  `merge_coordinator_orchestrator.py`의 `_load_state` / `_save_state` / `_reconcile_state_with_disk` /
  `_apply_status_update` / `_emit_summary_state`는 전부 파라미터·리턴 형태가 1:1 유지된 채 몸체만
  `_shared/retry_state.py` 위임으로 바뀌었다. 세 CLI(`--summary-state`, `--update --agent --status
  --reset-hint`)의 외부 인터페이스(인자, stdout 라인 포맷)는 `test_retry_state_shared.py`가
  바이트 단위로 고정하며 회귀가 없음을 확인했다(`code-review` 쪽 `skipped=`/`routing=` 필드,
  `consistency` 쪽 그 필드 부재 — 둘 다 유지).
- **인터페이스 변경 (⑤)**: `ReviewDecision.notes: tuple[str, ...] = ()` (review_guard.py:184)와
  `Outcome.notes: list[str] = []` (failopen_state.py 신규 필드)는 둘 다 끝에 추가된 디폴트값 있는
  필드라 기존 생성/소비 코드와 하위 호환. 저장소 전체에서 `ReviewDecision`/`evaluate_review`의
  소비자는 `guard_review_before_push.py`·`guard_review_before_stop.py` 둘뿐이고 둘 다 이번 diff에서
  함께 갱신됨을 grep으로 확인했다 — 누락된 제3의 소비자 없음.
- **전역 변수 (②)**: `consistency_orchestrator.ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)`는
  매 호출마다 새 리스트를 만들어 넘기므로(`project_config.filter_enabled_agents(cfg, "checkers",
  list(ALL_CHECKERS))`) `block_integrity.ALL_CHECKERS`(tuple, 불변)를 공유 가변 상태로 오염시키지
  않는다. `block_integrity.py`/`retry_state.py`에 런타임에 변경되는 모듈 전역은 없음(전부 상수·컴파일된
  정규식).
- **환경 변수 (⑥)**: 이번 diff의 프로덕션 코드(`block_integrity.py`, `retry_state.py`, 두 훅의
  변경분)에 새 `os.environ` 읽기/쓰기 없음. 테스트 파일들의 `os.environ`/`CLAUDE_PROJECT_DIR` 조작은
  전부 격리용 subprocess 환경 오버라이드.
- **네트워크 호출 (⑦)**: 이번 diff에 새 네트워크 호출 없음. `subprocess.run(["git"...])`/
  `["gh"...])`는 전부 변경 이전부터 있던 호출이고 diff에서 손대지 않았다(별도 `git diff`로 확인).
- **이벤트/콜백 (⑧)**: `.claude/settings.json`(훅 등록)은 변경 없음 — 훅이 언제 발동하는지는 그대로다.
  새로 추가된 `_report_notes`/note-throttle 블록은 정상 흐름에서 `outcome.notes`가 빈 리스트면 즉시
  return하므로(review_guard.py 쪽 `notes`가 실제로 채워지는 경우는 "채택된 --impl-done 세션이
  BLOCK:NO인데 checker가 CRITICAL을 낸" 드문 경우뿐) 평범한 push/turn-end에서 stdout/stderr에 새
  텍스트가 섞이지 않는다. 스트림 라우팅(ALLOW→stdout, BLOCK→stderr, Stop은 항상 stderr)은
  `test_block_integrity.py`의 `AdvisoryReachesTheModelTest`/`NotesReachBothHooksTest`가 실제 훅
  subprocess로 검증한다.
- **파일시스템 (③) 그 외**: `merge_coordinator_orchestrator.py`는 여전히
  `_reconcile_state_with_disk`가 없어(다른 두 orchestrator만 자가치유 획득) Agent tool 직접 fan-out
  세션의 상태가 stale할 수 있다는 기존 한계가 남아있지만, 이는 이번 diff가 만든 회귀가 아니라
  `merge_coordinator_orchestrator.py:103` 주석과 `plan/in-progress/harness-review-gate-ci-backstop.md`
  §신규 후속 9번에 이미 별도 PR로 등록된 기지(旣知) 갭이다 — 재지적 대상 아님.
- 실측: `.claude/tests/test_block_integrity.py`를 직접 실행(30 tests, `python3 -m unittest`)해 통과를
  확인했고, 실행 전후 `git status`로 하네스 상태 파일(`.claude/state/*_failopen.json` 등)이 실제
  워킹트리에 남지 않음을 확인했다(`SuiteLeavesNoRealStateTest`가 같은 것을 상시 검증).

## 요약

이번 라운드는 `codebase/**`를 전혀 건드리지 않는 `.claude/` 하네스 전용 변경이다. 핵심은 (1) 세 개
orchestrator가 각자 들고 있던 5개 상태 bookkeeping 함수를 `_shared/retry_state.py`로 단일화하고,
(2) consistency SUMMARY의 `BLOCK: NO`가 checker의 `[CRITICAL]`과 모순되는지 감지하는 신규
`_shared/block_integrity.py` 백스톱을 추가해 `review_guard.py`/두 훅에 advisory(`notes`) 경로로
배선한 것이다. 위임된 함수들은 파라미터·CLI 출력 포맷이 전부 1:1 유지되어 시그니처·인터페이스
파손은 없고, 새로 추가된 `notes` 필드들은 끝에 디폴트값을 가진 채 추가되어 하위 호환이며 유일한
두 소비자(push/stop 훅)가 이번 diff에서 함께 갱신됐다. 전역 가변 상태·신규 환경변수·신규 네트워크
호출·훅 등록 변경은 없다. 실질적으로 새로 생긴 부작용은 두 가지뿐이다 — `_retry_state.json` 쓰기가
원자적(temp+replace)으로 바뀌며 생기는 임시 파일(권한 초기화 가능성 포함, 낮은 위험)과, Stop 훅의
note 스로틀이 세션마다 새 마커 파일을 영구 누적시키는 것(gitignored, 낮은 스케일) — 둘 다 의도된
설계이고 전용 테스트(`test_retry_state_shared.py::AtomicWriteTest`, `test_block_integrity.py`의
`StopThrottleKeysOnTextTest`/`NotesReachBothHooksTest`)로 검증돼 있다.

## 위험도

LOW
