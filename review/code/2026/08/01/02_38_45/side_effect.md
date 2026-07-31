# 부작용(Side Effect) 리뷰 — deps-guard-hardening (3차 라운드)

## 발견사항

- **[INFO]** (검증됨, 해소 확인) 2차 라운드(`review/code/2026/08/01/01_56_46/side_effect.md`)가 CRITICAL 로 지적한 `harness-checks.yml` YAML 매핑 중복 키(“Install PyYAML” 스텝이 기존 스텝의 `name:`/`run:` 사이에 끼어들어 `pip install` 이 소실되고 원 스텝이 `run`/`uses` 없는 빈 스텝이 되던 문제)가 현재 워크트리 HEAD 에서 해소되어 있음을 직접 확인했다.
  - 위치: `.github/workflows/harness-checks.yml:77-85`
  - 상세: 파일을 `Read` 로 직접 열어 "Install PyYAML"(81-82행, `run:` 1개)과 "Run harness unit tests"(84-85행, `run:` 1개)가 완전히 분리된 두 스텝으로 존재함을 확인했고, `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 실제로 실행해 739건 전부 통과(88.265s)함을 재현했다 — 여기엔 이 정확한 회귀를 겨냥한 신규 `test_workflow_yaml_structure.py`(모든 워크플로의 중복 키·`run`/`uses` 정확히 1개 검증, 개별 실행으로 6/6 통과)가 포함된다. 워크플로 CI 파이프라인 자체를 깨뜨리는 side effect는 남아있지 않다.

- **[INFO]** 신규 네트워크 호출 표면 — `scripts/check-override-floors.py::run_audit()` 가 `pnpm audit --audit-level=moderate --json` 로 npm 레지스트리에 실제 질의한다. `deps-security-checks.yml` 의 신규 `override-floors` 잡에 배선되어 CI 에서 네트워크 호출이 발생하지만, 같은 파일의 기존 `audit` 잡과 동일한 패턴(레지스트리 조회, 별도 `pnpm install` 불요)이라 새로운 클래스의 부작용은 아니다. 더 중요한 것은 하네스 **단위 테스트 스위트에는 이 호출이 전혀 새지 않는다는 점**이다 — `.claude/tests/test_override_floors.py::run_with_stub_audit()` 가 `PATH` 맨 앞에 가짜 `pnpm` 실행파일을 얹은 **복사본** env(`dict(os.environ, PATH=...)`, `os.environ` 자체는 불변)만 서브프로세스에 넘기므로, `python3 -m unittest discover` 전체 실행(739건, 88s)이 실측상 네트워크 지연 없이 끝난다.
  - 위치: `scripts/check-override-floors.py:124-146`(`run_audit`); `.claude/tests/test_override_floors.py:59-107`(`run_with_stub_audit`, PATH 우선순위 트릭은 101행); `.github/workflows/deps-security-checks.yml:74-94`(`override-floors` 잡)

- **[INFO]** PyYAML 커스텀 로더가 라이브러리 전역 상태를 건드리지 않음을 직접 재현해 확인했다 — 이 리뷰 관점(전역 변수 도입/변경)이 정확히 겨냥하는 패턴이라 명시적으로 검증했다. `_duplicate_keys()` 는 호출될 때마다 `class _Loader(yaml.SafeLoader): pass` 로 **새 서브클래스**를 만든 뒤 그 위에서만 `add_constructor` 를 호출한다. PyYAML 의 `add_constructor` 는 대상 클래스의 `__dict__` 에 `yaml_constructors` 가 없으면 부모 것을 복사해 자신만의 사본을 만든 뒤 그 사본만 갱신하므로(직접 파이썬으로 재현: `yaml.SafeLoader.yaml_constructors` 가 호출 전후 동일 — `before != after` → `False`), `yaml.SafeLoader`/`yaml.safe_load` 는 이 테스트가 몇 번을 돌든 전혀 영향받지 않는다. `yaml.SafeLoader.add_constructor(...)` 를 직접 호출했다면(흔한 실수) 프로세스 전역에서 이후의 모든 `safe_load` 호출이 오염됐을 자리다.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:61-74`(`_duplicate_keys`)

- **[INFO]** CI 트리거 표면의 의도적 확장 — `harness-checks.yml` 의 `on.pull_request.paths` 가 개별 항목(`.github/workflows/harness-checks.yml` 자기참조, `.github/workflows/e2e.yml`) 대신 `.github/workflows/**` 를 등재한다. 실질적 동작 변화다: 이제 `.github/workflows/` 아래 **어떤** 워크플로 파일을 고쳐도 harness-checks 잡이 트리거된다(이전엔 두 파일만). `test_workflow_yaml_structure.py` 가 "모든 워크플로"를 대상으로 하므로 의도된 확장이며, 대응하는 fixture(`test_harness_checks_paths_coverage.py::KNOWN_COVERAGE_DEPENDENCIES` 의 `.github/workflows/**` → `e2e.yml` 매핑)도 함께 갱신되어 `test_each_historical_leak_is_load_bearing`(개별 실행 26/26 통과)이 이 필터가 죽은 등재가 아님을 검증한다. 부작용의 실질 영향: 향후 워크플로 파일이 늘어날수록 harness-checks 실행 빈도가 늘어난다(비용 측면, 기능적 위험 아님).
  - 위치: `.github/workflows/harness-checks.yml:41-52`; `.claude/tests/test_harness_checks_paths_coverage.py:110-111`

- **[INFO]** 코드베이스 밖 외부 시스템 부작용 — `.github/dependabot.yml` 에 pnpm 워크스페이스 루트(`directory: "/"`)를 신규 `npm` ecosystem 항목으로 등록. 이 저장소의 어떤 코드도 호출·소비하지 않는 GitHub 플랫폼 자동화(Dependabot)의 동작을 바꾸는 구성 변경이라 — 병합 후 Dependabot 이 워크스페이스 루트 전체에 대해 주간 버전 업데이트 PR 을 새로 열기 시작한다(#1029/#1030 사고 경위가 파일 내 주석에 상세). 코드 인터페이스가 아니라 리포 자동화 설정이라 깨질 기존 호출자는 없으며, 신규 `test_workspace_root_stays_registered` / `test_root_exception_does_not_admit_workspace_members`(각 개별 실행에서 통과 확인, 14/14 `test_dependabot_npm_coverage.py`)가 등록 유지·범위(루트 1곳만)를 회귀 테스트로 고정한다.
  - 위치: `.github/dependabot.yml:42-46`

- **[INFO]** 시그니처/인터페이스 영향 없음 — 신규 심볼(`chain_segments`·`override_target`·`load_override_targets`·`run_audit`·`classify_vulnerable`·`main`·`_legitimate_dependabot_directories`·`_duplicate_keys` 등)은 전부 net-new 이고, 저장소 전체 grep 으로 이 신규 스크립트/테스트 파일 자신 외에 다른 호출자가 없음을 확인했다. 기존 함수(`_independent_trees()`, `KNOWN_COVERAGE_DEPENDENCIES` 의 나머지 5개 항목, `check-pnpm-security-config.py`)는 diff 로 건드리지 않아 기존 시그니처·동작이 보존된다.
  - 위치: 저장소 전체 grep 결과 (`check-override-floors`, `override_target`, `_legitimate_dependabot_directories` — 매치 파일은 diff 대상 5개 파일뿐)

- **[INFO]** 환경 변수·시크릿 신규 사용 없음 — 변경된 워크플로 3개 파일(`deps-security-checks.yml`·`harness-checks.yml`·`dependabot.yml`) 전체를 grep 했으나 `secrets.`·`env:`·`permissions:` 블록이 전혀 없다(변경 전후 동일) — 새 `override-floors` 잡도 공개 레지스트리 조회만 하므로 토큰·자격증명 노출 경로가 없다.

## 요약

이 라운드(3차)에서 실측 검증한 결과, 2차 라운드가 CRITICAL 로 지적했던 유일한 실질적 부작용(`harness-checks.yml` YAML 매핑 손상으로 PyYAML 설치가 소실되고 CI 파이프라인 자체가 깨질 위험)은 현재 파일 상태와 전체 하네스 스위트(739건 실행, 전부 통과)로 해소가 확인됐다. 이번 diff 가 실제로 도입하는 부작용 — `pnpm audit` 네트워크 호출, `harness-checks.yml` 트리거 범위 확장, `dependabot.yml` 신규 루트 등록 — 은 전부 설계 의도와 정확히 일치하고, 각각을 겨냥한 회귀 테스트로 고정돼 있으며, 단위 테스트 스위트 자체는 네트워크·전역 `os.environ`·PyYAML 라이브러리 전역 상태 어느 것도 오염시키지 않는다(직접 재현으로 확인). 신규 함수/스크립트는 기존 호출자가 전혀 없는 net-new 코드라 시그니처·인터페이스 파손 위험도 없다. 종합하면 이번 diff 자체가 새로 만든 미검토·의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
