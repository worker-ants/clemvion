# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `changes` 잡 정의(체크아웃 + `scripts/ci-paths-changed.sh` 호출 wiring)가 두 워크플로에 거의 동일하게 복제됨 — 재사용 추상화 부재
  - 위치: `.github/workflows/deps-security-checks.yml:43-67`, `.github/workflows/frontend-checks.yml:27-49`
  - 상세: 두 파일의 `changes` 잡은 `runs-on`/`timeout-minutes`/`outputs.relevant`/체크아웃(`fetch-depth: 0`)/`detect` 스텝의 `env`(`PR_BASE_SHA`, `PR_HEAD_SHA`) 구조가 pathspec 인자만 다르고 동일하다. `scripts/ci-paths-changed.sh` 로 **판정 로직(비즈니스 로직)** 은 잘 추출·중앙화됐지만(SRP·DRY 준수), 그 로직을 호출하는 **오케스트레이션 wiring(잡 정의)** 자체는 워크플로 파일마다 손으로 복제되고 있다. `.claude/tests/test_required_check_skip_jobs.py` 주석("새로 전환할 때마다 여기 추가한다")이 명시하듯 이 패턴은 앞으로 더 많은 워크플로에 적용될 예정이라, 잡 wiring 복제는 워크플로 수만큼 선형으로 늘어난다.
  - 제안: GitHub Actions 의 reusable workflow(`workflow_call`)로 `changes` 잡 자체를 하나의 파일로 추출하고 `paths` 를 입력으로 받는 방식을 검토. 현재 2개 워크플로만 적용된 상태라 당장 급하지 않지만, 3번째 전환 시점에는 복제 비용이 추상화 비용을 넘어설 가능성이 크다.

- **[WARNING]** 각 잡의 "모든 스텝에 `if: needs.changes.outputs.relevant == 'true'` 부착 + no-op 안내 스텝" 보일러플레이트가 스텝 단위로 반복 — shotgun surgery 위험
  - 위치: `.github/workflows/deps-security-checks.yml` (예: 75-145 구간의 `config-guard`/`audit`/`override-floors` 3개 잡, 스텝마다 반복), `.github/workflows/frontend-checks.yml:56-90`
  - 상세: GitHub Actions 에는 "잡은 항상 success 로 보고하되 스텝만 건너뛴다"는 요구를 표현할 잡-레벨 선언적 수단이 없어, 스텝마다 개별 `if:` 를 붙이는 현재 방식은 이 인프라의 실질적 제약이다. 다만 그 결과로 스텝 하나를 추가할 때마다 `if:` 를 빠뜨리면(회귀 ②) 조용히 무관한 PR 에서도 실행되는 위험이 있고, 이는 `test_every_step_is_gated` 가 잡아내므로 **정적으로는 안전**하다. 그러나 워크플로가 CONVERTED 목록에 계속 추가될수록 (스텝 수 × 잡 수 × 워크플로 수) 만큼 동일 문자열이 반복되는 구조라, "확장성" 관점에서 마찰이 커진다.
  - 제안: 테스트로 안전망은 확보돼 있으므로 시급하지 않으나, 워크플로가 3개 이상으로 늘면 composite action(`.github/actions/skip-job-gate`) 또는 reusable workflow 로 이 패턴 자체를 캡슐화하는 것을 고려. PR 자체 코멘트(`_SKIP_JOB_WORKFLOWS` 근처)에도 "개별 등재는 마찰만 는다"는 동일한 트레이드오프 인식이 있어, 저자들도 이 복제를 의식하고 있다.

- **[WARNING]** 스킵-잡 패턴 적용 대상을 나타내는 두 개의 독립 레지스트리가 서로 바인딩되지 않음
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:40-43` (`CONVERTED` 리스트) vs `.claude/tests/test_workflow_yaml_structure.py:213` (`_SKIP_JOB_WORKFLOWS` 집합)
  - 상세: 두 상수는 "스킵-잡 패턴을 적용한 워크플로 집합"이라는 동일한 도메인 개념을 각각 별도 파일에서 독립적으로 열거한다. 현재는 둘 다 `{"deps-security-checks.yml", "frontend-checks.yml"}` 로 일치하지만, 이를 강제하는 테스트(`assertEqual`)가 없다. 한쪽만 갱신하고 다른 쪽을 빠뜨리는 실수 자체는 — `test_workflow_yaml_structure.py::test_step_conditions_are_registered` 가 개별 스텝 등재 요구로 대신 실패하므로 — **조용히 통과하지는 않는다**(fail-loud). 다만 이 저장소가 반복적으로 겪은 "두 곳에 흩어진 동일 SoT" 클래스(paths 중복, `_lib` 중복, `report_paths`/`retry_state` drift 등, README 에 명시)와 형태가 같아, 근본적으로는 단일 SoT 로 합칠 여지가 있다.
  - 제안: 한쪽을 SoT 로 두고(예: `CONVERTED`) 다른 쪽이 그것을 import 하거나, 최소한 두 집합이 같다는 것을 검증하는 테스트 한 줄을 추가.

- **[INFO]** `changes` 잡의 `env`(`PR_BASE_SHA`/`PR_HEAD_SHA`) 배선이 워크플로-스크립트 간 암묵적 계약이며 테스트로 고정되지 않음
  - 위치: `.github/workflows/deps-security-checks.yml:56-57`, `.github/workflows/frontend-checks.yml:40-41` ↔ `scripts/ci-paths-changed.sh:54-55`
  - 상세: 워크플로의 `detect` 스텝이 `env:` 로 `PR_BASE_SHA`/`PR_HEAD_SHA` 를 채워 넘기는 것이 스크립트와의 유일한 결합점인데, 이 이름들이 일치해야 한다는 계약을 검증하는 테스트가 이번 PR 범위에는 없다(`.claude/tests/test_required_check_skip_jobs.py` 는 스크립트 존재·실행권한·self-reference 문자열만 확인). 이 `env:` 블록이 실수로 삭제돼도 스크립트는 자체 fail-safe 분기("base/head SHA 를 받지 못했다")로 떨어져 `relevant=true` 를 내므로 **정확성 결함은 아니고** 조용한 효율 저하(항상 풀 스캔 실행 = 이 패턴이 없애려던 예전 비용으로 회귀)로만 남는다. 이 저장소는 "게이트가 조용히 안 도는" 실패 클래스에 유난히 민감한 이력이 있어(README, 다수 사례) 대칭적으로 "게이트가 조용히 무의미하게 항상 통과 경로로 빠지는" 이 결합도 기록해 둘 가치가 있다.
  - 제안: 심각도가 낮아 이번 PR 을 막을 사유는 아님. 후속으로 `env:` 존재를 확인하는 스텝 하나를 `test_required_check_skip_jobs.py` 에 추가하면 배선-계약 커버리지가 완결된다.

## 긍정적 설계 포인트 (참고)

- `scripts/ci-paths-changed.sh` 는 "이 pathspec 들 중 변경된 게 있는가"라는 단일 책임만 지고, 어떤 워크플로가 부르는지 알지 못한다(SRP + OCP: 새 워크플로는 스크립트 수정 없이 인자만 바꿔 확장). 이전에는 `on.pull_request.paths` + `on.push.paths` 두 곳에 동일 경로 목록이 중복돼 있었는데(이 저장소가 이미 6번 겪은 "paths 커버리지 갭" 클래스의 온상), 이번 변경으로 경로 목록이 `changes` 잡 하나에만 존재하게 됐다 — SoT 단일화.
- 일반 구조 가드(`test_workflow_yaml_structure.py`)가 스킵-잡 패턴의 두 조건 문자열을 **정확히 일치할 때만** 예외로 인정하고, 오탈자·변형은 개별 등재 경로로 떨어뜨려 실패하게 한 설계(`_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP` 정확 매칭)는 "포괄 예외로 인한 조용한 우회"를 막는 defense-in-depth 로 잘 작동한다.
- fail-safe 방향이 스크립트 전 분기(비-PR 이벤트·SHA 부재·merge-base 실패·diff 실패)에서 일관되게 "검사를 돈다"로 수렴 — 결합도가 낮은 4개의 조기 반환 분기가 모두 같은 방향을 가리켜, 인터페이스 분리·일관된 안전 정책 관점에서 바람직하다.
- 순환 의존성 없음 — 워크플로 → 스크립트의 단방향 결합만 존재.

## 요약

이번 변경은 required status check 데드락을 해소하기 위해 `paths:` 필터를 걷어내고 "판정 로직(스크립트)"과 "오케스트레이션(워크플로 YAML의 changes 잡 + 스텝 게이팅)"을 계층적으로 분리한 설계로, 핵심 비즈니스 로직(경로 관련성 판정)은 SRP·OCP 를 지키며 잘 추출됐고 이전의 이중 `paths:` 목록 중복(반복적으로 사고를 낸 클래스)을 단일 SoT 로 정리했다. 다만 그 판정 로직을 호출하는 잡/스텝 단위 wiring 은 워크플로 파일마다 손으로 복제되는 구조라 "새 워크플로를 이 패턴으로 전환한다"는 명시된 확장 계획 하에서는 복제 비용이 워크플로 수에 비례해 커지며, 이를 나타내는 두 테스트 레지스트리(`CONVERTED`/`_SKIP_JOB_WORKFLOWS`)도 서로 바인딩되지 않은 병렬 SoT 다. 모두 테스트가 조용한 실패를 막고 있어(fail-loud) 당장 병합을 막을 사유는 아니지만, 패턴이 3번째 워크플로로 확산되기 전에 reusable workflow/composite action 추출과 레지스트리 단일화를 검토할 가치가 있다.

## 위험도

LOW
