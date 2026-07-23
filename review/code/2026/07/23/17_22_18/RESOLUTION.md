# RESOLUTION — §E 2라운드 (CRITICAL 1 + Warning 5)

리뷰: `review/code/2026/07/23/17_22_18/SUMMARY.md` — RISK=**CRITICAL**, Critical 1, Warning 5.
forced 7명 전원 확보(`forced_missing: []`).

## CRITICAL — 리셋 술어가 세 번째로 틀렸다

REVIEW 게이트가 정상 차단하면 `_run_gates()` 는 PLAN 블록 **전에** `return 2` 한다. 그래서
`answered=["REVIEW"]`, `degraded=[]` 가 되는데, 내 리셋 조건 `not outcome.answered` 가 이를
"건강함 확인" 으로 읽고 **PLAN streak 를 경고 없이 삭제**했다.

**재현(수정 전)**: PLAN 을 2회 연속 degrade → streak 2 → REVIEW 가 차단하는 push 1회 →
**state 파일 삭제, stderr 의 fail-open 경고 0건**. PLAN 은 여전히 고장이다.
REVIEW 차단은 이 훅의 **가장 흔한 이벤트**라 3회 에스컬레이션이 사실상 영영 안 뜬다.

내 docstring 은 "clearing takes a push where BOTH ran and answered" 라고 **정확히** 써 있었는데
코드가 그걸 강제하지 않았다. → `set(outcome.answered) != _ALL_GATES` 로 **명시적 집합 비교**.

> **같은 술어를 세 번 틀렸다**: v1 `degraded` 만 비면 리셋(BYPASS 가 지움) → v2 *아무* 게이트나
> 답하면 리셋(bypass 된 REVIEW + clean PLAN 이 지움) → v3 조기 return 경로. 전부 "모든 게이트가
> 답했다" 보다 **약한 증거를 받아준** 실수다. truthiness 검사를 버리고 이름 있는 집합
> (`_ALL_GATES`)과 비교하도록 바꿨다 — 3번째 게이트가 생겨도 2개로 리셋이 통과하지 못한다.
>
> 부수: 회귀 테스트를 쓰면서 **기대값도 한 번 틀렸다**(streak 3 을 기대). REVIEW 가 차단하면
> PLAN 은 실행조차 안 되므로 degradation 을 *관측한 것도 아니다* — 증가도 리셋도 아닌 **보존**(2)이
> 맞다. 테스트가 잡아줬고, 그 구분을 테스트 문구에 남겼다.

## Warning (5) — 전부 반영

### W2 — 쓰기 실패가 배너 자체를 삼켰다

`_report_fail_open` 이 `_write_streak()` → 배너 조립/print 순서였다. state 디렉토리가 쓰기 불가면
예외가 `except Exception: pass` 에 삼켜져 **print 에 도달조차 못 한다** — 내 docstring 의
"the PRIMARY signal is printed unconditionally and cannot be lost" 가 이 경우 **거짓**이었다.
이 장치가 막으려던 실패(조용한 통과)가 장치 안에서 재현된 셈.
→ **배너 먼저, 영속 나중**. 쓰기는 자체 try/except 로 감싸고 실패 시 traceback 을 남긴다.
기존 테스트에 배너 출력 단언 추가(수정 전이면 FAIL).

### W3 — 배너가 모델에 안 닿는 채널로 나갔다

`guard_default_branch_bash.py` 는 exit 0 신호를 **stdout** 으로 내고 그 근거를 docstring 에
남겨 뒀다 — *"prints a reminder to stdout (which the harness injects into the model's context)"*.
내 배너는 항상 stderr 였다. exit 0(= fail-open 의 기본 경로)에서 stderr 가 모델 컨텍스트에
닿는다는 근거가 없으므로, "LOUD 하게" 라는 목적이 가장 흔한 경로에서 무너질 수 있었다.
→ **exit code 로 채널 선택**: exit 2 는 stderr(거부 사유가 읽히는 곳), 그 외는 stdout.
양방향을 `test_banner_goes_to_the_stream_the_harness_actually_surfaces` 로 고정.

### W4 — streak lost update

리뷰어가 **내 근거를 실측 검증하고 "정확함" 으로 확인**했다(1차 신호는 레이스와 무관, 판정에
영향 없음). 문서화된 의도적 잔여로 유지. 다만 근거 문구를 이번 수정에 맞춰 정정했다 —
"배너를 쓰기보다 **먼저** 내보내므로 실패한/경합하는 쓰기에 1차 신호를 잃지 않는다".

### W5 — plan §E 의 "테스트 7건" stale

실제 35건(관측성 15건). 개수만 고치는 대신 **무엇이 추가됐는지**와 위 3회 오류 이력을 §E 에
기록했다 — 숫자는 또 낡지만 "왜 이 술어가 이렇게 생겼는가" 는 낡지 않는다.

### W6 — README 카탈로그가 신규 커버리지 미반영

`test_guard_review_before_push_main.py` 행에 fail-open 관측 정책(계수·에스컬레이션·리셋 조건·
채널) 요약 추가.

## INFO 중 미반영(사유)

- #8/#9/#10 (예외 원문 영속화·`CLAUDE_PROJECT_DIR` 미검증·비원자적 쓰기): 로컬 신뢰 경계 내,
  `_read_streak` 이 self-heal. 이전 라운드에서도 조치 불요 판정.
- #11 `__main__` 중복: 이번 diff 에서 이미 해결됨(리뷰어도 확인).
- #12 (degraded 게이트가 push 마다 바뀌는 조합): 카운트 로직이 게이트 종류와 무관해 위험 낮음.
- #13 (DETECTION 테스트의 소스 치환 취약성): `assertNotEqual` 가드로 vacuous 아님.
- #14/#15/#17 (게이트 블록 중복·사유 포맷 중복·`_Outcome` 스타일): 3번째 게이트가 생기면 함께.
- #16 `_Outcome` 정의 위치: `from __future__ import annotations` 로 런타임 무해하고, 이번 diff
  에서 더 건드리면 CRITICAL 수정과 섞인다. 다음 터치에.
- #18 docstring 이 인용한 영어 문구가 실제 한국어 배너와 불일치: 리터럴 인용이 아니라 설명이라
  오독 여지가 낮다.

## 검증

- `test_guard_review_before_push_main.py` **35건**, 전체 하네스 스위트 **482건 OK**.
- 뮤턴트(치환 적용·문법 검사 선행): 리셋 술어 되돌림 → 차단-리셋 테스트 포착 /
  배너·쓰기 순서 되돌림 → 쓰기실패 테스트 포착 / 채널 고정(항상 stderr) → 채널 테스트 포착.
- 수동 e2e: PLAN 2회 degrade 후 REVIEW 차단 → streak **보존**(2), 이후 PLAN 재도달 시 3 으로 증가.
