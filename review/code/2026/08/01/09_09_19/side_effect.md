# Side Effect Review — round 9

검증 방법: 코드 열람뿐 아니라 실측으로 교차 확인했다 — (1) 잘린 4개 파일
(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`)은 `Read` 로 전문을 직접 열었다. (2) `git diff
origin/main...HEAD -- .claude` 로 이 브랜치가 baseline 대비 실제로 바꾼 부분만 추출해
"이번 라운드의 변경"과 "기존 코드"를 구분했다. (3) `.claude/tests` 전체를 실제로 실행했다
(`python3 -m pytest .claude/tests -q` → **762 passed, 573 subtests passed** — 8R 커밋
메시지의 "762 tests OK" 주장과 정확히 일치). (4) `_glob_to_regex` 의 와일드카드 상한을
하네스 밖에서 직접 재현해 타이밍을 쟀다. (5) 테스트 실행 전/후 `git status --porcelain`
을 대조해 스위트 자체가 저장소에 부작용을 남기지 않는지 확인했다. (6) `grep`/`find` 로
mutating git 호출·env 쓰기·네임스페이스 충돌 여부를 전수 조사했다.

## 발견사항

- **[INFO]** (검증 완료) 8R 이 주장한 세 가지 수정 — ①`block_integrity.py` 의 두 번째
  quadratic 정규식, ②`_glob_to_regex` 의 지수 백트래킹, ③`_evaluate_over_targets` 의
  advisory 유실 — 이 실제로 유효함을 직접 실측으로 재확인했다.
  - 위치: `.claude/_shared/block_integrity.py:137-142` (`_BLOCK_AT_LINE_START`/
    `_BLOCK_AT_LINE_END`, 둘 다 `[ \t*]*` 단일 quantifier), `.claude/hooks/_lib/review_guard.py:576,603`
    (`_MAX_GLOB_WILDCARDS = 6` 및 그 cap 체크), `.claude/hooks/guard_review_before_push.py:843,880,883`
    (`_evaluate_over_targets` 의 `blocked = None` → 루프 끝까지 진행 → `return blocked`).
  - 상세: `_glob_to_regex('a*'*24+'!')` 를 하네스 밖에서 직접 실행해 컴파일 1.1e-05초·
    매치 9.5e-07초로 즉시 반환됨을 확인했다(24 stars > cap 6 → `.*` 로 폴백). 전체 테스트
    스위트(762 tests, 573 subtests)를 실행해 전부 통과함을 확인했고, 실행 전후
    `git status --porcelain` 이 동일해(리뷰 산출물 디렉터리 제외) 스위트 자체의 파일시스템
    부작용이 없음도 함께 확인했다(`SuiteLeavesNoRealStateTest` 도 그 안에서 통과).
    한 가지 주목할 점: 최초 1회 전체 스위트 실행 시 `SpecGlobCompilationIsBoundedTest`
    의 5초 서브프로세스 타임아웃이 우연히 초과되어 실패했으나(같은 소스 파일의
    `__pycache__` 를 두 프로세스 — in-process 로드 + subprocess 로드 — 가 동시에 컴파일하며
    생긴 것으로 보이는 최초-실행 경합), 격리 실행 1회+전체 스위트 재실행 5회에서 전부
    통과해 코드 결함이 아님을 확인했다. 로직 자체는 별도로 직접 실행해 즉시 반환됨을
    재확인했으므로 이 항목은 테스트 인프라의 미세한 타이밍 여유(5초 vs 실측 <1ms) 문제이지
    회귀는 아니다.
  - 제안: 조치 불요(확인 목적의 기록). `SpecGlobCompilationIsBoundedTest` 의 타임아웃 여유가
    걱정되면 5초를 유지해도 무방하나(실측 마진이 매우 큼), 신경쓰인다면 재시도 로직을
    고려할 수 있다 — 현재 우선순위 아님.

- **[INFO]** Stop 훅에 하향-모순 note 별 신규 마커 파일이 무기한 누적된다 — 8R 자체
  side-effect 리뷰가 이미 지적한 특성과 동일 재확인.
  - 위치: `.claude/hooks/guard_review_before_stop.py:380-386` (`for note in
    (getattr(decision, "notes", ()) or ())`→`hashlib.sha1(...)[:12]`→
    `_marker_path(session_id, token, f"note{digest}")`→`_mark_nudged(marker)`).
  - 상세: `decision.notes` 는 세션당 최대 1건(채택된 컨시스턴시 세션의 모순 문구)이라
    실사용 시 폭증하지는 않지만, (session_id, branch, note-digest) 조합마다 빈 마커
    파일이 하나씩 쌓이고 만료/정리 로직이 없다 — 기존 (session,branch) 단위 nudge 마커와
    같은 설계(무기한 누적, TTL 없음, gitignored)를 한 축 더 늘린 것이다. `.gitignore` 로
    커밋되지 않고 개발자 로컬 `.claude/state/` 아래에만 쌓이므로 위험은 낮다. 이 신규
    디렉터리를 스캔하는 reaper/정리 스크립트가 있는지 확인했으나 없었다
    (`test_reap_merged_worktrees.py` 는 worktree 반환 전용이라 무관).
    다만 이 메커니즘 자체는 이번 라운드의 회귀가 아니라 **의도적으로 고친 버그의 산물**
    이다 — 직전 버전은 `enumerate` 인덱스로 키를 잡아 "같은 세션의 첫 하향 경고가 이후
    모든 다른 세션·다른 checker 의 경고를 영구히 삼키는" 결함이 있었고(docstring 에 명시),
    지금은 `StopThrottleKeysOnTextTest::test_identical_note_is_throttled` /
    `test_a_different_note_still_gets_through` 두 테스트가 실제 서브프로세스로 훅을 두 번
    호출해(동일 문구→2번째 침묵, 다른 문구→둘 다 노출) 그 수정을 고정하고 있음을 직접
    읽어 확인했다.
  - 제안: 심각하지 않아 즉시 조치 불요. 장기적으로 `.claude/state/` 정리 스크립트 범위에
    이 서브디렉터리를 포함하는 것을 고려할 수 있음(결정 필요 사항 아님).

- **[INFO]** `evaluate_review()` 의 Gate 1 조기 return 2곳은 `notes` 를 나르지 않는다 —
  8R 관측 재확인. 회귀 테스트가 이 두 return 을 의도적으로 검사 대상에서 제외해 둔 지점이라
  향후 Gate 1 에 advisory 소스가 추가되면 그 예외 처리도 함께 재검토해야 한다.
  - 위치: `.claude/hooks/_lib/review_guard.py:986` (`if newest_review <= 0.0:` →
    `return ReviewDecision(True, ...)`, 3번째 위치 인자 없음), `:993`(`if newest_review <
    newest_code:` → 동일), `:1003`(`notes: list[str] = []` 는 이 두 return **이후**에야
    초기화).
  - 상세: Gate 1(코드 리뷰 커버리지)이 먼저 막으면 Gate 2(`_newest_resolved_impl_done_mtime`,
    `notes` 수집)는 이번 호출에서 아예 실행되지 않는다 — 현재는 무해하다(Gate 2 가 안
    돌았으니 나를 게 없다). `.claude/tests/test_block_integrity.py::NotesSurviveBlockingTest::
    test_blocking_returns_carry_notes` 를 직접 읽어 확인했다: AST 로 `evaluate_review` 함수를
    파싱해 `spec_linked` 대입 라인(`gate2_line`) **이후**의 `ReviewDecision(...)` return
    3곳만 "3번째 인자(advisory) 필수"로 검사하고, 그 이전(Gate 1)의 return 은
    `if node.lineno < gate2_line: continue` 로 명시적으로 면제한다. 이 면제 근거("Gate 1
    return 은 advisory 소스보다 먼저 존재해 나를 게 없다")는 현재는 사실이지만, 향후 Gate 1
    자체에 advisory 소스가 생기면(예: 코드 리뷰 SUMMARY 쪽에도 하향 백스톱을 붙이는 후속
    작업) 조용히 거짓이 될 수 있고 이 회귀 테스트는 line-number 컷오프 때문에 그 회귀를
    못 잡는다.
  - 제안: 현재 동작 변경 불요. Gate 1 에 advisory 소스가 추가되는 시점에 이 컷오프 가정도
    함께 재검토하라고 어딘가(코드 주석 혹은 후속 plan)에 남겨 두면 재발을 막을 수 있다 —
    8R 이 이미 같은 제안을 남겼고 아직 처리되지 않은 상태다.

- **[INFO]** (확인 완료, 문제 없음) `merge_coordinator_orchestrator.py` 가 `_shared` 패키지에
  닿기 위해 `sys.path` 에 `.claude/` 자체를 새로 추가했다 — 이 저장소가 과거 `_lib` 네임스페이스
  충돌을 여러 번 겪은 이력이 있어 점검했으나 이번엔 충돌이 없다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:36-39`
    (`CLAUDE_DIR = os.path.dirname(SKILLS_DIR)` → `sys.path.insert(0, CLAUDE_DIR)`, 기존
    `CODE_REVIEW_SKILL`/`SKILLS_DIR` insert 뒤에 추가되어 최종적으로 `sys.path` 맨 앞을 차지).
  - 상세: `find` 로 확인한 결과 `.claude/lib/`, `.claude/_lib/` 는 존재하지 않는다(오직
    `.claude/hooks/_lib`, `.claude/skills/_lib`, `.claude/workflows/_lib` 처럼 한 단계 더
    깊은 곳에만 있다) — 따라서 `CLAUDE_DIR` 를 sys.path 맨 앞에 둬도 `from lib import
    session`/`from _lib import project_config` 의 기존 해석이 바뀌지 않는다. `.claude/_shared`
    도 저장소 전체에 유일한 경로라 충돌 없음을 `find` 로 확인했다. 이 파일은 독립
    서브프로세스로만 실행되므로 `sys.path` 변경이 호출자 프로세스로 새지도 않는다.
    `test_retry_state_shared.py::MergeCoordinatorUsesTheSharedStateTest` (서브프로세스로
    `--update`/`--summary-state` 를 실제로 구동)가 그린임을 실행해 확인했다 — 이 경로가
    깨졌다면 두 테스트 모두 non-zero exit 로 실패했을 것이다.
  - 제안: 조치 불요. 확인 목적의 기록.

- **[INFO]** (확인 완료, 부작용 없음) 전 diff(`git diff origin/main...HEAD -- .claude`,
  약 1,800줄 추가)에서 다음을 전수 확인했다.
  - **시그니처/인터페이스**: `ReviewDecision.notes: tuple[str, ...] = ()` (신규 필드,
    기본값 있어 하위호환), `_newest_resolved_impl_done_mtime(repo_root, dirty=None,
    notes=None)` (신규 키워드 인자, 기본값 있어 하위호환) 외에 기존 함수 시그니처를 깨는
    변경 없음 — `grep -rn "evaluate_review("`/`"ReviewDecision("` 로 저장소 전체의 호출부를
    확인했고 전부 새 필드/인자 없이도 정상 동작.
  - **mutating git 호출**: diff 전체에 `push`/`commit`/`reset`/`checkout`/`merge`/`rebase`
    문자열 리터럴로 실제 git 서브커맨드를 구성하는 곳 0건(유일한 매치는 `args.commit` 이라는
    argparse 속성명).
  - **환경 변수**: diff 에 새로 추가된 `os.environ` 관련 라인은 전부 테스트 코드의
    서브프로세스 `env=` 구성/스텁(`FAKE_NOTE`)뿐 — 프로덕션 코드의 신규 env 읽기/쓰기 0건.
  - **전역 가변 상태**: 신규 모듈 레벨 값은 전부 상수(`_MAX_GLOB_WILDCARDS`,
    `_FAILOPEN_STATE_NAME` 류) 또는 "import 시 1회 fallback 바인딩"(`evaluate_review = None`
    형태) 패턴뿐 — 프로세스당 1회 실행되는 훅/스크립트 구조라 크로스-호출 누적 위험 없음.
  - **파일시스템 쓰기**: 신규 프로덕션 쓰기 경로는 `retry_state.save_state`(임시파일+
    `os.replace` 원자적 교체, `.claude/_shared/retry_state.py:81,85,89`)와 위 두 건(Stop
    훅 note 마커, block_integrity 자체는 read-only)뿐 — 전부 문서화된 의도와 일치.
  - 제안: 조치 불요.

## 요약

이번 라운드는 신규 코드보다 **직전 라운드(7R/8R)가 고쳤다고 주장한 결함들이 실제로
닫혔는지**를 실측으로 검증하는 데 집중했다. block_integrity 의 두 번째 quadratic 정규식,
`_glob_to_regex` 의 지수 백트래킹, `_evaluate_over_targets` 의 advisory 유실 — 세 가지
모두 직접 실행/벤치마크로 유효성을 재확인했고, 전체 하네스 스위트(762 tests, 573
subtests)가 실제로 통과함을 확인했으며 스위트 자체의 파일시스템 부작용도 없음을
`git status` 대조로 확인했다. 새로 발견한 항목은 모두 이미 8R 자신의 side-effect
리뷰가 언급한 특성의 재확인(Stop 훅 마커 무기한 누적, Gate 1 조기 return 의 notes
누락)이거나 이번에 새로 점검해 "문제 없음"으로 닫은 것(`merge_coordinator_orchestrator.py`
의 `sys.path` 신규 추가가 `_lib` 네임스페이스와 충돌하지 않음)이다. 시그니처 변경은
전부 기본값이 있는 신규 필드/키워드 인자라 하위호환이고, mutating git 호출·환경 변수
쓰기·전역 가변 상태 도입은 diff 전체에서 0건으로 확인했다. CRITICAL/WARNING 급 부작용은
없다.

## 위험도

LOW
