# 테스트(Testing) 코드 리뷰 — push 가드 간접실행 인식

## 리뷰 대상
- `.claude/hooks/guard_review_before_push.py` (origin/main 대비 `_is_git_push` 전면 재작성 + 8개 신규 헬퍼: `_is_segment_boundary`/`_has_hostile_control_characters`/`_tokenize`/`_find_command_substitutions`/`_git_subcommand`/`_shell_dash_c_argument`/`_eval_argument`/`_segment_runs_push`)
- `.claude/tests/test_push_detection.py` (44 테스트, 신규/확장; `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 하네스 전체 302 테스트 실행 — 전부 통과 확인)

## 발견사항

### [CRITICAL] 제어문자·파싱실패 폴백이 간접실행(`-c`/`eval`/`$(...)`) 인식을 무력화 — 미검증 false negative
- 위치: `guard_review_before_push.py:455-465`(`_is_git_push` 의 hostile-control-char·`ValueError` 조기 반환), `:184-192`(`_has_hostile_control_characters`). 대응 테스트 부재 — `test_push_detection.py` 전체에 이 조합 케이스가 없음.
- 상세: `_is_git_push` 는 명령 전체에 제어문자(주로 NUL)가 있거나 `shlex` 파싱이 실패(따옴표 불균형)하면, 이후의 세그먼트 분석·간접실행 재귀(이번 diff 의 핵심 목표, Critical #1)를 전혀 타지 않고 곧바로 legacy fallback 정규식(`_GIT_PUSH_FALLBACK`)으로 원문 전체를 검사한 결과만 반환한다(455-465행). 그런데 이 fallback 정규식은 `^`/`&&`/`;`/`|` 직후에만 `git` 를 인식하는 옛 방식이라 `-c`/`eval`/`$(...)` 로 감싸인 형태는 애초에 볼 수 없다. 즉 "제어문자·파싱불가" 와 "간접실행" 두 조건이 동시에 걸리면 이번 diff 가 고치려던 바로 그 결함(간접실행 탐지 누락)이 되살아난다. 직접 재현(`.claude/tests/_harness.py` 로 모듈 로드 후 호출, 44개 기존 테스트가 전부 통과하는 현재 코드 그대로의 동작):
  ```
  guard._is_git_push('bash -c "git push\x00"')   → False (거짓 음성)
  guard._is_git_push('eval "git push\x00"')      → False (거짓 음성)
  guard._is_git_push('echo "$(git push\x00)"')   → False (거짓 음성)
  guard._is_git_push('bash -c "git push')        → False (거짓 음성 — 따옴표 미종료 + && 없음)
  guard._is_git_push('eval "git push')           → False (거짓 음성)
  ```
  `test_push_detection.py` 의 `HostileControlCharacterTest`(NUL 이 `git push\x00 extra` 형태로만 등장)와 `IsGitPushTest.test_unparseable_command_falls_back_to_blocking`(따옴표 불균형이 `&&` 없는 단순 `git push "unterminated` 형태로만 등장) 어디에도 "제어문자/파싱불가 × 간접실행" 교차 케이스가 없다. 이 파일 자신의 모듈 docstring 이 "A false NEGATIVE lets an unreviewed branch ship. Unsafe." 라고 명시한 바로 그 방향의 결함이며, `ResidualLimitationsTest` 처럼 "의도적으로 남겨둔 한계" 로 문서화되어 있지도 않다 — 오히려 455-458행 주석은 "fail closed exactly like the ValueError branch below" 라고 안전하다고 서술하지만, 이 서술은 간접실행과 조합되는 순간 성립하지 않는다.
- 제안: `RecursiveIndirectionTest` 에 위 5개 케이스류(제어문자×`-c`, 제어문자×`eval`, 제어문자×`$(...)`, 파싱불가×`-c`, 파싱불가×`eval`)를 추가해 현재 동작을 명시적으로 pin 하거나, 조기 반환 전에 최소한 `-c`/`eval`/`$(...)` 스팬을 먼저 추출·재귀 검사하도록 순서를 바꾼 뒤 그 수정을 테스트로 고정해야 한다. 최소한 "이 결과가 의도된 잔여 한계인지 미발견 회귀인지" 를 결정하고 `ResidualLimitationsTest` 급으로 명시 pin 할 것 — 조용히 미검증 상태로 남겨두면, 이 파일의 Critical #1-#4·WARNING #1-#3 이 모두 그래왔듯 다음 세션이 우연히 재발견하기 전까지 아무도 존재를 모른다.

### [WARNING] `main()` 훅 진입점이 어디에도 테스트되지 않음
- 위치: `guard_review_before_push.py:523-556`(`main`), `:194-201`(`_read_payload`). (이번 diff 로 신설된 갭은 아님 — `main()` 자체는 origin/main 대비 무변경. 다만 `_is_git_push` 의 동작이 이번 diff 로 크게 바뀐 만큼, 그 결과를 소비하는 최종 진입점의 무검증 상태가 상대적으로 더 아프다.)
- 상세: `test_push_detection.py` 는 스스로 "not what it then decides (that is test_review_guard.py's job)" 라고 범위를 명시하지만, `test_review_guard.py`/`test_plan_guard.py` 는 `_lib/review_guard.py::evaluate_review` / `_lib/plan_guard.py::evaluate_plan` 만 직접 테스트하고 `guard_review_before_push.main()` 자체(두 게이트 오케스트레이션 순서, exit code 0/2, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 우회, `evaluate_review`/`evaluate_plan` import 실패·호출 예외 시 fail-open, stdin JSON 파싱 실패 시 빈 payload 처리)는 `.claude/tests/*.py` 어디에도 exercise 되지 않는다(전수 grep 으로 확인). 이 파일은 `git push` 를 실제로 막는 최종 게이트이므로, `_is_git_push` 단위 테스트가 촘촘해도 그 결과가 올바른 exit code·stderr 문구로 이어지는지는 실측되지 않는다.
- 제안: `subprocess.run([sys.executable, "guard_review_before_push.py"], input=json.dumps(payload), ...)` 형태의 엔드투엔드 테스트이거나, `evaluate_review`/`evaluate_plan` 을 `unittest.mock.patch` 로 주입해 exit code·stderr 문구까지 검증하는 통합 테스트를 별도 파일(예: `test_guard_review_before_push_main.py`)로 추가 권장.

### [INFO] `_MAX_RECURSION_DEPTH` 캡이 `-c`/`eval` 체인 실제 경로로는 검증되지 않음
- 위치: `test_push_detection.py:280`(`RecursiveIndirectionTest.test_recursion_depth_is_capped`), `guard_review_before_push.py:390`(`_segment_runs_push` 의 `if depth >= _MAX_RECURSION_DEPTH: return False`)
- 상세: 캡 경계 테스트는 `_find_command_substitutions` 재귀 경로(`$(...)`)로만 `_depth == cap` 시 재귀 중단을 검증한다. `_segment_runs_push` 자신의 depth 체크(390행) — 즉 `-c`/`eval` 체인이 캡에 도달했을 때도 동일하게 멈추는지는 별도로 pin 되어 있지 않다. 현재는 두 경로가 같은 상수·같은 부등호를 공유하므로 위험은 낮지만, 두 경로가 향후 분기되면 이 테스트만으로는 잡히지 않는다.
- 제안: `test_recursion_depth_is_capped` 옆에 `bash -c` 체인 버전(`guard._is_git_push('bash -c "git push"', guard._MAX_RECURSION_DEPTH)` → False, `one_below_cap` → True)을 짝으로 추가.

### [INFO] `main()` 의 `sys.stdin`/`os.environ` 직접 의존 — 테스트 용이성
- 위치: `guard_review_before_push.py:194-201`(`_read_payload`, `sys.stdin.read()` 직접 호출), `:532`, `:543`(`os.environ.get(...)` 직접 호출)
- 상세: `main()` 이 stdin/env 를 전역으로 직접 읽어, 위 WARNING 의 통합 테스트를 작성하려면 `unittest.mock.patch("sys.stdin", ...)` 류의 몽키패치나 서브프로세스 기동이 필요하다. `payload`/`env` 를 매개변수로 받는 얇은 `run(payload: dict, env: Mapping) -> int` 를 분리하고 `main()` 이 그 wrapper 로 남으면 몽키패치 없이 직접 호출 가능해진다.
- 제안: 필수는 아니나, WARNING 항목의 테스트를 작성하는 김에 함께 리팩터링을 고려.

### [INFO] 사소한 경계값 — 트레일링 값-옵션·다중 env 대입
- 위치: `guard_review_before_push.py:339-360`(`_git_subcommand`)
- 상세: `git -C`(값 없이 끝) 나 `FOO=1 BAR=2 git push`(다중 env 대입) 같은 경계는 명시적으로 pin 되어 있지 않다. 직접 실행해 확인한 결과 둘 다 `IndexError` 없이 각각 `None`/`"push"` 를 정상 반환하므로 실제 위험은 낮다(루프 경계조건이 자연히 보호).
- 제안: 우선순위 낮음 — 여유 시 `test_subcommand_skips_global_options_and_their_values` 옆에 한두 줄 추가하면 향후 리팩터링 회귀를 더 조밀하게 잡는다.

## 요약
`_is_git_push` 자체의 테스트 설계는 매우 우수하다 — 순수 함수 분해로 각 헬퍼(`_tokenize`/`_find_command_substitutions`/`_git_subcommand`/`_shell_dash_c_argument`/`_eval_argument`/`_is_segment_boundary`/`_has_hostile_control_characters`)가 독립적으로 단위 테스트되고, mock 없이 결정론적 문자열 입력만으로 44개 테스트 전부(하네스 전체 302개도 함께 확인)가 격리·통과하며, legacy 정규식을 얼려서 광범위 코퍼스와 비교하는 `LegacyRegressionDifferentialTest`(구조적 회귀 게이트, "old ⊆ new" 불변식 + 의도적 flip 화이트리스트의 rot 방지까지 포함)와 `ResidualLimitationsTest`(의도적으로 남긴 한계를 침묵 드리프트 없이 명시 pin)는 이 정도 복잡도의 문자열 파서 회귀 방지책으로는 모범적이다. 다만 이번 diff 가 새로 도입한 두 안전장치 — "제어문자/파싱불가 시 legacy 폴백" 과 "간접실행 재귀" — 가 상호작용할 때 전자가 후자를 완전히 무력화하는 지점이 있고, 이는 실측으로 재현되는 진짜 false negative 인데도 테스트가 전혀 다루지 않는다(CRITICAL). 또한 `main()` 훅 진입점(실제 exit code·게이트 오케스트레이션 계약)은 이 diff 이전부터 어떤 테스트로도 커버되지 않는 사각지대로 남아 있다(WARNING). `_is_git_push` 의 동작이 이번 diff 로 크게 바뀐 만큼, 그 결과를 소비하는 최종 진입점의 무검증 상태가 상대적으로 더 눈에 띈다.

## 위험도
HIGH
