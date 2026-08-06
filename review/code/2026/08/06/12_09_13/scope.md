# 변경 범위(Scope) 리뷰 — CI 백스톱 라운드 7

대상: `origin/main...HEAD` (9개 파일, `+1250/-23`). 커밋 `a8138aafd`(feat 본체) ~
`2eca6270d`(6R 픽스) 전체 누적분. 티켓: `plan/in-progress/harness-review-gate-ci-backstop.md`
(리뷰 게이트의 훅-독립 CI 백스톱).

## 방법

프롬프트가 잘라 보여준 `.claude/tests/README.md`는 `Read`로 직접 열었고, 9개 파일 전부에
대해 `git diff origin/main...HEAD -- <path>`로 실제 diff를 대조해 "전체 파일 컨텍스트"로
표시된 파일이 신규 추가인지 기존 파일 확장인지, 그리고 그 확장이 이 티켓의 의도(리뷰 게이트
CI 백스톱)에 속하는지를 판정했다. `codebase/**` 등 애플리케이션 코드 변경은 diff에 없음을
`git diff --stat`로 확인했다.

## 발견사항

- **[INFO]** `test_workflow_yaml_structure.py` 확장분 5개 신규 검사(`continue-on-error`
  전역 등재제, job/step `if:` 등재제, `pull_request` 키 집합 등재제, 워크플로/job identity
  유일성, 스위트 호출 명령 고정)가 README에 반영되지 않음
  - 위치: `.claude/tests/README.md:44` (해당 파일 설명 테이블 행)
  - 상세: 이 PR은 `test_workflow_yaml_structure.py`를 161줄→360줄로 확장했다(diff:
    `.claude/tests/test_workflow_yaml_structure.py` `+199/-0`, 기존 클래스 뒤에 이어붙임).
    그런데 README의 해당 행은 여전히 "중복 매핑 키·`run`/`uses` 단일성" 두 불변식만
    설명하고, 새로 추가된 다섯 개 검사(`test_no_guard_workflow_swallows_its_own_failure`,
    `test_job_conditions_are_registered`, `test_step_conditions_are_registered`,
    `test_pull_request_trigger_shape_is_registered`,
    `test_workflow_and_job_identities_are_unique`,
    `test_the_harness_suite_is_invoked_over_every_test_file`)는 언급이 없다. 같은 PR이
    `test_review_gate_ci.py`용으로는 매우 상세한 신규 행(README:48)을 추가한 것과 대비된다.
    이 저장소는 `.claude/tests/README.md`를 "정책/의도"의 SoT로 명시하고
    (`review-gate.yml`/`check-review-gate.py` 자신의 주석이 그렇게 인용한다), 이 파일이 왜
    지금 모양인지 다음 사람이 README만 보고 오판할 여지가 생긴다. 게이트 판정 자체에는
    영향 없음 — 문서 완결성 문제.
  - 제안: `test_workflow_yaml_structure.py` 행에 5개 신규 불변식 요약을 추가하거나, 최소한
    "6R에서 continue-on-error/if/pull_request-key/identity 등재제가 추가됨"을 한 문장으로
    덧붙인다.

- **[INFO]** `test_block_integrity.py`의 `PlanStubsMirrorTheRealInterfaceTest` 수정은
  이 티켓의 표제(CI 백스톱)와 직접 관련은 없으나, 근거가 문서화돼 있고 방향이 강화(약화 아님)
  이므로 스코프 이탈로 분류하지 않음 — 확인 목적의 기록
  - 위치: `.claude/tests/test_block_integrity.py:690-703` (기존 프롬프트 게이트 기준)
  - 상세: `join("".join(stubs))` 방식이던 검사를 스텁별 개별 검사로 바꿨다. 커밋 메시지/인라인
    주석이 "라운드 7에서 새 스텁 파일이 늘며 실제로 두 번째 스텁이 `push_blocks`를 빠뜨린
    경우가 발견됐다"는 근거를 남겼고, `test_stop_guard_failopen.py`에 대응하는 `push_blocks`
    추가(같은 diff 세트)가 그 근거를 실측으로 뒷받침한다. 즉 이 파일 밖으로 번진 변경이지만
    라운드 7이 새로 만든 스텁 형태(여러 개 stub 리터럴을 가진 새 테스트 파일들)가 기존 전역
    가드의 사각을 드러낸 데 따른 필연적 파급이며, 검사를 완화하는 방향이 아니라 엄격화하는
    방향이다. 별도 리팩토링이나 기능 확장이 아님.
  - 제안: 없음(기록용). 다만 다음 라운드에서 이 파급을 "이 티켓과 무관"이라며 되돌리지
    않도록 커밋 메시지에 남겨진 근거를 유지할 것.

- **[INFO]** `.github/workflows/harness-checks.yml`의 `paths:` 등재 확장 —
  `scripts/check-review-gate.py` 1줄 추가 + 주석 갱신은 정확히 필요한 만큼만
  - 위치: `.github/workflows/harness-checks.yml` (paths 목록, `scripts/check-review-gate.py`
    항목)
  - 상세: 신규 스크립트가 harness 스위트(`test_review_gate_ci.py`)의 대상이 되므로 단독
    수정 시에도 CI가 돌아야 한다는 논리가 명확하고, 기존 6개 사례와 동일한 실패 클래스로
    문서화돼 있다. 범위 이탈 아님.

## 스코프 밖으로 확인된 항목 (문제 없음)

- `codebase/**`(애플리케이션 코드) 변경 0건 — `git diff --stat`로 확인.
- `.github/workflows/` 아래 `review-gate.yml`(신규)·`harness-checks.yml`(paths/주석)만
  변경. 6R 히스토리가 우려한 "동일 `name:`/job id를 참칭하는 제3의 워크플로 추가"는 없음 —
  `test_workflow_yaml_structure.py::test_workflow_and_job_identities_are_unique`가 저장소
  전체 9개 워크플로에 대해 이를 이미 고정하고 있고, 실제로 신규 워크플로 파일은
  `review-gate.yml` 하나뿐.
- `scripts/check-review-gate.py`(신규): import·호출 표면이 같은 PR의
  `OneJudgeTest._ALLOWED_IMPORTS`/`_ALLOWED_CALLS`와 정확히 일치 — 스크립트가 선언한
  범위를 스스로 벗어나지 않음(대입/속성 재바인딩/환경 접근 없음, 직접 코드 대조로 확인).
  기능 확장(예: 자체 판정 로직 재구현)의 흔적 없음.
  - `plan/in-progress/harness-review-gate-ci-backstop.md`: 진행 이력·라운드별 우회 표·마찰
    실측 갱신 — 해당 in-progress plan 문서 자체이므로 범위 내. 별도 "## 체크리스트" 절이
    없어 본문 체크박스와의 이중 관리 이슈(과거 반복된 실패 패턴)는 해당 없음.
  - 포맷팅/주석/임포트: 확인한 모든 diff hunk에서 실질 변경과 무관한 공백·개행 재배치,
    장식적 주석 추가, 미사용 임포트를 찾지 못했다. 모든 신규 주석은 "왜 이렇게 됐는가"를
    설명하는 근거 주석이며 이 저장소의 기존 밀도 높은 인라인-근거 관행과 일치한다.

## 요약

9개 파일 diff(`+1250/-23`) 전체를 대조한 결과, 이번 라운드(누적 1R~6R)의 변경은 "리뷰 게이트의
훅-독립 CI 백스톱과 그 배선을 우회 불가능하게 만든다"는 티켓 표제에서 벗어나지 않는다.
`test_block_integrity.py`·`test_stop_guard_failopen.py`·`test_workflow_yaml_structure.py`에
대한 파급 수정은 표제 파일(`test_review_gate_ci.py`/`review-gate.yml`/
`check-review-gate.py`) 밖으로 번지지만, 전부 라운드 7이 새로 만든 스텁·워크플로 형태가
기존 전역 가드의 사각을 드러낸 데 따른 필연적 강화이며 근거가 커밋/주석에 남아 있다. 애플리케이션
코드(`codebase/**`) 변경은 전혀 없고, 우려됐던 "제3의 워크플로 참칭" 같은 스코프 밖 추가도
없다. 유일한 흠은 `test_workflow_yaml_structure.py`에 추가된 5개 신규 불변식이
`.claude/tests/README.md`의 해당 행에 반영되지 않은 문서 완결성 갭으로, 판정 로직에는
영향이 없는 INFO 수준이다.

## 위험도

LOW
