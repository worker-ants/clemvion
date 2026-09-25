# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `_SET_JSON` 정규식과 통합 테스트 내 인라인 정규식 리터럴이 동일한 패턴을 두 곳에 따로 정의
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:68` (`_SET_JSON = re.compile(r'mc anonymous set-json (?P<path>\S+) local/"\$S3_BUCKET"')`) 및 `:178` (`test_policy_is_applied_to_the_created_bucket` 내부 `self.assertRegex(self.script, r'mc anonymous set-json \S+ local/"\$S3_BUCKET"')`)
  - 상세: 두 정규식은 named group(`(?P<path>...)` vs `\S+`) 차이만 있을 뿐 패턴 본문이 완전히 동일하다. `_SET_JSON` 은 이미 모듈 상수로 추출돼 `test_set_json_reads_the_file_the_heredoc_wrote` 에서 재사용되는데, 178번 줄은 같은 문자열을 별도로 다시 타이핑했다. 이 파일 자체가 "정책이 두 벌이라 드리프트를 가드로 묶는다" 는 취지로 존재하는데, 정작 파일 내부에 같은 부류의 드리프트 위험(정규식이 두 군데서 따로 움직임)을 남겼다는 점이 아이러니하다. `mc anonymous set-json` 커맨드 형식이 바뀌면 두 곳을 모두 고쳐야 하고, 하나만 고치면 나머지 쪽 assert 가 의미 없이(또는 혼란스럽게) 실패한다.
  - 제안: `test_policy_is_applied_to_the_created_bucket` 에서 `_SET_JSON` (또는 `_SET_JSON.pattern`) 을 직접 재사용하도록 바꾼다. 예: `self.assertRegex(self.script, _SET_JSON)`.

- **[WARNING]** `job_script()` 가 형제 가드 `k8s_images()` 의 "리소스 찾기 → 컨테이너 찾기" 매핑 워크 구조를 재구현
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py` 함수 `job_script` (72~90행) vs `.claude/tests/test_minio_image_parity.py` 함수 `k8s_images` (148~165행)
  - 상세: 새 파일의 주석(49~53행)은 "`_expect_one`·매핑-워크 체크는 이미지 가드에 ONCE 만 있고, 여기선 헬퍼만 임포트한다" 고 명시적으로 주장한다. 그런데 실제로는 leaf 헬퍼(`_dig`/`_seq`/`_expect_one`)만 재사용될 뿐, "docs 를 kind+name 으로 필터링 → `_expect_one` → `spec.template.spec` 로 dig → containers 를 이름으로 필터링 → `_expect_one`" 이라는 **복합 워크 자체**는 `job_script()` 안에 그대로 다시 작성돼 있다(72~86행이 `k8s_images` 148~163행과 구조적으로 거의 1:1 대응). `test_minio_image_parity.py` 자신의 docstring(102~106행)은 "이 walk 를 장소마다 복사하는 것"이 네 차례 리뷰 라운드에서 반복 발견된 안티패턴이라고 경고하는데, 새 파일이 그 walk 를 (장소 하나에 대해서지만) 다시 한 번 복제한 형태다. 주석의 주장("mapping-walk 는 ONCE")과 실제 코드가 어긋나 있어, 다음 사람이 주석만 보고 "워크가 한 곳에만 있다"고 오인할 수 있다.
  - 제안: `k8s_images` 의 루프 본문에서 "kind/name/container 로 리소스+컨테이너를 찾아내는" 부분을 `_find_container(docs, label, kind, name, container) -> dict` 같은 헬퍼로 뽑아 `test_minio_image_parity.py` 에 두고, `k8s_images` 와 `job_script` 양쪽에서 재사용한다. 혹은 주석의 "ONCE" 주장 범위를 실제로 재사용되는 것(leaf 헬퍼)으로만 한정해 정정한다.

- **[INFO]** 픽스처 헬퍼 배치 컨벤션이 형제 파일과 다름
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:110-119` (`_job_yaml`, `_mc`, 모듈 레벨 함수)
  - 상세: 형제 파일 `test_minio_image_parity.py` 는 동일한 역할의 픽스처 헬퍼 `_k8s` 를 `ExtractorBoundaryTest` 클래스 내부의 `@staticmethod` 로 둔다(188~196행). 새 파일은 같은 역할의 `_job_yaml`/`_mc` 를 모듈 레벨 함수로 둬, 같은 디렉터리의 두 가드 파일이 서로 다른 배치 컨벤션을 쓴다.
  - 제안: 둘 중 하나로 통일한다(모듈 레벨 함수가 여러 테스트 클래스에서 재사용될 가능성이 있으면 모듈 레벨이 낫고, 그렇지 않으면 형제 파일과 맞춰 클래스 내부 staticmethod로).

- **[INFO]** `job_script()` 내부에서 매니페스트 경로 문자열을 리터럴로 재하드코딩
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py` 함수 `job_script` 내 `label = "k8s/overlays/local/infra-minio.yaml"`
  - 상세: 모듈 상수 `K8S_MINIO`(56행)가 이미 같은 경로를 `Path` 객체로 갖고 있는데, `job_script()` 는 에러 메시지용 `label` 문자열을 별도 리터럴로 다시 적는다. 같은 패턴이 형제 파일의 `all_images()` 호출부(`k8s_images("k8s/overlays/local/infra-minio.yaml", ...)`, `test_minio_image_parity.py:172`)에도 이미 존재하는 기존 관례라 이번 변경이 새로 도입한 문제는 아니지만, 두 파일에 반복되면서 경로가 바뀔 경우 갱신 지점이 늘어난다.
  - 제안: (기존 관례를 바꾸는 별도 작업으로) `str(K8S_MINIO.relative_to(REPO_ROOT))` 같은 파생값을 쓰거나, label 생성을 상수화해 한 곳에서만 관리한다. 이번 PR 의 스코프를 벗어나면 후속 과제로 남겨도 무방하다.

## 요약

새 가드 파일 `test_minio_bucket_policy_parity.py` 는 형제 파일 `test_minio_image_parity.py` 와 네이밍·구조(`PlaceNotFound`, `_expect_one` 활용, `ExtractorBoundaryTest`/통합 테스트 분리, 데이터 기반 서브테스트)를 잘 맞췄고 docstring 이 각 assertion 의 회귀 형태를 조목조목 설명해 가독성이 높다. 다만 두 지점에서 DRY 원칙이 완전히 지켜지지 않았다: (1) `mc anonymous set-json ... $S3_BUCKET` 정규식이 모듈 상수와 인라인 리터럴로 중복 정의돼 있고, (2) `job_script()` 가 "walk 로직은 이미지 가드에 ONCE 만 있다"는 자신의 주석과 달리 형제 파일의 리소스/컨테이너 탐색 구조를 재구현한다 — 이는 형제 파일 자신의 docstring 이 명시적으로 경계하는 안티패턴과 같은 모양이다. 둘 다 기능을 깨뜨리지는 않지만, 향후 두 파일 중 하나만 고칠 때 드리프트가 생길 여지를 남긴다. 그 외 함수 길이·중첩 깊이·매직 넘버 측면은 양호하다.

## 위험도

LOW
