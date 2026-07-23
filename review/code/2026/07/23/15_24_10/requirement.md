# Requirement Review — push 가드 blind + allowlist (② 최종 라운드)

## 검토 범위·방법

- 대상: `.claude/hooks/guard_review_before_push.py`(신규 `_redact_inert_text`/`_is_git_push` 2단계 판정),
  `.claude/tests/test_push_guard_allowlist.py`(신규 491줄, differential + release + backtracking 스위트),
  `.claude/tests/test_guard_review_before_push_main.py`(docstring 정정), plan 문서 2건, 그리고
  선행 리뷰 산출물(`review/code/2026/07/23/14_23_23/*`, `14_57_32/*`, 이번 세션은 `git diff origin/main`
  전체 — 즉 6eec7cb80(초안) + 837ebba33(1라운드 CRITICAL 3건 수정) + cef183faf(2라운드 O(n²) 수정)
  3개 커밋 누적분을 리뷰).
- prompt 의 diff 가 크기 제한으로 생략돼 있어, 워크트리에서 `git diff origin/main -- <path>` 로
  실제 diff 를 직접 확보해 라인 단위로 읽음. `.claude/tests/test_push_guard_allowlist.py` 전문 정독.
- `python3 -m pytest .claude/tests/test_push_guard_allowlist.py .claude/tests/test_guard_review_before_push_main.py`
  실행 — 32 passed / 135 subtests (allowlist) + 20 passed(main e2e), 전부 그린.
- 독립 PoC 4건을 직접 실행해 회귀 여부 재확인(아래 "직접 검증" 참고).
- `spec/` 전체에서 이 훅과 관련된 문서를 grep 했으나(관련 없는 "push 알림" 문맥의 오탐 히트만 존재)
  대상 문서를 찾지 못함 — harness 내부 개발 도구이며 CLAUDE.md 규약상 `spec/` 는 제품 정의/기술
  명세 영역이라 이 컴포넌트는 애초에 spec 대상이 아님. SoR 은 명시적으로
  `plan/in-progress/harness-push-guard-subcommand-detection.md` 이고, 코드 주석(`# SoR: plan/...`)
  이 정확히 이를 가리킴 — 규약 위반 아님, INFO.

## 발견사항

- **[INFO]** 관련 `spec/` 문서 없음 (spec fidelity 점검 대상 자체가 없음)
  - 위치: 전역
  - 상세: `.claude/hooks/`, `.claude/tests/` 는 하네스 내부 개발 도구이며 CLAUDE.md 의 정보 저장
    표에 따르면 `spec/` 는 제품 정의·기술 명세 전용이다. 이 변경의 단일 진실(SoR)은
    `plan/in-progress/harness-push-guard-subcommand-detection.md` 이며, 코드 상단 주석이
    `# SoR: plan/in-progress/harness-push-guard-subcommand-detection.md` 로 정확히 이를 명시한다.
    plan 본문(설계 반전 근거·해제 규칙 3종·1/2라운드 CRITICAL 표·검증 체크리스트)과 실제 구현을
    라인 단위로 대조한 결과 괴리 없음 — `_redact_inert_text` 의 규칙 순서(escaped-pipe → heredoc →
    message)·해제 3종(escaped pipe, `-m`/`--message=`/`-F` 인용값, commit/tag heredoc 본문)·
    "명령 전체에 확장 토큰이 있으면 해제 보류" 정책이 모두 plan 서술과 코드가 정확히 일치.
  - 제안: 조치 불요 (규약상 정상 상태). 참고로만 기록.

- **[INFO]** 알려진 보수적(안전 방향) 미해제 케이스가 테스트 코퍼스 밖에 추가로 존재
  - 위치: `.claude/hooks/guard_review_before_push.py::_MESSAGE_ARG`, `_redact_inert_text`
  - 상세: 직접 검증(아래)에서 다음 두 가지를 확인함 — (1) `-m`/`-F` 가 아닌 위치에서 **이스케이프
    없이 등장하는 순수 리터럴 파이프**가 큰따옴표 안에 있는 경우(예:
    `grep -E "add|git push|delete" f`) 는 `_ESCAPED_PIPE` 규칙(홀수 백슬래시 선행만 매칭)의 대상이
    아니므로 해제되지 않고 계속 차단됨. (2) `git commit -m $'push text'` 처럼 ANSI-C 인용(`$'...'`)
    으로 감싼 `-m` 값은 `_MESSAGE_ARG` 가 인식하는 두 quote 스타일(`'…'`/`"…"`) 밖이라 매칭되지 않아
    역시 계속 차단됨. 두 경우 모두 **차단(과오탐) 방향**이라 안전하며 게이트 우회로 이어지지 않음 —
    설계 철학("좁게 빗나가면 차단 유지 = 안전")과 정확히 일치. `test_unrecognised_message_flag_spellings_stay_blocked`
    가 이미 같은 부류(`-am`, `--message ` 공백형)를 하나 pin 하고 있어 패턴 자체는 알려진 것.
  - 제안: 기능 결함 아님. 원한다면 `KnownRemainingFalsePositiveTest` 에 두 케이스를 추가로 pin 해
    "발견 가능한 갭"으로 남기는 정도(선택, 이번 PR 필수 아님).

- **[INFO]** heredoc 종료 구분자 매칭이 POSIX 보다 관대함 — 이미 2라운드 리뷰가 발견·수용
  - 위치: `.claude/hooks/guard_review_before_push.py::_commit_heredoc_spans` (`end_re`)
  - 상세: `end_re = re.compile(rf"^[ \t]*{delim}[ \t]*$", re.M)` 는 `<<-`(탭 스트립 허용) 여부와
    무관하게 항상 선행/후행 공백을 허용한다. 독립적으로 이 지점을 파고들어 "실제 종료 구분자보다
    먼저/늦게 일치할 수 있는가"를 분석했으나, 정규식이 항상 POSIX 규칙의 **superset**(더 관대)이라
    실제 종료 지점보다 **먼저 또는 같은 위치**에서만 일치할 수 있고 늦게 일치하는 경우는 없음 —
    즉 본문을 실제보다 **과소 추정**할 수는 있어도 **과대 추정**(진짜 명령을 message 로 오인해
    redact)할 수는 없는 구조. 이는 `review/code/2026/07/23/14_57_32/RESOLUTION.md` INFO#7 이 이미
    "항상 과소-해제(차단 유지) 방향" 이라 명시한 것과 일치하는 결론 — 독립 재확인만 됐을 뿐 새로운
    발견 아님.
  - 제안: 조치 불요.

## 직접 검증 (PoC)

```
git commit -m "a" -m "$(git push)"                        -> _is_git_push=True (정상 차단, 다중 -m 중 하나에 확장 존재)
grep -E "add|git push|delete" f                            -> _is_git_push=True (미해제, 안전 방향 과오탐)
git commit -m $'push text'                                 -> _is_git_push=True (미해제, 안전 방향 과오탐)
git commit -m "a" && git push                              -> _is_git_push=True (실제 push 여전히 차단)
```
전부 안전 방향(차단 유지)으로 귀결 — 신규 CRITICAL/WARNING 없음.

## 요구사항 충족 평가 (항목별)

1. **기능 완전성**: `_is_git_push` = blind 1차 + 3종 해제 규칙(escaped pipe / message quote / commit·tag
   heredoc)이 plan 이 요구한 "설계 반전"을 완전히 구현. `_GIT_PUSH` 원본 패턴은 바이트 단위로 동결되고
   테스트(`BlindPassFrozenTest`)가 이를 강제.
2. **엣지 케이스**: 빈 heredoc 본문(`test_empty_heredoc_body_terminates_and_keeps_the_real_push`), 다중
   `-m`, 미정렬/중첩 span(`BlankSpansTest`), env 접두사(`GIT_EDITOR=vim git commit -F -`) 등 광범위하게
   커버. 위에서 검증한 잔여 갭은 전부 안전 방향.
3. **TODO/FIXME/HACK/XXX**: 변경 3개 코드 파일 전체 grep 결과 0건.
4. **의도 vs 구현 괴리**: `_is_git_push` 독스트링("Blind first pass, then an enumerated allowlist that
   can only SUBTRACT")이 실제 로직과 정확히 일치. `test_guard_review_before_push_main.py` 의 갱신된
   주석("`_is_git_push`'s own detection logic... lives in `test_push_guard_allowlist.py`")도 실제
   테스트 구성과 일치(허구 아님, 직접 실행해 32건/135 subtests 확인).
5. **에러 시나리오**: `_owns_heredoc_as_message`/`_commit_heredoc_spans` 는 매치 실패·구분자 미발견
   등 모든 분기에서 결정적 값을 반환(무한루프 없음, `pos` 가 매 반복 strictly 증가함을 코드 추적으로
   확인). `_redact_inert_text` 는 빈 `spans` 도 안전하게 처리(`_blank_spans` 의 `if not spans: return text`).
6. **데이터 유효성**: 이 계층은 셸 명령 문자열을 신뢰 불가 입력으로 간주하고 철저히 "증명 가능하게
   비활성"인 경우만 해제 — 그 외 전부 차단이 기본값이라 유효성 검증 철학이 코드 전체에 일관.
7. **비즈니스 로직**: "1차 정규식은 절대 편집 금지, 해제는 오직 빼기만" 이라는 plan 의 핵심 규칙이
   `_MESSAGE_ARG`/`_redact_inert_text`/`_is_git_push` 어디에도 위반 없이 반영. C1~C3(1라운드) +
   W1~W2(2라운드) 전 항목이 재현 → 수정 → 회귀 테스트로 닫힘(로컬 재실행으로 재확인 완료).
8. **반환값**: 모든 함수가 모든 경로에서 타입에 맞는 값을 반환(bool/str/list). 예외를 조용히 삼키는
   경로 없음.
9. **spec 본문 일치**: 위 INFO 참고 — 대상 spec 문서 없음(정상), SoR 인 plan 문서와는 라인 단위로 일치.

## 요약

`.claude/hooks/guard_review_before_push.py` 의 push 감지 로직을 "1차 blind 정규식(불변) + 좁게
enumerated 된 allowlist" 로 재설계한 최종본이다. 1라운드 리뷰가 찾은 CRITICAL 3건(홑따옴표 이스케이프
오판정에 의한 게이트 우회, `_MESSAGE_ARG` 의 파국적 백트래킹, 메시지 blanking 이 살아있는 `$(git push)`
를 드러내는 결함)과 2라운드 리뷰가 찾은 신규 O(n²) 백트래킹(heredoc 소유 판정 정규식)이 모두 실측
재현 → 수정 → 회귀 테스트(뮤테이션 검증 포함)로 닫혀 있으며, 이번 세션에서 로컬 재실행(32건/135
subtests, main e2e 20건)과 4건의 독립 PoC 로 재확인한 결과 새로운 CRITICAL/WARNING 은 발견하지
못했다. `_owns_heredoc_as_message`/`_commit_heredoc_spans` 의 반환 경로·루프 종료 조건, `_is_git_push`
의 모든 분기를 직접 추적해 무한루프·미반환 경로가 없음을 확인했고, heredoc 종료 구분자 관대함·
비인식 `-m` 철자(`$'...'`, 무-이스케이프 파이프)는 모두 "과오탐(차단 유지)" 방향으로 수렴해 안전
방향임을 별도로 검증했다(2라운드 RESOLUTION 의 기존 INFO 결론과 일치). spec fidelity 측면에서는
이 컴포넌트가 `spec/` 대상이 아니라 plan 문서가 SoR 이며, 코드·주석·plan 서술이 라인 단위로 정합함을
확인했다. 결론적으로 이 변경은 의도한 기능(오탐 감소 + 거짓음성 0 유지)을 완전히 구현했다고 판단한다.

## 위험도
NONE
