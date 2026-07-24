# 부작용(Side Effect) 리뷰

## 리뷰 대상

- `.claude/hooks/guard_default_branch_bash.py` — `_is_mutating` 세그먼트 분할 + `VAR=value`(따옴표 값 포함) 접두 스킵 (핵심 로직 변경)
- `.claude/hooks/guard_review_before_push.py` — 주석만 추가(상호 참조), 정규식·로직 변경 없음
- `.claude/tests/test_guard_default_branch_bash_mutating.py` — 신규 테스트
- `.claude/docs/worktree-policy.md`, `.claude/tests/README.md`, `plan/complete/harness-push-guard-subcommand-detection.md`, `plan/in-progress/harness-guard-followups.md` — 서술 갱신
- `review/code/2026/07/23/20_02_29/*`(RESOLUTION.md, SUMMARY.md, meta.json, _retry_state.json, 각 reviewer 산출물) — 직전 리뷰 라운드 산출물, 정적 문서/JSON 커밋

## 발견사항

- **[INFO]** 넛지(마커 파일 쓰기) 트리거 범위 확대 — 의도된 부작용 확장, 메커니즘 자체는 불변
  - 위치: `.claude/hooks/guard_default_branch_bash.py:149-154`(`_is_mutating`), 실제 쓰기는 `:169-180`(`_mark_warned`/`_state_dir`, diff 밖 — 이번 diff 로 손대지 않음)
  - 상세: `_is_mutating` 이 명령을 `&&`/`||`/`;`/`|`/`&`/개행으로 분할해 각 세그먼트에 `_MUTATING` 을 적용하도록 바뀌어(구버전: `bool(_MUTATING.search(command))`), 이전엔 무반응이던 `git add -A && git commit -m "x"` 류 체인이 이제 반응한다. 그 결과 `main()` 이 `.claude/state/main_worktree_bash_warned/<session_id>` 마커 파일을 쓰는 빈도가 넓어질 수 있다. 다만 파일 경로·포맷·"세션당 1회"(`_already_warned` 가드)·실패시 best-effort 무시(`except OSError: pass`) 등 실제 파일시스템 부작용의 **메커니즘**은 이번 diff 에서 한 글자도 바뀌지 않았고, `plan/in-progress/harness-guard-followups.md` §C·`SegmentTest`로 근거·회귀가 고정돼 있다.
  - 제안: 조치 불필요(의도됨, pin 완료). 직전 라운드(`review/code/2026/07/23/20_02_29/side_effect.md`)에서도 동일하게 확인된 항목으로, 이번 diff(W1/W3 반영판)에서도 결론이 바뀌지 않는다.

- **[INFO]** 세그먼트 분할이 인용을 모름 — 두 가지 오탐 클래스가 부작용(reminder 출력 + 마커 쓰기) 트리거를 확대
  - 위치: `.claude/hooks/guard_default_branch_bash.py:146`(`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|&\n]")`)
  - 상세: 분할이 따옴표를 모르므로 (1) 인용된 구분자(`echo "a && rm -rf x" > /dev/null`)와 (2) heredoc/멀티라인 본문 줄(`cat <<'EOF'\nmkdir …\nEOF`)이 실제로는 안전한 명령인데도 세그먼트로 쪼개져 `_is_mutating` 이 `True` 를 반환할 수 있다 — 즉 이전엔 발생하지 않았을 stdout reminder 출력과 세션 마커 파일 생성이 새로 트리거되는 케이스가 생긴다. 두 클래스 모두 `AcknowledgedFalsePositiveTest`(`test_guard_default_branch_bash_mutating.py`)로 명시적으로 pin 되어 있고, README(`.claude/tests/README.md`)·plan(§C 결론)에도 "2종"으로 정확히 반영돼 있다(직전 라운드 WARNING #3 이 정정된 결과).
  - 제안: 조치 불필요. 훅이 **차단하지 않고** 세션당 최대 1회만 반응하는 soft nudge 라 영향 반경이 구조적으로 작고, 정밀 셸 파서 도입은 §C 가 이미 포기한 무한 표면 경로다.

- **[INFO]** `guard_review_before_push.py` 변경은 주석-only — 차단형 게이트의 동작·부작용 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:141-148`
  - 상세: diff 는 `_SEGMENT_SPLIT = re.compile(r"&&|[|;\n]")` 바로 위에 `guard_default_branch_bash.py` 와의 상호 참조 주석만 추가한다. 정규식·분기 로직·리턴 값 등 실행 경로는 한 글자도 바뀌지 않았으므로, 이 파일이 담당하는 **차단성** push 게이트(REVIEW/PLAN 판정, exit code)에는 어떤 부작용 변경도 없다. 주석이 언급하는 `_GIT_PUSH`/`\S+` 따옴표 env 우회 결함(§J)은 이번 diff 의 스코프가 아니라 별 PR 로 defer 되어 있음이 `plan/in-progress/harness-guard-followups.md` §J 항목과 일치한다.
  - 제안: 조치 불필요. §J 는 차단형 게이트 우회이므로 별도 PR 에서 patch-level 부작용(byte-for-byte 핀 갱신) 검토가 필요하다는 점만 참고.

- **[INFO]** 신규 테스트의 서브프로세스 스폰은 테스트 실행 범위로 격리됨
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py::BacktrackingTest.test_adversarial_input_does_not_hang`
  - 상세: `subprocess.run([sys.executable, "-c", self._PROBE, ...], timeout=20)` 으로 별도 파이썬 프로세스를 띄워 적대적 입력에 대한 선형성을 검증한다. 프로브는 `guard._is_mutating(payload)` 만 호출하고 `main()`/`_mark_warned()` 는 부르지 않으므로, 테스트 실행이 저장소의 실제 `.claude/state/main_worktree_bash_warned/` 를 오염시키지 않는다. `timeout=20` 이 있어 프로세스가 무한정 남는 경우도 없다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/2026/07/23/20_02_29/*` 신규 파일들은 직전 리뷰 라운드의 정적 산출물 커밋 — 실행 경로 없음
  - 위치: 파일 8~18 (`RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, 각 reviewer `.md`)
  - 상세: 전부 마크다운/JSON 정적 문서이며, 이번 diff 가 실행하는 어떤 코드에서도 read/write 되지 않는다("review/ 는 gitignored 아님" 컨벤션과 일치). 부작용 관점에서 검토할 실행 표면이 없다.
  - 제안: 조치 불필요.

## 확인한 항목 (문제 없음)

- **시그니처/인터페이스**: `_is_mutating(command: str) -> bool` 시그니처 불변. 저장소 전수 grep 결과 이 함수를 호출하는 곳은 `guard_default_branch_bash.py` 자신(`main()`)과 신규 테스트 파일뿐 — 외부 호출자 영향 없음.
- **전역 변수**: 신규 module-level 상수는 `_SEGMENT_SPLIT` 하나뿐이며 `_`-prefixed private, 다른 모듈에서 import 되지 않음. 기존 `_MUTATING` 은 패턴 본문만 확장(env-prefix 허용)됐고 참조 방식(정규식 객체) 자체는 그대로.
- **환경 변수**: `VAR=value` 접두 정규식은 명령 **문자열**을 패턴 매칭할 뿐 실제 프로세스 환경 변수를 읽거나 쓰지 않는다. `BYPASS_DEFAULT_BRANCH_GUARD`/`CLAUDE_PROJECT_DIR` 읽기 로직은 diff 밖(기존 그대로).
- **파일시스템**: `_mark_warned`/`_state_dir`/`_already_warned` 자체의 코드는 이번 diff 에서 변경되지 않았다 — 경로·포맷·실패 처리 모두 그대로. 트리거 빈도만 넓어짐(위 INFO 참고).
- **네트워크 호출**: 없음.
- **이벤트/콜백**: `print(reminder)` 는 훅 프로세스 자신의 stdout(하네스가 가로채 모델 컨텍스트에 주입)이며, 실제로 실행되는 Bash 명령의 stdout/stderr 파이프라인과는 분리돼 있어 다운스트림 파싱 오염 위험 없음. Hook 은 항상 `sys.exit(0)`(never blocks)이라 exit-code 기반 콜백 계약도 불변.
- **RESOLUTION.md 가 자체 정정한 ReDoS 주장**: 이전 커밋에서 "서로소 alternation 이 ReDoS 를 막는다"는 주석·`BacktrackingTest` 를 넣었다가, 뮤테이션에서 모호한 형태도 선형임을 재측정해 주석을 "명확성을 위한 것"으로 교정했다고 밝힘 — 코드(`guard_default_branch_bash.py:85-90`)에서 실측대로 정정돼 있음을 확인. 부작용 관점에서 문제 없음(단정 철회가 성실하게 반영됨).

## 요약

이번 diff 의 핵심은 `guard_default_branch_bash.py::_is_mutating` 을 "명령 전체 첫 토큰만 검사"에서 "구분자로 나눈 각 세그먼트의 첫 토큰 검사 + 따옴표 인식 `VAR=value` 접두 스킵"으로 확장한 것이며, 이 훅은 애초에 **차단하지 않고 세션당 최대 1회만 stdout 에 reminder 를 출력**하는 nudge 전용 훅이라 부작용의 폭발 반경이 구조적으로 좁다. 마커 파일 쓰기(`_mark_warned`)의 트리거 빈도가 넓어지는 것과, 인용을 모르는 순진한 분할이 두 가지 오탐 클래스(인용된 구분자·heredoc 본문)를 여는 것 모두 의도된 트레이드오프로 plan(§C)과 신규 테스트(`SegmentTest`, `AcknowledgedFalsePositiveTest`)에 정확히 pin 되어 있다. `guard_review_before_push.py`(차단형 게이트)에는 주석만 추가돼 실행 경로 변경이 전혀 없고, `_is_mutating` 시그니처·유일한 호출자 구조도 그대로라 인터페이스 영향도 없다. 나머지 문서·plan·리뷰 산출물 파일은 서술/기록 갱신뿐으로 실행 경로가 없다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
