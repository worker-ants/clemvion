# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 0건(직전 라운드 C1/C2/C3 는 재현 검증 결과 전부 정상 수정 확인). 다만 side_effect 리뷰어가 이번 CRITICAL 3건 수정 diff 자신이 새로 도입한 **다항(O(n²)) catastrophic backtracking** 표면(`_COMMIT_STDIN_CMD`/`_owns_heredoc_as_message`)을 실측(84KB 입력에서 6.19초)으로 발견했고, 이 훅이 모든 Bash 호출을 동기 게이팅하는 hard gate 라는 점에서 C2(ReDoS)와 동일한 피해 범주다. 회귀 테스트로 전혀 pin 되어 있지 않아 조기 조치를 권장한다. 그 외 나머지 8개 reviewer(security/performance/architecture/requirement/scope/maintainability/testing/documentation)는 모두 위험도 LOW 로 수렴했다.

**router 강제(forced) whitelist 이행 확인**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원 forced 결과가 인라인 전문으로 확보되었다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/성능(신규 hang 표면) | 이번 CRITICAL 수정 diff 가 새로 도입한 `_COMMIT_STDIN_CMD`/`_owns_heredoc_as_message` 에 두 개의 그리디 `[^\n]*` 구간이 겹쳐, `commit`/`tag` 단어가 다회 등장하고 끝내 `-F -`/`--file` 을 못 찾으면 O(n²) 백트래킹 발생. 실측: 84KB 명령에서 6.19초(2배 입력마다 ~4배 시간, 대조군 일반 텍스트는 0.017초). PreToolUse 동기 게이팅이라 세션 정지로 이어지며, `BacktrackingTest` 는 `_MESSAGE_ARG` 만 겨냥해 이 경로는 회귀 테스트로 전혀 pin 되어 있지 않음 | `.claude/hooks/guard_review_before_push.py` `_COMMIT_STDIN_CMD`, `_owns_heredoc_as_message()` → `_blank_commit_heredocs()` → `_redact_inert_text()` → `_is_git_push()` 경로 | 두 `[^\n]*` 가 겹치는 실패 지점을 만들지 않도록 재작성(lazy 매칭 또는 "마지막 `-F`/`--file` 위치 선탐색 후 앞쪽 commit/tag 확인"하는 비-역추적 2단계 절차). 수정 후 "닫는 `-F -` 없이 commit/tag 단어 대량 반복" 케이스를 `BacktrackingTest` 에 추가해 회귀 고정 |
| 2 | 성능 | `_redact_inert_text`/`_blank_commit_heredocs` 가 매치(span)·heredoc 개수(k)만큼 `_blank()`(O(n) 전체 문자열 복사)를 반복 호출 — 다수 매치 입력에서 O(n·k)(최악 O(n²))로 열화. `-m` 을 매우 많이 반복하는 긴 명령 문자열에서 트리거 가능(지수 아닌 다항이라 위 #1 보다는 낮은 등급) | `.claude/hooks/guard_review_before_push.py::_redact_inert_text` (spans 루프), `::_blank_commit_heredocs` (while True 루프) | span/heredoc 블랭킹 구간을 모았다가 마지막에 한 번만 선형 재조립(`join`)하도록 변경해 O(n) 으로 낮춤. 최소 방어책으로 입력 길이 상한 초과 시 redaction 생략+즉시 차단(fail-closed) 가드 추가 고려 |
| 3 | 문서(코드-외부 drift) | 이번 diff 가 정확히 채우는 detection-로직 커버리지 갭을, diff 밖의 이웃 테스트 파일 `test_guard_review_before_push_main.py` 모듈 docstring 이 여전히 "`_is_git_push` 는 전용 유닛 테스트가 전혀 없다(backlog item ②)" 고 잘못 서술 — 이번 diff 가 바로 그 backlog ② 를 `test_push_guard_allowlist.py`(25건)로 닫았는데 문서가 갱신되지 않음. 향후 유지보수자가 오판(중복 테스트 작성 또는 실제 커버리지 존재를 놓침)할 위험 | `.claude/tests/test_guard_review_before_push_main.py:9-17`(diff 밖, 변경 안 됨) | 해당 문단을 "detection 로직은 이제 `test_push_guard_allowlist.py` 가 커버, 이 파일은 `main()` 오케스트레이션만 다룸"으로 갱신 (코드 무변경, 주석 교정만) |
| 4 | 문서(plan 기록 drift) | `plan/in-progress/harness-push-guard-subcommand-detection.md` 체크리스트가 "`test_push_guard_allowlist.py` 17건, 전체 스위트 359건"이라는 **C1~C3 수정 이전** 수치를 그대로 담고 있어, 같은 diff 안의 `RESOLUTION.md`("25건/367건") 및 실측(`grep -c` 25건, 전체 스위트 367건)과 모순 | `plan/in-progress/harness-push-guard-subcommand-detection.md` 체크리스트 라인 | 최종 수치(25건/367건)로 갱신하거나 RESOLUTION.md 참고를 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | C1(홑따옴표 이스케이프 오판정)·C2(ReDoS)·C3(메시지 blanking 이 살아있는 확장 노출) 세 CRITICAL 모두 코드 추적·재현으로 수정 확인. 프로세스 치환(`<(...)`/`>(...)`)이 `_LIVE_EXPANSION` 에 없다는 독자 가설도 셸 실측으로 우회 아님 확인 | `guard_review_before_push.py:75,124-129,215-237` | `_LIVE_EXPANSION` 주석에 "따옴표/heredoc 컨텍스트는 프로세스 치환 미트리거" 근거 한 줄 추가(선택) |
| 2 | 보안/아키텍처 | `main()` 3중 fail-open(import 실패·evaluate 예외·JSON 파싱 실패)은 선재 정책, `harness-guard-followups.md` §E 로 이미 추적 중, 범위 밖 | `guard_review_before_push.py:39-48, 289-311` | 조치 불요(§E 트래킹 참고) |
| 3 | 아키텍처 | `_is_git_push` 의 "명령 전체 inert 검사 우선" guard clause 가 defense-in-depth 로 유효 작동 확인; blind 1차 패턴(폐쇄)과 allowlist(개방)의 아키텍처 경계는 이번 fix 라운드에도 유지됨(강점) | `guard_review_before_push.py:216-233` | 조치 불요, 향후 신규 해제 규칙 추가 시 이 순서를 유지하라는 docstring 한 줄 권장 |
| 4 | 아키텍처 | `guard_review_before_push.py` vs `guard_default_branch_bash.py` 의 git 서브커맨드 판정 로직 중복 — 이미 `harness-guard-followups.md` 항목 C 로 추적 중, 이번 PR 밖 defer 는 합리적이나 `_lib/` 공유 추출 우선순위 상향 재권고 | 두 훅 비교 | `_redact_inert_text`/`_is_inert`/`_ESCAPED_PIPE` 를 `_lib/`로 조기 추출 검토 |
| 5 | 아키텍처 | `_redact_inert_text` 3규칙(escaped-pipe→heredoc→message) 순서 의존성이 여전히 문서화 안 됨(직전 라운드 이월, 이번 fix 범위 밖) | `guard_review_before_push.py:129-161` | docstring 에 "순서가 의미 있다" 한 줄 + 코퍼스 케이스 1건 추가 |
| 6 | 요구사항 | 알려진 잔여 오탐(`git log --grep=push`) 외 `-am`/`--message`(공백 구분) 등 유사 보수적 오탐 형태 추가 확인, 안전 방향(결함 아님) | `guard_review_before_push.py::_MESSAGE_ARG` | `KnownRemainingFalsePositiveTest` 에 발견성 목적으로 1~2건 추가(선택) |
| 7 | 요구사항 | heredoc 종료 구분자 매칭이 `<<`/`<<-` 구분 없이 탭+스페이스 모두 허용해 POSIX 보다 근소하게 관대 — 다만 항상 "과소-해제(차단 유지)" 방향이라 우회 아님 | `guard_review_before_push.py::_blank_commit_heredocs` | 우선순위 낮음, 필요시 `<<-` 분기 처리 |
| 8 | 유지보수성 | 파일 내 top-level 정의 사이 공백 줄이 1/2/3줄로 혼재(순수 스타일, 일부는 직전 라운드에 이미 defer) | `guard_review_before_push.py:109, 202-204` | 여유 있을 때 2줄로 통일 |
| 9 | 테스트 | `_COMMIT_STDIN_CMD` 의 env-assignment 접두 분기가 뮤테이션 검증 결과 현재 테스트 스위트에 대해 dead-for-tests(제거해도 25/25 통과) | `guard_review_before_push.py:96` | CORPUS 에 env-assignment + heredoc 소유 세그먼트 조합 케이스 1건 추가 |
| 10 | 테스트 | `_is_git_push` 유닛 테스트와 `main()` e2e 테스트 사이에 "release 판정된 명령이 실제 프로세스에서 exit 0" 을 검증하는 통합 이음매 테스트 없음 | `guard_review_before_push.py:280-286` | `test_guard_review_before_push_main.py` 에 release 케이스 e2e 스모크 1건 추가(우선순위 낮음) |
| 11 | 문서 | `_is_git_push` 인라인 주석의 C3 예시 문자열이 실제 pin 된 CORPUS 문자열과 축약되어 불일치(동작 영향 없음) | `guard_review_before_push.py::_is_git_push` 인라인 주석 | 예시를 CORPUS 와 동일하게 맞추거나 "illustrative" 명시 |
| 12 | 범위 | 함수 경계 공백 줄 3개(파일 전체 컨벤션 2개) 잔존 — 직전 라운드에 이미 INFO 로 지적·의도적 defer, 실질 변경과 미혼재 | `guard_review_before_push.py:202-204` | 조치 불요(이미 defer) |
| 13 | 범위 | `harness-guard-followups.md` 편집은 별도 백로그 항목 C 의 선행조건 상태 갱신 — 이번 작업(②)이 그 선행조건을 실제로 풀었다는 사실의 정직한 반영, 스코프 위반 아님 | `plan/in-progress/harness-guard-followups.md` §C | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | C1/C2/C3 수정 확인, 프로세스 치환 우회 가설 반증, 신규 시크릿/인젝션 없음 |
| performance | LOW | `_redact_inert_text`/`_blank_commit_heredocs` O(n·k) 다항 열화 (WARNING #2), 조기-반환 설계는 우수 |
| architecture | LOW | OCP 경계·defense-in-depth guard clause 검증됨, 두 훅 판정 로직 중복은 이미 추적 중 |
| requirement | LOW | C1/C2/C3 PoC 재실행으로 수정 재확인, plan 체크리스트 테스트 건수 stale(WARNING #4) |
| scope | LOW | 16개 파일 전부 단일 작업(②)에 수렴, 요청 밖 확장 없음 |
| side_effect | **WARNING** | 이번 fix 가 새로 도입한 `_COMMIT_STDIN_CMD` O(n²) catastrophic backtracking 실측 발견(WARNING #1) — 이번 라운드 최고 위험도 |
| maintainability | LOW | 이웃 테스트 파일 docstring stale(WARNING #3), 코드 품질 자체는 개선됨 |
| testing | LOW | 25/25, 367/367 실행 확인 + 3종 독립 뮤테이션으로 C1/C3 비-vacuity 재검증, docstring stale 발견(WARNING #3 중복) |
| documentation | LOW | plan 체크리스트 수치 stale(WARNING #4 중복), 나머지 문서화 강점 다수 |

## 발견 없는 에이전트

없음(9개 전원 최소 INFO 이상 발견 보고).

## 권장 조치사항

1. **(최우선)** `_COMMIT_STDIN_CMD`/`_owns_heredoc_as_message` 의 겹치는 그리디 `[^\n]*` 구간을 재작성해 O(n²) catastrophic backtracking 제거하고, "commit/tag 단어 대량 반복 + `-F -` 미종결" 케이스를 `BacktrackingTest` 에 추가해 회귀 고정한다(WARNING #1) — 이번 CRITICAL 수정 자체가 새로 연 hang 표면이므로 다음 라운드로 미루지 않는다.
2. `_redact_inert_text`/`_blank_commit_heredocs` 의 반복 `_blank()` 호출을 한 번의 선형 재조립으로 교체해 O(n·k) 열화를 O(n) 으로 낮춘다(WARNING #2).
3. `test_guard_review_before_push_main.py` docstring 과 `harness-push-guard-subcommand-detection.md` 체크리스트의 테스트 건수를 최종 상태(25건/367건)로 동기화한다(WARNING #3, #4) — 코드 변경 없는 저비용 문서 정정.
4. 저우선순위 INFO(env-assignment dead branch 테스트 추가, 통합 이음매 e2e 스모크, 인라인 예시 문자열 일치 등)는 다음 유지보수 사이클에 일괄 반영 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff(정규식·테스트 로직) 와 무관 |
  | database | 해당 없음 — DB 접근 코드 변경 없음 |
  | concurrency | 해당 없음 — 동시성 상태 변경 없음 |
  | api_contract | 해당 없음 — API/DTO 변경 없음 |
  | user_guide_sync | 해당 없음 — 사용자 가이드/문서 대상 기능 변경 없음(`.claude/` 하네스 내부 도구) |