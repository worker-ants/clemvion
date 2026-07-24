### 발견사항

- **[INFO]** 넛지(마커 파일 쓰기) 트리거 범위 확대 — 의도된 부작용 확장, 메커니즘 자체는 불변
  - 위치: `.claude/hooks/guard_default_branch_bash.py:152-157`(`_is_mutating`), 실제 쓰기는 `:172-183`(`_mark_warned`/`_state_dir`, 이번 diff 로 손대지 않음)
  - 상세: `_is_mutating` 이 명령을 `&&`/`||`/`;`/`|`/`&`/개행으로 분할해 각 세그먼트에 `_MUTATING` 을 적용하도록 바뀌어(구버전: `bool(_MUTATING.search(command))`), `git add -A && git commit -m "x"` 류 체인이 이제 반응한다. 그 결과 `main()` 이 `.claude/state/main_worktree_bash_warned/<session_id>` 마커 파일을 쓰는 빈도가 넓어질 수 있으나, 파일 경로·포맷·"세션당 1회"(`_already_warned` 가드)·실패 시 best-effort 무시(`except OSError: pass`) 등 실제 파일시스템 부작용의 메커니즘은 이번 diff 에서 변경되지 않았다. `plan/in-progress/harness-guard-followups.md` §C 및 `test_guard_default_branch_bash_mutating.py::SegmentTest` 로 근거·회귀가 고정돼 있다.
  - 제안: 조치 불필요(의도됨, pin 완료).

- **[INFO]** 세그먼트 분할이 인용을 모름 — 두 오탐 클래스가 reminder 출력 + 마커 쓰기 트리거를 확대
  - 위치: `.claude/hooks/guard_default_branch_bash.py:149`(`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|&\n]")`)
  - 상세: 분할이 따옴표를 모르므로 (1) 인용된 구분자(`echo "a && rm -rf x"`)와 (2) heredoc/멀티라인 본문 줄(`cat <<'EOF'\nmkdir …\nEOF`)이 실제로는 안전한 명령인데도 세그먼트로 쪼개져 `True` 를 반환할 수 있다 — 이전엔 없던 stdout 출력·마커 파일 생성이 새로 트리거된다. 두 클래스 모두 `AcknowledgedFalsePositiveTest`(`.claude/tests/test_guard_default_branch_bash_mutating.py:100-125`)로 명시 pin 되어 있고 README·plan(§C)에도 "2종"으로 정확히 반영돼 있다.
  - 제안: 조치 불필요. 훅이 차단하지 않고 세션당 최대 1회만 반응하는 soft nudge 라 영향 반경이 구조적으로 작다.

- **[INFO]** 단일 `&` 구분자 추가 — 흔한 `2>&1`/`&>` 리다이렉션 관용구에서 새 오탐을 만들지 않음(실측 확인)
  - 위치: `.claude/hooks/guard_default_branch_bash.py:149`(`_SEGMENT_SPLIT`)
  - 상세: `sleep 5 & rm -rf x` FN 해소를 위해 단일 `&` 를 구분자에 추가했는데, 셸에서 `&` 는 배경 실행 연산자 외에 `2>&1`/`&>` 리다이렉션에도 등장한다. 직접 실행 검증: `_is_mutating('ls -la 2>&1 | cat')` → `False`, `_is_mutating('echo hi 2>&1 > out.log')` → `False`, `_is_mutating('command &> /tmp/log')` → `False`, `_is_mutating('grep foo bar.txt 2>&1')` → `False` — 리다이렉션으로 쪼개진 세그먼트(`2>`, `1`, 등)는 어떤 것도 `_MUTATING` 알터네이션과 매치하지 않아 새 오탐이 생기지 않는다.
  - 제안: 조치 불필요(검증 완료, 참고용 기록).

- **[INFO]** `guard_review_before_push.py` 변경은 주석-only — 차단형 게이트 실행 경로 부작용 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:96-106`(`_GIT_PUSH` 위 KNOWN DEFECT 주석), `:149-156`(`_SEGMENT_SPLIT` 위 상호참조 주석)
  - 상세: 현재 소스를 직접 읽어 확인한 결과 `_GIT_PUSH`(`:107-109`)·`_SEGMENT_IS_GIT`(`:145`)·`_SEGMENT_SPLIT`(`:157`) 정규식·리턴 값·분기 로직은 한 글자도 바뀌지 않았다. diff 는 순수 주석 추가(§J 결함 위치 기록)뿐이라, 이 파일이 담당하는 review-before-push 게이트의 차단/우회 동작에는 어떤 side effect 변경도 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트의 서브프로세스 스폰은 저장소 상태를 오염시키지 않음
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:234-244`(`BacktrackingTest.test_adversarial_input_does_not_hang`)
  - 상세: `subprocess.run([sys.executable, "-c", self._PROBE, ...], timeout=20)` 으로 별도 파이썬 프로세스를 띄우지만, 프로브는 `g._is_mutating(payload)` 순수 함수만 호출하고 `main()`/`_mark_warned()` 는 부르지 않는다. 나머지 테스트 클래스는 모두 `guard._is_mutating()` 을 직접 호출하는 순수 함수 테스트라 `.claude/state/main_worktree_bash_warned/` 등 실제 상태 디렉터리를 쓰지 않는다. `timeout=20` 이 있어 프로세스가 무한정 남지도 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `test_line_anchors.py` 의 신규 fixture 선택 로직은 읽기 전용 git 호출만 추가 — 저장소 상태 변경 없음
  - 위치: `.claude/tests/test_line_anchors.py:332-359`(`_pick_commit_fixture`), `:361-371`(`_prepare_commit`)
  - 상세: `_git("log", "-n", "40", "--format=%H")` 로 최근 40개 커밋을 나열한 뒤, 조건(`>=80` 변경 라인)을 만족할 때까지 각 후보에 `_git("show", "--numstat", "--format=", sha)` 를 호출한다. `_git` 헬퍼(`:40-43`)는 `git log`/`git show`/`git rev-parse` 등 read-only 서브커맨드만 실행하는 순수 wrapper이고, 이번 변경도 같은 read-only 계열(`log`, `show --numstat`)만 추가했다 — 상태 변경 git 명령(`checkout`/`reset`/`commit` 등)은 없다. `--prepare` 실행은 `tempfile.mkdtemp()` 로 만든 임시 디렉터리(`REVIEW_OUTPUT_DIR`)에만 쓰고 `finally: shutil.rmtree(tmp, ignore_errors=True)` 로 정리되며, 이는 이번 diff 이전부터 있던 기존 격리 메커니즘 그대로다. 부작용은 "실행 시 최대 40회의 추가 `git` 서브프로세스 호출"이라는 성능성 오버헤드뿐이다.
  - 제안: 조치 불필요.

## 확인한 항목 (문제 없음)

- **시그니처/인터페이스**: `_is_mutating(command: str) -> bool` 시그니처 불변. 저장소 전수 grep 결과 이 함수를 호출하는 곳은 `guard_default_branch_bash.py` 자신(`main()`, `:203`)과 신규 테스트 파일뿐 — 외부 호출자 영향 없음.
- **전역 변수**: 신규 module-level 상수는 `_SEGMENT_SPLIT`(`:149`) 하나이며 `_`-prefixed private, 다른 모듈에서 import 되지 않음. 기존 `_MUTATING`(`:99-120`) 은 패턴 본문만 확장(env-prefix 허용)됐고 참조 방식 자체는 그대로.
- **환경 변수**: `VAR=value` 접두 정규식(`:101`)은 명령 **문자열** 패턴 매칭일 뿐 실제 프로세스 환경 변수를 읽거나 쓰지 않는다. `BYPASS_DEFAULT_BRANCH_GUARD`(`:187`)/`CLAUDE_PROJECT_DIR`(`:161`) 읽기 로직은 diff 밖(기존 그대로) 불변.
- **파일시스템**: `_mark_warned`/`_state_dir`/`_already_warned`(`:160-183`) 자체의 코드는 이번 diff 에서 변경되지 않았다 — 경로·포맷·실패 처리 모두 그대로. 트리거 빈도만 넓어짐(위 INFO 참고).
- **네트워크 호출**: 없음(전 파일 대상).
- **이벤트/콜백**: `print(reminder)`(`:225`)는 훅 프로세스 자신의 stdout(하네스가 가로채 모델 컨텍스트에 주입)이며, 실제로 실행되는 Bash 명령의 stdout/stderr 파이프라인과는 분리돼 있어 다운스트림 파싱 오염 위험이 없다. Hook 은 항상 `sys.exit(0)`(never blocks, `main()` 전 분기 모두 `return 0`)이라 exit-code 기반 콜백 계약도 불변.
- **문서/plan/과거 리뷰 산출물 파일**(`worktree-policy.md`, `.claude/tests/README.md`, `plan/complete/harness-push-guard-subcommand-detection.md`, `plan/in-progress/harness-guard-followups.md`, `review/code/2026/07/23/{20_02_29,20_33_56}/**`): 전부 정적 마크다운/JSON이며 이번 diff 가 실행하는 어떤 코드 경로에서도 read/write 되지 않는다 — 부작용 관점에서 검토할 실행 표면이 없다.

### 요약

이번 diff 의 핵심 실행 경로 변경은 `guard_default_branch_bash.py::_is_mutating` 을 "명령 전체 첫 토큰 검사"에서 "구분자(`&&`/`||`/`;`/`|`/`&`/개행)로 나눈 각 세그먼트의 첫 토큰 검사 + 따옴표 인식 `VAR=value` 접두 스킵"으로 확장한 것이며, 이 훅은 애초에 **차단하지 않고 세션당 최대 1회만 stdout 에 reminder 를 출력**하는 nudge 전용 훅이라 부작용의 폭발 반경이 구조적으로 좁다. 마커 파일 쓰기(`_mark_warned`) 트리거 빈도 확대, 인용을 모르는 순진한 분할이 여는 두 오탐 클래스(인용된 구분자·heredoc 본문), 신규 단일 `&` 구분자가 흔한 `2>&1` 리다이렉션 관용구에서 새 오탐을 만들지 않음을 실측으로 추가 확인했다. `guard_review_before_push.py`(차단형 게이트)는 현재 소스를 직접 대조한 결과 주석만 추가돼 실행 경로가 전혀 바뀌지 않았고, `_is_mutating` 시그니처·유일한 호출자 구조도 그대로라 인터페이스 영향이 없다. 신규 테스트 파일은 순수 함수 호출 위주라 저장소 상태(`.claude/state/`)를 오염시키지 않으며, `test_line_anchors.py` 의 fixture 선택 로직 변경은 read-only git 서브프로세스 호출을 최대 40회 추가하는 성능성 오버헤드일 뿐 저장소 상태 변경은 없다. 나머지 문서·plan·과거 리뷰 산출물 파일은 정적 텍스트로 실행 경로가 없다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

### 위험도
LOW
