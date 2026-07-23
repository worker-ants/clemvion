# 보안(Security) 코드 리뷰 — push guard allowlist (누적 3라운드 확인)

## 리뷰 대상 및 방법

- `.claude/hooks/guard_review_before_push.py` (blind 1차 정규식 + `_redact_inert_text` 열거형 allowlist)
- `.claude/tests/test_push_guard_allowlist.py` (신규 차등/거부/ReDoS/재조립 테스트, 32건)
- `.claude/tests/test_guard_review_before_push_main.py` (docstring 갱신만)
- `plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md` (SoR 문서 갱신)
- `review/code/2026/07/23/14_23_23/*`, `review/code/2026/07/23/14_57_32/*` (직전 2라운드 리뷰·RESOLUTION 산출물)

이 훅은 "리뷰되지 않은 `codebase/**` 변경을 담은 브랜치의 `git push` 를 차단"하는 **보안 통제
(access-control gate) 그 자체**다. 1라운드(14_23_23)에서 CRITICAL 3건(C1 홑따옴표 이스케이프
오판정에 의한 게이트 완전 우회, C2 `_MESSAGE_ARG` 파국적 백트래킹/ReDoS, C3 메시지 blanking 이
살아있는 `$(git push …)` 노출)이 발견됐고, 2라운드(14_57_32)에서 그 수정 자체가 새로 연 O(n²)
백트래킹(`_COMMIT_STDIN_CMD`)이 WARNING 으로 지적돼 수정됐다. 이번 리뷰는 최종 상태(HEAD)를
대상으로 **주장을 그대로 믿지 않고 코드를 직접 읽고, 테스트를 직접 실행하고, 별도의 적대적
PoC 를 스스로 구성해 재현을 시도**하는 방식으로 독립 검증했다.

## 검증 결과 (실측)

- `.claude/hooks/guard_review_before_push.py` 현재 소스를 직접 읽고 세 CRITICAL 각각의 수정
  코드를 라인 단위로 확인:
  - C1: `_MESSAGE_ARG` 본문이 quote 종류별로 분리됨 — `'…'` 는 `[^']*`(이스케이프 불인정,
    POSIX 셸 의미론과 일치), `"…"` 만 `(?:\\.|[^"\\])*`(이스케이프 인정). 홑따옴표 안엔 `'`
    리터럴을 넣을 방법 자체가 없어 첫 `'` 가 항상 진짜 종료라는 전제가 정확함.
  - C2: 겹따옴표 본문의 두 대안(`\\.` vs `[^"\\]`)이 첫 글자 기준 **서로소**로 재작성돼
    겹치는 alternation 이 제거됨 — 백트래킹 폭발 경로가 구조적으로 차단됨.
  - C3: `_is_git_push()` 가 `_redact_inert_text()` 호출 **이전에** 명령 전체에 대해
    `_is_inert()` 를 먼저 검사(`if not _is_inert(command): return True`)해, 지역(local) 검사만
    하던 결함을 설계 차원에서 봉쇄. 새 해제 규칙이 추가돼도 같은 클래스의 결함을 구조적으로 막는
    형태라 개별 패치보다 견고함.
  - 2라운드 W1: `_COMMIT_STDIN_CMD` 의 겹치는 그리디 `[^\n]*` 두 구간이 `_SEGMENT_IS_GIT` →
    `_COMMIT_OR_TAG` → `_STDIN_FILE_FLAG` 세 개의 독립 단일-패스 probe 로 교체됨 — 겹치는
    수량자가 사라져 다항 백트래킹 경로도 닫힘.
- `test_push_guard_allowlist.py` 를 독립 실행(`python3 -m unittest test_push_guard_allowlist`):
  **32/32 통과**. `.claude/tests/` 전체 discover 실행도 재확인 시 **374/374 통과**(최초 1회
  discover 러닝에서 `BacktrackingTest.test_repeated_subcommand_word_without_stdin_flag_is_fast`
  가 유일하게 실패했으나, 동일 테스트를 단독/재실행 시 3회 연속 0.05s 내 통과 — 374건을 순차
  실행하며 다수 서브프로세스+하드타임아웃 테스트가 몰릴 때의 **시스템 부하발 flake** 로 판단.
  실제 훅은 in-process 로 동작해 서브프로세스 스폰 경합과 무관하므로 프로덕션 보안 결함은
  아니나, CI 안정성 관점에서 테스트 리뷰어에게 참고용으로 남긴다).
- 세 CRITICAL 의 PoC 를 직접 재실행해 전부 수정 확인:
  - `guard._is_git_push(r"""git commit -m 'a\' && git push -- 'end'""")` → `True`(정상 차단,
    이전엔 `False` 로 우회).
  - `guard._is_git_push('git commit -m "fix: retry push notification bug" && echo "log: $(git push origin main)"')`
    → `True`(정상 차단, 이전엔 `False`).
  - `_MESSAGE_ARG` 에 닫는 따옴표 없는 긴 백슬래시 시퀀스(60/200/800개)를 서브프로세스+하드
    타임아웃으로 재확인 — 전부 즉시 반환(선형).
- 독자적으로 추가 적대적 케이스를 구성해 프로빙:
  - 이스케이프된 따옴표가 정상적으로 닫히는 균형잡힌(valid) 명령들(`-m "a\\" b"`, `-m 'a\' &&
    git push`, `-c core.hooksPath=… -m "push"`, `-F "notes-push.txt"` 등)은 전부 기대대로
    동작(해제되거나, 해제돼도 뒤따르는 실제 push 는 살아남아 차단 유지).
  - 홑/겹 이스케이프 배타 조합(`\\|`, `\|`)도 문서화된 홀/짝 규칙대로 정확히 동작.
  - **[INFO 로만 기록]** 인위적으로 불균형(따옴표 짝이 맞지 않는) 문자열
    `git commit -m "a\" && git push -- "end"` 를 넣으면 `_is_git_push` 가 `False` 를 반환한다.
    그러나 이 문자열은 `bash -n`으로 직접 검증한 결과 **`unexpected EOF while looking for
    matching` 구문 오류**로, 실제 셸에서는 애초에 실행되지 않는(따라서 push 도 일어나지 않는)
    무효 입력이다. 즉 새로운 우회가 아니라 "구문적으로 실행 불가능한 입력에 대한 판정은 정의역
    밖" 이라는, 이 정적 텍스트 가드 설계가 처음부터 감수한 한계(파서가 아니므로 셸 문법 유효성
    자체는 검증하지 않음)의 연장선이다. 조치 불요 — 기록만.

## 발견사항

- **[INFO]** 위 "불균형 따옴표 입력에서의 오탐지"는 실행 불가능한 셸 구문에 대한 것으로
  실질적 우회가 아님을 확인함(재현·`bash -n` 대조 완료). 별도 조치 불요.
  - 위치: `.claude/hooks/guard_review_before_push.py::_MESSAGE_ARG`
  - 제안: 없음(참고 기록 목적). 원한다면 `KnownRemainingFalsePositiveTest` 류에 "구문
    오류(unbalanced quote) 입력은 정의역 밖" 이라는 주석과 함께 pin 해 향후 리뷰가 같은 가설을
    재검증하는 시간을 아낄 수 있음(선택).

- **[INFO]** `BacktrackingTest` 의 하드 타임아웃(10s)이 CI 시스템 부하가 높을 때 다른(관련
  없는) 서브프로세스 테스트와의 경합으로 드물게 flake 할 수 있음을 실측으로 관찰(단독 실행 시
  0.05s, discover 로 374건을 순차 실행할 때 1회 관찰). 훅 자체는 서브프로세스를 스폰하지 않고
  in-process 로 동작하므로 **프로덕션 보안 특성과는 무관**하나, CI 안정성 측면에서 testing
  리뷰어 참고용으로 기록.
  - 위치: `.claude/tests/test_push_guard_allowlist.py::BacktrackingTest`
  - 제안: 조치 불요/선택. 필요 시 타임아웃 상한을 여유 있게 늘리거나(예: 20s), CI 부하 시
    재시도 1회 허용.

- **[INFO]** 1·2라운드가 이미 다룬 항목(재확인만, 신규 아님) — 전부 등급 유지:
  `main()` 3중 fail-open(선재 정책, `harness-guard-followups.md` §E 추적 중, 범위 밖) ·
  `git log --grep=push` 알려진 잔여 오탐(의도적으로 pin) · `guard_default_branch_bash.py` 와의
  판정 로직 중복(백로그 항목 C, 이번 diff 가 "선행 해소, 착수 가능"으로 정확히 반영) ·
  프로세스 치환(`<(...)`/`>(...)`) 이 `_LIVE_EXPANSION` 에 없는 것은 실측(쉘 검증) 결과 우회
  아님(인용/heredoc 컨텍스트에서 트리거 안 됨).
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿·SQL/XSS/커맨드/LDAP 인젝션·경로 탐색·안전하지 않은 암호화·평문
  전송 해당 없음. 이번 diff 는 순수 텍스트 정규식 판정 로직과 그 테스트·문서(plan/review
  산출물)뿐이며, 신규 외부 의존성 도입도 없다(전수 grep 확인 — API 키/토큰/패스워드/인증서
  리터럴 0건). 훅은 Bash 명령 문자열을 분석만 할 뿐 재실행하지 않으므로 자체가 인젝션 표면이
  되지 않으며, 신규 테스트의 서브프로세스 호출(`BacktrackingTest`)도 `shell=True` 없이 커맨드를
  stdin 데이터로만 전달해 안전하다.

## 요약

3라운드에 걸쳐 실측 재현된 CRITICAL(홑따옴표 이스케이프 오판정에 의한 게이트 결정론적 우회,
`_MESSAGE_ARG` 파국적 백트래킹/ReDoS, 메시지 blanking 의 라이브 확장 노출)과 그 수정 자체가
새로 연 WARNING(`_COMMIT_STDIN_CMD` O(n²) 백트래킹)까지 전부 코드를 직접 추적하고 테스트를
독립 실행하며 재검증했다 — 모두 근본 원인(셸 인용 의미론 혼동, 정규식 alternation 겹침, 지역
검사의 범위 부족)에 정확히 대응하는 방식으로 고쳐졌고, 회귀 테스트(서브프로세스+하드
타임아웃 ReDoS 테스트 포함, 32건)로 고정되어 있다. 직접 구성한 추가 적대적 PoC 에서는 새로운
실행 가능한 우회를 찾지 못했다 — 유일하게 발견한 오탐지 케이스는 셸 자체가 구문 오류로 거부하는
무효 입력에 대한 것이라 보안 결함이 아니다. 하드코딩 시크릿·인젝션·인증/인가 우회·암호화
문제는 신규·기존 모두 발견되지 않았다. "미검토 코드 push 를 막는 유일한 hard gate" 라는 이
컴포넌트의 위상을 감안할 때, 이번 최종 상태는 `/ai-review → RESOLUTION → PR` 다음 단계로
진행하기에 안전한 수준이다.

## 위험도
LOW
