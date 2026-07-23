### 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `worktree-policy.md` §5 의 구분자 서술이 실제 `_SEGMENT_SPLIT` 동작(단일 `&`)을 누락
  - 위치: `.claude/docs/worktree-policy.md:73` (diff 후 신설 문장 — "명령을 `&&`/`||`/`;`/`|`/개행으로 나눈 각 세그먼트의 첫 토큰…")
  - 상세: 이번 diff 는 `guard_default_branch_bash.py` 의 `_SEGMENT_SPLIT` 에 단일 `&`(백그라운드 연산자)를 **의도적으로** 추가했다 — `plan/in-progress/harness-guard-followups.md:199`("단일 `&`(백그라운드) 도 구분자에 포함 — `sleep 5 & rm -rf x` 가 같은 이유로 새고 있었다")와 `.claude/hooks/guard_default_branch_bash.py:24-25`("split on `&&`/`||`/`;`/`|`/`&`/newline"), 그리고 `.claude/tests/test_guard_default_branch_bash_mutating.py` `SegmentTest::test_mutating_command_after_separator_is_caught`(`"sleep 5 & rm -rf x"` 케이스)가 이를 명시하고 고정한다. 실측(`guard._is_mutating("sleep 5 & rm -rf x")` → `True`)으로도 확인됨. 그런데 이번 diff 가 새로 쓴 `worktree-policy.md:73` 는 구분자를 "`&&`/`||`/`;`/`|`/개행" 5가지로만 열거하고 단일 `&` 는 어디에도 언급하지 않는다 — 코드·plan·테스트·모듈 docstring 은 전부 6종(개행 포함)을 일관되게 서술하는데, "정책의 상세 SoT" 라고 자칭하는 이 문서(파일 최상단 "본 문서는 정책의 상세·운영 규칙·자동 차단 4-layer 의 SSOT 다")만 하나 빠져 있다. 코드는 의도적이고 테스트로 고정된 올바른 동작이므로 코드를 되돌릴 사안이 아니라 spec(정책 문서) 갱신 누락이다.
  - 제안: 코드 변경 없음. `.claude/docs/worktree-policy.md:73` 의 구분자 열거에 `&`(단일, 백그라운드)를 추가해 "`&&`/`||`/`;`/`|`/`&`/개행"으로 정정 — 대상은 `project-planner`/`resolution-applier` 의 spec draft 경로.

- **[INFO]** `VAR=value` 접두 스킵이 따옴표 없는 **빈 값**(`VAR=`)에서 다시 false negative
  - 위치: `.claude/hooks/guard_default_branch_bash.py:98` (`(?:'[^']*'|"[^"]*"|[^\s'"]\S*)`)
  - 상세: 실측 — `guard._is_mutating("VAR= git commit -m x")` → `False`, 반면 `guard._is_mutating("VAR='' git commit -m x")` → `True`. 세 대안 중 비-따옴표 케이스(`[^\s'"]\S*`)는 최소 1글자를 요구하므로, 따옴표 없이 완전히 빈 값을 대입하는 `VAR= cmd` 형태(셸 문법상 유효)는 env-prefix 로 인식되지 않고, 이어지는 `git commit` 이 앵커되지 않은 위치에서 시작해 조용히 미분류된다. 이번 diff 가 고치려던 "W1: 따옴표 안 공백 값" false negative 와 같은 계열이지만 다른 트리거(빈 값)이며, `EnvPrefixTest`/`AcknowledgedFalsePositiveTest` 어디에도 pin 되지 않았다. 다만 unquoted 빈 값 대입은 실사용에서 극히 드문 셸 관용구이고, 이 훅은 soft nudge(차단 없음)이므로 실질 위험은 낮다.
  - 제안: 필요 시 값 alternation에 빈 문자열 허용 분기(예: `(?=\s)`) 를 추가하거나, 최소한 `EnvPrefixTest` 에 이 케이스를 명시적으로 pin(현재 동작이 알려진 갭임을 기록). 낮은 우선순위.

- **[INFO]** `test_line_anchors.py::PromptPayloadIntegrationTest::test_diff_blocks_are_annotated_and_correct` 가 현재 HEAD 에서 실패 — 이번 diff 파일들의 결함은 아님
  - 위치: `.claude/tests/test_line_anchors.py:387-406` (diff 밖, 이 파일은 리뷰 대상 18개 파일에 포함되지 않음)
  - 상세: 로컬 재현 — `python3 -m pytest .claude/tests/ -q` → `1 failed, 528 passed`(`AssertionError: 13 not greater than 20`). 이 테스트는 `--prepare --commit HEAD` 로 **현재 HEAD 커밋 하나의 diff**를 프롬프트로 빌드해 gutter 개수를 검증하는데, 이번 PR 의 마지막 커밋(`004d33ccb`, plan 문서에 "§E 후속(#1000)" 한 단락만 추가하는 작은 문서 diff)이 HEAD 라서 주석 붙은 diff 줄이 20개 미만이 된다. 같은 클래스의 취약성을 `_prepare_files`(whole-file 테스트) 쪽은 이미 "FILES 고정 fixture" 로 회피했다고 파일 자체 주석(라인 296-299)이 밝히지만, `_prepare_commit`(diff 테스트) 쪽은 여전히 `--commit HEAD` 에 결합돼 있어 **"repo 의 마지막 커밋이 우연히 작으면 실패"** 하는 동일 클래스의 문제가 재발한 것 — 리뷰 대상 훅(`guard_default_branch_bash.py`)의 로직 결함이 아니라 이 테스트 자신의 설계 취약점이며, 대상 파일이 diff 밖이라 이번 PR 이 만든 결함은 아니다. 다만 이 PR 의 커밋 순서(작은 문서 커밋으로 마무리)가 그 취약점을 트리거했으므로, RESOLUTION.md 의 "하네스 전체 513건 OK" 주장은 그 시점 이후 커밋된 현재 HEAD 기준으로는 더 이상 유지되지 않는다.
  - 제안: 이번 PR 코드 변경 불필요. 별도로 `test_diff_blocks_are_annotated_and_correct` 도 `_prepare_files` 처럼 고정 fixture 커밋/파일 세트로 옮기거나 `--commit` 대상을 큰 diff 를 가진 고정 커밋으로 바꾸는 후속 조치를 권장(harness-guard-followups 류에 등록 검토).

- **[INFO]** spec fidelity — 위 SPEC-DRIFT 항목을 제외하면 `worktree-policy.md:73`, 모듈 docstring(`guard_default_branch_bash.py:1-46`), plan(`harness-guard-followups.md` §C 결론·체크리스트), README 카탈로그(`test_guard_default_branch_bash_mutating.py` 항목) 는 실제 구현(`_MUTATING`, `_SEGMENT_SPLIT`, `_is_mutating`)과 line-level 로 일치한다. RESOLUTION.md 가 반영했다고 주장한 W1(따옴표 공백 값)·W2(교차 참조 주석)·W3(heredoc 2번째 FP 클래스)·#4(단일 `&`)·#8(Overview stale)·#9(프로브 숫자) 를 실제 소스에서 전수 재검증했고 전부 일치했다(`guard_review_before_push.py:142-149` 상호 참조 주석 확인, `test_guard_default_branch_bash_mutating.py` 12개 test method 실행·통과 확인, `harness-guard-followups.md`에서 "8건" 문구 제거 확인).
  - 위치: `.claude/hooks/guard_default_branch_bash.py` 전체, `.claude/hooks/guard_review_before_push.py:142-149`, `plan/in-progress/harness-guard-followups.md`
  - 상세: (검증 근거는 위 요약 참조)
  - 제안: 조치 불필요.

## 검증 방법 (재현)

- `python3 -m pytest .claude/tests/test_guard_default_branch_bash_mutating.py -q` → `12 passed, 37 subtests passed`.
- `python3 -m pytest .claude/tests/ -q` → `1 failed(test_line_anchors.py, 상기 INFO), 528 passed, 286 subtests passed` — 실패는 리뷰 대상 파일 결함 아님.
- 직접 `_is_mutating` 프로브: `"sleep 5 & rm -rf x"` → `True`(코드·plan·테스트와 일치, `worktree-policy.md` 서술과는 불일치); `"VAR= git commit -m x"` → `False`(신규 갭); `"VAR='' git commit -m x"` → `True`.

### 요약

핵심 결함(체인 명령 `git add -A && git commit` 이 구 버전의 "명령 전체 첫 토큰만 보는" 앵커에 걸리지 않던 false negative)을 세그먼트 분할로 정확히 겨냥해 고쳤고, RESOLUTION.md 가 주장한 3건의 Warning(따옴표 공백 env 값, push 가드와의 중복, heredoc 2번째 오탐 클래스) 반영을 소스·테스트에서 직접 재검증해 전부 사실과 일치함을 확인했다. `guard_default_branch_bash.py`·`guard_review_before_push.py`·plan·README·테스트 12건이 서로 line-level 로 정합하고, 새 로직은 실행·서브프로세스 검증까지 마쳤다. 유일하게 새로 발견한 것은 `worktree-policy.md`(정책 SoT)의 구분자 열거가 이번 diff 로 새로 추가된 단일 `&` 지원을 언급하지 않는 SPEC-DRIFT(코드·테스트·plan 은 옳고 정책 문서 한 곳만 누락)이며, 그 외엔 극히 드문 unquoted 빈 값 env-prefix 미분류(INFO, soft nudge 라 실질 위험 낮음)와 이 diff 파일들과 무관한 기존 테스트 하네스의 취약성(`test_line_anchors.py`, HEAD 커밋 크기에 의존하는 설계 결함) 정도다. 차단성 결함(§J, push 가드 env-prefix 우회)은 이번 diff 범위에서 의도적으로 제외되고 별 PR 로 정확히 등록돼 있어 스코프 판단도 타당하다.

### 위험도
LOW
