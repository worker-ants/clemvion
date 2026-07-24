# Security Review — push guard `_GIT_PUSH` 따옴표 env 접두 수정 (§J)

## 발견사항

- **[CRITICAL]** `_GIT_PUSH` 정규식이 이번에 새로 도입한 이중따옴표 브랜치(`"[^"]*"`)가 **백슬래시로
  이스케이프된 `"`를 인식하지 못해**, env 값 안에 이스케이프된 `"`가 있는 `git push` 명령이
  다시 탐지 불능(§J 와 동일한 부류의 gate 우회)이 됩니다.
  - 위치: `.claude/hooks/guard_review_before_push.py:108` (`_GIT_PUSH = re.compile(...)` 의 첫 번째
    추가 줄 — `r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|\"[^\"]*\"|[^\s'\"]\S*)\s+)*"`).
    같은 패턴이 `.claude/tests/test_push_guard_allowlist.py:70` 의 `_BLIND_PATTERN` 에도 byte-identical
    로 복제돼 있어 테스트 픽스처 쪽도 동일 결함을 그대로 상속합니다.
  - 상세: 실제 모듈을 로드해 재현했습니다(`_is_git_push` 직접 호출):
    ```
    GIT_SSH_COMMAND="ssh -i \"file with space\"" git push origin main   -> is_git_push: False
    GIT_AUTHOR_NAME="John \"JD\" Doe" git push                          -> is_git_push: False
    GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main (§J 수정 확인용)-> is_git_push: True
    ```
    원인: 새 이중따옴표 대안 `"[^"]*"`는 POSIX 이중따옴표 안에서 `\"`가 리터럴 `"`를 표현한다는
    사실을 모르고 첫 `"` 문자에서 즉시 값을 끊어버립니다. 그 결과 값 뒤에 요구되는 `\s+`가
    실패하고, env-접두 그룹 전체가 0회 반복으로 되돌아가며, `git\b` 앵커가 문자열 시작 위치의
    `GIT_SSH_COMMAND`(대문자)와 맞지 않아 **`_GIT_PUSH.search()` 자체가 어디서도 매치되지 않습니다.**
    `command` 안에 `&&`/`;`/`|` 구분자가 없는 한(이 예시들처럼) 앵커가 매치될 다른 위치도 없으므로
    전체 탐지가 실패합니다.
    같은 파일의 `_MESSAGE_ARG`(263~267행)는 정확히 이 문제(이중따옴표 이스케이프)를 이미
    `(?:\\.|[^"\\])*` 로 올바르게 처리하고 있는데, 이번에 새로 추가한 env-값 대안에는 그 패턴을
    적용하지 않았습니다 — 같은 파일 안에 정답과 오답이 공존합니다.
    영향은 §J 와 동일합니다: 탐지가 실패하면 `_is_git_push()` 가 `False` 를 반환 → `main()` 은
    `return 0`(“push 아님”) → REVIEW/PLAN 게이트 모두 실행되지 않고, **fail-open 관측(배너/카운터)조차
    발동하지 않습니다** (이건 예외가 아니라 "탐지 결과가 false" 라서 `_report_fail_open` 의
    `degraded` 경로를 타지 않음). 즉 리뷰 안 된 코드가 완전히 침묵 속에 push 될 수 있는, §J 가
    막으려던 바로 그 결함이 좁은 트리거로 재발합니다. 트리거 자체(env 값 안의 이스케이프된 `"`)는
    다소 드물지만, 유효한 POSIX 셸 문법이라 조작 없이도 발생 가능합니다(예: 값에 따옴표 문자를
    포함해야 하는 SSH 커맨드/작성자명 등).
    참고(진단용, 이 diff 밖): `guard_default_branch_bash.py:101` 의 `_MUTATING` 도 "byte-identical" 이라고
    주석·plan 문서가 명시한 동일 3-대안(`'[^']*'|"[^"]*"|[^\s'"]\S*`)을 그대로 복제하고 있어 같은
    결함을 공유합니다. 다만 그 훅은 soft-fail(never blocks, 넛지 전용)이라 이 파일만큼 심각하지
    않습니다.
  - 제안: 이중따옴표 대안을 `_MESSAGE_ARG` 와 동일한 이스케이프-인지 패턴으로 교체 —
    `"(?:\\.|[^"\\])*"`. `_GIT_PUSH`(hook)·`_BLIND_PATTERN`(test 고정값)·(가능하면 별건으로)
    `guard_default_branch_bash.py::_MUTATING` 세 곳을 함께 갱신하고, `_LEGACY_PATTERN` 은 회귀
    바닥이므로 건드리지 않습니다. `CORPUS` 에 이스케이프된 이중따옴표를 포함한 env 접두 케이스
    (예: `GIT_AUTHOR_NAME="John \"JD\" Doe" git push`)를 `release_reason=None`(반드시 차단되어야
    함)으로 추가해 이번 §J 수정과 같은 방식으로 회귀를 고정하세요. `test_the_pin_targets_the_post_fix_pattern`
    류의 pin 테스트도 이 새 이스케이프 처리를 포함하도록 갱신이 필요합니다.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 의 §J 항목이 "✅ 해소" 로 표시돼 있으나
  (위 CRITICAL 근거로) 완전히 해소된 것은 아닙니다.
  - 위치: `plan/in-progress/harness-guard-followups.md:449` (`- [x] ✅ ... _GIT_PUSH env 값에 따옴표
    형태 허용 ...`), 체크리스트 483행.
  - 상세: 플레인/따옴표(공백 포함) 형태는 실제로 고쳐졌고 회귀 코퍼스도 견고합니다(공백-포함
    단순 따옴표 6종 전부 통과 확인). 다만 "따옴표 형태 허용"이 이스케이프까지 포함한다고 오인될
    소지가 있어, 위 CRITICAL 이 고쳐질 때까지는 완전한 해소로 표기하지 않는 것이 안전합니다.
  - 제안: CRITICAL 수정 후 이 항목을 갱신하거나, 최소한 "이스케이프된 이중따옴표는 미해결"이라는
    잔여 각주를 남기세요(이 문서 자체가 그런 각주 관행을 이미 여러 곳에서 쓰고 있습니다).

## 그 외 점검한 항목 (문제 없음)

- **ReDoS**: 새 3-대안(`'[^']*'|"[^"]*"|[^\s'"]\S*`)은 첫 문자가 서로소(`'`/`"`/그 외)라 모호한
  분기가 없고, 실측(수천~수만 반복 adversarial 입력, 미종료 인용부호 포함)으로도 선형 시간을
  확인했습니다. 새로운 ReDoS 벡터는 도입되지 않았습니다.
- **정보 노출**: 실패/차단 메시지(`_REVIEW_MSG`/`_PLAN_MSG`/`_report_fail_open`)는 원본 `command`
  문자열(민감정보를 담을 수 있는 셸 커맨드 원문)을 그대로 echo 하지 않습니다 — 시크릿이 커맨드
  라인에 있었더라도 이 훅의 stderr/stdout 출력에는 노출되지 않습니다.
- **하드코딩된 시크릿/인증/암호화/의존성**: 이번 diff(훅 정규식 수정 + 테스트 보강 + plan 문서)에는
  해당 사항이 발견되지 않았습니다.
- 테스트 파일의 `subprocess.run([sys.executable, "-c", script], ...)` 는 `repr()` 로 안전하게
  이스케이프된 로컬 신뢰 경로만 삽입하므로 인젝션 벡터가 아닙니다.

## 요약

이번 변경은 §J(따옴표 있는 env 접두가 `git push` 탐지를 피해가는 리뷰 게이트 완전 우회)를 고치려는
의도된 보안 수정이며, 공백 포함 단순 따옴표 케이스는 실제로 잘 막습니다. 그러나 새로 추가한
이중따옴표 대안이 POSIX 의 `\"` 이스케이프를 처리하지 못해, 같은 파일의 `_MESSAGE_ARG` 가 이미
올바르게 구현한 이스케이프-인지 로직을 그대로 재사용하지 않은 결과 **동일한 부류(gate 완전 우회,
무신호)**의 잔여 결함이 남아 있습니다(실제 모듈 실행으로 재현 확인). 트리거 빈도는 낮지만 영향은
"리뷰 안 된 코드가 조용히 push 됨"이라는 이 훅의 존재 이유를 직접 무력화하는 수준이라 이 PR 의
목표(§J 완전 해소) 관점에서 그대로 두면 안 됩니다. 그 외 정규식은 ReDoS 관점에서 안전하고, 시크릿
노출·인젝션 등 다른 카테고리에서는 문제가 없습니다.

## 위험도

CRITICAL
