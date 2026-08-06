# 아키텍처(Architecture) 코드 리뷰 — 리뷰 게이트 CI 백스톱 (Round 7)

## 발견사항

- **[CRITICAL]** 워크플로 "identity" 가드가 실제 GitHub 체크 식별자(job 의 표시 이름)가 아니라 YAML 구조상의 job dict key 만 비교한다 — job `name:` override + `pull_request` 트리거 레지스트리의 non-dict skip 을 결합하면, 등록된 아홉 개 워크플로를 **한 글자도 건드리지 않고** 새 워크플로 파일 하나만 추가해서 `review-gate / gate` 체크를 참칭하는 "always-green" 워크플로를 심을 수 있고, `.claude/tests` 전체가 GREEN 인 채로 통과한다. 실측으로 확인했다(아래 재현 절차).
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:281`(`test_workflow_and_job_identities_are_unique`, `pairs` 키가 `(워크플로 name, job **id**)`) 및 같은 파일 `:295`(`pairs[(name, job)] += 1` — `job` 은 `doc["jobs"]` 의 dict key 이지 job 이 자체 선언하는 `name:` 필드가 아니다) / `.claude/tests/test_workflow_yaml_structure.py:247`(`_PULL_REQUEST_KEYS` 레지스트리) 및 `:265`(`if not isinstance(pr, dict): continue` — `pull_request:` 트리거가 필터 없는 bare 키(YAML 파싱 시 `None`)이면 등재 검사 자체를 건너뛴다).
  - 상세: GitHub Actions 는 non-matrix job 의 체크 이름을 `jobs.<id>.name`(있으면) 아니면 job id(기본값)로 노출하고, required-status-check 는 그 문자열로 매칭한다 — 서로 다른 워크플로가 같은 job 이름을 쓰면 어느 한쪽만 성공해도 체크가 만족되는 것은 GitHub Actions 의 잘 알려진 동작이다. 이 저장소의 `test_workflow_and_job_identities_are_unique` 는 자기 docstring 에서 정확히 이 위협("체크 이름 문자열 매칭")을 지목하지만, 구현은 `job` 을 `doc.get("jobs")` 순회의 **dict key** 로만 취급하고 job 자신의 `name:` override 필드는 한 번도 읽지 않는다. 그래서 job id 를 다르게 두고 `name: gate` 로 override 하면 `pairs[(워크플로name, job_id)]` 충돌이 생기지 않아 통과한다. 여기에 더해, 그 새 워크플로가 `on.pull_request:` 를 **필터 없이**(서브키 없는 bare 트리거 — 모든 PR 이벤트에 무조건 실행되는, 가장 위험한 형태) 선언하면 `_PULL_REQUEST_KEYS` 레지스트리 검사가 `isinstance(pr, dict)` 가 거짓이라는 이유로 등재를 아예 요구하지 않는다(가장 넓은 트리거 형태가 유일하게 검사를 피하는 형태). 두 결함을 조합하면 새 워크플로는 (a) 아무 `paths` 필터 없이 매 PR 마다 즉시 실행되고, (b) `echo` 한 줄로 항상 성공하고, (c) 실제 `review-gate.yml` 의 job(오버라이드 없음 → 표시 이름이 job id `gate`)과 동일한 체크 이름 `gate` 를 보고한다.
    실측(격리된 스크래치 트리, 실 저장소는 미변경):
    ```
    $ cat .github/workflows/ci-status-relay.yml
    name: ci-status-relay
    on:
      pull_request:
    jobs:
      impersonator:
        name: gate
        runs-on: ubuntu-latest
        timeout-minutes: 1
        steps:
          - run: echo "always green, fires on every PR, never touches codebase/**"

    $ python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py' -v
    ...
    test_pull_request_trigger_shape_is_registered ... ok
    test_workflow_and_job_identities_are_unique ... ok
    ----------------------------------------------------------------------
    Ran 12 tests in 0.134s
    OK
    ```
    `test_review_gate_ci.py` 도 이 새 파일을 전혀 스캔하지 않는다(자기 docstring이 명시하듯 `review-gate.yml` 한 파일만 로드). 즉 7라운드에 걸쳐 닫아 온 아홉 워크플로 각각의 내부 필드는 모두 방어됐지만, **"이 저장소에 존재하는 워크플로 파일의 집합" 자체**에는 어떤 화이트리스트도 없다 — 6R 이 "같은 `name:`/job id 를 참칭하는 워크플로 추가"를 막았다고 기록한 바로 그 방어선(`plan/in-progress/harness-review-gate-ci-backstop.md:33`)에 job 자신의 `name:` 필드라는 세 번째 축이 빠져 있다.
  - 제안: (1) `pairs` 의 키를 job dict key 가 아니라 `job.get("name", job_id)` — 즉 GitHub 이 실제로 노출하는 문자열 — 로 바꾼다. (2) `_PULL_REQUEST_KEYS` 의 `if not isinstance(pr, dict): continue` 를 뒤집어, 필터 없는(가장 위험한) `pull_request:` 트리거도 명시 예외 등재를 요구하게 한다. (3) 근본적으로는 `.github/workflows/*.yml` 의 **파일 집합 자체**를 닫힌 화이트리스트로 만들어(신규 파일 추가 = 이 테스트에서 명시 등재 필요) "존재하는 파일들의 필드"가 아니라 "존재할 수 있는 파일들의 집합"을 통제 대상으로 승격하는 편이, 다음 라운드에 또 다른 축(예: `workflow_run`/`workflow_call` 트리거, reusable workflow 참조 등)이 나오는 것을 막는다.

- **[WARNING]** 레지스트리(등재제 화이트리스트) 패턴이 6곳 이상에 독립적으로 산개해 있다 — `_ALLOWED`(env 변수, `test_review_gate_ci.py:600`), `_ALLOWED_IMPORTS`/`_ALLOWED_CALLS`(`test_review_gate_ci.py:239-246`), `_MAY_SWALLOW`(`continue-on-error`, `test_workflow_yaml_structure.py:135`), `_JOB_CONDITIONS`(`:189`), `_STEP_CONDITIONS`(`:197`), `_PULL_REQUEST_KEYS`(`:247`) 가 "워크플로 배선이 조용히 무해해지지 않는다"는 **하나의 불변식**을 서로 다른 축(파일 / 파일+job / 파일+step / 트리거 키집합 / 호출 표면 / env 이름)에서 각자 재구현한다. 각 클래스는 "새 항목이 나타나면 실패하고 사람이 판단"이라는 동일 계약을 갖지만 공유 추상화가 없어, 이번 라운드처럼 한 축의 검사 범위(예: job identity = dict key)가 그 축이 실제로 방어해야 할 대상(job 의 실효 표시 이름)과 미묘하게 어긋나도 그 어긋남 자체를 잡아줄 상위 계층이 없다.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py` (클래스 변수 다수), `.claude/tests/test_review_gate_ci.py:600`
  - 제안: 최소 "등재 키 형태 · 검사 대상 문서 열거 · 미등재 시 실패"라는 공통 골격을 하나의 헬퍼(예: `assert_registered(actual_keys, registry, formatter)`)로 뽑아 각 축이 같은 실패 모드(예: 오늘 발견된 "가장 위험한 형태가 검사 스코프 밖"과 같은 경계조건 누락)를 독립적으로 재발명하지 않도록 한다.

- **[INFO]** `WorkflowWiringTest.EXPECTED`(및 다른 레지스트리들)는 그것이 검증하는 워크플로 파일과 같은 저장소·같은 PR 안에서 함께 편집 가능한 골든파일이다. 이는 테스트가 이미 문서화한 기지의 한계("expectation 과 pin 대상을 함께 고치면 항상 통과")이므로 새 결함으로 보고하지 않지만, 아키텍처적으로는 **정책(무엇이 안전한 배선인가)과 집행(그 배선이 실제로 그런가)이 같은 신뢰 경계 안에 있다**는 사실을 드러낸다. CODEOWNERS 강제나 별도 서명 절차 같은 계층 분리 없이는, harness 스스로도 그것이 지키는 `codebase/**` 코드와 동일한 "리뷰만으로 지켜지는" 신뢰 모델에 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:407`(`WorkflowWiringTest.EXPECTED`)
  - 제안: 조치 불요(범위 밖으로 이미 인지됨). 향후 이 계층을 더 강화하려면 "누가 이 레지스트리들을 수정할 수 있는가"를 코드가 아니라 저장소 정책(CODEOWNERS)으로 별도 방어선에 두는 것을 고려할 수 있다.

## 요약

`scripts/check-review-gate.py` 자신은 판정 로직을 재구현하지 않고 로컬 훅과 동일한 `review_guard.evaluate_review()` 에 위임하는 얇은 어댑터로 남아 있어, 이 저장소가 `report_paths`/`retry_state` 로 겪은 "판정자가 둘로 갈리는" 실패 클래스를 이번엔 피했다는 점은 설계상 견고하다. 그러나 7라운드에 걸쳐 "한 층을 닫으면 우회는 그 밖으로 이동한다"는 패턴이 이번에도 반복된다 — 지금까지의 방어는 전부 **이미 존재하는 아홉 워크플로 파일 각각의 필드**를 대상으로 했고, "새 워크플로 파일을 하나 더 추가한다"는 축은 `test_workflow_and_job_identities_are_unique` 하나만 지키고 있는데, 그 테스트가 사용하는 "identity" 의 정의(YAML job dict key)가 GitHub 이 실제로 매칭에 쓰는 정의(job 의 `name:` 필드, 기본값 job id)와 다르다는 것을 실측으로 확인했다. 여기에 `_PULL_REQUEST_KEYS` 레지스트리가 필터 없는(가장 위험한) `pull_request:` 트리거를 검사 대상에서 제외하는 경계조건까지 겹쳐, 등록된 아홉 파일을 전혀 건드리지 않고 새 파일 하나로 `review-gate / gate` 체크를 참칭할 수 있음을 격리된 스크래치 트리에서 실증했다(`test_workflow_yaml_structure.py` 전체 GREEN 유지). 이는 아키텍처 관점에서 "추상화가 그것이 감싸는 실제 프로토콜(GitHub 의 체크 매칭 규칙)과 어긋난 leaky abstraction"이며, 이 CI 백스톱 계층 전체의 존재 목적(훅의 판정자 사각지대를 훅 밖에서 닫는 것)을 무력화할 수 있는 지점이다. 부차적으로, 같은 불변식을 지키는 6개 이상의 독립 레지스트리가 공유 골격 없이 각자 손으로 유지되고 있어 다음 라운드에도 같은 발견-등재 사이클이 재발할 구조적 소지가 남는다.

## 위험도

CRITICAL
