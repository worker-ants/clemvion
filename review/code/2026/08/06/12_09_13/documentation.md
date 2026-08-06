# 문서화(Documentation) Review

리뷰 대상: `.claude/tests/README.md`, `test_block_integrity.py`, `test_review_gate_ci.py`,
`test_stop_guard_failopen.py`, `test_workflow_yaml_structure.py`,
`.github/workflows/{harness-checks,review-gate}.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`
(CI 백스톱 6R/round 7, `origin/main...HEAD`).

## 발견사항

- **[CRITICAL]** `test_workflow_yaml_structure.py` 의 모듈 docstring이 "Two invariants" 라고
  선언하는데, 실제로 이 클래스(`WorkflowStructureTest`)가 지금 강제하는 불변식은 최소 8개다.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:16` ("Two invariants, both cheap:")
  - 상세: 이 docstring 은 2026-08-01 중복 키 사고 때 작성된 그대로다("Why this exists...
    Two invariants, both cheap: 1. no duplicate keys ... 2. every step has exactly one of
    run/uses"). 그런데 같은 클래스 안에 이후 라운드에서 추가된 테스트가 이미 6개 더 있다 —
    `test_no_guard_workflow_swallows_its_own_failure`(`continue-on-error` 전역 금지,
    `test_workflow_yaml_structure.py:139`), `test_job_conditions_are_registered`(job `if:`
    등재제, `:204`), `test_step_conditions_are_registered`(step `if:` 등재제, 이번 라운드 신규,
    `:223`), `test_pull_request_trigger_shape_is_registered`(`pull_request` 키 집합 등재제,
    이번 라운드 신규, `:259`), `test_workflow_and_job_identities_are_unique`(워크플로/job
    identity 유일성, 이번 라운드 신규, `:281`), `test_the_harness_suite_is_invoked_over_every_test_file`
    (하네스 스위트 호출 명령 고정, `:306`). 즉 "why this exists" 헤더가 파일의 실제 방어 범위를
    2.5배 이상 축소해서 서술한다. 아이러니하게도 이 저장소는 바로 이 실패 클래스를 스스로
    경고해 왔다 — `.claude/tests/README.md` 는 PyYAML 예외 단락에서 "count in prose goes stale
    the next time one is added, which is how this paragraph was wrong" 라며 프로즈 개수 표기를
    의도적으로 피하는데, 같은 원칙이 이 파일 자신의 모듈 docstring 에는 소급 적용되지 않았다.
    이 파일은 리뷰 가드 CI 우회를 라운드마다 한 층씩 막아 온 보안 하드닝 파일이라, "이 파일이
    무엇을 막는지" 를 헤더만 보고 판단하는 다음 작업자(새 워크플로 추가 시 무엇을 지켜야 하는지
    확인하러 오는 사람)를 오도할 수 있다.
  - 제안: "Two invariants" 를 "여러 불변식(구조 + CI 배선)" 처럼 개수에 의존하지 않는 문구로
    바꾸거나, 최소한 아래 5개 클래스 추가 시마다 갱신해야 한다는 점을 헤더에 명시. 이상적으로는
    `harness-checks.yml` 상단 주석이 이미 채택한 패턴("Which suites is deliberately not
    enumerated here — the list grew the same week it was written")을 재사용해 개수 자체를
    적지 않는 편이 이 파일의 성장 속도에 더 안전하다.

- **[WARNING]** `.claude/tests/README.md` 의 `test_review_gate_ci.py` 카탈로그 행이 "Four
  properties pinned" 라고 선언한 뒤 그 네 개(One judge / Observation by default / Fail-open /
  Advisories are verdict-independent)와 `WorkflowWiringTest`, `VerdictComesFromTheGateTest`
  만 서술하고, 파일에 실제로 존재하는 세 개의 테스트 클래스를 통째로 누락한다.
  - 위치: `.claude/tests/README.md:48`
  - 상세: 누락된 클래스는 `TheGateItselfDoesNotBranchOnCiEnvTest`(게이트 본체가 CI 환경으로
    갈라지지 않는지 — 이번 라운드에 신규 추가), `ReviewArtifactsStayTrackedTest`(이 백스톱
    전체가 서 있는 전제 — `review/**` 가 git 추적됨), `PyYamlPinsAgreeTest`(세 워크플로의
    pyyaml pin 일치). 특히 `TheGateItselfDoesNotBranchOnCiEnvTest` 는 이 라운드(6R)에 새로
    생긴, 등재제 방식의 load-bearing 안전장치인데 README 에는 아무 흔적이 없다. 이 저장소는
    `test_tests_readme_catalog.py` 로 "행이 존재하는가" 는 강제하지만 "행 내용이 실제 클래스
    커버리지를 다 반영하는가" 는 아무것도 강제하지 않아서, 이런 부분 누락은 조용히 통과한다.
  - 제안: 세 클래스에 대한 한두 문장씩을 행에 추가. 특히 `TheGateItselfDoesNotBranchOnCiEnvTest`
    는 "판정자는 하나" 주장이 `check-review-gate.py` 뿐 아니라 `review_guard.py` 자체에도
    적용된다는 6R 의 핵심 교훈이라 우선순위가 높다.

- **[WARNING]** `.claude/tests/README.md` 의 `test_workflow_yaml_structure.py` 카탈로그 행이
  2026-08-01 중복 키 사고(중복 매핑 키 + `run`/`uses` 정확히 하나)만 서술하고, 이후 라운드에서
  같은 파일에 추가된 5개 불변식(위 CRITICAL 항목과 동일 목록: `continue-on-error` 전역 금지,
  job/step `if:` 등재제, `pull_request` 키 집합 등재제, 워크플로/job identity 유일성, 하네스
  스위트 호출 명령 고정)을 전혀 언급하지 않는다.
  - 위치: `.claude/tests/README.md:44`
  - 상세: 위 CRITICAL 항목(파일 자신의 모듈 docstring)과 같은 근본 원인 — 파일이 여러 라운드에
    걸쳐 성장했는데 그 성장을 반영하는 문서 갱신 지점이 두 군데(모듈 docstring, README 행) 다
    비어 있다. `test_workflow_yaml_structure.py` 는 이 PR 의 리뷰 게이트 CI 백스톱을 지키는
    핵심 방어선 중 하나인데, README 의 "What's covered" 표만 보고 이 파일의 역할을 판단하는
    사람은 review-gate.yml 워크플로 트리거 형태·조건부 실행·identity 유일성이 지켜지고 있다는
    사실 자체를 모른다.
  - 제안: 위 CRITICAL 항목의 수정과 함께 처리 — 모듈 docstring 을 고치면서 README 행도 같은
    목록으로 갱신할 것. 두 자리를 같은 커밋에서 동시에 고치지 않으면 다음 라운드에 또 한쪽만
    갱신되는 패턴(이 PR 자체가 방금 그 실패를 낸 예시, 아래 참조)이 반복된다.

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §배선 가드 소제목이
  "네 라운드에 걸친 경화 이력" 이라고 쓰는데, 바로 아래 표는 이 라운드에 추가된 5R·6R 행까지
  포함해 이미 6개 라운드를 나열한다 — 소제목과 표가 같은 문단 안에서 서로 모순된다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:20` (소제목) vs `:26`-`:33` (1R~6R 표)
  - 상세: 이번 diff 는 같은 파일 상단 요약 표의 "배선 가드 경화" 행은 "1R~4R 진행 중" →
    "1R~6R 진행 중" 으로 정확히 갱신했다(`:18`). 그런데 몇 줄 아래 §배선 가드 절의 소제목
    문구("네 라운드에 걸친")는 그대로 남았다 — 같은 커밋 안에서 두 곳 중 한 곳만 고치는,
    이 저장소가 harness 코드 쪽에서 반복적으로 겪었다고 스스로 기록한 바로 그 실패 형태다
    (`test_block_integrity.py` 의 "한 인스턴스만 고치고 나머지는 남기는" 주석·
    `README.md` 의 "손-동기 쌍은 드리프트한다" 코멘트 등, 이 PR 자신의 다른 파일들이 정확히
    이 클래스의 버그를 여러 번 언급한다).
  - 제안: "네 라운드" → "여섯 라운드" 로 갱신하거나, 위 harness-checks.yml 패턴처럼 라운드
    수를 프로즈에 아예 안 적는 문구("여러 라운드에 걸친 경화 이력")로 바꿔 다음 라운드에
    또 갱신을 잊는 경로를 막을 것.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 상단 배너의 "본 티켓의
  주제(CI 백스톱)는 여전히 미착수이며 설계 결정이 선행이다" 문장이, 두 줄 아래 같은 표의
  "CI 백스톱 본체 | ~~미착수~~ → 2026-08-01 구현 완료 (관측 모드)" 행과 즉시 모순된다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:10`
  - 상세: 이 문장은 이번 diff 이전(2026-07-31)부터 있던 것으로, 이번 라운드가 만든 결함은
    아니다. 취소선으로 즉시 정정되는 이 저장소의 관행(정정을 지우지 않고 옆에 덧붙이는 방식)과
    일치하는 패턴이라 심각하지는 않지만, 표 윗줄만 읽는 독자에게는 여전히 오도 소지가 있다.
  - 제안: 급하지 않음. 다음에 이 배너를 손댈 때 상단 문장도 함께 정리(예: "CI 백스톱은
    구현 완료했고 남은 것은 §배선 가드 경화와 enforce 전환 결정뿐이다" 로 교체) 권장.

## 요약

이번 라운드(CI 백스톱 6R)에서 코드/워크플로/YAML 가드 쪽의 인라인 주석·docstring 은 전반적으로
매우 높은 품질이다 — `scripts/check-review-gate.py`, `test_review_gate_ci.py`,
`review-gate.yml`, `harness-checks.yml` 모두 "왜" 를 설명하고 이전 라운드에 어떤 우회가 있었는지
정확히 기록하며, `harness-checks.yml` 상단 주석은 "두 가드" → "세 가드" 로 개수까지 정확히
동기화했다. 문제는 그 반대편 축이다: `test_workflow_yaml_structure.py` 라는 핵심 CI 하드닝
파일이 여러 라운드에 걸쳐 8개 불변식으로 성장했는데, 그 파일 자신의 모듈 docstring("Two
invariants")과 `.claude/tests/README.md` 카탈로그 행(`test_workflow_yaml_structure.py`,
`test_review_gate_ci.py` 둘 다) 이 그 성장을 따라가지 못했다. `test_tests_readme_catalog.py`
는 "행이 존재하는가" 만 강제하고 "행 내용이 최신인가" 는 강제하지 않기 때문에 이런 부분 누락이
조용히 쌓인다. plan 문서에서도 같은 클래스의 작은 사고(소제목 "네 라운드"가 6R 표와 불일치)가
같은 커밋 안에서 발생했다 — 두 자리 중 한 곳만 고친 패턴이다. 전부 기능·보안에는 영향이 없는
순수 문서 드리프트지만, 이 파일들이 정확히 "CI 우회가 다음에 어디로 이동할지" 를 다음 사람이
판단하는 참고 자료라는 점에서 방치하면 누적 비용이 커진다.

## 위험도

MEDIUM
