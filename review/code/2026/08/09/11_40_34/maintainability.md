# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 테스트 클래스가 이 스위트의 확립된 `*Test` 접미사 네이밍 컨벤션을 따르지 않음
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:55` (`class RequiredCheckSkipJobContract(unittest.TestCase):`)
  - 상세: `.claude/tests/` 하위의 `unittest.TestCase` 서브클래스는 예외 없이 `...Test` 로 끝난다 — `WorkflowStructureTest`, `DetectorTest`, `AgentRegistryTest`, `StopGuardFailOpenTest`, `SuiteLeavesNoRealStateTest`, `ApplyRoutingGuardTest`, `ReviewGateCliTest`, `OneJudgeTest`, `WorkflowWiringTest`, `VerdictComesFromTheGateTest`, `TheGateItselfDoesNotBranchOnCiEnvTest`, `PyYamlPinsAgreeTest`, `BacktrackingTest`, `EnvValueSubpatternSharedTest`, `UndecodableGitOutputTest` 등 실제로 grep 한 약 50개 클래스 전부(리포지토리 전체 컨벤션). 이번 PR 로 새로 추가된 `RequiredCheckSkipJobContract` 만 접미사 `Test` 가 없다. 동작에는 영향이 없다(`unittest discover` 는 파일명 패턴 `test_*.py` 로 수집하지 클래스명을 보지 않는다) 순수 네이밍 일관성 문제다.
  - 제안: `RequiredCheckSkipJobContractTest` 등으로 리네임해 기존 컨벤션에 맞춘다.

- **[INFO]** `changes` 잡의 보일러플레이트가 두 워크플로 파일에 구조적으로 중복됨
  - 위치: `.github/workflows/deps-security-checks.yml` (전체 파일 컨텍스트 기준 40~67행, `changes:` 잡) / `.github/workflows/frontend-checks.yml` (전체 파일 컨텍스트 기준 27~49행, `changes:` 잡)
  - 상세: `actions/checkout@v7` + `fetch-depth: 0` + `id: detect` 스텝 + `env: PR_BASE_SHA/PR_HEAD_SHA` + `scripts/ci-paths-changed.sh` 호출 구조가 두 파일에 거의 동일하게(파라미터인 pathspec 목록만 다르고) 복제돼 있다. `test_required_check_skip_jobs.py` 의 `CONVERTED` 리스트 주석("새로 전환할 때마다 여기 추가한다")은 이 패턴이 앞으로 더 많은 워크플로에 적용될 것을 예고하므로, 현재는 2곳(≈15줄×2)이지만 세 번째 워크플로가 전환되면 3곳으로 늘어난다. 이 저장소는 "같은 정보가 두 곳에 복제된" 클래스의 결함(`paths:` 목록 중복 등)을 반복해 겪었다는 점이 같은 파일의 자체 주석에 인용돼 있다.
  - 제안: 현재 2개뿐이라 즉시 추출이 필수는 아니다(과도한 조기 추상화 위험도 있음). 다만 세 번째 워크플로가 이 패턴을 채택하는 시점에는 `workflow_call` 재사용 워크플로(pathspec 목록을 입력으로 받고 `relevant` 를 출력하는 공용 `changes` 잡)로 추출하는 것을 고려하라.

- **[INFO]** 스텝마다 `if: needs.changes.outputs.relevant == 'true'` 조건 문자열이 반복됨 (조치 불요, 참고용)
  - 위치: `.github/workflows/deps-security-checks.yml` (예: 79, 81, 85, 89, 102, 104, 106, 113, 126, 128, 130, 134, 138, 145행) / `.github/workflows/frontend-checks.yml` (예: 61, 65, 68, 78, 82, 89행)
  - 상세: 동일한 조건 문자열이 스텝마다 반복된다(deps-security-checks.yml 8회, frontend-checks.yml 5회). GitHub Actions 가 스텝 그룹 단위 조건·매크로를 지원하지 않아 구조적으로 불가피하며, 잡 레벨 `if:` 를 쓰지 않는 이유("skipped 잡의 conclusion 이 required check 를 만족하는지 문서상 모호함")도 스크립트·워크플로 주석에 이미 명시돼 있다. `.claude/tests/test_workflow_yaml_structure.py` 의 `test_step_conditions_are_registered`(및 새로 추가된 `_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP` 상수 매칭)와 `test_required_check_skip_jobs.py` 의 `test_every_step_is_gated` 가 "if: 하나 빠뜨림" 회귀를 정확히 잡도록 이미 대응돼 있어 실질적 위험은 낮다.
  - 제안: 조치 불요. 참고 기록으로만 남긴다.

## 요약

이번 변경은 required status check 데드락 회피를 위한 skip-job 패턴 도입으로, 신규 스크립트(`scripts/ci-paths-changed.sh`)는 가드절(guard clause) 스타일로 중첩 없이 깔끔하게 작성됐고, 신규/확장된 테스트(`test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`)는 기존 레지스트리 기반 가드 패턴과 잘 정렬되며 각 회귀 시나리오(paths 부활·if 누락·needs 누락)를 명확한 이름의 테스트로 분리해 가독성이 높다. README 카탈로그 갱신도 기존 표 형식을 그대로 따른다. 실질적 결함은 없고, 유일하게 눈에 띄는 것은 신규 테스트 클래스 하나가 이 스위트 전체에 예외 없이 적용되는 `*Test` 접미사 컨벤션을 따르지 않는다는 점(WARNING)이며, 나머지는 GitHub Actions 플랫폼 제약에서 기인하는 구조적 중복으로 이미 문서화·테스트로 방어돼 있어 조치 우선순위가 낮다.

## 위험도

LOW
