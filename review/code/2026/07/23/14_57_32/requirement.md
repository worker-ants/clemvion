# 요구사항(Requirement) 리뷰 — push 가드 blind + allowlist (재리뷰, 라운드 2)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
`review/code/2026/07/23/14_23_23/*`(직전 라운드 리뷰 산출물, 이번 diff 에 커밋됨).

이 diff 는 `review/code/2026/07/23/14_23_23` 리뷰(Critical 3·Warning 3)에 대한 수정본이다. 코드를
그대로 신뢰하지 않고 직접 재실행·프로브로 재현·검증했다.

## 검증 방법

- `.claude/tests/test_push_guard_allowlist.py` 를 직접 `unittest` 로 실행: **25건 전체 OK**.
- 전체 하네스 스위트 `python3 -m unittest discover`: **367건 전체 OK** (RESOLUTION.md 의 "367건" 주장과 일치).
- 직전 라운드가 재현한 3개 CRITICAL PoC 를 현재 코드에 대해 직접 재실행:
  - C1 (`git commit -m 'a\' && git push -- 'end'`) → `_is_git_push` = `True`(차단) — 수정 확인.
  - C3 (`git commit -m "fix: retry push notification bug" && echo "log: $(git push origin main)"`) →
    `True`(차단) — 수정 확인. 두 번째 변형(`VAR="$(git push)"`)도 `True`.
  - C2(ReDoS)는 `BacktrackingTest`(서브프로세스+하드 타임아웃)가 40/200/800개 백슬래시에서 전부
    수 ms 내 종료함을 직접 재확인.
- `_MESSAGE_ARG` 의 이중 따옴표 분기(`(?:\\.|[^"\\])*`)가 실제 POSIX 이스케이프 규칙과 동치인지
  수동 유도로 검증: 비-따옴표·비-백슬래시 문자는 쌍으로 소비하든 개별로 소비하든 닫는 따옴표
  위치가 달라지지 않으므로, 종료 경계 판정이 실제 셸 파싱과 일치한다(회귀 없음).
- `git tag ... -F -` 해제 경로 + tag 소유권 위장 거부 케이스를 직접 재실행해 Warning#3 반영 확인.
- `plan/in-progress/harness-push-guard-subcommand-detection.md` 의 "## 구현" 서술(1차 정규식 불변
  + `_redact_inert_text` 3규칙 + C1/C2/C3 재현·수정 이력)이 실제 코드와 line-level 로 일치함을 확인
  (이 plan 문서가 `.claude/` 하네스 도구의 사실상 SoR — `spec/` 에는 이 훅을 다루는 문서가 없음,
  `grep -rl "guard_review_before_push\|git push" spec/` 0건, CLAUDE.md 상 `.claude/` 는 spec/ 대상 밖).

## 발견사항

- **[WARNING]** plan 체크리스트의 테스트 건수 근거가 최종 수정본과 불일치(stale)
  - 위치: `plan/in-progress/harness-push-guard-subcommand-detection.md:160`
    (`- [x] 차등 테스트 + 위 코퍼스 고정 (`test_push_guard_allowlist.py` 17건, 전체 스위트 359건)`)
  - 상세: 이 항목은 C1/C2/C3 수정 **이전**(최초 구현 시점)의 테스트 건수를 담고 있다. 실제로
    `test_push_guard_allowlist.py` 를 직접 실행하면 **25건**(`BacktrackingTest`·추가된
    `ReleaseRefusedTest` 케이스 등 8건 증가), 전체 하네스 스위트는 **367건**이다 — 이는 같은 diff
    안의 `review/code/2026/07/23/14_23_23/RESOLUTION.md`("`test_push_guard_allowlist.py` 25건,
    전체 하네스 스위트 367건 OK")와도 직접 모순된다. `grep -n "25건\|367건" plan/in-progress/harness-push-guard-subcommand-detection.md`
    는 0건 — 최종 수정 반영 후 이 체크리스트 줄이 갱신되지 않았다. 기능 결함은 아니지만, 이
    plan 문서가 이 하네스 도구의 사실상 SoR(spec 대체) 역할을 하므로, "완료" 표시(`[x]`)에 첨부된
    구체적 수치가 틀리면 향후 이 plan 을 근거로 상태를 판단하는 사람(혹은 gate)이 오도될 수 있다.
  - 제안: 라인을 `test_push_guard_allowlist.py` 25건, 전체 스위트 367건`으로 갱신(RESOLUTION.md 와
    합치). 코드 fix 대상 아님 — plan 문서 정정.

- **[INFO]** 알려진 잔여 오탐(`git log --grep=push`) 외에, 문서화되지 않은 유사한 보수적 오탐 형태가
  더 있음(설계상 의도된 안전 방향이라 결함 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py::_MESSAGE_ARG`
  - 상세: 직접 프로브로 확인 — `git commit -am "message mentions push"`(`-a`+`-m` 번들, `-m` 이
    독립 토큰이 아니라 `_MESSAGE_ARG` 의 `(?:(?<=\s)|^)-m` 경계 조건을 못 만족) 와
    `git commit --message "mentions push"`(공백 구분, `=` 없음 — 정규식은 `--message=` 만 지원)
    는 둘 다 해제되지 않고 계속 차단된다. 안전 방향(오탐, 결함 아님)이며 `KnownRemainingFalsePositiveTest`
    가 이미 `git log --grep=push` 하나를 이런 식으로 명시적으로 pin 해두는 패턴이 있으므로, 같은
    방식으로 이 두 형태도 나란히 pin 해두면 향후 우연히 해제 규칙이 확장될 때 "이미 알려진 갭"과
    "새 회귀"를 구분하기 쉬워진다.
  - 제안: 낮은 우선순위. `KnownRemainingFalsePositiveTest` 에 1~2건 추가해 발견성 개선(선택).

- **[INFO]** heredoc 종료 구분자 매칭이 실제 셸 문법보다 근소하게 관대함 — 다만 안전 방향으로만 작용
  - 위치: `.claude/hooks/guard_review_before_push.py::_blank_commit_heredocs`
    (`end_re = re.compile(rf"^[ \t]*{re.escape(delim)}[ \t]*$", re.M)`)
  - 상세: 평범한 `<<DELIM`(대시 없음)은 POSIX 상 종료 구분자 줄에 **선행 공백이 전혀 없어야** 하고,
    `<<-DELIM` 만 **탭만** 허용한다. 이 정규식은 `<<`/`<<-` 구분 없이 탭·스페이스 모두 허용해
    실제보다 넓게 "종료"로 인식할 수 있다. 다만 이로 인한 결과는 본문 경계를 항상 **더 일찍**
    (혹은 동일하게) 잡는 쪽으로만 작용한다 — 즉 실제 heredoc 본문의 뒷부분이 블랭킹되지 않고
    남아 blind 1차 패스에 그대로 노출되는 "과소-해제"(차단 유지) 방향이라, 문서가 명시한 안전
    불변식("좁게 빗나가면 차단 유지")과 일치하며 게이트 우회로 이어지지 않음을 직접 사례로
    확인했다(허위 종료로 짧아진 구간 밖은 항상 미블랭킹 상태로 남아 blind 패스가 여전히 감시).
  - 제안: 우선순위 낮음. 정확성을 높이려면 `<<-` 여부에 따라 허용 공백 문자를 분기할 수 있으나,
    현재도 안전 방향이라 결함으로 보지 않는다.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음 — 미완성 작업 표시 없음(`grep -n "TODO\|FIXME\|HACK\|XXX"` 0건).

## Spec/plan 정합성 요약

`.claude/` 하네스 도구는 `spec/` 스코프 밖(CLAUDE.md 명시)이라 `spec/` 문서 대조는 해당 없음(확인:
`git push`/훅 이름 언급 0건). 이 변경의 사실상 SoR 는
`plan/in-progress/harness-push-guard-subcommand-detection.md` 이며, 그 "## 구현" 절이 서술하는
설계(1차 정규식 불변 + `_redact_inert_text` 3규칙 + C1/C2/C3 재현·수정)와 실제 코드가
line-level 로 정확히 일치함을 직접 대조로 확인했다. 유일한 불일치는 위 WARNING(체크리스트
테스트 건수 stale) 하나뿐이며, 이는 코드가 틀린 것이 아니라 plan 문서 기록이 뒤쳐진 것이다.

## 요약

직전 라운드가 발견한 3개 CRITICAL(홑따옴표 이스케이프로 인한 게이트 완전 우회, 정규식 파국적
백트래킹, 메시지 blanking 이 살아있는 `$(git push …)` 를 드러내는 거짓음성)은 모두 코드에서
수정된 상태이며, 재현 PoC 를 직접 재실행해 셋 다 이제 올바르게 차단됨을 독립적으로 확인했다.
전체 하네스 스위트 367건이 통과하고, `test_push_guard_allowlist.py` 신규 25건도 전부 통과한다.
남은 지적은 기능 결함이 아니라 (a) plan 체크리스트에 남은 stale 테스트 건수 표기(WARNING, plan
문서 정정 대상)와 (b) 이미 알려진 안전-방향 잔여 오탐 패턴에 문서/테스트 발견성을 조금 더
높일 수 있는 저우선순위 개선(INFO) 뿐이다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 측면에서
심각한 괴리는 발견되지 않았다.

## 위험도

LOW
