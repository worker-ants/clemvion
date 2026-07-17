# 아키텍처(Architecture) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`

## 발견사항

- **[WARNING]** `_is_git_push` 판정 엔진(~350줄)이 `_lib/` 관례를 벗어나 훅 엔트리포인트 파일에 직접 내장됨 + 동일 판정 필요가 형제 훅에서 독립적으로(그리고 훨씬 약하게) 재구현되어 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:57-480` (`_GIT_PUSH_FALLBACK`~`_is_git_push` — tokenizer, 명령치환 스캐너, git 서브커맨드 리졸버, `-c`/`eval` 재귀 전체) vs `.claude/hooks/guard_default_branch_bash.py:60-81` (`_MUTATING` 정규식, 자체적으로 `git\s+(?:commit|reset|...|push\b|...)` 매칭)
  - 상세: 이 훅 패키지의 다른 판정 모듈들 — `_lib/review_guard.py`, `_lib/plan_guard.py`, `_lib/branch_guard.py` — 은 전부 "판정 로직은 `_lib/`, 훅 파일(`guard_*.py`)은 payload 읽기 + `evaluate()` 호출 + 메시지 포맷팅만" 이라는 일관된 레이어 분리를 따른다. `guard_review_before_push.py` 만 이 관례에서 벗어나 있다: 3개 세션(review/code/2026/07/17 17_09_10 → 18_04_20 → 이번 델타)에 걸쳐 하드닝된 tokenizer(`_tokenize`)·명령치환 균형괄호 스캐너(`_find_command_substitutions`)·git 서브커맨드 리졸버(`_git_subcommand`)·간접실행 재귀(`_shell_dash_c_argument`/`_eval_argument`/`_segment_runs_push`)가 파일 전체 560줄 중 대부분(57~480행)을 차지하며 훅 엔트리포인트 안에 직접 산다. 실제 훅 오케스트레이션(`main()`, REVIEW/PLAN 게이트 호출, 메시지 상수)은 480행 이후 80줄 남짓뿐이다. 이 판정 로직 자체의 내부 응집도는 높다 — 순수 함수로만 구성되고, 전용 테스트 파일(`test_push_detection.py`, 621줄)이 `IsGitPushTest`/`RecursiveIndirectionTest`/`CommandSubstitutionExtractionTest`/`ShellDashCAndEvalArgumentTest` 등으로 이미 "독립된 판정 유닛"처럼 다루고 있다. 문제는 응집도가 아니라 **배치**다.
    같은 저장소에 "Bash 명령 문자열이 실제로 어떤 git 서브커맨드를 실행하는가"를 판정해야 하는 또 다른 PreToolUse 훅이 이미 존재한다 — `guard_default_branch_bash.py` 의 `_MUTATING` 정규식이 그것으로, `git\s+(?:commit|reset|checkout -b|...|push\b|...)` 를 매칭한다. 이 정규식은 셸 인용·개행-단독 구분·명령치환·case-insensitive 런처를 전혀 모르는 단순 anchored regex 이며, `guard_review_before_push.py` 가 지난 3세션에 걸쳐 하나씩 막아온 것과 **동일 계열의 과소탐지**(heredoc 안에 숨은 `git push`, `bash -c "... push"`, `GIT push` 등)에 그대로 노출돼 있다. 두 훅이 개념적으로 같은 질문을 풀면서 서로 다른 정교함 수준으로 독립 진화하고 있고, 한쪽(이번 PR)의 하드닝은 다른 쪽에 전혀 반영되지 않는다. (다만 `guard_default_branch_bash.py` 는 자체 docstring 에 "never blocks, misclassification only injects a harmless reminder" 라고 명시된 soft-fail 설계이므로, 오탐/미탐의 실질 위험은 낮다 — 이 훅의 단순함 자체가 결함은 아니다.)
  - 제안: `_tokenize` ~ `_is_git_push`(그리고 지원 상수·헬퍼)를 `.claude/hooks/_lib/git_command_detection.py` 같은 이름으로 추출해 다른 `_lib` 모듈과 같은 위치·같은 컨벤션(순수 판정 함수 + 훅은 얇은 wrapper)으로 맞춘다. `guard_review_before_push.py` 는 `from git_command_detection import is_git_push` 로 축소하고, `guard_default_branch_bash.py` 도 필요 시 같은 모듈을 재사용할 길을 열어둔다. 이번 PR 을 블로킹할 사안은 아니다(로직 자체의 정확성·테스트는 견고하고 자매 훅은 soft-fail 이라 당장 위험은 낮음) — 다만 이미 3세션 분량의 하드닝 투자가 한쪽 파일에만 누적되고 있으므로 후속 plan 항목으로 추적을 권장한다.

- **[INFO]** 간접 실행 리졸버(`_shell_dash_c_argument`, `_eval_argument`)가 확장 가능한 리스트가 아니라 순차 `if`/`else` 체인으로 하드코딩됨
  - 위치: `.claude/hooks/guard_review_before_push.py:382-397` (`_segment_runs_push`)
  - 상세: 현재 리졸버가 2개뿐이라 실질 문제는 아니다. 모듈 자신의 "잔여 한계" 주석(`_is_git_push` docstring 하단)이 스스로 인정하듯 `env`/`sudo`/`nohup`/`timeout`/`xargs` 등 `_SHELL_INTERPRETERS` 밖의 래퍼는 여전히 탐지 범위 밖이며, 이는 은닉된 결함이 아니라 문서화되고 의식적으로 수용된 트레이드오프다. 다만 다음 래퍼 하나를 추가로 지원하게 되면 `if inner is None: inner = _eval_argument(...)` 체인이 세 번째 분기로 늘어나는 대신, `_INDIRECTION_RESOLVERS: list[Callable[[list[str]], str | None]]` 형태로 바꾸면 리졸버 추가가 개방-폐쇄 원칙에 더 가까워진다(기존 `_GIT_OPTS_WITH_VALUE`/`_GIT_OPTS_NO_VALUE` 가 frozenset 테이블로 이미 이 패턴을 따르는 것과 대칭).
  - 제안: 현재로선 조치 불필요(리졸버 2개엔 과한 일반화). 위 WARNING 의 `_lib/` 추출 시점에 함께 고려할 만하다.

- **[INFO]** `_git_subcommand()` 의 fail-closed 분기가 "확정 파싱"과 "보수적 추측"을 같은 `str | None` 반환 타입에 섞음 — 직전 아키텍처 리뷰(review/code/2026/07/17/18_04_20, INFO #1)에서 이미 지적된 특성이며, 이번 델타(간접 실행 처리 추가)에서도 그대로 유지됨.
  - 위치: `.claude/hooks/guard_review_before_push.py:338` (`return "push" if "push" in segment[i + 1:] else None`)
  - 상세: 정상 경로(같은 함수의 `return token`)는 실제로 파싱된 서브커맨드를 돌려주지만, 미지 글로벌 옵션을 만난 이 분기는 "확신 없음, 그러나 뒤에 push 라는 단어가 있으니 보수적으로 push 로 간주"라는 전혀 다른 신뢰도의 판정을 같은 타입으로 내보낸다. 유일 호출부(`_segment_runs_push`)가 `== "push"` 비교만 하므로 현재는 무해하고, docstring 에도 의도적 트레이드오프로 명시돼 있다 — 새 결함은 아니며 조치를 요구하지 않는다.
  - 제안: 조치 불필요. 재사용 확장 시점(예: 다른 서브커맨드 판정에 이 함수를 재사용)에만 `(subcommand, confident)` 형태로 분리를 고려.

## 요약

이번 델타(간접 실행 탐지 + 제어문자·불리언 옵션 회귀 수정, review/code/2026/07/17/18_04_20 의 Critical #1·WARNING #1-3 해소)는 직전 아키텍처 리뷰가 이미 확인한 기본 뼈대 — "탐지"(`_is_git_push` 계열)와 "정책"(REVIEW/PLAN 게이트)의 명확한 레이어 분리, `review_guard`/`plan_guard` 각각을 독립 try/except 로 감싼 장애 격리, 순환 의존성 없음(hooks → `_lib` 단방향, `_lib/review_guard.py`·`_lib/plan_guard.py` 모두 stdlib 만 임포트) — 을 그대로 유지한 채 동일 스타일(순수 함수, frozenset 테이블, 재귀 깊이 상한)로 확장됐다. `_find_command_substitutions`/`_shell_dash_c_argument`/`_eval_argument`는 모두 단일 책임의 작은 함수이며, 반복되던 재귀 처리를 `_segment_runs_push` 하나로 뽑아 mid-loop·trailing-segment 두 호출부가 서로 다르게 드리프트하지 않도록 한 것도 좋은 리팩터다. `LegacyRegressionDifferentialTest`(구 정규식을 얼려 회귀 베이스라인으로 삼아 "old ⊆ new"를 광범위 코퍼스로 구조적으로 고정)는 이 종류의 파서 하드닝에 특히 적합한 테스트 아키텍처다. 다만 이 판정 엔진이 3개 세션에 걸쳐 파일 560줄 중 대부분까지 불어나는 동안, 같은 저장소의 자매 모듈들이 이미 확립한 "판정 로직은 `_lib/`, 훅 파일은 얇은 오케스트레이션" 관례를 따르지 않고 훅 엔트리포인트에 그대로 눌러앉았다는 점, 그리고 "이 Bash 명령이 어떤 git 서브커맨드를 실행하는가"라는 같은 질문을 `guard_default_branch_bash.py` 가 훨씬 약한 정규식으로 독립 재구현하고 있어 이번 하드닝의 혜택을 전혀 못 받는다는 점은 구조적 부채로 남아 있다. 둘 다 이번 PR 을 막을 사안은 아니다(내장 로직 자체의 정확성·테스트는 견고하고, 자매 훅은 soft-fail 설계라 당장 위험은 낮다) — 후속 `_lib/` 추출 리팩터로 추적할 것을 권장한다.

## 위험도
LOW
