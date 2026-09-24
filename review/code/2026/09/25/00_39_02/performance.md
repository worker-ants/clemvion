# 성능(Performance) 리뷰 — MinIO 이미지 일치 가드

## 발견사항

- **[INFO]** `MinioImageParityTest.setUp` 이 테스트 메서드마다 `all_images()` 를 다시 호출해 3개 YAML 파일을 매번 읽고 파싱한다
  - 위치: `.claude/tests/test_minio_image_parity.py:175` (`setUp`), 호출 대상 `all_images()` 는 118~123
  - 상세: `MinioImageParityTest` 에 test 메서드가 4개(`test_all_six_places_found`, `test_all_places_use_one_image`, `test_each_is_pinned_by_tag_and_digest`, `test_no_distroless_variant`) 있고, `unittest.TestCase.setUp` 은 인스턴스 메서드당(=테스트 메서드당) 매번 실행되므로 `all_images()` 가 세션당 4회, 즉 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml` 세 파일에 대한 `read_text` + `yaml.safe_load`/`safe_load_all` 이 총 12회 발생한다. 대상 파일이 모두 수 KB 수준의 소규모 매니페스트이고 이 코드는 CI 하네스에서만 실행되는 테스트이므로 실행 시간에 미치는 영향은 무시할 수준(수 ms 이내)이며, 알고리즘적으로도 O(1)에 가깝다. 다만 불필요한 반복 I/O 라는 점 자체는 사실이고, `setUpClass`(클래스 스코프, 1회만 계산)로 바꾸면 그 중복을 없앨 수 있다.
  - 제안: 급하지 않음. 굳이 고친다면 `all_images()` 결과를 `setUpClass` 에서 한 번 계산해 `cls.images` 로 공유하는 정도. 파일 크기·실행 빈도(개발자 로컬 실행 + PR 당 CI 1회)를 고려하면 현재 상태로 두어도 무방하다.

- **[INFO]** 정규식 `_PINNED` 는 모듈 레벨에서 1회만 컴파일되어 반복 호출에도 재컴파일 비용이 없음 — 문제 없음, 긍정 관찰
  - 위치: `.claude/tests/test_minio_image_parity.py:69`
  - 상세: 루프(`test_each_is_pinned_by_tag_and_digest`, `test_no_distroless_variant`) 안에서 매번 새로 컴파일하지 않고 모듈 상수로 미리 컴파일해 재사용한다. 6개 place 에 대해서만 매칭을 수행하므로 시간 복잡도상 문제 없음.

- **[INFO]** `_render` 의 문자열 결합은 `"\n".join(...)` 을 사용해 O(n²) 누적 패턴을 피함 — 문제 없음
  - 위치: `.claude/tests/test_minio_image_parity.py:127`
  - 상세: 6개 place 규모에서는 어차피 무의미하지만, `+=` 반복 결합이 아니라 `join` 을 쓴 것은 좋은 패턴이며 place 수가 늘어나도 안전하다.

- **[INFO]** `k8s_images` 의 이중 리스트 컴프리헨션(`matches`, `images`)은 `docs`/`containers` 전체를 매번 순회하지만 실제 크기가 문서 2~수개, 컨테이너 1~2개 수준으로 고정되어 있어 성능에 영향 없음
  - 위치: `.claude/tests/test_minio_image_parity.py:100-113`
  - 상세: `K8S_PLACES` 순회(외부 루프, 2회) × `docs` 전체 스캔(내부, 문서 수만큼) 형태로 명목상 O(P×D) 지만 P, D 모두 한 자리 수 상수이므로 실질적으로 O(1). N+1 이나 블로킹 I/O 문제는 아님 — 파일 I/O 는 `all_images()` 단계에서 파일당 1회로 이미 끝난 뒤 메모리 내 구조체만 순회한다.

## 요약

이 변경은 순수 CI 하네스 테스트(`test_minio_image_parity.py`)와 이를 트리거하는 workflow pathspec 추가, 문서/plan 갱신으로 구성되어 있고 런타임 서비스 코드나 프로덕션 핫패스를 건드리지 않는다. 데이터 규모(파일 3개, place 6개)가 고정된 작은 상수이므로 알고리즘 복잡도·N+1·캐싱·블로킹 I/O 등 실질적 성능 리스크는 없다. 유일하게 지적할 만한 점은 `setUp` 이 인스턴스별로 3개 YAML 파일을 반복 읽고 파싱해 `all_images()` 가 테스트 세션당 4회 호출된다는 것인데, 파일 크기와 실행 빈도(로컬/CI에서 산발적 실행)를 고려하면 무시 가능한 수준이라 INFO 로만 남긴다. `_PINNED` 정규식의 모듈 레벨 컴파일, `"\n".join` 기반 문자열 결합 등은 오히려 좋은 패턴이다.

## 위험도
NONE
