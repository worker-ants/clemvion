# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 테스트가 쓰는 `yaml` (PyYAML) 은 신규 의존성이 아니라 기존 harness CI 의존성 재사용
  - 위치: `.claude/tests/test_minio_image_parity.py:52` (`import yaml`)
  - 상세: `.github/workflows/harness-checks.yml` 은 이미 `pip install "pyyaml>=6,<7"` 스텝(파일 내 "Install PyYAML" 스텝, `test_override_floors.py` 도입 시점부터 존재)으로 PyYAML 을 설치하고 있고, `.claude/tests/` 안에서 이미 `test_changed_paths_reusable.py` · `test_pnpm_workspace_action.py` · `test_required_check_skip_jobs.py` · `test_spec_link_checks_scope.py` · `test_workflow_run_inputs_covered.py` · `test_workflow_yaml_structure.py` 등 6개 파일이 동일하게 `import yaml` 하고 있다. 이번 diff 는 이 기존 install 스텝이나 pin 범위(`>=6,<7`)를 전혀 건드리지 않았다 — `pip install`/`requirements` 관련 라인이 diff 에 없음을 직접 확인했다. `test_minio_image_parity.py` docstring 의 "PyYAML 은 harness CI 의 유일한 허용 의존성" 이라는 주장도 워크플로 헤더 주석("`unittest`, stdlib-only with ONE exception: PyYAML")과 일치해 실측대로다.
  - 제안: 조치 불필요. (양성 확인 — 새 외부 의존성 도입도, pin 변경도 없음)

- **[INFO]** `yaml.load()` 가 아니라 `safe_load`/`safe_load_all` 을 사용해 임의 객체 역직렬화(구 PyYAML CVE-2017-18342/CVE-2020-1747 계열) 경로를 피함
  - 위치: `.claude/tests/test_minio_image_parity.py:84` (`yaml.safe_load(text)`), `:97` (`yaml.safe_load_all(text)`)
  - 상세: 대상 파일이 저장소 내부 신뢰 파일(`docker-compose.yml` 등)이라 위협 모델상 급하지 않지만, 어차피 `safe_load` 를 쓴 것은 올바른 선택이고 기존 6개 테스트 파일의 관례와도 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** 내부 의존성(`_harness.REPO_ROOT`) 재사용은 기존 관례를 따름, 순환·신규 결합 없음
  - 위치: `.claude/tests/test_minio_image_parity.py:54` (`from _harness import REPO_ROOT`)
  - 상세: `.claude/tests/_harness.py` 는 같은 디렉터리의 기존 공용 모듈이고, 다른 harness 테스트들도 동일 패턴으로 임포트한다. `test_harness_checks_paths_coverage.py::parse_pathspecs_block` 재사용(README 서술)도 새 모듈 결합이 아니라 기존 파서 재사용이다.
  - 제안: 조치 불필요.

- **[INFO]** 이번 diff 는 컨테이너 이미지(`pgsty/silo:...@sha256:...`) 자체를 바꾸지 않음 — 그 third-party 이미지로의 전환(`#1392`)은 이 PR 범위 밖의 선행 커밋
  - 위치: `docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/overlays/local/infra-minio.yaml` — 이번 diff 대상 파일 목록에 없음(직접 확인: 세 파일 모두 이번 커밋 시리즈에서 변경 없음, `image:` 값은 이미 태그+다이제스트로 고정돼 있음)
  - 상세: `pgsty/silo` 는 MinIO 공식 이미지가 Docker Hub/quay 양쪽에서 익명 pull 이 막힌 뒤 채택된 비공식 미러/포크(주석에 근거 명시)로, 이 자체는 supply-chain 관점에서 별도로 따져볼 사안이지만 그 결정은 이번 diff 이전에 이미 내려졌고 이번 변경은 "여섯 자리가 서로 같은지" 를 고정하는 테스트만 추가한다. 새 의존성 판단 대상이 아니다.
  - 제안: 조치 불필요 (참고 사항으로만 기재). 이미지 자체의 신뢰성 재평가가 필요하면 별도 plan(`minio-silo-image`, 주석에 언급)에서 다룰 사안.

- **[INFO]** `harness-checks.yml` pathspec 3줄 추가는 의존성이 아니라 트리거 경로 등재 — 파일 단위 등재로 범위를 좁혀 무관한 `k8s/**` 변경에 스위트가 과도하게 도는 것을 피함
  - 위치: `.github/workflows/harness-checks.yml:92-98`
  - 상세: 새 external action/의존성 추가가 아니라 기존 `changes` job 의 `pathspecs:` 블록에 3개 파일 경로만 추가한 것. `test_harness_checks_paths_coverage.py` 가 이 등재를 강제하므로 커버리지 공백도 없다.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 harness 전용 회귀 테스트(`test_minio_image_parity.py`) 한 개와 그에 딸린 워크플로 pathspec/문서/플랜 갱신으로 구성되며, 애플리케이션 코드(`codebase/**`)의 의존성 목록(`package.json`, `requirements.txt` 등)은 전혀 건드리지 않는다. 새로 쓰는 유일한 외부 패키지 `PyYAML` 은 harness CI 에 이미 존재하는 pin(`pyyaml>=6,<7`)을 그대로 재사용하며 이미 6개 테스트 파일이 동일하게 `import yaml` 하고 있어 신규성·라이선스·취약점·크기·호환성 어느 축에서도 새로운 위험을 추가하지 않는다(`safe_load` 계열만 사용해 구버전 PyYAML 의 임의 역직렬화 클래스도 애초에 회피). 내부 의존성(`_harness.REPO_ROOT`, `test_harness_checks_paths_coverage.py::parse_pathspecs_block`)도 기존 모듈 재사용이라 순환·신규 결합이 없다. 컨테이너 이미지(`pgsty/silo`)로의 전환 자체는 이 diff 이전에 이미 확정된 결정이고 이번 변경은 그 값의 "6곳 일치"만 검사하는 가드를 추가한 것이라 별도 의존성 리스크로 볼 필요가 없다. 의존성 관점에서 이 diff 는 사실상 무해하다.

## 위험도

NONE
