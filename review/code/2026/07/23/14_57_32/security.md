# 보안(Security) 리뷰 — push guard blind-scan + allowlist 재설계 (followup PR)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
`review/code/2026/07/23/14_23_23/*`(직전 라운드 리뷰 산출물 커밋)

## 맥락

이번 diff 는 `review/code/2026/07/23/14_23_23` 라운드에서 발견된 **CRITICAL 3건**
(C1 홑따옴표 이스케이프 오판정으로 gate 완전 우회, C2 `_MESSAGE_ARG` 파국적 백트래킹으로 훅
정지/fail-open, C3 메시지 blanking 이 살아있는 `$(git push …)` 를 드러냄)에 대한 **수정 + 회귀
테스트 + RESOLUTION 기록**이다. 보안 관점에서 이번 리뷰의 핵심 질문은 (a) 세 CRITICAL 이
실제로 고쳐졌는가, (b) 수정이 새 우회 표면을 열지 않았는가 이다.

## 발견사항

- **[INFO]** C1(홑따옴표 이스케이프 오판정 → gate 완전 우회) 수정 확인
  - 위치: `.claude/hooks/guard_review_before_push.py:124-129` (`_MESSAGE_ARG`)
  - 상세: 홑따옴표 본문이 `[^']*`(이스케이프 불인정)로, 겹따옴표 본문만 `(?:\\.|[^"\\])*`
    로 분리됐다. POSIX 셸이 `'…'` 내부에서 이스케이프를 처리하지 않는다는 사실과 정확히
    일치한다. PoC(`git commit -m 'a\' && git push -- 'end'`)를 직접 코드로 추적한 결과,
    홑따옴표 본문은 첫 `'` 에서 끊기므로 뒤따르는 `&& git push --` 는 redaction 대상에서
    제외되어 blind 1차 패턴에 그대로 걸린다 — 재현된 우회가 닫힌 것을 확인.
  - 제안: 없음 (수정 타당).

- **[INFO]** C2(ReDoS) 수정 확인 — 대안 서로소화로 겹치는 alternation 제거
  - 위치: `.claude/hooks/guard_review_before_push.py:126-127`
  - 상세: 겹따옴표 본문의 두 대안 `\\.`(백슬래시로 시작) 와 `[^"\\]`(백슬래시 배제)가
    첫 글자 기준으로 상호 배타적이다. 이전 결함(`\\.|(?!(?P=q)).`)의 겹침 지점(백슬래시)이
    제거되어, 닫는 따옴표가 없는 입력에서도 각 위치가 정확히 한 대안에만 매칭되므로 지수
    백트래킹 경로가 원천 차단된다. 새 `BacktrackingTest`(서브프로세스+하드 타임아웃, 60/200/800
    백슬래시)가 이 성질을 실측 검증한다 — 특히 "반환 후 시간 측정"이 아니라 서브프로세스+
    타임아웃으로 설계한 점이 옳다(C-레벨 `re` 의 파국적 백트래킹은 시그널을 받지 않으므로
    in-process 타이밍 단언은 hang 자체를 절대 실패시키지 못한다).
  - 제안: 없음. 다만 `_COMMIT_STDIN_CMD`(`.../guard_review_before_push.py:95-98`)에도 연속된
    `[^\n]*` 두 구간이 있어 이론상 다항(quadratic) 백트래킹 여지가 있다 — 다만 alternation
    겹침이 없어 지수적이지 않고, 입력이 한 Bash 커맨드 라인 길이로 사실상 유계이므로 실질
    위험은 낮다(INFO 수준, 조치 불필요).

- **[INFO]** C3(메시지 blanking 이 살아있는 확장 은닉) 수정 확인 — 전역 inert 게이트
  - 위치: `.claude/hooks/guard_review_before_push.py:215-237` (`_is_git_push`)
  - 상세: `_redact_inert_text()` 호출 자체가 **명령 전체**에 `$(`/backtick/`${` 중 무엇이라도
    있으면 실행되지 않도록 앞단에서 차단한다(`if not _is_inert(command): return True`). 국소
    범위(매칭된 body)만 보던 이전 결함과 달리, 이 게이트는 "해제 결정 이전에" 전역으로
    적용되므로 다른 어떤 해제 규칙이 추가되더라도 같은 클래스의 결함(로컬은 비활성인데
    전역에 살아있는 확장이 있는 경우)을 구조적으로 막는다 — 개별 규칙 패치가 아니라 설계
    차원의 봉쇄라는 점이 특히 견고하다.
  - 제안: 없음.

- **[INFO]** 독자적으로 검증한 잠재 우회 후보 — 프로세스 치환(`<(...)`/`>(...)`), 결론: 우회 아님
  - 위치: `.claude/hooks/guard_review_before_push.py:75` (`_LIVE_EXPANSION`)
  - 상세: `_LIVE_EXPANSION = ("$(", "`", "${")` 에 프로세스 치환 구문(`<(`, `>(`)이 빠져 있어,
    "`-m` 값이나 heredoc 본문에 `<(git push)` 를 심으면 텍스트는 inert 로 오판되지만 셸이
    실제로 서브셸을 fork 해 실행하는 것 아닌가"라는 가설을 실측으로 직접 검증했다. 결과:
    (1) 겹따옴표 문자열 내부의 `<(...)` 는 bash 가 프로세스 치환으로 인식하지 않고 리터럴
    문자열로 남는다(실측: `echo "before <(touch …) after"` → 파일 미생성), (2) 따옴표 있는/
    없는 heredoc 본문 모두에서도 동일하게 미실행(실측 확인). 즉 이 훅이 inert 판정을 적용하는
    두 컨텍스트(따옴표 값, heredoc 본문) 모두 애초에 프로세스 치환이 트리거되지 않는 위치라
    `_LIVE_EXPANSION` 누락이 실질적 우회로 이어지지 않는다.
  - 제안: 없음 — 다만 이 근거(따옴표/heredoc 본문 컨텍스트에서는 프로세스 치환이 트리거되지
    않는다는 셸 의미론)를 `_LIVE_EXPANSION` 주석에 한 줄 남겨두면, 다음에 같은 가설을 재검증
    하는 리뷰어의 시간을 아낄 수 있다(선택 사항, 저비용).

- **[INFO]** `main()` 3중 fail-open — 신규 아님, 추적 중, 범위 밖
  - 위치: `.claude/hooks/guard_review_before_push.py:39-48, 289-311`
  - 상세: `review_guard`/`plan_guard` import 실패, `evaluate_review()`/`evaluate_plan()` 예외,
    `_read_payload()` 의 JSON 파싱 실패(빈 dict 반환 → command="" → `_is_git_push` False) 등
    다중 지점에서 "게이트를 통과시킨다"(fail-open) 정책이다. 이는 이번 diff 가 도입한 게
    아니라 선재 정책이며, `plan/in-progress/harness-guard-followups.md` §E 로 이미 추적 중이고
    직전 리뷰(SUMMARY #10)에서도 동일하게 범위 밖으로 처리됐다. 재지적하지 않음 — 참고용 기록.
  - 제안: 없음(§E 트래킹 참고).

- **[INFO]** 하드코딩 시크릿 · 의존성 · 암호화 · 전형적 인젝션(SQL/XSS/커맨드) 해당 없음
  - 상세: 이번 diff 는 순수 텍스트/정규식 판정 로직과 그 테스트, 문서(plan/review 산출물)뿐이다.
    신규 외부 의존성 도입 없음, 자격증명/토큰/키 리터럴 없음(전수 grep 확인). 훅은 Bash 명령을
    "실행"하지 않고 실행 여부만 결정하므로 커맨드 인젝션 표면이 아니다(입력은 이미 호출측이
    실행하기로 결정한 문자열이며, 훅이 이를 재해석해 shell 로 넘기지 않음). 신규 테스트의
    서브프로세스 호출(`test_push_guard_allowlist.py::BacktrackingTest`)도 `shell=True` 를
    쓰지 않고 커맨드를 stdin 데이터로만 전달해 안전.

## 요약

이번 변경은 직전 라운드(14_23_23)에서 실측 재현된 CRITICAL 3건(gate 우회·ReDoS·라이브 확장
은닉)을 대상으로 한 수정이며, 코드를 직접 추적한 결과 세 건 모두 근본 원인(홑/겹따옴표 셸
의미론 혼동, alternation 겹침, 국소 검사의 범위 부족)에 대응하는 방식으로 타당하게 고쳐졌고
회귀 테스트(서브프로세스+하드 타임아웃 ReDoS 테스트 포함)로 고정되어 있다. 추가로 "프로세스
치환이 `_LIVE_EXPANSION` 목록에 없다"는 독자적 가설을 직접 셸에서 실측 검증했으나 실질
우회로 이어지지 않음을 확인했다. 신규 하드코딩 시크릿·인젝션·인증 우회·암호화 취약점은
없다. 남아있는 항목(fail-open 정책, `git log --grep=push` 오탐, `_COMMIT_STDIN_CMD` 의 이론적
다항 백트래킹)은 모두 이번 diff 이전부터 존재했거나 설계상 의도적으로 안전한 방향(과차단)의
트레이드오프이며 이미 문서·plan 으로 추적되고 있어 신규 조치가 필요하지 않다.

## 위험도
LOW
