# 부작용(Side Effect) 리뷰

## 컨텍스트

이 diff(`origin/main` 대비 `dd4311678` → `e617a19a0` → `af849ba25` 3커밋)는 이미 두 차례의
`/ai-review` 라운드(`review/code/2026/07/23/16_55_04`, `17_22_18`)를 거쳐 CRITICAL 1건·
WARNING 다수가 순차적으로 fix 된 최종 상태다. 현재 `.claude/hooks/guard_review_before_push.py`
(584줄), `.claude/tests/test_guard_review_before_push_main.py`, 관련 plan/문서를 직접 열어
확인했다. 이전 라운드에서 지적된 side_effect 항목(①`_run_gates` 진입 전 예외 미관측
②streak 리셋이 bypass/조기-return 을 오판 ③배너 채널·순서)은 모두 코드로 반영되었고
회귀 테스트가 각각 고정되어 있음을 확인했다. 아래는 현재 상태에 대한 독립적 재검토다.

## 발견사항

- **[INFO]** `_report_fail_open()` 이 이제 push 여부와 무관하게 **모든 Bash 호출**에서 실행됨
  - 위치: `.claude/hooks/guard_review_before_push.py` `main()` L559-580 (특히 `finally` L579-580),
    `_is_git_push` 조기 `return 0` L564-565
  - 상세: `main()` 이 `try/…/finally` 구조로 바뀌면서, non-push 커맨드에 대한 조기 `return 0`
    (L564-565) 도 `finally` 블록(`_report_fail_open(outcome, exit_code)`)을 거치게 됐다. 현재는
    `outcome`(`degraded=[]`, `answered=[]`, `bypassed=[]`)이 항상 "건강 증명 실패" 조건
    (`set(outcome.answered) != _ALL_GATES`, L445)에 걸려 즉시 반환하므로 실질적으로 no-op —
    파일 I/O·print 모두 발생하지 않는다(`.claude/tests/test_guard_review_before_push_main.py`
    L371-378 `test_non_push_does_not_clear_an_existing_streak` 로 기존 streak 보존은 검증됨).
    다만 이전(diff 이전)에는 non-push 경로가 `return 0` 한 줄로 끝나 이 함수 자체가 호출조차
    안 됐던 반면, 지금은 매 Bash 호출마다 실행 경로에 들어간다 — 향후 리셋 조건이 완화되면
    (예: `_ALL_GATES` 정의 변경, `set(...) != _ALL_GATES` 를 truthiness 검사로 되돌리는 회귀 등)
    non-push 경로에서 의도치 않게 state 파일을 쓰거나 지울 잠재적 표면이 새로 생겼다는 뜻.
    현재 코드·테스트는 안전하지만, "non-push 는 항상 no-op" 이라는 불변식을 지키는 직접적인
    단정(`test_non_push_command_allows` 는 `stderr==""`만 확인하고 `stdout`·state 파일 부재는
    미단정)은 없다.
  - 제안: (선택) `test_non_push_command_allows` 에 `self.assertEqual(r.stdout, "")` 와 state 파일
    미생성 단언을 추가해 이 불변식을 명시적으로 고정. 필수는 아님(현재 테스트 스위트가 회귀를
    간접적으로 잡는 구조).

- **[INFO]** 새 전역 상수 `_ALL_GATES`(frozenset)가 게이트 이름 문자열 리터럴("REVIEW"/"PLAN")과
  약하게 결합됨
  - 위치: `.claude/hooks/guard_review_before_push.py` L376 (`_ALL_GATES` 정의), `_run_gates()`
    L510-550 곳곳의 `"REVIEW"`/`"PLAN"` 리터럴 (`outcome.bypassed.append("REVIEW")` 등)
  - 상세: 리셋 판정(`set(outcome.answered) != _ALL_GATES`, L445)이 `_run_gates()` 안에서 흩어져
    등장하는 문자열 리터럴과 이름으로만 연결되어 있다. 리터럴 하나에 오타가 나면(예:
    `"Review"`) 그 게이트는 영원히 "answered" 되지 못해 streak 가 절대 리셋되지 않는 방향으로
    실패한다 — fail-safe 방향(리셋 억제)이라 심각한 부작용은 아니지만, 정적으로는 잡히지 않고
    end-to-end 서브프로세스 테스트(`test_a_fully_clean_push_still_resets` 등)가 통과/실패로만
    드러낸다. 변경 자체가 만든 새 리스크라기보다 기존 설계의 연장이며, 현재 테스트 커버리지가
    이 경계를 실질적으로 지키고 있어 위험도는 낮음.
  - 제안: 조치 불요(YAGNI) — 게이트가 3개 이상으로 늘어나는 시점에 상수화/딕셔너리 기반
    리팩터 고려.

- **[INFO]** 신규 파일시스템 부작용은 의도된 것이며 스코프가 잘 통제됨
  - 위치: `_state_path()` L383-386, `_write_streak()` L399-410, `_report_fail_open()` 의
    `os.remove(_state_path())` L448
  - 상세: `.claude/state/push_guard_failopen.json` 생성/갱신/삭제라는 새 파일시스템 부작용이
    도입됐지만 (1) `.gitignore:19`에 `.claude/state/` 가 이미 포함되어 커밋 오염 위험 없음,
    (2) `CLAUDE_PROJECT_DIR` 폴백 패턴(`os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()`)은
    `guard_default_branch_bash.py`/`guard_review_before_stop.py`/`clear_resolution_in_flight.py`/
    `mark_resolution_in_flight.py` 에 이미 존재하는 저장소 관례와 동일해 이 diff 가 새로 만든
    리스크가 아님, (3) 테스트가 `CLAUDE_PROJECT_DIR` 를 매 케이스 tmp 디렉토리로 격리해
    (`test_guard_review_before_push_main.py` L128-132) 실제 저장소 state 를 건드리지 않음을
    확인. 조치 불요.

- **[INFO]** 내부 함수 시그니처 변경(`_report_fail_open(outcome)` → `_report_fail_open(outcome,
  exit_code)`, `main()` 분할로 `_run_gates(outcome)` 신설)은 외부 호출자 영향 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` L413, L506
  - 상세: 두 함수 모두 `_`-prefixed 모듈 내부 전용이며, 리포지토리 전체에서
    `guard_review_before_push` 를 참조하는 다른 코드(`grep` 결과: `test_push_guard_allowlist.py`
    는 `_is_git_push`/`_GIT_PUSH`/`_blank_spans`/`_MAX_REDACTION_INPUT` 만 직접 참조,
    `.claude/settings.json` 은 subprocess 로만 호출)는 이번에 바뀐 함수를 import/직접 호출하지
    않음. `main()`의 공개 계약(exit 0/2/그 외, stdin JSON 입력)은 그대로. 조치 불요.

## 요약

이 변경이 실제로 도입하는 새 부작용은 `.claude/state/push_guard_failopen.json` 파일에 대한
읽기·쓰기·삭제뿐이며, 이는 이번 작업의 목적(§E fail-open 관측가능화) 그 자체이고 gitignore·
`CLAUDE_PROJECT_DIR` 격리 테스트로 잘 통제되어 있다. 이전 두 라운드 리뷰가 지적한 CRITICAL
(차단 push 가 타 게이트 streak 를 지움)과 WARNING(배너 채널·순서, `_run_gates` 진입 전 예외
미관측, bypass 오리셋)은 모두 코드에 반영되고 회귀 테스트로 고정된 상태를 직접 확인했다.
남은 것은 "non-push 커맨드도 이제 관측 함수 실행 경로를 통과한다"(현재는 검증된 no-op)와
게이트 이름 문자열 리터럴 결합 정도의 INFO 성 관찰뿐이며, 둘 다 fail-safe 방향으로 치우쳐
있어 즉시 조치가 필요하지 않다. 신규 전역은 불변 상수(frozenset/str/int)뿐이고 프로세스 간
공유 가변 상태는 디스크 파일 하나로 한정되어 있다. 시그니처가 바뀐 함수는 전부 모듈 내부
전용이라 외부 호출자 영향이 없다.

## 위험도

LOW
