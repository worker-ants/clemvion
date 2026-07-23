STATUS=success testing review complete (2 WARNING)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `VAR="여러 단어"` 형태의 따옴표 붙은 환경변수 값이 있으면 뒤따르는 실제 mutating 명령(`git commit`, `rm` 등)을 **놓친다** — 이번 변경이 고치려던 "false negative" 결함과 정확히 같은 방향의 잔여 결함
  - 위치: `.claude/hooks/guard_default_branch_bash.py:69` (`^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:` — `\S+` 는 공백 없는 토큰 하나만 허용) / 테스트 갭: `.claude/tests/test_guard_default_branch_bash_mutating.py:132-145` (`EnvPrefixTest`, 값에 공백이 있는 케이스가 없음)
  - 상세: `EnvPrefixTest` 는 `GIT_EDITOR=vim`, `CI=1 NODE_ENV=test`, `GIT_PAGER=cat` 등 **값에 공백이 없는** 경우만 pin 한다. 그런데 `VAR="a b" git commit …` 처럼 따옴표로 감싼 값에 공백이 있으면 `\S+`(공백 없는 문자만 허용)가 첫 공백에서 멈추고, 남은 `b" git commit …` 은 `(?:VAR=value)*` 반복도, 메인 alternation 도 매칭하지 못해 **전체 앵커가 실패**한다. 실측:
    ```python
    guard._is_mutating('GIT_AUTHOR_NAME="John Doe" git commit -m x')  # → False (실제로는 mutating)
    guard._is_mutating('GIT_AUTHOR_DATE="2024-01-01 00:00:00" git commit -m x')  # → False
    ```
    특히 두 번째 형태(`GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` 를 공백 포함 날짜 문자열로 지정)는 이 저장소 자신의 테스트 컨벤션(`test_review_guard_hardening.py`, `.claude/tests/README.md` "Conventions for new tests" 절이 명시)에서 실제로 쓰는 패턴이라, 가상의 엣지케이스가 아니라 이 코드베이스에서 실제로 발생 가능한 입력이다. 이번 diff 의 존재 이유가 "체인된 명령의 false negative 해소"(plan §C "대신 발견한 진짜 결함")인데, 그 해소가 부분적임을 테스트가 놓치고 있다.
  - 제안: `EnvPrefixTest` 에 `VAR="여러 단어"` 케이스를 추가해 실패를 재현한 뒤, `_MUTATING` 의 프리픽스 그룹을 `\S+` 대신 `(?:'[^']*'|"[^"]*"|\S+)` 정도로 완화(따옴표 값 허용)하거나, 최소한 이 잔여 갭을 `AcknowledgedFalsePositiveTest` 처럼 의도적으로 pin 해 문서화한다. 훅이 soft-fail(never block)이라 즉시 차단 리스크는 아니지만, "false negative 를 줄이자"는 변경 목적과 정면으로 부딪히는 잔여 사각지대이므로 최소 pin 은 필요하다.

- **[WARNING]** `\n` 을 세그먼트 구분자로 취급하면서, 헤어독/멀티라인 커밋 메시지 본문의 한 줄이 mutating 동사로 시작할 때 발생하는 **두 번째 FP 클래스**가 테스트·문서 어디에도 없음 — README·docstring 이 "residual FP 는 하나뿐(따옴표 붙은 구분자)"이라고 단정한 것과 배치
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111` (`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|\n]")`) / 관련 pin: `.claude/tests/test_guard_default_branch_bash_mutating.py:98-110` (`AcknowledgedFalsePositiveTest`, `&&` 인용 케이스만 존재) / 문서 단정: `.claude/tests/README.md:45` ("the one residual FP (a quoted separator)")
  - 상세: `AcknowledgedFalsePositiveTest` 는 `echo "a && rm -rf x" > /dev/null` 한 건만 pin 하며, 클래스 이름·주석·README 모두 "잔여 FP 는 이 하나뿐"이라고 서술한다. 그러나 실측하면 `\n` 이 포함된 heredoc 본문에서도 독립된 FP 클래스가 발생한다:
    ```python
    guard._is_mutating("cat <<'EOF'\nmkdir the new feature folder\nEOF")  # → True (cat 은 read-only)
    ```
    커밋 메시지를 `git commit -F - <<'EOF' … EOF` 로 넘기는 패턴은 바로 옆 `plan/complete/harness-push-guard-subcommand-detection.md` 가 push 가드 쪽에서 명시적으로 다루는 실제 시나리오이며, 본문 첫 줄이 "rm 관련 리팩터링" 같은 문장으로 시작하면 이 훅에서도 트리거된다. `&&` 케이스처럼 "의도적으로 수용"한다는 서술은 있지만 그 서술은 인용된 `&&`/`;`/`|` 에어리어만 겨냥하고 있고, heredoc 본문(순수 개행)에서 벌어지는 사례는 별도 성격(따옴표가 없어도 발생, 명령어가 전혀 없는 순수 텍스트에서도 발생)이라 같은 pin 으로 커버된다고 보기 어렵다.
  - 제안: `AcknowledgedFalsePositiveTest` 에 heredoc/멀티라인 케이스를 추가해 "잔여 FP 는 하나가 아니라 최소 두 클래스(따옴표 구분자 + 개행 기반 텍스트 블록)" 임을 명시적으로 pin 하고, README·docstring 의 "the one residual FP" 문구를 갱신한다. 훅이 never-block 이므로 심각도는 낮지만, 문서가 스스로 단정한 범위와 실제 동작이 어긋나 있다.

## 요약

신규 `test_guard_default_branch_bash_mutating.py` (9건)는 세그먼트 분할·env-prefix·FP/FN 경계를 의도적으로 문서화하며 잘 구조화돼 있고(격리·가독성 우수, `_harness.load_module_by_path` 로 순수 함수만 테스트해 모킹도 불필요), 전체 스위트(510건)도 회귀 없이 통과한다. 다만 이번 변경의 핵심 목적인 "체인 명령 false negative 해소"가 따옴표 붙은 다중 단어 환경변수 값(`GIT_AUTHOR_DATE="…  …" git commit` 등, 이 저장소 자신의 컨벤션에서 실제로 쓰는 형태) 앞에서는 여전히 실패하는 것을 실측으로 확인했고, `_SEGMENT_SPLIT` 이 개행을 무조건 구분자로 취급해 heredoc/멀티라인 텍스트 본문에서 문서가 "유일한 잔여 FP" 라고 단정한 것과 다른 두 번째 FP 클래스가 생긴다는 점도 테스트·문서 어느 쪽에도 반영돼 있지 않다. 둘 다 훅이 never-block·세션당 1회 소프트 넛지라는 설계상 심각도는 낮지만, "왜 안전한지"를 스스로 실측·pin 하는 이 diff/plan 의 방법론(다른 항목들이 보여준 것과 동일한 엄밀함) 기준으로 보면 두 갭 모두 최소 pin 대상이다.

## 위험도
LOW
