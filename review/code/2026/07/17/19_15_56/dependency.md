# 의존성(Dependency) 리뷰

리뷰 대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`
(git push 감지 로직의 shlex 기반 재작성 + 신규 회귀 테스트)

## 발견사항

- **[INFO]** 신규 import 는 `shlex` 1건, 표준 라이브러리 — 프로젝트의 "harness Python = zero third-party deps" 관례 준수
  - 위치: `.claude/hooks/guard_review_before_push.py` (파일 상단 import 블록, `import shlex`)
  - 상세: `git diff origin/main...HEAD -- .claude/hooks/guard_review_before_push.py`로 대조한 결과, origin/main 버전의 이 파일은 `json`/`os`/`re`/`sys`/`traceback`(+`__future__.annotations`)만 import하고 `shlex`는 없었다. 즉 `shlex`는 이번 변경으로 순수 신규 추가된 import이며, 외부 패키지가 아니라 Python 3 표준 라이브러리다. `PROJECT.md:334`, `PROJECT.md:346`, `.claude/tests/_harness.py:6-7`("matching the harness convention that its Python carries zero third-party deps")가 명시하는 "harness Python 스크립트는 서드파티 의존성 0" 관례를 그대로 만족한다. `.claude/` 트리 전체에서 `import shlex`를 사용하는 파일은 이 1개뿐임을 확인했고(`grep -rl "import shlex" .claude/`), 기존에 유사 기능(shell 토큰화)을 제공하던 내부 유틸을 중복 구현한 것도 아니다.
  - 제안: 조치 불필요. 참고로만 기록.

- **[INFO]** `shlex` 채택은 정당화됨 — `re` 단독 접근의 구조적 한계(Critical #1~#4)를 해결하기 위한 최소 도구 선택
  - 위치: `.claude/hooks/guard_review_before_push.py` 파일 전역 docstring(예: `_tokenize` 함수 docstring, L204-222)
  - 상세: 코드 내 docstring이 `re` 기반 이전 구현이 놓친 실제 회귀 사례(개행만으로 구분되는 두 명령, `$(...)`/backtick 명령 치환, `-c`/`eval` 간접 실행, 인용된 pure-punctuation 토큰 등)를 근거로 shlex 채택 이유를 상세히 기록하고 있다. 표준 라이브러리 안에서 쉘 인용 규칙을 인지하는 토크나이저가 필요했고 `shlex.shlex(..., punctuation_chars=...)`가 그 요구를 정확히 충족한다 — 서드파티 shell-parsing 라이브러리(`bashlex` 등)를 끌어올 필요가 없었다. "불필요한 의존성" 관점에서 문제 없음.
  - 제안: 조치 불필요.

- **[INFO]** 버전 고정/호환성: 대상 없음(서드파티 패키지 미도입), stdlib API 요구 버전도 무리 없이 충족
  - 위치: `.claude/hooks/guard_review_before_push.py` `_tokenize` (L204-222), `.github/workflows/harness-checks.yml` L42-44
  - 상세: `shlex.shlex(text, posix=True, punctuation_chars=...)`의 `punctuation_chars` 파라미터는 Python 3.6+ 요구 — CI(`actions/setup-python@v6`, `python-version: '3.x'`, 최신 3.x로 floating)와 로컬 실행 환경(`python3 --version` → 3.11.9) 모두 여유 있게 충족한다. 코드 내 `list[str]`/`str | None` 등 PEP 585/604 스타일 타입 힌트도 전부 `from __future__ import annotations`(PEP 563, 지연 평가) 보호 아래 함수 시그니처/변수 애너테이션 위치에만 등장하며(`grep`으로 전수 확인 — 런타임에서 실제로 subscript되는 위치 없음) 구버전 Python에서도 import 시점 오류를 일으키지 않는다. lockfile/버전 고정 파일(requirements.txt, pyproject.toml 등)은 이 harness 스크립트 군에 존재하지 않으며, 이는 "표준 라이브러리만 사용"이라는 기존 프로젝트 관례상 정상이다(codebase/의 pnpm 의존성과는 별도 축).
  - 제안: 조치 불필요.

- **[INFO]** 취약점: `shlex` 자체는 알려진 CVE 대상 아님. 신뢰 경계는 fail-closed 설계로 이미 보완됨
  - 위치: `.claude/hooks/guard_review_before_push.py` `_is_git_push` L508-536 (특히 `_has_hostile_control_characters` 분기와 `except ValueError` fallback)
  - 상세: Python 공식 문서는 `shlex`가 완전히 적대적인 입력 파싱을 위해 설계된 모듈은 아니라고 명시하지만, 이 훅의 위협 모델은 "Claude 에이전트가 구성한 Bash 명령을 오분류하지 않는 것"이며 임의의 외부 신뢰되지 않은 데이터를 파싱하는 것이 아니다. 또한 코드는 이미 이 한계를 인지하고 있다 — NUL 등 제어문자가 있으면 shlex 토큰화를 신뢰하지 않고 구형 정규식 fallback으로 fail-closed(WARNING #1 주석), 인용부호 불균형 등 파싱 불가 시에도 동일하게 fail-closed(`except ValueError`)한다. 즉 shlex의 파싱 한계가 실제 보안 구멍으로 이어지지 않도록 이미 방어선이 설계돼 있다. 신규 서드파티 패키지가 아니므로 `pnpm audit`/CVE 데이터베이스 대상도 아니다(`.github/workflows/deps-security-checks.yml`은 `pnpm-workspace.yaml`/`pnpm-lock.yaml`/`package.json` 경로에만 반응하도록 스코프돼 있어 이번 변경으로 트리거되지 않음 — 확인함).
  - 제안: 조치 불필요. (참고: shlex의 "적대적 입력 비신뢰" 한계 자체는 보안 리뷰어 관점에서 더 다뤄질 수 있으나, 의존성 관점에서는 취약점 없음으로 판단)

- **[INFO]** 내부 의존성 배선 — 변경 후에도 정상 동작 확인(직접 실행 검증)
  - 위치: `.claude/hooks/guard_review_before_push.py` L66-75(`review_guard`/`plan_guard` 임포트), `.claude/tests/test_push_detection.py` L1-26(`_harness` 의존)
  - 상세: 이번 diff는 `_lib/review_guard.evaluate_review`, `_lib/plan_guard.evaluate_plan` 임포트 블록 자체는 건드리지 않았지만, 회귀 여부를 직접 검증했다 — 모듈을 실제로 로드해 `evaluate_review`/`evaluate_plan`이 여전히 `None`(임포트 실패 fallback)이 아닌 실함수로 바인딩됨을 확인(둘 다 성공). 신규 파일 `test_push_detection.py`는 기존 `.claude/tests/_harness.py`의 `load_module_by_path`/`HOOKS_DIR`(변경 없음)를 재사용해 `guard_review_before_push.py`의 private 함수(`_is_git_push`, `_tokenize`, `_git_subcommand`, `_GIT_OPTS_WITH_VALUE` 등)를 화이트박스로 직접 테스트한다 — 보안에 민감한 파서 내부 분해를 그대로 pin하는 의도된 결합이며(예: `_GIT_OPTS_WITH_VALUE`/`_GIT_OPTS_NO_VALUE` 전수를 table-driven으로 순회해 "화이트리스트 rot" 방지), 문제 있는 순환/은닉 의존이 아니다. 실제로 `python3 -m unittest discover -s .claude/tests -p 'test_push_detection.py'`를 실행해 44개 테스트 전부 통과를 확인했다(모듈 로더 → `sys.path`에 `HOOKS_DIR` 추가 → `_lib` 임포트까지 엔드투엔드 경로). `.claude/settings.json`의 훅 등록(L51, 파일 경로 기준)과 `.claude/tests/README.md`의 `test_push_detection.py` 설명(간접실행/`--no-pager` 케이스까지 반영)도 이번 변경 내용과 정합해 stale 문서/배선 없음.
  - 제안: 조치 불필요.

- **[INFO]** 번들 크기·빌드 시간: 해당 없음 + 자체 성능 실측 문서화됨
  - 위치: `.claude/hooks/guard_review_before_push.py` `_is_git_push` docstring L522-529
  - 상세: 이 변경은 Node/frontend 번들이나 backend 빌드 파이프라인과 무관한 Python 훅 스크립트다. 매 Bash 호출마다 무조건 토큰화하기로 한 설계 결정에 대해 코드 자체가 `timeit`으로 실측한 비용(실제 Bash-tool 명령 샘플 기준 약 6-24us)을 `python3` 인터프리터 기동 비용(~13ms)과 대비해 문서화했다 — 무시 가능한 수준임을 자체 근거로 남겨 별도 검증이 불필요하다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `.claude/` 하네스의 `git push` 감지 로직(`guard_review_before_push.py`)을 정규식 기반에서 shlex 기반 토크나이저로 재작성하고, 이를 pin하는 신규 회귀 테스트 파일(`test_push_detection.py`)을 추가한 것이다. 의존성 관점에서 유일하게 새로 추가된 것은 `shlex`이며, 이는 Python 표준 라이브러리로서 프로젝트가 명시적으로 규정한 "harness Python 스크립트는 서드파티 의존성 0" 관례(PROJECT.md, `_harness.py` docstring)를 그대로 준수한다. 버전 고정·라이선스·취약점·의존성 크기 항목은 모두 해당 없음(N/A)으로 귀결되며, `re` 단독으로는 해결 불가능했던 실측 회귀(Critical #1~#4)를 근거로 shlex 채택이 정당화되어 "불필요한 의존성" 문제도 없다. 내부 의존성(`_lib/review_guard`, `_lib/plan_guard`, `_harness` 테스트 인프라, `settings.json` 훅 등록)은 직접 실행·테스트로 정상 동작을 재확인했다. 전반적으로 의존성 관점에서 지적할 결함이 없는 매우 낮은 위험의 변경이다.

## 위험도

NONE
