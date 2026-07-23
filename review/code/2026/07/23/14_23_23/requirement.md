# 요구사항(Requirement) 코드 리뷰 — push guard allowlist redaction

## 리뷰 대상

- `.claude/hooks/guard_review_before_push.py` (`_redact_inert_text`/`_MESSAGE_ARG`/`_blank_commit_heredocs`/`_is_git_push` 신설)
- `.claude/tests/test_push_guard_allowlist.py` (신규, 17건)
- `plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md` (SoR 문서, 코드 주석이 명시적으로 참조)

**의도된 기능**: "리뷰 안 된 `codebase/**` 변경을 담은 브랜치의 `git push` 를 막는 hard gate"를,
1차 blind 정규식(거짓 음성 0 보장) + 그 위에 "증명 가능하게 비활성(inert)인 텍스트만" 지우는
좁은 allowlist(`_redact_inest_text`)로 재구성해 커밋 메시지 속 "push" 단어로 인한 거짓 양성을
없애면서 실제 실행되는 `git push` 는 여전히 차단한다.

`spec/` 에는 이 harness 컴포넌트를 다루는 문서가 없다(grep 확인 — `spec/4-nodes/3-ai/1-ai-agent.md`,
`spec/conventions/conversation-thread.md` 의 "push" 히트는 제품 도메인 개념이라 무관). 이 컴포넌트의
설계 권위(SoR)는 코드 주석이 직접 지목하는 `plan/in-progress/harness-push-guard-subcommand-detection.md`
이므로, 이하 spec-fidelity 점검은 이 plan 문서 본문 대비로 수행했다. **[INFO] spec 부재.**

## 검증 방법 (재현·실측)

- `.claude/tests/test_push_guard_allowlist.py` 를 실제 실행: **17/17 통과**, plan 이 주장한 수치와
  일치.
- `.claude/tests/` 전체 스위트 실행: **359/359 통과**, plan 체크리스트의 "전체 스위트 359건"과 일치.
- `_owns_heredoc_as_message` 를 `return True` 로 뮤테이션(임시, 이후 원복 확인함) → 재실행 시
  **정확히 4건 실패**, plan 이 기록한 "heredoc 소유검사 제거 4 실패"와 일치. mutation 주장이
  허구가 아님을 직접 확인.
- `_is_git_push` 를 직접 호출해 아래 두 결함을 실측 PoC 로 재현(코드 변경 없이 조사만, 이후 원복 불요).

## 발견사항

- **[CRITICAL]** `_MESSAGE_ARG` 의 인용값 파싱이 홑따옴표(`'…'`)에도 겹따옴표 이스케이프
  규칙(`\` + 다음 문자 = 이스케이프 쌍)을 그대로 적용해, **실제로 실행되는 `git push` 를
  "커밋 메시지"로 오분류·redact 하여 가드를 완전히 우회**시킨다. (security 리뷰가 동일 결함을
  이미 CRITICAL 로 제출했음 — 본 리뷰는 독립적으로 재현해 "의도한 기능(비활성 텍스트만 해제)을
  충족하는가" 관점에서 교차 확인한다.)
  - 위치: `.claude/hooks/guard_review_before_push.py` `_MESSAGE_ARG` 본문 서브패턴
    `(?:\\.|(?!(?P=q)).)*` (L100-104 부근). quote 종류(`'` vs `"`)를 구분하지 않는다.
  - 상세: POSIX/bash 상 홑따옴표 안에는 이스케이프 메커니즘이 전혀 없다 — 백슬래시는 항상
    리터럴이며 뒤따르는 `'` 를 결코 무효화하지 못한다. 현재 구현은 홑따옴표 값에도 "백슬래시+
    다음문자=이스케이프"를 적용해, `-m` 값이 홀수 개 백슬래시로 끝나며 홑따옴표로 닫히는 형태이면
    그 닫는 따옴표를 건너뛰어 명령 뒤쪽의 **다음** 홑따옴표까지를 "메시지 본문"으로 잘못 캡처한다.
    그 구간에 `$(`/백틱/`${` 가 없으면 `_is_inert` 가 통과시켜 **그 안에 있는 실제 `&& git push`
    까지 통째로 공백 치환**된다 — 1차 정규식 재실행 시점엔 "push" 글자 자체가 지워진 뒤라 탐지 실패.
  - 독립 재현 (본 세션에서 직접 실행, security.md 의 PoC 와 동일 결과):
    ```
    >>> guard._is_git_push(r"""git commit -m 'a\' && git push -- 'end'""")
    False   # 실제로는 push 를 실행하는데 미탐지
    >>> guard._redact_inert_text(r"""git commit -m 'a\' && git push -- 'end'""")
    "git commit -m '                   'end'"   # "&& git push --" 가 통째로 지워짐
    >>> guard._is_git_push(r"""git commit -m 'release notes\' && git push origin 'main'""")
    False   # 흔한 "commit 후 이어서 push" 한 줄 형태에서도 재현
    >>> guard._is_git_push("git commit -m 'fix bug' && git push origin 'refs/heads/main'")
    True    # 대조군(트레일링 백슬래시 없음) — 정상 차단, 회귀 아님을 확인
    ```
  - 의도-구현 괴리: 이 diff 전체(및 동봉 279줄 테스트)의 존재 이유가 되는 명시적 불변식 —
    "해제는 오직 **증명 가능하게 비활성인 텍스트**만"(plan 문서, 파일 주석 양쪽 명시) — 이
    바로 이 케이스에서 깨진다. `CORPUS`/`RELEASED`/`ReleaseRefusedTest` 어디에도 **홑따옴표
    `-m` 값** 테스트가 하나도 없다(전부 겹따옴표) — "전체 스위트 359건 통과"라는 안전 주장이
    이 클래스에 대해서는 거짓 확신이다.
  - 제안: `_MESSAGE_ARG` 본문을 quote 종류로 분기 — `'` 일 때는 이스케이프 인식 없는 `[^']*`
    (홑따옴표 안에 `'` 리터럴을 넣을 방법 자체가 없으므로 첫 `'` 가 항상 진짜 종료), `"` 일 때만
    현재 로직 유지. 위 PoC 두 케이스를 `ReleaseRefusedTest` 에 회귀 고정.

- **[CRITICAL]** `_MESSAGE_ARG` 본문 서브패턴 `(?:\\.|(?!(?P=q)).)*` 자체가 **파국적
  backtracking(ReDoS)** 을 일으킨다 — security 리뷰(`security.md` L77-78)는 "단일 레벨 교대,
  중첩 수량자 없음이라 소지가 낮다"고 **실측 없이** 판단했는데, 실제로 벤치마크하면 지수적으로
  느려진다. 이 hook 은 PreToolUse 로 **모든 Bash 호출** 앞에서 동기 실행되는 hard gate이므로,
  hang 은 곧 해당 세션의 정지 또는(파일 상단 docstring 이 명시한 "그 외 → 런타임 오류로 처리,
  툴 호출 진행(fail-open)" 계약에 따라 하네스의 hook 타임아웃이 이를 킬 → 런타임 오류 분류로
  이어질 경우) **gate 자체의 우회**로 귀결될 수 있다.
  - 위치: 동일 — `_MESSAGE_ARG` (L100-104).
  - 원인: `\\.` 와 `(?!(?P=q)).` 두 대안이 백슬래시 문자에 대해 **겹친다**(둘 다 백슬래시를
    소비할 수 있음) — 닫는 따옴표를 못 찾아 전체 매치가 실패해야 하는 입력에서 정규식 엔진이
    모든 분할 조합을 역추적하게 만드는 전형적 패턴.
  - 실측 (본 세션에서 직접 벤치마크, `-m "` + `\x` × n + ` git push`, 닫는 따옴표 없음):

    | n (`\x` 반복) | 소요 시간 |
    | --- | --- |
    | 10 | 0.0005s |
    | 15 | 0.0156s |
    | 20 | 0.5048s |
    | 25 | **>3s (timeout)** |

    (별도로 20000 반복으로 실행한 최초 프로브는 120초 하네스 타임아웃에 걸려 백그라운드로
    밀려났다 — 실사용 환경에서 그대로 hang.) 대조로, 같은 백슬래시 시퀀스라도 **닫는 따옴표가
    실제로 존재**하면(예: `-m "` + `\x`×1000 + `"`) 즉시(< 0.001s) 매치된다 — 문제는 정상
    닫힘이 아니라 "닫히지 않는" 입력에서만 발현되는 역추적 폭발이다.
  - 트리거 조건: (a) 명령 텍스트에 "push" 부분문자열이 있고 (b) 1차 blind 정규식이 매치하고
    (c) `-m`/`-F`/`--message=` 값이 백슬래시-문자 쌍을 다수 포함한 채 **닫는 따옴표를 못 찾는**
    형태(따옴표 오타, 혹은 프롬프트 인젝션으로 조작된 파일 내용이 커밋 메시지에 삽입되는 경로
    등)여야 한다 — "push" 를 언급하는 평범한 커밋 메시지 자체로는 발현되지 않지만, 이
    hook 이 정확히 목표로 삼는 입력 형태(길고 이스케이프가 섞인 `-m`/`-F` 값)와 겹치는 표면이라
    우연 발생 가능성이 이론적 수준을 넘는다.
  - 제안: 위 CRITICAL 항목과 같은 자리이므로 함께 고친다 — 겹따옴표 분기의 본문을
    `(?:\\.|(?!")[^\\])*` 처럼 폴백 대안에서 백슬래시를 명시적으로 배제해 두 대안이 겹치지
    않게 한다(이러면 quote-종류 분기와 별개로 선형 시간이 복원된다). 수정 후 "닫는 따옴표 없는
    긴 백슬래시 시퀀스"에 대한 시간 상한 회귀 테스트(예: 1초 이내) 를 추가할 것 — 현재
    `test_push_guard_allowlist.py` 는 정확성만 검증하고 성능 상한을 전혀 검증하지 않는다.

- **[INFO]** 위 두 CRITICAL 을 제외한 나머지 설계 요소는 plan 본문과 line-level 로 일치하고
  실측으로 뒷받침된다: escaped-pipe 해제(홀수 백슬래시 룩비하인드), heredoc 소유권 판정("마지막
  세그먼트가 명령 자체인가" — 초안의 "여는 줄이 언급하는가" 결함을 실제로 교정, spoof 테스트
  통과 확인), `KnownRemainingFalsePositiveTest`(`git log --grep=push`)로 알려진 잔여 갭을
  의도적으로 고정한 것 모두 plan 서술과 부합. `_is_git_push = legacy_hit and hit_after_redaction`
  공식도 코드·plan 서술이 문자 그대로 일치.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` §C 갱신("재설계 확정, 착수 가능하나
  1차 패턴은 각자, redaction 만 공유")은 이번 diff 의 실제 구현 형태(1차 정규식 유지 + 별도
  `_redact_inert_text`)와 모순 없이 정확히 반영됐다. 체크박스 `- [ ] /ai-review → RESOLUTION → PR`
  가 아직 미체크인 것은 본 리뷰가 그 단계이므로 현재 시점 기준 정합(수행 후 갱신 대상).

## 요약

설계 방향(blind 1차 + 좁은 allowlist)과 그 방향을 뒷받침하는 차등/뮤테이션 테스트 방법론은
견고하며, 문서화된 claim(17/359 테스트 통과, mutation 4건 실패 등)은 전부 독립 재실행으로
사실로 확인됐다. 그러나 구현의 핵심 축인 `_MESSAGE_ARG` 인용값 파서 하나에 **서로 다른 두 개의
CRITICAL 결함**이 겹쳐 있다 — (1) 홑따옴표 이스케이프 오인으로 인한 **결정론적 gate 우회**(이미
security 리뷰가 PoC 로 제출, 본 리뷰가 독립 재현으로 교차 확인), (2) 동일 정규식의 겹치는 대안
구조로 인한 **파국적 backtracking(ReDoS)**(본 리뷰가 실측 벤치마크로 새로 확인 — 다른 리뷰가
"소지 낮음"으로 벤치마크 없이 넘긴 항목의 반증). 두 결함 모두 "1차 정규식은 무지해서 안전,
해제 규칙은 좁아서 안전"이라는 이 설계의 핵심 안전 논증이 실제로는 **구현 세부(quote-종류
무분별, 겹치는 정규식 대안)에서 깨진다**는 같은 근본 원인을 공유하며, 이 저장소가 반복적으로
겪어온 "손으로 짠 정밀 primitive가 리뷰마다 반증된다"는 패턴과 정확히 같은 계열이다. `/ai-review
→ RESOLUTION → PR` 단계로 넘어가기 전에 두 결함을 함께 고치고(같은 서브패턴 재작성으로 해결
가능), 홑따옴표 `-m` 코퍼스 항목과 성능 상한 회귀 테스트를 추가해야 한다.

## 위험도

CRITICAL
