# 요구사항(Requirement) 리뷰 — §E fail-open 관측가능화 (push-guard-failopen-observable)

## 검토 방법

`meta.json`/`_retry_state.json` 기준 diff 는 `origin/main...HEAD` (3 commit: `dd4311678` feat →
`e617a19a0` fix(Warning 9) → `af849ba25` fix(CRITICAL 리셋 술어)). 프롬프트에 diff 가 생략된
`.claude/hooks/guard_review_before_push.py`/`.claude/tests/test_guard_review_before_push_main.py`
는 `git diff origin/main...HEAD` 로 직접 재취득해 전문을 확인했고, 최종 상태의
`guard_review_before_push.py` 전체(585줄)를 Read 로 열람했다. 이번 diff 에는 이전 두 리뷰 라운드
(`review/code/2026/07/23/16_55_04`, `17_22_18`)의 SUMMARY/RESOLUTION 산출물 자체도 파일로
포함돼 있어, 그 문서들이 지적한 CRITICAL/WARNING 이 현재 코드에 실제로 반영됐는지 교차검증했다.
`.claude/tests/test_guard_review_before_push_main.py` 35건 개별 실행(전원 PASS) 및 전체
`.claude/tests/` 스위트(501 passed, 249 subtests) 를 재실행해 실측 확인했다.

## 발견사항

- **[INFO]** `main()`의 최상위 `except Exception as exc:` 가 주석("payload read, or push
  DETECTION itself")이 서술하는 범위보다 넓다 — `try` 블록이 `_read_payload()`/`_is_git_push()`
  뿐 아니라 `exit_code = _run_gates(outcome)` 호출 자체도 감싸고 있어, `_run_gates()` 오케스트레이션
  코드 자체의 버그(예: `outcome` 속성 접근 오류 등, `evaluate_review`/`evaluate_plan` 호출 자체는
  이미 `_run_gates` 내부 try/except 로 별도 처리됨)가 나면 `"DETECTION gate — <exc>"`로 잘못
  라벨링되어 기록된다. fail-open 유지·계수라는 정책 목적에는 영향 없음(여전히 관측·카운트됨)이나,
  향후 디버깅 시 원인 귀속이 부정확할 수 있다.
  - 위치: `.claude/hooks/guard_review_before_push.py:553-580` (`main()`, 특히 `try:` 범위
    L559-568과 `except Exception as exc:` L569-578)
  - 상세: 주석은 "anything unhandled above — payload read, or push DETECTION itself"라고
    한정하지만, 실제 `try` 범위는 `_run_gates()` 반환까지 포함한다.
  - 제안: 현행 유지로 충분(방어적 catch-all 자체는 안전한 설계). 원인 귀속을 더 정밀히 하려면
    `_run_gates()` 호출을 별도 `try/except`로 감싸 `"ORCHESTRATION"` 등 별도 사유로 구분하는 것을
    고려 — 우선순위 낮음.

- **[INFO]** 모듈 최상단 docstring(L25-33)이 실제 배너 문구(한국어)와 다른 영어 인용처럼 보이는
  `"this push was not checked"`를 그대로 남기고 있다. 이는 `review/code/2026/07/23/17_22_18`
  리뷰가 이미 INFO#18 로 지적했고, 같은 세션 RESOLUTION.md 가 "리터럴 인용이 아니라 설명이라
  오독 여지가 낮다"는 근거로 의식적으로 미반영 처리한 항목이다. 코드 동작에는 영향 없음 — 재확인
  차원의 기록.
  - 위치: `.claude/hooks/guard_review_before_push.py:28`
  - 상세: 실제 배너는 L463 `"이 push 는 해당 검사를 **받지 않았습니다**."`.
  - 제안: 조치 불요(팀 결정 기 완료). 다음 편집 시 따옴표를 제거해 paraphrase 로 남기면 더 명확.

- **[INFO]** `REVIEW gate 가 BYPASS 되고 동시에 PLAN gate 가 실제로 degrade 하는` 조합(예:
  `bypass_review=True, plan="import_error"`)에 대한 전용 테스트가 없다. 로직상
  `outcome.degraded`가 비지 않으면 `bypassed` 여부와 무관하게 카운트되므로 기존 코드 경로로
  안전하게 커버되는 것으로 판단되나, 명시적 회귀 테스트는 부재.
  - 위치: `.claude/tests/test_guard_review_before_push_main.py` (기존 `test_bypassing_an_actually_broken_gate_is_still_not_counted` 인접)
  - 제안: 우선순위 낮음. 추가 시 "REVIEW bypass + PLAN degraded → streak 증가·PLAN 사유만 기록"을 단언하는 테스트 1건.

## 요구사항 충족 상세 확인

- `plan/in-progress/harness-guard-followups.md` §E 의 사용자 결정("3안 — fail-open 유지 +
  관측 가능하게")과 하위 구현 체크리스트 7개 항목을 코드와 1:1 대조: `_run_gates()` 분리
  (`guard_review_before_push.py:506-550`), BYPASS 는 degraded 아님(`:510-511`, `:529-530`),
  `main()` `finally` 에서 `_report_fail_open` 호출(`:579-580`, 차단 경로 포함),
  stderr/stdout 경고 + `.claude/state/push_guard_failopen.json` 연속 카운트(`:442-487`),
  reset 술어의 `set(outcome.answered) != _ALL_GATES` 명시적 집합 비교(`:445`),
  배너-먼저·쓰기-나중 순서(`:474-475` print → `:481-482` write), 전체 try/except 로 관측
  자체가 가드를 깨지 않도록 보장(`:442`, `:485-487`) — 전부 line-level 로 일치. 문서에 적힌
  "테스트 35건" 도 실측 `grep -c "^    def test_" ... = 35` 로 일치 확인.
- 이전 두 리뷰 라운드가 지적한 CRITICAL(리셋 술어 v3 — REVIEW 조기 `return 2` 시 PLAN streak 를
  경고 없이 리셋)은 `set(outcome.answered) != _ALL_GATES` 로 교체돼 해소됐고,
  `test_a_blocking_gate_does_not_reset_the_other_gates_streak` 로 회귀 고정됨을 직접 실행해
  확인(PASS). W2(BYPASS 리셋), W3(`_run_gates` 진입 전 예외 미관측 → DETECTION 계수),
  W4(lost-update 잔여 위험 의도적 수용), 배너/쓰기 순서 역전(초판이 쓰기 먼저라 배너가
  삼켜지던 결함) 도 모두 현재 코드에 반영돼 있고 대응 테스트가 통과한다.
- `.claude/tests/README.md` 카탈로그(`test_guard_review_before_push_main.py` 행)가 신규
  관측성 정책(계수·에스컬레이션·리셋 조건·채널 선택)을 정확히 요약 — 실제 코드 동작과 불일치 없음.
- 함수 시그니처·반환값: `_run_gates`는 모든 경로에서 int(0 또는 2) 반환, `main()`도 모든 경로
  (정상/차단/예외)에서 int 반환. `_read_streak`/`_write_streak`/`_state_path` 는 모든 입력(파일
  부재·손상 JSON·비-int streak)에 대해 예외 없이 self-heal(0 반환)하도록 방어돼 있음(`:389-396`).
- TODO/FIXME/HACK/XXX 주석: 검색 결과 없음(diff 범위 내).
- 에러 시나리오: import 실패·`evaluate_*()` 예외·push 감지 자체의 예외(`_is_git_push`) 3개 경로
  모두 fail-open 정책을 유지하면서 관측(계수+배너)되는 것을 subprocess e2e 로 확인.

## 요약

3라운드에 걸친 `/ai-review` → `resolution-applier` 사이클의 최종 산출물로, 이전 두 리뷰가
지적한 CRITICAL 1건(리셋 술어가 REVIEW 조기 차단 시 PLAN streak 를 잘못 지움)과 WARNING 다수
(배너/쓰기 순서, BYPASS 오분류, `_run_gates` 진입 전 예외 미관측, plan/README 문서 drift 등)가
모두 현재 코드에 반영되어 있으며, 독립적으로 트레이싱한 결과 `plan/in-progress/harness-guard-followups.md`
§E 명세와 코드가 line-level 로 일치한다. 35개 단위 테스트와 전체 하네스 스위트(501건) 를 직접
재실행해 통과를 실측했다. 남은 항목은 전부 INFO 수준(예외 라벨링의 정확도, 이미 팀이 검토·기각한
docstring 인용구, 사소한 테스트 커버리지 조합 1건)으로, 기능 완전성·에러 시나리오·반환값·spec
충실도 어느 관점에서도 새로운 CRITICAL/WARNING 을 발견하지 못했다.

## 위험도
LOW
