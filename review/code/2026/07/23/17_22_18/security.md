# 보안(Security) 리뷰 — push guard fail-open observability (재검토)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`plan/in-progress/harness-guard-followups.md` (§E), 및 `review/code/2026/07/23/16_55_04/**` (이전 라운드 산출물, 신규 커밋)

본 리뷰는 `review/code/2026/07/23/16_55_04/` 라운드에서 발견된 Warning 9건(W1~W9)이 `RESOLUTION.md`
기준으로 실제 반영됐는지 코드를 직접 `Read` 하여 확인한 뒤(예: `__main__` 중복 제거 확인 —
현재 파일 559행에 1개만 존재), 그 위에서 독립적으로 새로 스캔한 결과다.

## 발견사항

- **[CRITICAL]** 두 게이트 중 하나(REVIEW)가 *정상적으로* push 를 차단(block)하면 다른 게이트(PLAN)는
  이번 실행에서 전혀 평가되지 않는데, `_report_fail_open()` 의 리셋 판정이 이 경우를 "건강함이 확인됨"
  으로 오인해 **경고 배너 하나 출력 없이** 기존 연속 fail-open streak 를 조용히 지운다 — 이 기능 전체가
  막으려 한 바로 그 실패 모드("게이트가 꺼져 있는데 아무도 모른다")가 그대로 재현된다.
  - 위치: `.claude/hooks/guard_review_before_push.py` `_run_gates()` L484-528 (특히 REVIEW 블록의
    조기 `return 2` — L502-504), `_report_fail_open()` 의 리셋 분기 L429-438
    (`if not degraded: if outcome.bypassed or not outcome.answered: return ... else: os.remove(...)`)
  - 상세: `_run_gates()` 는 REVIEW 게이트를 먼저 평가하고, `decision.blocked` 이 True 이면
    `return 2` 로 **함수 자체를 즉시 종료**한다(L502-504). 이 return 은 PLAN 게이트 블록(L506-526)
    코드에 도달하기 **이전**이므로, PLAN 은 이번 push 에서 bypass 되지도, degraded 로 기록되지도,
    answered 로 기록되지도 않는다 — 아예 실행되지 않는다.
    `_report_fail_open()` 의 docstring(L413-421)은 "clearing it takes positive evidence that the
    gates are working: a push where **BOTH** ran and answered" 라고 명시하지만, 실제 구현(L431-433)은
    `degraded` 가 비어있고 `bypassed` 도 비어있으며 `answered` 가 **비어있지만 않으면**(즉 한쪽만
    답해도) 리셋 조건을 통과시킨다 — "BOTH answered" 를 강제하지 않는다.
    결과적으로: PLAN 게이트가 실제로 계속 깨져 있는 상태(streak=N)에서, REVIEW 게이트가 (그와 무관한
    사유로) 정상적으로 차단하는 push 가 한 번이라도 발생하면, PLAN 이 재확인되지 않았음에도
    streak 파일이 삭제되고 카운트가 0 으로 리셋된다. 이 리셋은 **stderr 에 아무 메시지도 남기지
    않는다** — 이번 push 의 출력에는 오직 REVIEW 차단 메시지(`_REVIEW_MSG`)만 나타나고, "PLAN 은
    여전히 깨져 있을 수 있다"는 신호는 전혀 없다. 3회 연속 시 발동해야 할 `‼️` 에스컬레이션도
    REVIEW 가 주기적으로 차단하는 정상적인 개발 흐름(리뷰 미비로 인한 push 차단은 흔한 이벤트)에서는
    거의 영원히 발동하지 못할 수 있다.
  - **실측 재현** (실제 훅을 subprocess 로 두 번 실행, 기존 테스트 픽스처와 동일한 stub 패턴 사용):
    1. push 1: REVIEW=clean, PLAN=import_error(고장) → stderr 에 `⚠️ … PLAN gate — _lib/plan_guard.py
       failed to import` 출력, `streak_file` 생성, `streak=1`.
    2. push 2: REVIEW=blocked(정상 동작), PLAN=여전히 import_error(고장 지속, 단 이번엔 평가되지
       않음) → exit code 2(REVIEW 차단 메시지만 출력, fail-open 경고 **없음**), 실행 후
       `streak_file` 이 **완전히 삭제**됨(즉 streak 가 0 으로 리셋).
    → PLAN 게이트는 이 두 push 사이에 전혀 수정되지 않았는데도 관측 카운터는 마치 "이제 건강하다"
    처럼 리셋됐다. 이는 W2 에서 고친 것과 **같은 클래스의 결함**이 다른 트리거(BYPASS 대신 정상
    차단에 의한 조기 return)로 재발한 것이며, 기존 32건 테스트 중 이 조합
    (`review="blocked"` + `plan="import_error"`)을 검증하는 테스트는 없다.
  - 제안: 리셋 조건을 "두 게이트가 **모두** `answered` 에 들어있을 때만"으로 좁힐 것 — 예:
    `if len(outcome.answered) == 2: reset` (또는 `_run_gates` 가 REVIEW 차단 시에도 PLAN 을 최소
    상태-기록 목적으로는 평가하도록 구조를 바꾸거나, REVIEW 가 차단해 PLAN 이 미평가인 경우
    리셋은 물론 카운트 증가도 하지 않고 **"PLAN gate — 이번 push 에서는 확인되지 않음"** 같은
    중립 메시지를 남기는 세 번째 상태를 추가). 최소 수정으로는 `_report_fail_open` 의 리셋 분기를
    `if outcome.bypassed or set(outcome.answered) != {"REVIEW", "PLAN"}: return` 으로 바꾸는 것으로
    충분히 막힌다. 회귀 테스트로 위 재현 시나리오(`review="blocked"`, 이전 push 에서
    `plan="import_error"` 로 streak 형성) 를 반드시 추가할 것.

- **[INFO]** 예외 메시지(`str(exc)`)가 가공 없이 stderr 및 로컬 state 파일에 영속화됨
  - 위치: `.claude/hooks/guard_review_before_push.py:499`, `:518` (`degraded.append((..., f"{type(exc).__name__}: {exc}"))`), `:396-407`(`_write_streak` 가 이를 JSON 으로 디스크에 기록)
  - 상세: `evaluate_review()`/`evaluate_plan()` 이 던진 예외의 원문 메시지가 그대로
    `.claude/state/push_guard_failopen.json` 과 stderr 에 남는다. 이 훅은 로컬 개발자 세션의
    stderr/로컬 파일만 대상으로 하므로(신뢰 경계 내 자기 노출), 즉시 조치가 필요한 위협은 아니다.
    이전 라운드(`review/code/2026/07/23/16_55_04/security.md`)에서도 동일하게 INFO 로 판정됐고
    RESOLUTION 에서 "조치 불요"로 의식적으로 보류됨 — 재확인 결과 이견 없음.
  - 제안: 조치 불요(옵션: state 파일에는 `type(exc).__name__` 만 남기고 원문은 비영속 stderr 에만 출력).

- **[INFO]** `_state_path()` 가 `CLAUDE_PROJECT_DIR` 환경변수를 검증 없이 경로 결합에 사용
  - 위치: `.claude/hooks/guard_review_before_push.py:380-383`
  - 상세: `os.path.join(project_dir, ".claude", "state", ...)` 에서 `project_dir` 검증이 없다. 다만
    같은 저장소의 다른 훅들(`clear_resolution_in_flight.py:29`, `guard_review_before_stop.py:119`,
    `mark_resolution_in_flight.py:52`, `guard_default_branch_bash.py:101`,
    `_lib/review_guard.py:762`)도 전부 동일한 `os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()`
    패턴을 검증 없이 쓰고 있어, 이번 diff 가 새로 만든 신뢰 경계 문제가 아니다. `CLAUDE_PROJECT_DIR`
    은 harness/세션이 설정하는 값이며, push 명령의 `tool_input.command` 를 공격자가 조작해도 훅
    프로세스 자신의 환경변수는 바뀌지 않는다.
  - 제안: 조치 불요(기존 관례와 일관). 만약 이 패턴 전체를 강화한다면 `_lib/` 공용 헬퍼로 한 번에
    처리하는 편이 개별 수정보다 낫다(현재는 범위 밖).

- **[INFO]** state 파일 쓰기가 원자적이지 않고 symlink 를 따라감 (torn write / symlink 추종)
  - 위치: `.claude/hooks/guard_review_before_push.py:396-407` (`_write_streak`, `open(path, "w")`)
  - 상세: 임시파일+`os.replace()` 방식이 아니라 대상 경로를 직접 열어 truncate 후 쓴다. 동시 실행 시
    파일이 손상될 수 있으나 `_read_streak()`(L386-393)가 모든 파싱 실패를 `except Exception: return 0`
    으로 흡수해 self-heal 되며(설계 원칙 L371-372 "Nothing here may ever raise into the guard" 와
    일치), 이 파일은 동일 로컬 사용자만 접근하는 devtool 상태 파일이라 별도 권한 경계를 넘는 공격
    시나리오가 아니다. 위 CRITICAL 항목과 달리 이건 판정 로직 자체에는 영향 없는 잔여 위험이다.
  - 제안: 조치 불요(락 도입 논의는 concurrency 리뷰의 lost-update WARNING 과 함께 검토 대상 —
    이미 저장소에 `fcntl.flock` 을 "recurring 해지면 도입" 으로 defer 한 선례가 있음, §G).

- **[INFO]** 파일 말미 `if __name__ == "__main__":` 중복 — 이전 라운드 지적 사항, 수정 확인됨
  - 위치: `.claude/hooks/guard_review_before_push.py:559-560`
  - 상세: 이전 라운드(`review/code/2026/07/23/16_55_04/`)에서 architecture/documentation reviewer 가
    지적한 중복 블록(당시 491-496행)이 이번 diff 에서 제거되어 현재 파일에는 559-560행에 단 1개만
    존재함을 직접 `Read` 로 확인했다(`wc -l` 결과 총 560줄, `grep -n "__main__"` 결과 1건).
  - 제안: 해당 없음(이미 해결됨, 회귀 없음).

- **긍정적 확인 사항** (결함 아님, 참고용):
  - `main()` 이 `try/finally` 로 `_report_fail_open` 을 감싸(L536-556) 차단 경로에서도 보고가
    실행되도록 한 구조, `BYPASS_*` 를 `degraded` 와 명시적으로 분리해 신호 희석을 막은 점(L488-489,
    L507-508), `_report_fail_open` 전체가 `except Exception: pass`(L463-465)로 감싸져 관측 로직
    자체의 실패가 게이트 판정에 전파되지 않도록 한 점(테스트
    `test_unwritable_state_dir_does_not_break_the_guard` 로 검증됨)은 모두 견고하다.
  - push 탐지 정규식(`_GIT_PUSH`, `_redact_inert_text` 등, L61-321)은 이번 diff 의 변경 범위 밖이며
    (docstring/구조 리팩터만 추가됨), 별도 트래커(backlog ②)와 전용 차등 테스트로 이미 하드닝된
    상태 — 이번 보안 재검토에서 새로운 결함을 추가하지 않았다.
  - 하드코딩된 시크릿, SQL/커맨드/경로 인젝션 신규 벡터, 인증/인가 우회, 안전하지 않은 암호화·평문
    전송, 알려진 취약점이 있는 신규 의존성 — 전부 해당 없음(이 diff 는 신규 의존성을 추가하지 않는
    로컬 devtool 훅의 관측성 확장).

## 요약

이 변경은 애플리케이션(사용자 대면) 코드가 아니라 로컬 개발 하네스의 pre-push 가드 훅에 fail-open
관측성(로그·연속 실패 카운트·3회 에스컬레이션)을 추가하는 diff로, 이전 리뷰 라운드(16_55_04)에서
지적된 9건의 Warning(특히 "BYPASS 가 살아있는 streak 를 리셋"하던 W2)은 코드 확인 결과 실제로
반영되어 있다. 그러나 독립적으로 재검토한 결과, W2 와 **동일한 클래스의 결함이 다른 경로로 잔존**한다
— REVIEW 게이트가 정상적으로 차단(block)할 때 그 즉시 `return` 하여 PLAN 게이트가 이번 push 에서
전혀 평가되지 않는데도, 리셋 판정 로직은 이를 "두 게이트 모두 건강함이 확인됨"으로 오인해 **아무
경고 없이** 기존 fail-open streak 를 지운다. 이는 subprocess 재현으로 실측 확인했으며, 32건의 기존
테스트 중 이 조합을 검증하는 테스트가 없다. 이 결함은 게이트 자체의 차단/허용 판정(실제 push 보안
통제)을 우회하지는 않지만, "게이트가 꺼져 있는데 아무도 모른다"를 막기 위해 이번 PR 이 존재하는
바로 그 목적을 실제 발생 가능한 시나리오에서 조용히 무력화한다는 점에서 CRITICAL 로 판정한다. 그 외
잔여 항목(예외 메시지 영속화, `CLAUDE_PROJECT_DIR` 무검증, 비원자적 symlink-추종 쓰기)은 전부 로컬
단일 사용자 신뢰 경계 내의 저위험 INFO 이며 이전 라운드 판정과 일치한다. `__main__` 중복은 이번
diff 에서 이미 해결된 것으로 확인됐다.

## 위험도

CRITICAL
