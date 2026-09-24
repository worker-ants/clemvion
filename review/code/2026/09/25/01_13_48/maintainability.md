# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `k8s_images` 내부에 "정확히 하나여야 한다" 패턴이 두 번(리소스 단위·컨테이너 단위) 그대로 복제되어 있고, `compose_images`/`k8s_images` 사이에도 이미지 값 유효성 검사(`not isinstance(image, str) or not image`)가 문자 그대로 중복돼 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:128`(`if len(matches) != 1:`), `.claude/tests/test_minio_image_parity.py:135`(`if len(named) != 1:`) — 같은 "filter → len 검사 → PlaceNotFound(이름 포함)" 골격의 반복. 그리고 `.claude/tests/test_minio_image_parity.py:111`과 `.claude/tests/test_minio_image_parity.py:140` — 완전히 동일한 이미지 값 검사 조건문의 중복.
  - 상세: 코드 자체 주석(133번째 줄 부근 "Same 'exactly one' rule one level in")이 이 중복을 이미 인지하고 있다. 더 중요한 것은 이 파일의 리뷰 이력이다 — `plan/in-progress/minio-image-parity-guard.md` §B-2 가 "리뷰가 두 라운드 연속 같은 형태를 한 칸씩 안쪽에서" (리소스 수준 → 컨테이너 수준) 놓쳤다고 스스로 기록하고 있다. 즉 이 복제-비추출 구조가 실제로 한 세대 앞서 버그 은닉의 원인이었던 패턴이다. 지금은 뮤테이션 전수(B1~B4)로 각 분기를 개별 고정했으니 현재 동작은 안전하지만, 구조 자체는 그대로 남아 있어 향후 세 번째 "한 칸 더 안쪽" 자리(예: 컨테이너 내부의 volumeMounts 등)가 추가될 때 같은 실수가 재발할 표면을 제공한다.
  - 제안: `_expect_one(items: list, description: str) -> object` 같은 작은 헬퍼로 "filter → 정확히 1개 검사 → PlaceNotFound" 골격을 통합하고, 이미지 값 검사도 `_require_image_str(value, label) -> str`로 뽑아 `compose_images`/`k8s_images`가 공유하게 하면 분기 수가 줄고 향후 위치 추가 시 실수 표면이 하나로 좁아진다. 다만 현재 뮤테이션 스위트가 이미 각 분기를 개별 고정해 두었으므로 리팩터링 시 같은 뮤턴트 표(B1~B4, B5~B8)를 재실행해 동일하게 RED 가 나는지 재확인이 필요하다.

- **[INFO]** SHA-256 다이제스트 길이(64 hex)가 매직 넘버로 여러 테스트 메서드에 반복 하드코딩되어 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:162`(`"0" * 64`), `:240`(`"a" * 64`), `:252`(`"a" * 63`, 짧은 다이제스트), `:260`(`"a" * 64`).
  - 상세: `_PINNED` 정규식(파일 상단 주석, 74~76번째 줄)은 이미 "OCI 이미지 스펙이 sha256 인코딩을 64자 hex 로 정의한다"는 근거를 명시하고 있다. 그런데 그 상수 `64`가 코드에는 이름 없이 리터럴로 네 곳에 흩어져 있다. 오탈자로 한 곳만 63/65로 바뀌면(예: 짧은 다이제스트 테스트가 아닌 다른 자리에서) 실수인지 의도인지 코드만 보고 구분하기 어렵다.
  - 제안: 모듈 상단에 `SHA256_HEX_LEN = 64` 같은 이름 있는 상수를 두고 정규식과 테스트 픽스처가 모두 참조하게 하면, 이 값이 "OCI sha256 hex 길이"라는 단일 의미를 갖는다는 것이 코드에서 바로 보인다.

- **[INFO]** `test_k8s_duplicate_resource_is_named` 가 `_k8s()` 헬퍼(정적 메서드)와 동일한 YAML 형태를 손으로 다시 작성해 중복시키고 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:200`(`def test_k8s_duplicate_resource_is_named`)의 본문에 하드코딩된 `sts`/`job` 문자열 — 같은 파일 `:167`(`def _k8s`)의 StatefulSet/Job 골격과 사실상 동일한 구조를 별도로 정의.
  - 상세: `_k8s(job_containers)` 헬퍼는 이미 "유효한 StatefulSet 하나 + containers 리스트를 주입할 수 있는 Job 하나"를 만들어 준다. 이 테스트는 리소스를 중복시키는 시나리오라 헬퍼 시그니처 그대로는 못 쓰지만, StatefulSet 문자열 부분만이라도 별도 헬퍼(`_sts()`)로 뽑아 재사용했다면 같은 YAML 골격이 파일 안에 두 벌 존재하는 상태를 피할 수 있었다. 지금 구조에서는 `_k8s()`의 StatefulSet 부분이 나중에 바뀌면(예: 필드 추가) 이 테스트의 사본은 자동으로 따라가지 않는다.
  - 제안: 우선순위는 낮음(테스트 1곳뿐이라 실제 drift 위험은 작다) — 리팩터링 시 함께 정리해도 되는 수준.

## 요약

핵심 로직(`compose_images`/`k8s_images`/`pin_violation`/`is_distroless`)은 각 함수가 단일 책임을 가지고 가드 절 위주로 작성되어 중첩 깊이가 얕고, 모든 회귀 형태를 이름 있는 `PlaceNotFound` 예외로 구분해 실패 메시지의 가독성이 높다. 특히 뮤테이션 검증 이력(`plan/in-progress/minio-image-parity-guard.md` §B, §B-2)이 각 분기를 실측으로 고정해 놓아, 지금 상태의 동작 정확성 자체는 신뢰할 만하다. 다만 "정확히 하나" 검증 골격이 리소스/컨테이너 두 층위에 그대로 복제돼 있고 이미지 유효성 검사도 두 추출 함수 사이에 문자 그대로 중복돼 있는데, 이 특정 자리는 과거 두 라운드 리뷰에서 "한 칸씩 안쪽"으로 놓쳤던 바로 그 구조라 향후 확장(§B-2 각주가 암시하는 새 자리 추가) 시 같은 종류의 실수가 재발할 여지가 구조적으로 남아 있다. 그 외 SHA-256 길이 매직 넘버 반복, 테스트 픽스처 소규모 중복은 경미하다. 전체적으로 가독성·네이밍·일관성은 이 코드베이스의 다른 하네스 테스트와 부합하는 수준이며 즉시 조치가 필요한 CRITICAL 은 없다.

## 위험도

LOW
