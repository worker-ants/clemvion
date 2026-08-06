# 유지보수성(Maintainability) Review

리뷰 대상: 리뷰 게이트의 훅-독립 CI 백스톱 (round 6) — `.github/workflows/{harness-checks,review-gate}.yml`,
`scripts/check-review-gate.py`, `.claude/tests/{README.md,test_block_integrity.py,test_review_gate_ci.py,
test_stop_guard_failopen.py,test_workflow_yaml_structure.py}`, `plan/in-progress/harness-review-gate-ci-backstop.md`.

이 라운드의 목적(정적 회피가 매번 뚫려 전량 일치 + 행위 테스트로 반전)은 코드에 그대로 반영돼 있고,
그 자체는 타당한 설계다. 아래 발견사항은 그 설계를 뒤집으라는 게 아니라, 이번에 새로 생긴/누적된
가독성·중복·결합도 비용을 표시한 것이다. `scripts/check-review-gate.py` 본체는 짧고 단일 책임이라
문제를 찾지 못했다 — 발견사항은 대부분 테스트 스위트와 문서 쪽에 있다.

## 발견사항

- **[WARNING]** 스텁 fixture `_CLEAN_PLAN` 소스 문자열이 두 파일에 바이트 단위로 중복된다
  - 위치: `.claude/tests/test_stop_guard_failopen.py:52` (`.claude/tests/test_block_integrity.py:383`
    의 `NotesReachBothHooksTest._CLEAN_PLAN` 과 글자 그대로 동일)
  - 상세: 두 `_CLEAN_PLAN` 리터럴(`class _P: ... def evaluate_plan(): return _P()`)이 완전히 같은
    텍스트다. `test_stop_guard_failopen.py:56-59` 의 주석 자체가 "`push_blocks` 를 빠뜨리는 실패가
    `test_block_integrity.py` 에서 이미 한 번 일어났고 그 뒤에도 조용히 통과했다"고 적어, 같은 버그가
    두 파일에서 독립적으로 재발했음을 이 코드 스스로 증언한다. 그런데 고친 결과(올바른 스텁)를
    공유 상수로 승격하지 않고 다시 각자 손으로 타이핑해 두었다 — 다음에 `PlanDecision` 인터페이스가
    바뀌면(`push_blocks` 외 필드 추가 등) 최소 이 두 곳을 手동 동기화해야 한다.
    `PlanStubsMirrorTheRealInterfaceTest`(`test_block_integrity.py`)가 "필드 누락"은 잡아주지만
    "중복 자체"는 막지 않는다.
  - 제안: `_harness.py` 에 `CLEAN_PLAN_STUB_SRC` 같은 공유 상수(또는 `clean_plan_stub()` 헬퍼)로
    승격해 두 파일이 import 하게 하면, 향후 인터페이스 변경 시 한 곳만 고치면 된다.

- **[WARNING]** `OneJudgeTest.test_the_import_and_call_surface_stays_small` 가 ~100줄, 7가지
  독립적 검사를 한 테스트 메서드에 누적하고 있다
  - 위치: `.claude/tests/test_review_gate_ci.py:265-366`
  - 상세: import 허용목록 검사 → 지역 별칭 해석 → call 허용목록 검사 → `getattr` 모듈 우회 검사 →
    속성 대입(재바인딩) 금지 → `environ`/`getenv`/`argv`/`putenv` 접근 금지 → `evaluate_review`
    존재 확인, 서로 다른 6~7개의 성질이 한 함수 안에 순서대로 나열돼 있다. 각 라운드마다 새 검사가
    "여기 추가"되는 형태로 자라 왔고(docstring 이 스스로 "4번 뚫렸다"고 적음), 함수가 계속 길어지는
    추세다. 실패 메시지는 각 검사마다 붙어 있어 원인 파악 자체는 되지만, 한 함수가 서로 무관한
    다수 책임을 지는 형태라 다음 라운드에 8번째 검사가 또 이 함수 끝에 붙을 가능성이 높다.
  - 제안: 검사 단위로 `_assert_import_allowlist(tree)` / `_assert_call_allowlist(tree, alias_of)` /
    `_assert_no_attribute_rebinding(tree)` / `_assert_no_environ_access(tree)` 같은 private 헬퍼로
    쪼개고, 테스트 메서드는 그것들을 순서대로 호출하는 얇은 오케스트레이터로 남긴다. 저자의 의도
    ("이 전부가 하나의 좁은 성질이다")를 해치지 않으면서 각 검사의 경계를 코드로도 드러낼 수 있다.

- **[WARNING]** `_ALLOWED_CALLS` 허용목록이 스크립트의 지역 변수 이름(`ap`)에 결합돼 있다
  - 위치: `.claude/tests/test_review_gate_ci.py:243` (`"ap.add_argument", "ap.parse_args"`)
    ↔ `scripts/check-review-gate.py:81` (`ap = argparse.ArgumentParser(...)`)
  - 상세: `OneJudgeTest._dotted` 의 별칭 등록(`alias_of`)은 `Assign` 우변이 `Attribute`/`Name`
    체인일 때만 동작한다(`test_review_gate_ci.py:249-263`). `ap = argparse.ArgumentParser(...)`
    의 우변은 `Call` 이라 이 조건에 안 걸리므로 `ap` 는 별칭으로 등록되지 않고, 허용목록의
    `"ap.add_argument"` 는 실제로는 스크립트의 지역 변수명 `ap` 를 문자 그대로 고정한 것이다.
    즉 `check-review-gate.py` 에서 가독성을 위해 `ap` → `parser` 로 리네임만 해도(의미 변화
    없음) 이 테스트가 "허용되지 않은 호출 `parser.add_argument`" 로 실패하고, 그 실패 메시지는
    "판정을 재구현하면 로컬/CI 가 갈린다"고 말해 실제로는 무관한 리네임을 재구현 위험처럼
    보이게 한다.
  - 제안: `Assign` 의 우변이 `argparse.ArgumentParser(...)` 호출인 경우도 `alias_of` 에 등록하거나
    (타입 기준 판별), 최소한 `_ALLOWED_CALLS` 옆에 "이 두 항목은 스크립트의 실제 지역 변수명과
    결합돼 있다 — 리네임 시 여기도 함께 고칠 것" 주석을 남겨 다음 사람이 놀라지 않게 한다.

- **[INFO]** `README.md` 의 참조표 셀 하나에 문단 단위 산문이 들어가 "빠른 참조표" 목적과 충돌한다
  - 위치: `.claude/tests/README.md:48` (`test_review_gate_ci.py` 행이 가장 극단적 — 500단어 이상)
    — 참고로 `:43`(`test_override_floors.py`), `:77`(`test_block_integrity.py`) 도 유사한 밀도
  - 상세: `## What's covered` 표는 파일당 한눈에 훑는 요약을 의도하는데, 48행 셀 하나가 4라운드
    우회 역사·행위 테스트의 4-조합 논증까지 통째로 담고 있다. 같은 내용은 이미
    `test_review_gate_ci.py` 자신의 모듈 docstring(`test_review_gate_ci.py:1-23`)과
    `OneJudgeTest`/`WorkflowWiringTest`/`VerdictComesFromTheGateTest` 각 클래스 docstring에도
    실려 있어(사실상 3중 서술), 표 자체가 요약이 아니라 두 번째(세 번째) 전문이 됐다.
  - 제안: 표 셀은 1~2문장으로 압축("hook-독립 CI 백스톱. 판정자 단일성은 행위 테스트로,
    배선은 워크플로 전체 리터럴 일치로 고정")하고, 라운드별 우회 이력 같은 서사는 해당 테스트
    파일의 docstring 한 곳만 SoT 로 유지한다. 이 저장소가 이미 기록한 "손 동기화 쌍은 drift
    한다" 교훈을 표-문서 관계에도 적용하는 셈이다.

- **[INFO]** `WorkflowWiringTest.EXPECTED` 가 `review-gate.yml` 전체를 두 번째 진실(Python
  literal)로 유지한다 — 의도된 트레이드오프이지만 상호 참조가 한쪽에만 있다
  - 위치: `.claude/tests/test_review_gate_ci.py:396-432`(`EXPECTED`) ↔
    `.github/workflows/review-gate.yml` 전체
  - 상세: 문서 전체 정확 일치는 4라운드 우회를 막기 위한 의도된 설계이고 docstring
    (`test_review_gate_ci.py:369-393`)에 충분히 설명돼 있으며, `test_the_expectation_still_
    describes_a_gate_that_runs`(`:451-485`)가 "기대값 자체가 게이트를 끄는 모양으로 함께
    바뀌는" 위험도 부분적으로 완화한다. 다만 정당한 배선 변경(예: 새 step 추가)마다 두 파일을
    손으로 동기화해야 하는 비용은 구조적으로 남는다. 확인해보니 `review-gate.yml` 쪽에는
    이 테스트를 가리키는 역참조 주석이 없다(`grep` 결과 0건) — 워크플로 파일만 먼저 고치는
    사람이 이 테스트의 존재 자체를 모를 수 있다.
  - 제안: `review-gate.yml` 상단 주석에 "이 워크플로의 배선은
    `.claude/tests/test_review_gate_ci.py::WorkflowWiringTest.EXPECTED` 와 정확히 일치해야
    한다"는 한 줄을 추가해 상호 참조를 양방향으로 만든다. (구조 변경 제안 아님 — 현재 설계는
    유지하되 drift 예방 비용을 낮추는 최소 조치.)

- **[INFO]** `WorkflowStructureTest` 내부 레지스트리 상수가 테스트 메서드 사이사이에 흩어져
  선언돼 있다
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:123-127`(`_SWALLOWS_FAILURE`),
    `:183-189`(`_JOB_CONDITIONS`) — 둘 다 앞뒤로 빈 줄 2개(더블 블랭크)로 구분
  - 상세: `_SWALLOWS_FAILURE`/`_MAY_SWALLOW`/`_JOB_CONDITIONS`/`_SUITE_COMMAND` 네 레지스트리가
    테스트 메서드들 사이에 하나씩 끼워져 있어, "이 클래스가 지금 등재하고 있는 예외·조건이
    총 몇 개인지"를 한눈에 보기 어렵다. 이중 빈 줄도 PEP8 관례(클래스 본문 내부 단일 빈 줄)와
    다르다. 라운드마다 하나씩 늘어난 이력이 반영된 결과로 보이며 기능에는 영향 없다.
  - 제안: 클래스 상단에 네 레지스트리를 모아 선언하고 메서드는 그 아래로 이어 붙이면, 새 라운드가
    상수를 추가할 자리도 명확해지고 현재 등재 개수도 한눈에 파악된다. 빈 줄은 표준(단일 줄)으로
    정리.

## 요약

`scripts/check-review-gate.py` 본체는 단일 책임·적정 길이로 깨끗하다. 발견사항은 모두 테스트
스위트와 문서 쪽에 몰려 있으며, 성격은 두 가지로 나뉜다: (1) 4~6라운드에 걸친 "정적 회피 → 뚫림
→ 더 강한 검사"의 누적으로 한 테스트 메서드(`OneJudgeTest`)가 여러 책임을 지게 됐고 그 허용목록이
스크립트의 우발적 구현 세부(지역 변수명)에 결합됐다는 것, (2) 같은 스텁 텍스트가 파일 간에
byte-identical 로 중복돼 있는데도(`_CLEAN_PLAN`) 공유 헬퍼로 승격되지 않았다는 것. 둘 다 코드
자체가 스스로 원인을 주석으로 기록해 둔 만큼 원인 파악은 쉽고, 고치는 비용도 낮다. README 표와
`EXPECTED` 리터럴 항목은 이미 의도된 트레이드오프로 문서화돼 있어 구조를 바꾸라는 제안이 아니라
drift 예방 비용을 낮추는 보완 제안이다. CRITICAL 급 발견은 없다.

## 위험도

LOW
