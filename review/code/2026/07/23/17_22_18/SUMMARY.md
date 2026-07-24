# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — REVIEW 게이트가 정상적으로 push 를 차단하면 PLAN 게이트가 이번 실행에서 아예 평가되지 않는데도, fail-open 관측 로직(`_report_fail_open`)이 이를 "두 게이트 모두 건강함이 확인됨"으로 오인해 **아무 경고 없이** 기존 PLAN 연속 fail-open streak 를 리셋한다. security·requirement·side_effect 3개 reviewer 가 각자 독립적으로 실제 subprocess 재현을 통해 동일 결함을 확인했다 — 이 PR("게이트가 꺼져 있는데 아무도 모른다"를 막는 것) 자신의 존재 목적이, 그 목적을 지키기 위해 신설한 리셋 판정 로직 안에서 결정론적으로 재현되는 회귀다.

라우터 결정과 관련해 **forced 화이트리스트(7개) 전원 결과 확보됨** — 강제 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/보안/부작용 (3개 reviewer 중복) | REVIEW 게이트가 정상적으로 `blocked=True` 판정을 내리면 `_run_gates()`가 PLAN 블록에 도달하기 전에 즉시 `return 2` 하여 PLAN 게이트가 이번 실행에서 전혀 평가되지 않는다. 그런데 `_report_fail_open()`의 리셋 분기(`if outcome.bypassed or not outcome.answered: return ... else: os.remove(...)`)는 "REVIEW 만 answered 에 들어있어도"(리스트가 비어있지만 않으면) 조건을 통과시켜 리셋을 강행한다. docstring 은 "clearing takes... a push where BOTH ran and answered"라고 명시하지만 코드는 이를 강제하지 않는다. 3개 reviewer 모두 실제 subprocess 재현으로 확인: PLAN 이 import_error 로 연속 degraded(streak 형성) 중 REVIEW 가 (무관한 사유로) 정상 차단하는 push 가 한 번 발생하면 PLAN 이 여전히 고장나 있음에도 streak 파일이 통째로 삭제되고, stderr 에는 어떤 경고도 없다. RESOLUTION.md 가 이미 한 번 발견·수정한 W2(BYPASS 리셋)와 **동일 클래스의 결함**이 REVIEW 조기-return 경로로 재발한 것이며, REVIEW 차단은 이 훅의 가장 흔한 일상 이벤트이므로 3회 연속 에스컬레이션이 사실상 영구히 발동하지 않을 수 있다. | `.claude/hooks/guard_review_before_push.py` `_run_gates()` L484-528(REVIEW 조기 `return 2`: L500-504), `_report_fail_open()` 리셋 분기 L429-438(특히 L432) | 리셋 조건을 "두 게이트가 실제로 `answered` 에 모두 있는가"로 명시적으로 강제: 예 `if outcome.bypassed or set(outcome.answered) != {"REVIEW", "PLAN"}: return`. 또는 REVIEW 차단 시에도 PLAN 의 `evaluate_plan()`을 계속 호출해 `answered`/`degraded`를 채우되 PLAN 판정 메시지만 억제(기존 `test_review_gate_precedes_plan_gate` 계약과 상충하지 않음). 회귀 테스트 필수: `review="blocked"` + 이전 push 의 `plan="import_error"` streak 형성 시나리오. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | testing | `test_unwritable_state_dir_does_not_break_the_guard`는 이름·docstring이 약속하는 것("관측이 관측 대상을 깨뜨리면 안 된다")의 절반(판정 불변)만 검증한다. 실측 재현 결과 `.claude/state` 쓰기가 실패하는 바로 그 시나리오에서 fail-open 배너 자체가 완전히 출력되지 않는다 — `_report_fail_open()`이 `streak = _read_streak()+1` → `_write_streak()` → (그 다음에야) 배너 조립/print 순으로 구성돼 있어, `_write_streak()`이 던진 예외가 `except Exception: pass`에 삼켜지면 print 문 자체에 도달하지 못한다. docstring의 "the PRIMARY signal... is printed unconditionally and cannot be lost"라는 주장이 이 케이스에서는 거짓임을 확인. | `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` L440-462; 테스트 `.claude/tests/test_guard_review_before_push_main.py:412-423` | (a) 테스트에 배너 출력 단언 추가(`assertIn("fail-open", r.stderr)` — 현재 코드로 FAIL 할 것). (b) 코드 수정: 배너 조립+print 를 `_write_streak()` 이전으로 옮기거나, `_write_streak()` 호출을 자체 try/except 로 감싸 쓰기 실패가 print 도달을 막지 못하게 함. |
| 3 | side_effect | fail-open 배너가 `sys.stderr`로 출력되는데, 이 저장소의 유사 선례(`guard_default_branch_bash.py`, exit 0 이면서 모델에 알려야 하는 신호)는 명시적으로 **stdout**을 사용하고 그 근거를 docstring 에 남겼다. 이 파일의 Contract docstring 은 stderr 노출을 "exit 2(차단)" 케이스에만 한정해 서술하므로, exit 0 fail-open 경로의 stderr 가 실제로 모델 컨텍스트에 도달하는지 확인되지 않는다. 최악의 경우 관측 목표("LOUD")가 부분 무력화될 수 있다. | `.claude/hooks/guard_review_before_push.py:462` (`_report_fail_open` 내부 `print(..., file=sys.stderr)`) | 하네스에서 exit 0 시 stderr 가 실제로 모델 컨텍스트에 도달하는지 실측 확인. 안 된다면 `guard_default_branch_bash.py` 관례에 맞춰 stdout 또는 확실한 채널(`hookSpecificOutput`/`additionalContext`)로 전환. 이미 확인됐다면 근거를 docstring 에 한 줄 남길 것. |
| 4 | 동시성 | streak 카운터의 read-increment-write(`_read_streak()` → `+1` → `_write_streak()`)가 락 없이 수행돼 두 push 프로세스가 겹치면 lost-update 가능. 단, 코드 자신의 docstring 이 "Known residual (accepted)"로 명시하고, 실측 검증 결과 그 근거(1차 신호인 per-push stderr 배너는 레이스와 무관하게 항상 출력되고, 레이스는 오직 카운트 정확도에만 영향)가 정확함을 확인. 판정(차단/허용) 자체에는 영향 없음. | `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` L440-441, `_read_streak()`/`_write_streak()` L386-407 | 현 상태(문서화된 의도적 잔여 위험) 유지로 충분. 카운트 정확도가 실제로 중요해지는 방향(예: streak 값을 소비하는 자동화)으로 확장될 경우 `fcntl.flock` 또는 tempfile+`os.replace` 원자적 read-modify-write 로 승격 검토. |
| 5 | 문서화 | plan §E 구현 노트("테스트 7건" 서술)가 RESOLUTION 반영 이후 stale — 실제로는 12건(RESOLUTION 커밋 `2a94de331`이 W2/W3/W6/W7 대응으로 5개 신규 카테고리: 양쪽 게이트 동시 degraded / bypass+실제고장 정밀 경계 / bypass 비-리셋 회귀 / non-push 비-리셋 / DETECTION 예외 관측 — 을 추가했으나 §E 본문 목록은 이를 반영하지 않음). 같은 이유로 §239의 "6개 중 5개 뮤턴트 포착" 서술도 RESOLUTION.md 의 두 번째 뮤턴트(DETECTION catch 제거) 결과를 누락. | `plan/in-progress/harness-guard-followups.md:237, :239` | 237-239행을 "테스트 12건"으로 갱신하고 RESOLUTION 이 추가한 5개 카테고리 + 두 번째 뮤턴트 결과를 목록에 반영. |
| 6 | 문서화 | `.claude/tests/README.md` 테스트 카탈로그가 이번 PR 의 핵심 신규 커버리지(fail-open 관측: announce+streak 카운트+3회 에스컬레이션+BYPASS 예외)를 전혀 언급하지 않음 — 32개 테스트 중 12개(파일 크기 절반 가까이)가 카탈로그 요약에서 누락. 이 저장소에는 이미 유사한 카탈로그 drift 전례(24 vs 44 extensions)가 기록돼 있어 같은 클래스의 문제가 반복될 조건을 갖춤. | `.claude/tests/README.md:43` | 43행에 "fail-open 발생 시 announce+streak 카운트+3회 연속 에스컬레이션(BYPASS 는 계수/리셋 대상 아님)" 구절 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 7 | 요구사항/문서화 | plan §E 본문의 "테스트 7건" 카테고리 서술 자체는(개수 세는 방식에 따라) 정확할 수 있으나 실제 테스트 메서드 수(신규 12개, 전체 32개, RESOLUTION.md 서술과 일치)와는 다른 단위 — 위 WARNING #5 와 동일 근본 원인. | `plan/in-progress/harness-guard-followups.md` §E | 조치 불요(선택: "7개 시나리오"로 문구 명확화). |
| 8 | 보안 | 예외 메시지(`str(exc)`)가 가공 없이 stderr 및 로컬 state 파일(`.claude/state/push_guard_failopen.json`)에 영속화됨. 로컬 개발 세션 신뢰 경계 내이며 이전 라운드에서도 조치 불요로 판정. | `.claude/hooks/guard_review_before_push.py:499, 518, 396-407` | 조치 불요(옵션: state 파일엔 `type(exc).__name__`만 남기고 원문은 stderr 에만). |
| 9 | 보안 | `_state_path()`가 `CLAUDE_PROJECT_DIR` 환경변수를 검증 없이 경로 결합에 사용하나, 저장소의 다른 다수 훅도 동일 패턴을 씀(이번 diff 가 새로 만든 문제 아님). | `.claude/hooks/guard_review_before_push.py:380-383` | 조치 불요(강화하려면 `_lib/` 공용 헬퍼로 일괄 처리, 범위 밖). |
| 10 | 보안/동시성 | `_write_streak()`이 tempfile+`os.replace` 가 아닌 직접 `open(path,"w")`로 덮어써 torn write/symlink 추종 가능성 있음. `_read_streak()`의 전면적 예외 흡수(`except Exception: return 0`)로 self-heal 되어 크래시·오판정으로 이어지지 않음. | `.claude/hooks/guard_review_before_push.py:396-407` | 조치 불요(락 도입 시 함께 원자화 권장). |
| 11 | 보안/유지보수성 | 파일 말미 `if __name__ == "__main__":` 중복(이전 라운드 지적) — 이번 diff 에서 이미 제거 확인(현재 559-560행에 1개만 존재). | `.claude/hooks/guard_review_before_push.py:559-560` | 해당 없음(이미 해결됨). |
| 12 | 테스팅 | 연속 fail-open 도중 어느 게이트가 깨졌는지 바뀌는 조합(push1=REVIEW degraded, push2=PLAN degraded)에 대한 테스트 없음. 코드 로직 자체는 게이트 종류 무관하게 단순 카운트라 버그 가능성 낮음. | `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` L429-441 | 우선순위 낮음. 해당 조합 시나리오 테스트 1건 추가 검토. |
| 13 | 테스팅 | `_run_gates` 진입 전 예외 관측 테스트(`test_detection_failure_is_observed_not_just_swallowed`)가 소스 텍스트 치환 방식이라 다소 취약하나, `assertNotEqual` 가드로 완전 vacuous 는 아님. | `.claude/tests/test_guard_review_before_push_main.py:389-410` | 조치 불요. |
| 14 | 유지보수성 | `_run_gates()`의 REVIEW/PLAN 게이트 블록이 4단 중첩(상한 근접)에 도달, 두 블록이 게이트 이름·호출 함수만 다른 사실상 동일 구조로 반복. | `.claude/hooks/guard_review_before_push.py:487-526` | 급하지 않음. 3번째 게이트 추가 시 `_run_one_gate(...)` 헬퍼 추출 권장(RESOLUTION INFO#6과 동일 결론). |
| 15 | 유지보수성 | 예외 사유 문자열 포맷(`f"{type(exc).__name__}: {exc}"`)이 3곳(L499, 518, 553)에 중복. | `.claude/hooks/guard_review_before_push.py:499,518,553` | `_reason(exc)` 헬퍼 추출 검토. 우선순위 낮음. |
| 16 | 유지보수성/문서화 | `_Outcome` 클래스가 이를 참조하는 `_report_fail_open()`보다 뒤에 정의됨(전방 참조). `from __future__ import annotations`로 런타임 오류는 없으나 가독성 순서상 부자연스러움. | `.claude/hooks/guard_review_before_push.py:410(사용) vs 468(정의)` | `class _Outcome` 정의를 `_report_fail_open` 앞으로 이동(순수 재배치, 리스크 없음). |
| 17 | 유지보수성 | `_Outcome`이 저장소 관례(`@dataclass(frozen=True)`)와 달리 손으로 작성한 mutable 클래스. 누적기(accumulator) 역할상 의도적 mutable 이 맞으나 스타일 편차. | `.claude/hooks/guard_review_before_push.py:468-481` | 선택 사항. 실익 작음. |
| 18 | 문서화 | 모듈 docstring L28 이 실제로 존재하지 않는 영어 문자열("this push was not checked")을 리터럴처럼 인용 — 실제 배너는 한국어. 기능 영향 없음. | `.claude/hooks/guard_review_before_push.py:28 vs 445,451-452` | 따옴표 제거해 paraphrase 로 쓰거나 실제 한국어 문구 인용. |
| 19 | 부작용 | `_run_gates(outcome)`가 `outcome` 객체를 in-place mutate 하는 출력 파라미터 스타일 — `_Outcome` 도입으로 개선됐으나 여전히 순수성 낮음. 현재 유일한 호출자는 `main()` 뿐. | `.claude/hooks/guard_review_before_push.py:468-481, 484-528` | 조치 불요. 두 번째 호출자 생기면 `(exit_code, outcome)` 튜플 반환 고려. |
| 20 | 동시성 | 문서화된 잔여 lost-update 레이스를 실제 동시 프로세스로 재현하는 회귀 테스트가 없음 — 의도적 정책 결정(RESOLUTION W4, "fcntl 은 과설계")의 자연스러운 결과이며 결정적 동시성 테스트는 flaky 해지기 쉬움. | `.claude/tests/test_guard_review_before_push_main.py` | 조치 불요(우선순위 낮음). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | REVIEW 정상 차단 → PLAN 미평가인데도 streak 리셋(Critical #1). 나머지는 이전 라운드 재확인(모두 조치 불요/이미 해결) |
| requirement | CRITICAL | security 와 동일 결함을 독립적으로 재현(Critical #1). plan "테스트 7건" stale(WARNING #5 상당) |
| scope | NONE | diff 16개 파일이 §E 구현+의무 `/ai-review`+Warning 반영이라는 단일 표준 사이클과 완전히 일치. 무관한 변경 없음 |
| side_effect | CRITICAL | security/requirement 와 동일 결함 재현(Critical #1) + stderr vs stdout 채널 선택 의문(WARNING #3) |
| maintainability | LOW | 4단 중첩·블록 중복·문자열 포맷 중복·전방 참조 등 INFO 다수, 실질 결함 없음 |
| testing | MEDIUM | `test_unwritable_state_dir_does_not_break_the_guard`가 배너 생존을 검증하지 않음, 실측상 배너가 실제로 사라짐(WARNING #2). 이전 라운드 WARNING 3건은 정상 해소 확인 |
| documentation | LOW | plan §E "테스트 7건" stale(WARNING #5), README 카탈로그 갭(WARNING #6). 이전 라운드 CRITICAL/WARNING 3건은 모두 해소 확인 |
| concurrency | LOW | streak read-increment-write 락 없음(WARNING #4, 문서화된 의도적 잔여 위험, 실측 검증상 근거 정확) |

## 발견 없는 에이전트

없음 (전 8개 reviewer 모두 최소 1건 이상 발견 또는 명시적 확인 사항 보고).

## 권장 조치사항

1. **[최우선, Critical #1]** `_report_fail_open()`의 리셋 조건을 "REVIEW 와 PLAN 모두 `answered`에 있는가"로 명시적으로 강제할 것(예: `set(outcome.answered) != {"REVIEW", "PLAN"}`이면 리셋 금지). REVIEW 정상 차단 + PLAN 미평가 + 기존 streak 보존을 검증하는 회귀 테스트 추가.
2. **[WARNING #2]** `_report_fail_open()`에서 배너 조립/print 를 `_write_streak()` 호출보다 먼저 수행하도록 순서 변경(또는 `_write_streak()`을 별도 try/except 로 격리). `test_unwritable_state_dir_does_not_break_the_guard`에 배너 출력 자체를 단언하는 assertion 추가.
3. **[WARNING #3]** exit 0 fail-open 경로에서 stderr 가 실제로 모델 컨텍스트에 도달하는지 실측 확인, 필요 시 `guard_default_branch_bash.py` 관례(stdout)로 전환하거나 확실한 채널 사용.
4. **[WARNING #5, #6]** plan §E 본문("테스트 7건"→12건 갱신, 5개 신규 카테고리 반영)과 `.claude/tests/README.md`(fail-open 관측 커버리지 한 줄 추가) 동기화.
5. **[WARNING #4]** streak 카운터 lost-update 는 현재 문서화된 의도적 잔여 위험으로 수용 — 별도 조치 불요, 향후 카운트 정확도가 중요해지면 원자적 read-modify-write 로 승격 검토.
6. 나머지 INFO 항목(전방 참조 재배치, 문자열 포맷 헬퍼 추출, docstring 인용 정정 등)은 우선순위 낮음, 다음 유지보수 패스에서 일괄 처리 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 강제 미이행 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(로컬 devtool 훅 관측성 확장)와 무관 |
  | architecture | router 판단상 이번 diff 범위와 무관 |
  | dependency | 신규 의존성 추가 없음 |
  | database | DB 접근 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 대면 제품 문서 변경 없음(내부 harness 훅) |