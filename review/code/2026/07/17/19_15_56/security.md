# 보안(Security) 코드 리뷰

리뷰 대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`

## 발견사항

- **[CRITICAL]** `$'...'` / `$"..."` (bash ANSI-C·locale quoting) 로 `_is_git_push` 를 회피하는 실사용 가능한 push 미탐지 — **legacy 정규식 대비 회귀(regression)**
  - 위치: `.claude/hooks/guard_review_before_push.py` — `_tokenize()` (204-230행, 특히 228행 `lexer.whitespace_split = True`), `_git_subcommand()` (291행~), `_is_git_push()` (398행~), `main()` (523-529행)
  - 상세: bash/zsh 는 `$'...'` (ANSI-C quoting) 와 `$"..."` (locale quoting, 기본 C/POSIX 로케일에서는 평범한 `"..."` 와 동일) 를 셸이 실제 실행하기 **전에** 리터럴로 디코드한다 — `$'push'`, `$"push"` 는 둘 다 실행 시점에 그냥 단어 `push` 가 된다. 반면 이 모듈이 구성한 `shlex.shlex(..., whitespace_split=True)` 는 이 두 형태를 특별 처리하지 않는다 — 선행 `$` 를 "미분류 문자"로 보고 다음에 오는 따옴표 내용에 그대로 이어붙여, `push` 가 아니라 `$push` 라는 토큰을 만든다. `_git_subcommand()` 는 토큰을 정확 문자열 비교로 판정하므로 `git $'push'` / `git $"push"` 는 결코 `push` 서브커맨드로 인식되지 않고, `_is_git_push()` 는 `False` 를 반환 → `main()` 은 529행에서 두 게이트(REVIEW/PLAN) 를 전혀 실행하지 않고 즉시 통과시킨다. 조용한 완전 우회다(에러도, 경고도 없음).
  - **실측 검증** (본 리뷰 중 직접 실행, `git push` 는 실행하지 않고 `echo`/직접 함수 호출로만 검증):
    - `bash -c "echo git \$'push'"` → `git push` 출력 (bash 가 실제로 `git push` 로 해석) — `zsh` 로도 동일 확인.
    - `bash -c 'echo git $"push"'` → `git push` 출력.
    - 실제 모듈 로드 후 `guard._is_git_push("git $'push'")` → `False`.
    - `guard._is_git_push('git $"push"')` → `False`.
    - `guard._tokenize("git $'push'")` → `['git', '$push']` (기대값 `['git', 'push']` 이 아님).
    - 해시 이스케이프로 단어 자체를 난독화한 변형도 동일하게 미탐지: `git $'\x70\x75\x73\x68'` (bash 가 `\x70\x75\x73\x68` 를 `push` 로 디코드) → `guard._is_git_push(...)` = `False`. `--force` 도 같은 방식으로 숨길 수 있음 확인(`git $'\x2d\x2dforce' $'\x70\x75\x73\x68'` → `False`).
  - **회귀 확정**: `test_push_detection.py` 의 `LegacyRegressionDifferentialTest` 가 "old ⊆ new" 를 검증하려고 얼려둔 `_LEGACY_RE` (rewrite 이전 정규식) 는 `git $'push'` 와 `git $"push"` 를 **둘 다 차단(match)** 한다 — 즉 rewrite 이전 정규식 기반 guard 는 이 두 형태를 정상적으로 막고 있었다. 새 shlex 기반 구현에서만 새로 뚫린 회귀다. (해시 이스케이프 변형 `git $'\x70\x75\x73\x68'` 는 legacy 정규식도 못 막던 기존 gap 이며 이번 회귀와는 별개.)
  - **테스트 커버리지 갭**: `LegacyRegressionDifferentialTest` 는 정확히 이런 회귀를 잡기 위해 존재하는 장치이지만, corpus(`MUST_BLOCK`/`MUST_ALLOW`/`INDIRECT_EXECUTION_CASES`/`ORDINARY_SHELL_COMMANDS`) 어디에도 `$'...'`/`$"..."` 형태가 없어 이번 회귀를 스스로 잡아내지 못했다. `grep -n "\$'|ANSI|dollar"` 로 확인 시 `test_push_detection.py` 에 해당 케이스 전무.
  - 영향: 이 파일 자신이 명시한 Critical 기준("A false NEGATIVE lets an unreviewed branch ship. Unsafe.", test_push_detection.py 상단 docstring) 에 정확히 부합한다. `$'push'` 는 난독화 의도 없이도 일부 사용자/스크립트가 습관적으로 쓰는 평범한 bash 인용 문법이라 우발적 발생 가능성도 있고, 의도적 회피(리뷰를 건너뛰고 싶은 상황) 로도 즉시 재현 가능한 2글자 접두(`$'`) 트릭이다.
  - 제안: `_tokenize`/`_is_git_push` (또는 `_find_command_substitutions` 처럼 별도 pre-pass) 에서 `$'` / `$"` 시퀀스를 인식해 최소한 선행 `$` 를 벗기고 나머지를 일반 인용으로 취급(`$'push'` → `push` 로 정상 매칭)하거나, 이 모듈의 기존 fail-closed 철학(예: 미지의 global 옵션 처리)을 따라 이 형태를 만나면 안전하게 차단 방향으로 처리. 가능하면 `\xHH`/8진수/`\n`/`\t` 등 ANSI-C 이스케이프까지 디코드해 `git $'\x70\x75\x73\x68'` 류도 함께 닫는 것이 이상적. 수정 후 `MUST_BLOCK` 과 `LegacyRegressionDifferentialTest` corpus 양쪽에 `git $'push'`, `git $"push"`, `git $'\x70\x75\x73\x68'` 를 추가해 재발 방지 테스트로 고정.

- **[WARNING]** 훅 전체가 "예외 발생 시 fail-open" 으로 설계되어 있어 스스로 표방하는 "hard gate" 서술과 긴장 관계
  - 위치: 40-49행 (`_lib` import 실패 시 `evaluate_review = None` / `evaluate_plan = None`), 532-540행·543-554행 (`evaluate_review()`/`evaluate_plan()` 호출을 감싸는 `try/except Exception: ... = None  # fail open on internal error`), 모듈 상단 계약 주석(27-39행, "any other → treated as runtime error; tool call proceeds (fail-open)"), 560행 `sys.exit(main())` (감싸지지 않음 — `main()` 내부에서 처리 안 된 예외, 예를 들어 `tool_input` 이 dict 가 아닐 때의 `AttributeError` 는 그대로 전파되어 harness 계약상 fail-open 으로 수렴).
  - 상세: 이 모듈은 자신을 "the hard gate for the '리뷰/fix 를 PR 로 미룸' failure mode" 로 표현하지만(27-34행), 내부적으로 3중 fail-open 경로를 갖는다 — (1) `_lib/review_guard.py`/`plan_guard.py` import 실패, (2) `evaluate_review()`/`evaluate_plan()` 평가 중 예외, (3) `main()` 자체에서 처리되지 않는 예외(맬폼드 payload 등). 셋 다 "차단하지 않고 통과" 로 수렴한다. 코드 주석에 의도적 설계로 명시되어 있어 새로 발견된 결함은 아니지만, 이 게이트의 유일한 존재 목적이 "리뷰 없는 push 차단" 이라는 점에서, 예외 발생 시의 기본값이 fail-closed 가 아니라 fail-open 이라는 점은 보안 검토자로서 명시적으로 짚어야 할 트레이드오프다. `review_guard.py`/`plan_guard.py` 에 (의도적이든 실수든) 구문 오류나 런타임 예외를 유발하는 변경이 들어가면, 이 게이트는 stderr 로그 외에는 별다른 경고 없이 조용히 무력화된다.
  - 제안: 이미 인지된 트레이드오프로 보이므로 재설계를 요구하진 않되, fail-open 발생 시 stderr 로그를 CI/사전-push 알림 등으로 별도 감시하거나 "연속 N 회 fail-open 발생 시 별도 경고" 같은 안전장치를 고려. 최소한 모듈 상단 docstring 의 "hard gate" 표현에 "예외 시 fail-open" 한계를 한 줄 명시해 기대치를 정합시킬 것.

- **[INFO]** `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 우회 — harness 가 이 값을 이후 Bash 호출에 전파/영속시키는지는 본 두 파일만으로 검증 불가
  - 위치: 532행, 543행 (`os.environ.get("BYPASS_REVIEW_GUARD") != "1"` 등)
  - 상세: 이 검사는 훅 프로세스 자신의 `os.environ` 만 본다. `BYPASS_REVIEW_GUARD=1 git push` 처럼 커맨드 문자열에 인라인으로 넣어도, 그 대입은 실제 셸이 push 를 실행할 때만 유효한 값이고 훅은 그 실행 이전에 별도 프로세스로 payload(JSON) 를 평가하므로 훅의 `os.environ` 에는 반영되지 않는 것이 정상 기대 동작이다. 다만 harness 가 훅 프로세스를 스폰할 때 Bash tool 호출 시점의 환경을 그대로 물려주는 방식이라면 이 전제가 달라질 수 있는데, 그 부분은 이 리뷰 대상 파일들 범위 밖이라 확정할 수 없다.
  - 제안: harness 쪽에서 훅 프로세스가 상속하는 환경이 Bash 명령의 inline env prefix 와 무관함을 한 번은 명시적으로 확인하거나 문서에 남겨 둘 것.

- **[INFO]** fallback 정규식의 경미한 ReDoS 가능성 (실질 위험 매우 낮음)
  - 위치: `_GIT_PUSH_FALLBACK` (57행), 사용처는 `_is_git_push` 의 제어문자 검출/`ValueError` 분기(대략 480행대)뿐.
  - 상세: `(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*` 형태의 반복 그룹은 병적으로 긴 미일치 입력에 대해 다항(대략 O(n²)) 시간이 걸릴 수 있다(고전적 지수적 catastrophic backtracking 패턴은 아님). 이 fallback 은 (a) 제어문자 포함 또는 (b) shlex 파싱 실패(따옴표 불균형) 시에만 실행되며, 로컬 개발자 도구라 공격자가 임의의 초대형 문자열을 이 훅에 주입할 현실적 경로가 제한적이다.
  - 제안: 시급하지 않음. 필요하면 fallback 정규식 적용 전 커맨드 길이 상한 가드를 추가해 방어 심화만 고려.

- **[INFO]** import/평가 실패 시 전체 트레이스백을 stderr 로 출력 (실질 위험 매우 낮음)
  - 위치: 42행 `traceback.print_exc(file=sys.stderr)`(및 동일 패턴이 536행, 547행)
  - 상세: 내부 파일 경로 등 정보가 stderr 에 노출될 수 있으나, 이 훅은 순수 로컬 개발자 워크플로에서만 실행되고 원격 노출 경로가 없어 실질적 정보 노출 위험은 거의 없다.
  - 제안: 조치 불요.

- **[INFO]** 문서화·수용된 잔여 한계 (참고용, 조치 불요)
  - 상세: `find … -exec git push \;`, process substitution(`diff <(git push) x`), git alias(`git config alias.p push` 후 `git p`), `_SHELL_INTERPRETERS` 밖의 인터프리터 등은 코드 자체가 "Deliberately NOT recursed into — pre-existing, structural limitations of a static token-based guard" 로 명시하며 `ResidualLimitationsTest` 로 고정해 둔 의도적 스코프 경계다. 정적 토큰 기반 가드가 임의 셸 실행을 완벽히 예측할 수 없다는 구조적 한계이며, 이번 CRITICAL 항목(`$'...'`/`$"..."`)과 달리 legacy 대비 회귀도 아니고 project 스스로 인지·수용한 gap 이라 새로운 조치를 요구하지 않는다.

## 파일 2 (`test_push_detection.py`) 관련

테스트 파일 자체에는 보안 이슈가 없다(외부 입력을 실행하지 않고 순수 함수 호출만 검증). 다만 위 CRITICAL 항목에서 지적한 대로, 회귀를 스스로 잡아내야 할 `LegacyRegressionDifferentialTest` 의 corpus 에 dollar-quote(`$'...'`, `$"..."`) 케이스가 전혀 없어 이번 회귀를 놓쳤다는 점은 테스트 커버리지 갭으로 별도 기재했다(CRITICAL 항목의 "제안" 참고).

## 요약

`guard_review_before_push.py` 는 자신을 "hard gate" 로 표방하며 셸 인용·간접 실행(command substitution, `-c`/`eval`, NUL 바이트, 대소문자, 미상 global 옵션 등)에 대해 이미 두 차례의 AI 리뷰를 거쳐 상당히 정교하게 방어선을 구축해 두었다. 이번 리뷰에서는 그 방어선에서 아직 다루지 않은 새로운 축 — bash/zsh 의 `$'...'`(ANSI-C quoting)·`$"..."`(locale quoting) — 을 실측으로 확인했고, `git $'push'` 라는 사실상 난독화조차 필요 없는 입력이 실제 셸에서는 `git push` 로 실행되지만 이 훅은 이를 탐지하지 못해 REVIEW/PLAN 게이트를 조용히 완전 우회한다는 것을 코드 실행으로 직접 검증했다. 더 나아가 이 두 형태(`$'push'`, `$"push"`)는 이 프로젝트가 회귀 방지용으로 얼려 둔 legacy 정규식은 정상적으로 차단하던 것이어서, 이번 shlex 기반 rewrite 가 만든 새로운 회귀임도 확인했다. 이 외에는 SQL/커맨드 인젝션, 하드코딩된 시크릿, 안전하지 않은 암호화, 인증/인가 우회(환경변수 기반 bypass 는 의도된 escape hatch 로 보이나 harness 환경 전파 방식은 이 파일만으로 확정 불가) 등 전형적인 OWASP Top 10 이슈는 발견되지 않았고, 훅 전체가 예외 발생 시 fail-open 하도록 설계된 점은 "hard gate" 라는 자기 서술과는 긴장 관계이나 코드 주석상 의도된 트레이드오프로 보인다.

## 위험도

CRITICAL
