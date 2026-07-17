# 요구사항(Requirement) 리뷰 — push 가드 `_is_git_push` 재검증

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`
(참고 spec 대용: `plan/in-progress/harness-session-anchor-guards.md` §② — `spec/` 에는 본 harness
tooling 을 다루는 문서가 없음. `.claude/tests/README.md` 도 동작 서술 문서로 함께 대조)

## 검증 방법

정적 리뷰만으로 끝내지 않고, 두 파일이 위치한 실제 `.claude/hooks/guard_review_before_push.py` 모듈을
`importlib` 로 로드해 `_is_git_push`/`_find_command_substitutions`/`_shell_dash_c_argument`/
`_eval_argument` 를 직접 호출하며 반례를 탐색했다. 기존 44 개 테스트(71 subtests)는 전부 PASS 하는
상태에서 출발했다 — 즉 아래 발견은 기존 테스트 스위트의 사각지대다.

---

## 발견사항

### [CRITICAL] `_find_command_substitutions` 의 backtick 미종료 처리가 `break` 로 전체 스캔을 중단시켜, 그 뒤에 나오는 **진짜** `git push` 를 놓친다 (old ⊆ new 회귀, 자기 docstring 의 "over-inclusive" 설계 원칙 위반)

- 위치: `.claude/hooks/guard_review_before_push.py:280-286` (`_find_command_substitutions` 의 backtick 분기), 호출부 `:494-497`(`_is_git_push` 의 `_find_command_substitutions` 재귀 루프)
- 상세:
  ```python
  if ch == "`":
      end = text.find("`", i + 1)
      if end == -1:
          break  # unterminated backtick — nothing more to pair with
      spans.append(text[i + 1:end])
      i = end + 1
      continue
  ```
  `$(...)` 분기(:267-279)는 미종료 시에도 "take the rest" 로 `spans.append(text[i+2:end])`(`end=n`)를 하고 계속
  진행하지만, backtick 분기는 짝이 안 맞으면 `spans.append` 없이 **`while i < n:` 루프 자체를 `break`** 한다 —
  그 지점 이후의 문자열은 `$(...)`든 backtick 이든 **전혀 스캔되지 않는다**. 이는 이 함수 자신의 docstring(
  `guard_review_before_push.py:256-261`, "an unterminated backtick or `$(...)` is left unmatched / **takes the
  rest of the string** rather than raising — over-inclusive is the safe direction")과 정면으로 다르다.

  실제 모듈을 로드해 재현(코드 원문 그대로, 수정 없음):

  ```python
  >>> guard._find_command_substitutions('echo "it`s neat" && git commit -m "$(git push)"')
  []
  >>> guard._is_git_push('echo "it`s neat" && git commit -m "$(git push)"')
  False   # 실제로는 git push 를 실행하는 명령인데 게이트를 완전히 통과한다
  ```

  더 자연스러운 트리거(따옴표를 인위적으로 섞지 않고, 커밋 메시지에 아포스트로피를 백틱으로 잘못 친
  흔한 오타 패턴 하나만으로 재현):

  ```python
  >>> guard._is_git_push('git commit -m "note: don`t forget" && git commit -m "$(git push)"')
  False
  ```

  두 번째 형태: 앞선 짝 없는 backtick 하나가 **그 뒤에 오는 진짜 backtick 쌍**의 첫 번째 backtick과
  잘못 짝지어져(그리디 순차 페어링에 오류 복구가 없음) 가짜 span 을 만들고, 진짜 `git push` 내용이 있는
  두 번째 backtick 쌍은 통째로 유실된다:

  ```python
  >>> guard._find_command_substitutions('echo "it`s neat" && git commit -m "`git push`"')
  ['s neat" && git commit -m "']   # 진짜 내용("git push")이 아니라 무관한 텍스트만 추출됨
  >>> guard._is_git_push('echo "it`s neat" && git commit -m "`git push`"')
  False
  ```

  **레거시 정규식 대비 실측 회귀 확인** — 이 모듈이 스스로 유지하는 `LegacyRegressionDifferentialTest`
  가 요구하는 "old ⊆ new" 를 위 두 명령 모두 위반한다(레거시는 둘 다 정확히 차단했었다):

  ```python
  >>> LEGACY_RE.search('echo "it`s neat" && git commit -m "$(git push)"')       # 매치함 → 차단
  >>> LEGACY_RE.search('echo "it`s neat" && git commit -m "`git push`"')        # 매치함 → 차단
  ```

  즉 이 두 케이스는 `plan/in-progress/harness-session-anchor-guards.md` §② "잔여 한계" 절에 **명시된
  수용 항목이 아니며**(그 절은 heredoc 리터럴 push 줄·미지 옵션 뒤 우연한 "push" 값·단따옴표 안
  `$(...)`·`find -exec`/프로세스 치환/alias/미등록 인터프리터만 나열), `LegacyRegressionDifferentialTest`
  가 잡아야 하는 "old ⊆ new 위반" 범주에 정확히 들어간다 — 다만 그 테스트의 코퍼스(`MUST_BLOCK` +
  `MUST_ALLOW` + `INDIRECT_EXECUTION_CASES` + `ORDINARY_SHELL_COMMANDS`)에 "진짜 substitution 앞에
  홀수 개의 backtick 이 먼저 나오는" 모양의 케이스가 하나도 없어 현재 44/44 PASS 상태에서도 드러나지
  않았다.

  실무 영향: `main()`(`:550-583`)은 `_is_git_push(command)` 가 `False` 를 반환하면 REVIEW 게이트와
  PLAN 게이트를 **둘 다** 건너뛰고 `return 0`(허용)한다 — 즉 이 파일 자신의 모듈 docstring이 명시하는
  "the hard gate ... you cannot ship the branch (push → PR) while code changes remain unreviewed" 를
  완전히 우회시킬 수 있는 미검토 `git push` 가 존재한다.

- 제안: backtick 미종료 시에도 `$(...)` 분기와 대칭으로 "나머지 전체를 span 으로 흡수" 하도록
  최소 수정(`spans.append(text[i+1:]); break`)은 케이스 1(순수 미종료 뒤 실체 없음)은 막아주지만,
  케이스 2(짝이 잘못 밀리는 미스페어링)는 여전히 진짜 `git push` 내용을 건너뛴다 — 순차 그리디
  페어링 자체가 홀수 개의 backtick 앞에서 복구 불능이므로, "backtick 총 개수가 홀수면(또는 페어링이
  중간에 실패하면) 첫 backtick부터 문자열 끝까지를 통째로 하나의 over-inclusive span 으로 취급"하는
  방향의 재설계가 필요해 보인다. 수정 후 위 3개 반례(그리고 가능하면 `MUST_BLOCK`/
  `INDIRECT_EXECUTION_CASES`)를 회귀 테스트로 고정하고, plan 의 기존 방법론대로 "수정 전 코드에서
  FAIL 함을 먼저 확인" 하는 비-vacuity 절차를 따를 것.

### [CRITICAL] `_shell_dash_c_argument`/`_eval_argument` 가 선행 env 대입 토큰을 걷어내지 않아 `FOO=1 bash -c "git push"` / `FOO=1 eval "git push"` 가 간접실행 탐지를 완전히 우회한다

- 위치: `.claude/hooks/guard_review_before_push.py:355-358`(`_shell_dash_c_argument` 의 `segment[0]`
  직접 검사), `:377`(`_eval_argument` 의 `segment[0] != "eval"` 직접 검사)
- 상세: `_git_subcommand` 는 `:313-315` 에서 `_ENV_ASSIGN`(`^[A-Za-z_][A-Za-z0-9_]*=`) 매치 토큰을
  먼저 건너뛴 뒤 실제 명령 토큰을 검사한다 — 이 설계는 `git` 자체를 대상으로 한 것으로,
  `("env assignment prefix", "FOO=1 git push")` 가 `MUST_BLOCK` 에 등재돼 있을 만큼 이 프로젝트가
  명시적으로 다루는 위협 모델이다. 그런데 `-c`/`eval` 간접실행을 여는 두 헬퍼는 이 skip 을 재사용하지
  않고 `segment[0]` 을 곧바로 검사한다 — env 대입이 하나라도 앞에 붙으면 `segment[0]` 이 `"bash"`나
  `"eval"` 이 아니라 `"FOO=1"` 이 되어 즉시 `None` 을 반환하고, `_segment_runs_push`(:388-395)는 이를
  "간접실행 아님" 으로 판정해 재귀하지 않는다.

  재현(수정 없이 원문 그대로):

  ```python
  >>> guard._is_git_push('FOO=1 bash -c "git push"')
  False
  >>> guard._is_git_push('FOO=1 eval "git push"')
  False
  # 대조: env 접두 없는 동일 형태는 정상 차단됨(기존 테스트로 이미 고정돼 있음)
  >>> guard._is_git_push('bash -c "git push"')
  True
  >>> guard._is_git_push('eval "git push"')
  True
  ```

  레거시 정규식도 이 두 케이스는 원래 못 잡았다(사전 회귀 아님 — `LEGACY_RE.search(...)` 가 둘 다
  `None`) — 그런 의미에서 backtick 건과 성격은 다르다. 그러나 plan 문서 §②"review 후속 수정 2"는
  `-c`/`eval` 간접실행을 "closed in the same pass" 로 명시적으로 완결 선언했고, §"잔여 한계" 절도
  이 env-prefix 변형을 수용된 한계로 나열하지 않는다 — 즉 "닫았다"고 선언한 기능의 부분적
  미완성이며, `_git_subcommand` 가 이미 갖고 있는 동일한 skip 로직을 재사용하지 않아 생긴 순수한
  구현 불일치다.
- 제안: `_shell_dash_c_argument`/`_eval_argument` 진입 시 `_git_subcommand` 와 같은 `_ENV_ASSIGN` skip
  루프(또는 공용 헬퍼로 추출)를 먼저 적용한 뒤 `segment[i]`(env 를 건너뛴 첫 실토큰)를 검사하도록
  수정. 회귀 테스트에 `FOO=1 bash -c "git push"`/`FOO=1 eval "git push"`(및 `MUST_ALLOW` 대응 —
  예: `FOO=1 bash -c "echo hi"`)를 추가.

### [WARNING] `.claude/tests/README.md` 서술과 `LegacyRegressionDifferentialTest` 코퍼스가 "간접실행은 전부 차단됨"을 암묵적으로 보장하지만 실제로는 위 두 CRITICAL 만큼 좁다

- 위치: `.claude/tests/README.md:32`("indirect execution via `$(...)`/backtick command substitution or a
  shell's `-c`/`eval` argument) must block"), `.claude/tests/test_push_detection.py:1111-1216`
  (`LegacyRegressionDifferentialTest`)
- 상세: 이 README 한 줄은 사실상 이 테스트 파일의 커버리지 계약을 요약한 "spec 대용" 서술인데, 위
  두 CRITICAL 이 보여주듯 "backtick 앞에 홀수개의 무관한 backtick 이 있는 경우"·"env 접두가 붙은
  `-c`/`eval`" 은 실제로는 차단되지 않는다. `LegacyRegressionDifferentialTest` 의 취지(코드 주석
  자체가 "one-off regression tests ... do not, by themselves, prove there is no next case nobody
  thought to write down")를 정확히 재확인시켜 주는 사례이기도 하다.
- 제안: 코드 fix 와 함께 README 서술은 그대로 두되(문구 자체는 여전히 "목표"로서는 맞음), 두 CRITICAL
  수정 후 해당 반례들을 `MUST_BLOCK`/`INDIRECT_EXECUTION_CASES` 코퍼스에 편입시켜 README 의 주장과
  코퍼스 실제 커버리지가 다시 일치하게 할 것.

### [INFO] `spec/` 에는 이 harness hook 을 규정하는 문서가 없음

- 위치: 해당 없음 (`spec/` 전수 grep 결과 `guard_review_before_push`/`_is_git_push`/`review_guard`
  참조 0건)
- 상세: CLAUDE.md 규약상 `spec/` 는 제품(코드베이스) 스펙 전용이고, `.claude/hooks/**` 같은 harness
  tooling 의 "요구사항"은 `plan/in-progress/harness-session-anchor-guards.md`(본 변경의 작업 plan,
  Critical/Warning 표까지 포함해 사실상의 행위 명세) 와 `.claude/tests/README.md` 가 대신한다. 본
  리뷰의 "spec 본문 일치" 점검은 이 두 문서를 기준으로 수행했다 — 위 CRITICAL 2건은 그 문서들이
  명시한 설계 의도("over-inclusive/fail-safe", "-c/eval indirection closed")와 코드의 실측 동작이
  다른, `project-planner` 개입이 필요 없는 순수 코드 결함이다(spec 자체가 낡은 SPEC-DRIFT 아님).

---

## 그 밖에 확인했으나 문제 없음 (참고용)

- `_GIT_OPTS_WITH_VALUE`/`_GIT_OPTS_NO_VALUE` 두 whitelist 는 서로 겹치지 않음(교집합 `frozenset()`)
  — 이중 분류로 인한 애매성 없음.
- `main()` 의 모든 경로가 `int` 를 반환(0 또는 2), 반환값 누락 없음.
- `_is_git_push`/`_git_subcommand`/`_find_command_substitutions` 모두 선언된 반환 타입과 실제 반환이
  일치.
- `_MAX_RECURSION_DEPTH` 캡·NUL 등 제어문자 fail-closed·`shlex` 예외 fallback·`--no-pager` 류
  boolean 옵션 처리 등은 기존 71 subtests 로 견고하게 고정돼 있고 재검증 결과도 정상.
- TODO/FIXME/HACK/XXX 주석 없음. `git diff HEAD` 없음(두 파일 모두 HEAD 상태와 워킹트리 일치, 리뷰
  대상이 곧 커밋된 최종 상태).
- `python3 -m pytest .claude/tests/test_push_detection.py -q` → `44 passed, 71 subtests passed`.

---

## 요약

두 CRITICAL 모두 "REVIEW/PLAN 게이트를 완전히 우회하는 미검토 `git push`" 라는, 이 파일 자신이
스스로 가장 위험하다고 규정한 실패 모드(false negative)를 실제 실행으로 재현한 것이다. 하나는
`_find_command_substitutions` 의 backtick 미종료 처리가 자기 docstring 의 "over-inclusive" 원칙을
어기고 `break` 로 스캔을 조기 종료시켜 그 뒤의 진짜 push 를 놓치는 것(레거시 정규식 대비 실측
회귀, "old ⊆ new" 위반)이고, 다른 하나는 `-c`/`eval` 간접실행 헬퍼가 `_git_subcommand` 에 이미
있는 env-대입 skip 로직을 재사용하지 않아 `FOO=1 bash -c "..."`/`FOO=1 eval "..."` 형태가 완전히
빠져나가는 것이다(선재 갭이지만 plan 이 "closed" 로 선언한 범위 안). 두 건 다 기존 44/44 테스트를
깨지 않는 사각지대이며, 코드가 인위적이지 않은(오타 수준의) 입력으로도 트리거된다. 그 외 반환값
완전성·TODO 부재·옵션 whitelist 무결성 등 나머지 관점은 이상 없다. `spec/` 자체는 이 harness
파일을 다루지 않으며(INFO), 본 리뷰는 plan 문서·README 를 대용 spec 으로 사용해 그 문서들이 명시한
설계 의도 대비 코드 실측을 비교했다.

## 위험도

CRITICAL
