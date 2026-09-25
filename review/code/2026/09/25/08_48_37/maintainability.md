# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 언더스코어(private) 헬퍼를 형제 테스트 모듈에서 직접 import
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:54` (`from test_minio_image_parity import PlaceNotFound, _dig, _expect_one, _seq`)
  - 상세: `_dig`/`_expect_one`/`_seq` 는 `test_minio_image_parity.py` 안에서 선행 언더스코어로 "모듈 전용" 임을 표시한 이름인데, 이 파일이 그것을 그대로 import 해 쓴다. 파이썬이 강제하진 않지만, 이름 자체가 "이 모듈 밖에서 참조하지 말 것"이라는 신호를 주므로 실제 사용(공개 계약)과 이름 규약이 어긋난다. 두 파일이 이 셋을 암묵적으로 공유 계약처럼 쓰고 있는데, 그 계약이 코드 어디에도 명시적 인터페이스로 드러나지 않는다. 현재는 바로 위 주석(50~53번째 줄)이 "중복 대신 재사용" 의도를 설명하고 있어 의도적 선택임은 분명하지만, `test_minio_image_parity.py` 쪽에서 이 헬퍼들의 이름을 바꾸거나 시그니처를 조정하면 이 파일은 `ImportError`로만 알아챌 수 있다.
  - 제안: 두 파일이 모두 이미 import 하는 `_harness` 모듈(둘 다 `from _harness import REPO_ROOT`를 쓴다)로 이 네 개(`PlaceNotFound`, `dig`, `expect_one`, `seq`)를 옮기고 언더스코어 없이 공개 이름으로 노출하면, "의도적으로 공유되는 헬퍼"라는 사실이 이름과 위치 양쪽으로 드러난다.

- **[INFO]** 버킷 치환 로직(`BUCKET_VAR.replace(...)`)이 두 테스트에서 거의 동일하게 반복
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:184`, `:189`
  - 상세: `test_heredoc_equals_canonical_policy`(184번째 줄, 실제 캐노니컬 버킷으로 치환)와 `test_no_list_bucket_anywhere`(189번째 줄, 임의 값 `"b"`로 치환)가 각각 `self.heredoc.replace(BUCKET_VAR, ...)` → `json.loads(...)` 패턴을 인라인으로 반복한다. 두 곳뿐이라 심각하지 않지만, 세 번째 사용처가 생기면 그대로 세 번째 반복이 될 가능성이 있다.
  - 제안: `def _heredoc_json(self, bucket: str) -> dict: return json.loads(self.heredoc.replace(BUCKET_VAR, bucket))` 같은 작은 헬퍼로 추출하면 두 테스트의 의도(정규화 후 동일성 / 버킷 값과 무관하게 ListBucket 없음)가 더 명확해진다.

- **[INFO]** `/tmp/avatars-public-read.json` 경로 리터럴이 heredoc 안에서 두 번 반복
  - 위치: `k8s/overlays/local/infra-minio.yaml:130`(`cat > /tmp/avatars-public-read.json <<EOF`), `:143`(`mc anonymous set-json /tmp/avatars-public-read.json local/"$S3_BUCKET"`)
  - 상세: 같은 파일 경로 문자열이 스크립트 안에서 하드코딩된 채 두 번 나온다. 이 PR 자체가 "버킷 이름을 두 번 하드코딩하지 않기 위해 `$S3_BUCKET` 변수를 쓴다"는 원칙을 정책 rationale 로 명시하고 있는데(같은 파일 112~114번째 줄 주석), 임시 파일 경로에는 같은 원칙이 적용되지 않았다. `set -e` 덕분에 오탈자는 배포 시점에 시끄럽게 실패하므로 위험도는 낮지만, 셸 변수 하나로 묶으면 이 파일을 고칠 때 동기화해야 할 자리가 하나 줄어든다.
  - 제안: 스크립트 앞부분에서 `POLICY_FILE=/tmp/avatars-public-read.json` 을 선언하고 두 자리 모두 `"$POLICY_FILE"` 을 참조.

- **[INFO]** 같은 설계 근거(heredoc 채택 이유·`set download` 금지·`set -e` 필요성)가 4개 파일에 독립적으로 산문으로 반복
  - 위치: `scripts/minio/README.md:11-17`, `plan/in-progress/k8s-avatar-policy.md`(§B, 28~37번째 줄), `k8s/overlays/local/infra-minio.yaml:109-121`(주석), `.claude/tests/test_minio_bucket_policy_parity.py:1-40`(모듈 docstring)
  - 상세: 네 곳 모두 "kustomize 가 오버레이 밖 파일을 못 가져온다 / 버킷 이름 하드코딩 회피 / `set download` 는 ListBucket 을 함께 연다 / `set -e` 없으면 앞 명령 실패가 가려진다"는 같은 세 가지 사실을 각자의 문장으로 다시 서술한다. 정책 JSON 자체의 일치는 테스트가 기계적으로 고정하지만, 이 산문 설명들 사이의 일치는 아무것도 강제하지 않는다 — 설계가 바뀌면(예: heredoc 대신 다른 방식 채택) 네 곳을 사람이 손으로 찾아 고쳐야 한다.
  - 제안: 이미 README 가 "정본" 성격(`docstring`·YAML 주석·plan 이 모두 README 를 인용)이므로, YAML 주석과 테스트 docstring 은 핵심 사실을 요약 인용하는 정도로 줄이고 전체 rationale 은 README 하나만 가리키는 방향을 고려할 수 있다. 다만 이 저장소는 각 위치별 독립 서술을 관례로 채택하고 있어(`MEMORY` 의 "Rationale" 패턴과 일치) 현재 상태를 CRITICAL/WARNING 으로 볼 근거는 아니다.

- **[INFO]** `ExtractorBoundaryTest` 클래스 이름이 형제 테스트 파일과 동일
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:115` vs `.claude/tests/test_minio_image_parity.py:180`
  - 상세: 서로 다른 모듈이라 pytest 수집에는 문제없고, 오히려 "각 가드 모듈이 자신의 추출기 경계를 `ExtractorBoundaryTest` 로 고정한다"는 기존 관례를 그대로 따른 것으로 보인다. 다만 `pytest -k ExtractorBoundaryTest`처럼 이름만으로 필터링하면 두 파일의 테스트가 함께 걸려 나와, 실패 로그를 훑을 때 어느 가드의 실패인지 파일 경로까지 봐야 구분된다.
  - 제안: 특별한 조치 불요(기존 관례 준수). 필요하면 두 클래스 모두 `Test` 대신 `Job스크립트Extractor...` 식으로 더 구체화하는 것도 가능하나 우선순위는 낮다.

## 요약

새로 추가된 `.claude/tests/test_minio_bucket_policy_parity.py`는 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, `PlaceNotFound`/`_expect_one` 패턴으로 실패 지점을 이름으로 특정하는 기존 가드(`test_minio_image_parity.py`)의 관례를 잘 따른다. 매직 넘버는 없고 네이밍도 일관적이다. 발견된 항목은 모두 INFO 수준으로 — (1) 형제 모듈의 언더스코어 헬퍼를 공개 계약처럼 import 하는 이름-용도 불일치, (2) 버킷 치환 로직의 소규모 중복, (3) 임시 파일 경로 리터럴의 이중 하드코딩, (4) 설계 근거 산문이 4개 파일에 독립 반복되는 문서 동기화 부담이다. 어느 것도 즉시 결함으로 이어지지는 않으며, 대부분 코드 내 주석이 그 트레이드오프를 이미 의식적으로 설명하고 있다.

## 위험도

LOW
