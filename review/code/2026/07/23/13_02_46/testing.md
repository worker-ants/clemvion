# 테스트(Testing) 리뷰 — `test_guard_review_before_push_main.py`

## 검증 방법

- 실제 `.claude/hooks/guard_review_before_push.py` 와 `_lib/{review_guard,plan_guard}.py` 를 읽고
  테스트의 stub 계약(`ReviewDecision.blocked/reason`, `PlanDecision.untouched/reason/plan_path`)이
  실제 소비 코드(`main()`)가 실제로 읽는 필드와 정확히 일치하는지 대조.
- `python3 -m pytest .claude/tests/test_guard_review_before_push_main.py -q` 실행 → 20건 전원 통과.
- 신뢰 검증을 위해 스크래치 복사본에서 `guard_review_before_push.py` 의 REVIEW/PLAN 게이트 블록
  순서를 실제로 스왑하는 뮤테이션을 적용하고 동일 스위트를 재실행 → 예상대로
  `test_review_gate_precedes_plan_gate`, `test_review_evaluate_exception_fails_open_and_runs_plan`
  2건이 실패로 포착됨(plan 문서의 "게이트 순서 스왑 뮤턴트 포착" 주장과 일치, 원본은 원상복구 불필요 —
  스크래치 복사본에서만 작업 후 삭제).

## 발견사항

- **[INFO]** 페이로드가 valid JSON 이지만 top-level 이 dict 가 아닌 경우(`"[]"`, `"null"`, `"5"`) 미검증
  - 위치: `test_guard_review_before_push_main.py` — `test_malformed_stdin_json_allows`/`test_empty_stdin_allows` 인근
  - 상세: `_read_payload()` 는 `json.loads(raw)` 결과를 그대로 반환하므로, stdin 이 `"[]"` 처럼 파싱은
    되지만 dict 가 아닌 JSON 이면 `payload.get(...)` 에서 `AttributeError` 로 크래시한다(exit code
    0/2 어느 쪽도 아님). 훅 자신의 계약 주석("any other exit → 호출측이 fail-open 으로 처리")에 따라
    외부적으로는 안전하지만, 현재 테스트는 "malformed JSON" 케이스를 "문법 오류로 파싱 실패"만
    다루고 "파싱은 성공하지만 타입이 틀린 경우"는 다루지 않는다.
  - 제안: `raw_stdin="[]"` / `raw_stdin="null"` 케이스를 추가해 최소한 행 크래시 여부(및 그 exit code)를
    명시적으로 고정(pin)하면 향후 `_read_payload()` 변경 시 회귀를 잡을 수 있다.

- **[INFO]** 두 게이트가 동시에 예외를 던지는 조합(`review="raise", plan="raise"`) 미검증
  - 위치: `test_review_evaluate_exception_fails_open_and_runs_plan` / `test_plan_evaluate_exception_fails_open` 인근
  - 상세: import 실패 조합은 `test_both_gate_imports_fail_allows_the_push` 로 전용 테스트가 있는 반면,
    호출 예외(raise) 조합은 각각 단독으로만 테스트되고 "둘 다 raise" 조합은 없다. 로직상 두 개의
    독립된 fail-open 분기의 AND 이므로 실패 가능성은 낮지만, import-fail 조합과의 대칭성을 위해
    한 줄 추가할 가치가 있다.
  - 제안: `test_both_gates_raise_allows_the_push` 1건 추가(대칭성·완전성 목적, 필수는 아님).

- **[INFO]** `tool_input`/`input` 키 우선순위·빈 dict 폴백 미검증
  - 위치: `main()` 의 `payload.get("tool_input") or payload.get("input") or {}` 소비 테스트
  - 상세: `test_push_via_input_alias_key_is_detected` 는 `input` 만 있는 케이스만 다룬다. 두 키가
    모두 존재할 때 `tool_input` 이 우선하는지, `tool_input`이 빈 dict(`{}`, falsy)일 때 `or` 체인이
    `input` 으로 폴백하는지는 커버되지 않는다. 로직이 단순해 리스크는 낮음.
  - 제안: 선택적으로 `payload={"tool_input": {}, "input": {"command": _PUSH}}` 케이스 1건 추가.

- **[INFO]** stub 데이터클래스가 실제 계약보다 좁음(의도된 것으로 판단, 위험 아님)
  - 위치: `_PLAN_STUB` 의 `_Plan` (실제 `PlanDecision` 은 `complete_but_in_progress` 필드도 가짐)
  - 상세: 실제 `plan_guard.PlanDecision` 은 Stop 가드가 쓰는 `complete_but_in_progress` 필드를 추가로
    갖지만 stub `_Plan` 에는 없다. `guard_review_before_push.py:main()` 은 현재 `.untouched`/`.reason`/
    `.plan_path` 만 읽으므로 지금은 문제가 없고, 향후 `main()` 이 새 필드를 읽게 바뀌면 try/except
    바깥에서 속성 접근이 일어나 `AttributeError` 로 시끄럽게(exit 1) 실패해 자체적으로 drift 를
    잡아낸다(조용한 거짓 통과가 아님) — 그래도 stub 이 실제 계약의 부분집합이라는 점은 유지보수자가
    인지해야 할 암묵적 전제다.
  - 제안: 조치 불필요. stub 근처 주석에 "narrower than the real dataclass; `main()` currently reads
    only these fields" 한 줄을 남기면 다음 사람이 실제 계약과 비교할 때 헤매지 않는다.

## 요약

새 테스트 파일은 plan `harness-guard-followups.md` §D 가 지적한 완전 무검증 진입점(`main()`)의
실질적 갭 — exit code, REVIEW→PLAN 순서, per-gate BYPASS 격리, 3중 fail-open(호출 예외/모듈 import
실패), stdin 파싱 — 을 서브프로세스 e2e 방식으로 빠짐없이 다루며, 각 테스트가 하나의 관측 가능한
계약(순서·격리·fail-open)에 집중해 가독성이 높고 서로 완전히 독립적이다(임시 디렉토리 + 프로세스
경계 + env dict 재구성으로 격리 보장, `BYPASS_*` 는 매 호출마다 명시적으로 pop 후 재설정해 부모 셸
누출도 차단). 직접 재현한 게이트-순서 스왑 뮤테이션이 의도한 2개 테스트를 정확히 실패시켜 plan
문서의 뮤테이션 검증 주장이 최소 1개 클래스에 대해 사실임을 확인했다. 남은 갭은 모두 INFO 등급의
낮은 우선순위 엣지 케이스(non-dict JSON 최상위 값, 동시 이중 raise 조합, tool_input/input 우선순위)
로, 실제 결함이 아니라 완전성 보강 여지이며 이 테스트 추가 자체를 막을 사유는 없다.

## 위험도
LOW
