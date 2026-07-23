# 보안(Security) 코드 리뷰 — push guard allowlist redaction

## 리뷰 대상

- `.claude/hooks/guard_review_before_push.py` (`_redact_inert_text` / `_MESSAGE_ARG` / `_is_git_push` 신설)
- `.claude/tests/test_push_guard_allowlist.py` (신규)
- `plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md` (문서만)

이 훅은 "리뷰되지 않은 `codebase/**` 변경을 담은 브랜치의 `git push` 를 차단"하는 **보안 통제
(access-control gate)** 그 자체다. 따라서 이 diff 의 핵심 보안 질문은 "이 gate 를 우회해 미검토
코드를 push 할 수 있는 입력이 있는가"이다.

## 발견사항

- **[CRITICAL]** `_MESSAGE_ARG` 의 인용값 파싱이 홑따옴표(`'…'`)에 겹따옴표 이스케이프 규칙을
  잘못 적용해, 실제로 실행되는 `git push` 를 "커밋 메시지 텍스트"로 오분류·삭제(redact)하여
  가드를 완전히 우회시킬 수 있음 (핵심 보안 통제 우회, OWASP A01 Broken Access Control 상당)
  - 위치: `.claude/hooks/guard_review_before_push.py` — `_MESSAGE_ARG` 정규식(약 L99-103)과
    그 본문 서브패턴 `(?:\\.|(?!(?P=q)).)*` 가 quote 문자(`'` 또는 `"`)와 무관하게 동일하게
    "백슬래시+다음문자 = 이스케이프 쌍"으로 취급한다.
  - 상세: POSIX/bash 규약상 **홑따옴표 안에는 이스케이프 메커니즘이 전혀 없다** — 백슬래시는
    항상 리터럴 문자이며 결코 뒤따르는 홑따옴표를 "이스케이프"하지 못한다(겹따옴표에서는
    `\"` 가 실제로 유효한 이스케이프이므로 그 경우엔 이 로직이 우연히 맞다). 그런데
    `_MESSAGE_ARG` 의 본문 패턴은 quote 종류를 구분하지 않고 항상 `\\.` 를 이스케이프 쌍으로
    소비한다. 그 결과, `-m` 값이 **홀수 개의 백슬래시로 끝난 채 홑따옴표로 닫히는 형태**이면
    정규식은 그 닫는 따옴표를 "이스케이프된 문자"로 오인해 진짜 문자열 종료를 지나쳐 버리고,
    명령 뒤쪽 어딘가에 있는 **다음 홑따옴표**(예: push 대상 ref/remote 를 홑따옴표로 감싼 것,
    혹은 임의의 다른 홑따옴표 토큰)까지를 "메시지 본문"으로 잘못 캡처한다. 그 확장된 구간
    안에 `$(` · 백틱 · `${` 가 없으면 `_is_inert` 가 "비활성 텍스트"로 판정해 통째로
    공백 치환(redact)하는데, 이 구간 안에 **실제로 실행되는 `&& git push …`** 가 그대로
    포함되어 함께 지워진다 — 1차 blind 정규식이 재실행될 시점엔 이미 `push` 라는 글자 자체가
    사라진 뒤라 탐지에 실패한다.
  - 실측 PoC (해당 워크트리에서 직접 `_is_git_push` 호출로 재현):
    ```
    >>> guard._is_git_push(r"""git commit -m 'a\' && git push -- 'end'""")
    False   # 실제로는 git push 를 실행하는 명령인데 탐지 실패
    >>> guard._redact_inert_text(r"""git commit -m 'a\' && git push -- 'end'""")
    "git commit -m '                   'end'"   # "&& git push --" 가 통째로 지워짐

    >>> guard._is_git_push(r"""git commit -m 'release notes\' && git push origin 'main'""")
    False   # 흔한 "commit and push" 한 줄 명령 형태에서도 재현
    ```
    대조군(같은 구조지만 `-m` 값이 백슬래시로 끝나지 않음)은 정상적으로 계속 차단됨을 함께 확인함:
    ```
    >>> guard._is_git_push("git commit -m 'fix bug' && git push origin 'refs/heads/main'")
    True   # 정상 — 참고용 대조군
    ```
  - 영향: 이 훅은 "미검토 `codebase/**` 변경을 push 하지 못하게 막는 유일한 hard gate"라고
    스스로 문서화하고 있다(파일 상단 docstring). 이 결함은 그 gate 를 결정론적으로,
    권한 상승 없이 우회한다 — 공격자(또는 프롬프트 인젝션으로 조작된 에이전트)가
    `-m`/`-F`/`--message=` 값을 백슬래시로 끝나는 홑따옴표 문자열로 만들고, 같은 명령 어딘가에
    (자연스럽게, 예를 들어 push 대상 ref 를 홑따옴표로 인용하는 형태로) 홑따옴표를 하나 더
    두기만 하면 재현된다. "commit 하고 이어서 push" 한 줄 명령은 매우 흔한 패턴이라 실수로도
    우연히 발생할 수 있고, 의도적 우회 목적으로는 사소하게 구성 가능하다.
  - 설계 의도와의 정면 충돌: 이 코드 전체(및 동봉된 279줄 차등 테스트 스위트)의 존재 이유가
    "1차 blind 정규식은 거짓 음성 0 을 유지하고, `_redact_inert_text` 는 **오직 증명 가능하게
    비활성인 텍스트만** 지운다"는 불변식이다(파일 주석, plan 문서 모두 명시). 이 결함은 바로 그
    불변식이 깨지는 사례이며, `test_push_guard_allowlist.py` 의 `CORPUS`/`RELEASED`/
    `ReleaseRefusedTest` 어디에도 홑따옴표+trailing-backslash 조합이 없어 "전체 스위트 359건
    통과"라는 현재 안전 주장이 이 케이스에 대해 거짓 확신을 준다.
  - 제안: `_MESSAGE_ARG` 의 본문 서브패턴을 quote 종류에 따라 분기한다 — 홑따옴표(`'`)일 때는
    이스케이프를 전혀 인정하지 않는 `[^']*` (홑따옴표 안에는 애초에 `'` 리터럴을 넣을 방법이
    없으므로 첫 `'` 가 항상 진짜 종료), 겹따옴표(`"`)일 때만 현재의 `(?:\\.|(?!").)*` 이스케이프
    인지 로직을 유지한다. 수정 후 위 PoC 두 케이스를 회귀 테스트(`ReleaseRefusedTest` 류)로
    반드시 고정할 것 — 이 클래스는 "release 규칙이 실행 가능한 텍스트를 삼키면 안 된다"는
    기존 테스트 카테고리(`ReleaseRefusedTest`)의 명시적 스코프 안에 있다.

- **[INFO]** `main()` 의 3중 fail-open(하위 모듈 import 실패 / `evaluate_*()` 예외 / 미처리 예외)은
  이 diff 가 도입한 것이 아니라 선재하는 정책 결정 사항이며, 이미 `plan/in-progress/
  harness-guard-followups.md` §E 에 "사용자/팀 판단 필요" 항목으로 별도 추적 중이다. 이번 diff 는
  `_is_git_push`/`_redact_inert_text` 만 건드렸으므로 범위 밖으로 판단해 등급을 올리지 않음
  (단, 위 CRITICAL 우회가 있으면 fail-open 정책과 무관하게 gate 자체가 무력화되므로 우선순위는
  CRITICAL 쪽이 훨씬 높음).

- **[INFO]** 그 외 인젝션(SQL/XSS/커맨드/LDAP/경로탐색)·하드코딩 시크릿·암호화·의존성 관련 항목은
  해당 없음 — 이 훅은 셸 명령 문자열을 정규식으로 "분석"만 할 뿐 실행하지 않으며, 새 의존성 도입도
  없다. `_MESSAGE_ARG`/`_ESCAPED_PIPE` 등 정규식은 구조상(단일 레벨 교대, 중첩 수량자 없음) 파국적
  backtracking(ReDoS) 소지가 낮다고 판단(별도 실측 벤치마크는 수행하지 않음).

## 요약

이번 diff 의 핵심 설계(blind 1차 정규식 유지 + 좁게 열거된 allowlist)는 방향 자체는 건전하고,
동봉된 차등 테스트 스위트도 이전 3라운드 회귀를 충실히 코퍼스로 고정하는 등 방법론적으로
훌륭하다. 그러나 실제 구현에서 `-m`/`-F`/`--message=` 인용값의 "비활성 텍스트" 판정이 홑따옴표와
겹따옴표의 셸 이스케이프 규칙 차이를 구분하지 못해, 실제로 실행되는 `git push` 를 통째로 지워
가드를 완전히 우회시키는 결정론적 false-negative 를 실측(PoC)으로 확인했다. 이 파일이 "미검토
코드 push 를 막는 유일한 hard gate"라고 스스로 규정하는 보안 통제이므로, 이 결함은 그 통제의
근본 목적을 무력화하는 CRITICAL 등급 취약점이다. 나머지 항목(하드코딩 시크릿, 인젝션, 암호화,
의존성 등)에서는 새로운 문제를 발견하지 못했다.

## 위험도

CRITICAL
