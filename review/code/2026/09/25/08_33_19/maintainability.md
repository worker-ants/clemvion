# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 신규 가드가 자매 파일이 이미 정립한 "helper 재사용" 패턴을 따르지 않고 YAML 트리 탐색 로직을 다시 구현함
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:61-75` (`job_script` 함수)
  - 상세: 같은 디렉터리의 `test_minio_image_parity.py`는 정확히 같은 대상 파일(`k8s/overlays/local/infra-minio.yaml`)에서 같은 종류의 YAML 문서 탐색(kind/metadata.name/containers 찾기)을 수행하며, 그 파일의 docstring 은 "네 번의 리뷰 라운드가 같은 모양을 한 자리씩 더 깊은 곳에서 발견했다"는 이유로 `_dig`/`_seq`/`_expect_one`/`_image_value` 4개 helper 로 탐색 로직을 통일했다고 명시한다(각 helper 는 자체 boundary test 보유). 이번 신규 파일의 `job_script` 는 그 helper 들을 재사용하지 않고 `(doc.get("spec") or {}).get("template") or {}).get("spec") or {}` 형태의 자체 체인을 새로 작성했다 — 같은 저장소, 같은 대상 파일에 대한 "안전한 dict 순회" 로직이 두 벌로 갈라진다. `_dig`가 향후 수정되면(예: 새 malformed-shape 케이스 보강) 이 파일은 그 개선을 받지 못한다.
  - 또한 실패 시 메시지가 `PlaceNotFound`(named exception, "expected one X, found N" 형태로 실패 원인을 구분)와 달리, `job_script` 는 "Job 없음"·"container 없음"·"args 개수 오류"·"args 타입 오류" 네 가지 서로 다른 실패 모양을 전부 동일한 문구(`"{kind}/{name} container {container!r}: single script arg not found"`)로 뭉갠다. `test_job_script_missing_or_malformed_is_named` 의 4개 subTest 가 모두 같은 정규식으로 통과하는 것이 이를 보여준다 — 실패 원인 구분이라는, 자매 파일이 공들여 세운 관례(“나머지가 실패해도 어디가 문제인지 이름으로 안다”)가 이 파일에서는 빠졌다.
  - 제안: `job_script` 내부의 dict 순회를 `test_minio_image_parity.py` 의 `_dig`/`_seq`를 import 해 재작성하거나(공유 helper 모듈로 승격), 최소한 실패 사유를 "Job/Container 없음" vs "args 개수·타입 오류"로 나눠 메시지에 반영해 디버깅 시 어느 실패인지 즉시 알 수 있게 한다.

- **[INFO]** 신규 헬퍼의 docstring 이 실제 동작보다 넓게 들린다
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:62` (`job_script` docstring: `"""The single script argument of the Job's container — or an error naming it."""`)
  - 상세: "or an error naming it" 은 자매 파일의 `PlaceNotFound`처럼 실패 지점을 구체적으로 지목하는 뉘앙스를 주지만, 실제로는 위 WARNING 대로 4가지 실패 모양이 모두 같은 고정 문구를 낸다(가변부는 상수 `JOB` 값뿐, 실패 종류를 반영하지 않음). 문서가 구현보다 넓게 말하는 사례.
  - 제안: docstring 을 "or a fixed AssertionError if the Job/container/args shape doesn't match" 정도로 낮추거나, 위 WARNING 처방과 함께 실제로 이름을 붙인다.

- **[INFO]** 동일한 설명(“kustomize 가 오버레이 밖 파일을 ConfigMap 으로 못 가져온다” 등)이 4곳에 근접 중복
  - 위치: `k8s/overlays/local/infra-minio.yaml:109-121`(Job 주석), `.claude/tests/test_minio_bucket_policy_parity.py:1-40`(모듈 docstring), `CHANGELOG.md`(`Unreleased — k8s 로컬 오버레이에서 아바타 이미지가 403 이던 것` 항목), `plan/in-progress/k8s-avatar-policy.md`(§A·§B)
  - 상세: kustomize 제약·heredoc 채택 이유·`set -e` 근거가 네 문서에 거의 같은 문장으로 반복된다. 저장소 관례상 각 산출물 옆에 근거를 재서술하는 것은 의도된 스타일(CLAUDE.md 의 "결정의 배경은 해당 문서 끝의 Rationale" 원칙과도 부합)이라 결함으로 보긴 어렵지만, kustomize 동작이 바뀌거나(예: 향후 버전이 옵션을 지원) 처방이 달라지면 4곳을 동시에 고쳐야 한다는 점은 남는다.
  - 제안: 조치 불요(의도된 관례). 다만 향후 kustomize 동작이 바뀌는 경우 네 곳을 함께 갱신해야 함을 인지.

- **[INFO]** `harness-checks.yml` pathspec 블록이 계속 선형으로 길어짐
  - 위치: `.github/workflows/harness-checks.yml:92-104` (`docker-compose.yml` 등 오브젝트 스토리지 매니페스트 섹션)
  - 상세: 이번 변경은 기존 관례(파일당 근거 주석 인접 배치)를 정확히 따라 새 pathspec(`scripts/minio/avatars-public-read.json`)과 주석을 추가했다. 새 결함은 아니지만, 목록이 이미 140줄에 달해 항목이 늘수록 "어느 가드가 어느 파일에 걸리는지" 를 손으로 추적하는 부담이 커진다. 이 파일 자체가 그 문제를 `test_harness_checks_paths_coverage.py`로 상쇄하고 있음을 이미 문서화하고 있어 별도 조치는 불요.

## 요약

신규 파일 `test_minio_bucket_policy_parity.py`는 함수가 짧고 책임이 명확히 나뉘어 있으며(추출 3함수 + 두 테스트 클래스), 매직 넘버 없이 상수(`JOB`, `BUCKET_VAR`)로 의도를 드러내고, docstring 에 근거·측정 결과·기각한 대안까지 상세히 남겨 가독성이 높다. `harness-checks.yml`·`infra-minio.yaml`·`CHANGELOG.md`·plan 파일의 변경도 기존 저장소 관례(주석 인접 배치, pathspec 확장, drift 가드 등재)를 그대로 따른다. 다만 신규 가드의 핵심 추출 함수 `job_script`가 바로 옆 자매 파일(`test_minio_image_parity.py`)이 정립해 놓은 `_dig`/`_seq`/`_expect_one` helper 재사용 및 "실패 사유별 명명" 관례를 따르지 않고 별도의 dict-체이닝 로직 + 뭉뚱그려진 에러 메시지를 새로 작성한 점이 유일한 실질적 유지보수성 리스크다 — 두 "parity" 가드가 같은 대상을 다루면서 탐색 로직 스타일이 갈라지면, 향후 한쪽만 개선되고 다른 쪽은 뒤처지는 drift 가 생길 수 있다. 그 외에는 CRITICAL/WARNING 수준의 가독성·네이밍·중첩·복잡도 문제는 발견되지 않았다.

## 위험도
LOW
