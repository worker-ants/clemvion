# 테스트(Testing) 리뷰 — k8s-avatar-policy

## 발견사항

- **[WARNING]** 새 가드 `job_script()`/`heredoc_policy()` 에 "정확히 하나" 검증이 없어, 형제 가드가 이미 잡는 "중복 리소스" 회귀 클래스를 놓친다
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:61` (`job_script` 함수 — 전체 파일 컨텍스트 기준 61~75줄), `.claude/tests/test_minio_bucket_policy_parity.py:78` (`heredoc_policy` 함수, 78~83줄)
  - 상세: `job_script()` 는 YAML 멀티 문서를 순회하며 `kind == "Job"` 이고 `metadata.name == "minio-create-bucket"` 이며 컨테이너 이름이 `"mc"` 인 **첫 매치를 찾는 즉시 반환**한다. 만약 병합 실수 등으로 동일 `kind`/`name` 의 Job 문서가 두 개 존재하거나(예: `---` 로 분리된 중복 정의), 한 파드 안에 이름이 `mc` 인 컨테이너가 두 개 있으면, 두 번째 정의의 스크립트/정책은 조용히 무시된다 — 검사 자체는 GREEN 을 낸다. `heredoc_policy()` 도 `_HEREDOC.search()`(첫 매치만) 를 쓰기 때문에 스크립트 안에 heredoc 이 두 개가 되면 두 번째는 검증 대상에서 빠진다.
    같은 PR 의 형제 가드 `test_minio_image_parity.py` 는 **바로 같은 Job 리소스**를 대상으로 이 클래스를 명시적으로 방어한다 — `_expect_one()` 헬퍼("zero AND duplicates" 를 모두 `PlaceNotFound` 로 거부, 주석: "a duplicate would leave it ambiguous which image runs")와 이를 검증하는 이름 있는 테스트 `test_k8s_duplicate_resource_is_named` · `test_k8s_duplicate_container_is_named` 가 실제로 존재하고 통과한다(직접 실행 확인, 아래 검증 절 참고). 새 가드는 정확히 같은 매니페스트·같은 Job 을 다른 축(정책)으로 보면서 이 방어를 재사용하거나 상응하는 테스트를 두지 않았다.
    plan(`plan/in-progress/k8s-avatar-policy.md` §D)의 11개 뮤턴트 census(D1~D7, E1~E4)에도 "중복 리소스/중복 heredoc" 클래스는 포함되어 있지 않아, 이 갭은 뮤테이션 테스트로도 검증되지 않은 상태다.
  - 제안: `job_script()` 를 형제 가드의 `_expect_one` 패턴처럼 바꿔 매치가 0개 또는 2개 이상이면 각각 이름을 붙여 실패시키고(`AssertionError` 메시지에 "found N"), `heredoc_policy()` 도 `search` 대신 `findall`/`finditer` 로 개수를 세어 정확히 1개가 아니면 실패하도록 하며, 형제 가드의 `test_k8s_duplicate_container_is_named` 에 대응하는 "중복 Job/중복 heredoc 이 명명되어 실패한다" 테스트를 `ExtractorBoundaryTest` 에 추가한다. 현재 저장소 상태에서 실제 위험은 낮지만(정적 YAML 파일 하나이고 실수로 중복 문서가 들어갈 가능성은 크지 않음), 저장소가 이미 확립한 규약(같은 Job 을 보는 형제 파일)과의 비대칭이라 재발 방지 관점에서 지적한다.

- **[INFO]** `job_script()` 는 컨테이너에 `args` 가 없거나(즉 `command` 만 있는 형태) 파드에 컨테이너가 아예 없는 경우를 별도 이름의 테스트로 구분하지 않는다
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py` `test_job_script_missing_or_malformed_is_named` (전체 파일 컨텍스트 106~115줄)
  - 상세: 현재 subTest 는 "no Job" · "two args" · "non-string arg" · "args not a list" 4가지만 다룬다. `args` 키 자체가 없는 컨테이너(`c.get("args")` → `None`)와 `containers` 리스트가 비어있는 경우는 코드상 같은 분기(`isinstance(args, list)` False, 또는 for 루프가 아예 안 돎)로 처리되어 사실상 기존 케이스들과 동일 경로를 타긴 하지만, 이름 있는 회귀 케이스로 명시되어 있지 않다. 형제 가드 수준의 촘촘함(예: `test_k8s_missing_container_is_named`)에 비하면 다소 느슨하다.
  - 제안: 우선순위는 낮음 — 현재 커버리지로도 해당 분기들은 간접적으로 죽는(mutation 관점에서 실질적 위험이 낮은) 상태로 보이나, 다음에 이 파일을 만질 때 subTest 라벨에 "no args key" / "no containers" 를 추가하면 좋다.

## 검증 (재현, 저장소 뮤테이션 없음)

읽기 전용으로 아래를 직접 실행해 확인했다 (저장소에 쓰기 없음, `git status --short` 로 변경 없음 확인):

```
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .claude/tests -p 'test_minio_bucket_policy_parity.py' -v
→ Ran 12 tests in 0.027s — OK  (plan 의 "새 테스트 12개" 주장과 일치)

PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py' -v
→ Ran 26 tests in 1.891s — OK

PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .claude/tests -p 'test_minio_image_parity.py' -v
→ Ran 20 tests in 0.064s — OK, 그 중 test_k8s_duplicate_resource_is_named / test_k8s_duplicate_container_is_named 확인(위 WARNING 근거)
```

`plan/in-progress/k8s-avatar-policy.md` §D 체크리스트의 `python3 -m pytest .claude/tests -q 전체 · docs 가드` 항목은 diff 시점 기준 미체크(`[ ]`) 상태다 — 위 부분 실행으로는 GREEN 을 확인했으나, 전체 스위트(`.claude/tests` 전체 + docs 가드)를 이 리뷰가 대신 전수 실행하지는 않았다는 점을 참고하라.

## 그 외 검토 항목 요약

- **테스트 존재 여부**: 변경된 인프라 동작(k8s Job 의 버킷 정책 적용)에 대해 신규 `test_minio_bucket_policy_parity.py` 가 직접 대응한다. 필요한 커버리지는 대체로 충족.
- **엣지 케이스**: heredoc 구분자 quoting(4가지 변형), Job/컨테이너 결측·형식 오류(4가지), Action 이 bare string 인 경우 등 핵심 엣지케이스는 `ExtractorBoundaryTest` 에서 합성 입력으로 촘촘히 다룬다. 위 WARNING/INFO 를 제외하면 갭이 작다.
- **Mock 적절성**: mock/stub 미사용 — 실제 저장소 파일(`k8s/overlays/local/infra-minio.yaml`, `scripts/minio/avatars-public-read.json`)을 그대로 읽는 parity 가드이므로 이 방식이 적절하다. 형제 가드(`test_minio_image_parity.py`)와 스타일이 일관된다.
- **테스트 격리**: 각 테스트는 파일을 읽기만 하고 쓰지 않으며, `setUp` 에서 매번 새로 로드한다. 테스트 간 상태 공유나 순서 의존 없음.
- **테스트 가독성**: 테스트명·docstring·subTest 라벨이 각 회귀 형태를 명확히 이름 붙여 표현한다. plan 문서의 뮤턴트 census(D1~D7, E1~E4)가 각 assertion 과 대응 관계를 명시적으로 기록해 추적 가능성이 높다.
- **회귀 테스트**: `harness-checks.yml` pathspec 에 `scripts/minio/avatars-public-read.json` 이 추가되어, 정책 파일만 단독으로 고쳐도 이 가드가 트리거된다 — plan 체크리스트에 "pathspec 을 넣기 전 RED → 넣은 뒤 GREEN" 으로 검증됨(추가로 이 리뷰가 `test_harness_checks_paths_coverage.py` 자체도 실행해 현재 GREEN 확인). 기존 `test_minio_image_parity.py` 등 형제 가드는 이번 변경으로 영향받지 않고 그대로 통과.
- **테스트 용이성**: 검사 대상이 YAML 매니페스트 안에 임베드된 shell heredoc이라 원천적으로 유닛 경계가 없는 영역이지만, "렌더된 YAML → 정규식으로 heredoc 추출 → JSON 비교"라는 간접 접근은 형제 가드와 같은 패턴이라 합리적이다.

## 요약

신규 가드 `test_minio_bucket_policy_parity.py` 는 k8s Job 의 버킷 정책 heredoc 과 원본 JSON 간의 drift 를 촘촘한 이름 있는 assertion(7개 회귀 형태) 과 별도의 추출기 경계 테스트로 방어하며, 12개 테스트 전부 실제 실행에서 GREEN 임을 확인했다. 다만 같은 PR 의 형제 가드(`test_minio_image_parity.py`)가 동일 Job 리소스에 대해 명시적으로 방어하는 "중복 리소스/중복 컨테이너" 회귀 클래스를 이 새 가드는 재사용하지 않았고, `job_script()`/`heredoc_policy()` 는 첫 매치만 반환해 조용히 두 번째 정의를 무시할 수 있다 — 뮤테이션 census(11개)에도 이 클래스는 없다. 실제 발생 가능성은 낮지만 저장소가 이미 확립한 "정확히 하나" 규약과 비대칭이라 WARNING 으로 남긴다. 그 외 엣지 케이스·격리·가독성·회귀 안전성은 모두 양호하다.

## 위험도

LOW
