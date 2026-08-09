# 의존성(Dependency) 리뷰

## 발견사항

- **[WARNING]** skip-job 패턴을 적용받는 워크플로 목록이 두 파일에 독립적으로 존재하고, 둘을 서로 대조하는 테스트가 없다
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:213` (`_SKIP_JOB_WORKFLOWS = {"deps-security-checks.yml", "frontend-checks.yml"}`) ↔ `.claude/tests/test_required_check_skip_jobs.py:40-43` (`CONVERTED = [...]`)
  - 상세: `_SKIP_JOB_WORKFLOWS` 는 "이 워크플로에서는 `needs.changes.outputs.relevant == 'true'`/`!= 'true'` 두 문자열의 `if:` 조건을 개별 등재 없이 허용한다"는 화이트리스트일 뿐이고, 실제 계약 검증(`needs: changes` 필수, 모든 스텝 게이팅, no-op 안내 스텝, 스크립트 자기참조)은 `test_required_check_skip_jobs.py::CONVERTED` 에 있는 워크플로에만 적용된다. 두 목록을 이어주는 테스트가 없으므로, 누군가 새 워크플로를 skip-job 패턴으로 전환하면서 `_SKIP_JOB_WORKFLOWS` 에는 추가하고 `CONVERTED` 에는 추가를 빠뜨리면(주석으로만 "반드시 추가한다"고 되어 있음) — `test_workflow_yaml_structure.py` 는 그 워크플로의 `if:` 조건을 조용히 통과시키고, `test_required_check_skip_jobs.py` 는 애초에 그 워크플로를 순회하지 않아 게이팅 누락(스텝에 `if:` 를 빠뜨렸거나 `needs: changes` 를 빠뜨린 경우)을 잡지 못한다. 이 README/테스트 스위트 자체가 "harness-checks.yml paths 커버리지 갭이 6번 샜다"고 명시하는 바로 그 클래스(등재 누락 → 조용한 미검사)를 이 두 목록 사이에서 재현할 수 있는 구조다.
  - 제안: `test_workflow_yaml_structure.py` 또는 `test_required_check_skip_jobs.py` 어느 한쪽에 `set(CONVERTED) == self._SKIP_JOB_WORKFLOWS` 를 단언하는 테스트를 추가해 두 레지스트리를 하나의 SoT 로 묶거나, 한쪽이 다른 쪽을 import 해서 파생시키는 편이 안전하다.

- **[INFO]** 새 외부 의존성 없음 — PyYAML 예외만 재사용
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:33` (`import yaml`), `.claude/tests/README.md:19-31`
  - 상세: 신규 테스트가 `import yaml` 을 쓰지만, README 가 이미 명시한 "하네스 Python 은 표준 라이브러리만" 규약의 유일한 예외(PyYAML)를 그대로 재사용하는 것이다. 버전 핀(`pip install "pyyaml>=6,<7"`, `.github/workflows/deps-security-checks.yml:87,139`)도 diff 로 변경되지 않았다. 새 패키지·라이선스·취약점 문제 없음.

- **[INFO]** `paths:` 제거로 인한 CI 빌드시간 영향(의도된 트레이드오프)
  - 위치: `.github/workflows/deps-security-checks.yml:27-67`, `.github/workflows/frontend-checks.yml:17-49`
  - 상세: required status check 데드락을 피하기 위해 `on.pull_request.paths` / `on.push.paths` 필터를 걷어냈다. 그 결과 이전에는 관련 없는 PR(예: `spec/`·`plan/`만 바꾸는 PR)에서 워크플로 자체가 스케줄되지 않았지만, 이제는 두 워크플로 모두 매 PR 마다 `changes` 잡(전체 히스토리 `fetch-depth: 0` 체크아웃 포함)이 최소 1회 실행된다. 근거·필요성이 코드 주석에 잘 설명돼 있고 required-check 정합성을 위해 불가피한 트레이드오프이므로 결함은 아니나, CI 러너 소모량이 "관련 없는 PR" 에서도 늘어난다는 점은 기록해 둘 만하다.

- **[INFO]** `changes` 잡 보일러플레이트가 두 워크플로에 거의 동일하게 중복
  - 위치: `.github/workflows/deps-security-checks.yml:43-67`, `.github/workflows/frontend-checks.yml:28-49`
  - 상세: `actions/checkout@v7`(`fetch-depth: 0`) + `scripts/ci-paths-changed.sh` 호출로 구성된 `changes` 잡이 pathspec 목록만 다르고 나머지는 동일한 형태로 두 파일에 복제돼 있다. 테스트 주석("새로 전환할 때마다 여기 추가한다")이 시사하듯 이 패턴이 다른 워크플로(harness-checks.yml, e2e.yml 등)로도 확장될 가능성이 있어, 지금 추출해 두면 이후 n번째 중복을 막을 수 있다.
  - 제안: 급하지 않음 — 워크플로가 3개 이상으로 늘어나는 시점에 composite action(`.github/actions/detect-relevant-changes`)으로 추출을 고려.

- **[INFO]** GitHub Actions 핀 버전은 diff 전체에서 불변, 저장소 전체와 호환
  - 위치: `.github/workflows/deps-security-checks.yml` / `frontend-checks.yml` 전체의 `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`, `pnpm/action-setup@v6.0.9`
  - 상세: 각 `if:` 추가로 인해 diff 상에서 반복 노출되지만 실제 버전 문자열은 변경되지 않았다. `.github/workflows/*.yml` 전체를 grep 한 결과 다른 모든 워크플로(e2e.yml, harness-checks.yml, packages-checks.yml, spec-link-checks.yml, web-chat-checks.yml 등)와 정확히 동일한 핀을 쓰고 있어 버전 충돌·호환성 이슈 없음.

## 요약

이번 변경은 `deps-security-checks.yml`/`frontend-checks.yml` 을 required status check 데드락을 피하는 skip-job 패턴으로 전환하는 CI 인프라 작업이며, 신규 외부 패키지·라이선스·알려진 취약점 관련 변경은 없다(PyYAML 은 기존 승인된 예외를 재사용, 버전 핀 불변). Actions 핀도 저장소 전체 관례와 일치해 호환성 문제가 없다. 유일하게 의존성 관점에서 실질적인 항목은 skip-job 대상 워크플로 목록이 두 테스트 파일에 각각 독립 레지스트리로 존재하면서 서로를 검증하지 않는 내부 결합 리스크(WARNING)이고, 나머지는 의도된 CI 비용 트레이드오프·경미한 보일러플레이트 중복에 대한 정보성 관찰(INFO)이다.

## 위험도
LOW
