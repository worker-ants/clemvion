# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `compose_images` 와 `k8s_images` 사이의 이미지 값 검증 블록이 사실상 동일한 형태로 두 번 반복된다.
  - 위치: `.claude/tests/test_minio_image_parity.py:104-105` (`compose_images`), `.claude/tests/test_minio_image_parity.py:133-134` (`k8s_images`)
  - 상세: 두 곳 모두 `if not isinstance(image, str) or not image: raise PlaceNotFound(f"...")` 형태다. 술어는 완전히 동일하고 메시지 포맷만 다르다.
  - 제안: 현재도 각 2줄 규모라 헬퍼로 뽑으면 메시지 포맷을 파라미터화해야 해서 오히려 간접성이 늘 수 있다. 코드베이스 관례상("진짜 동일 보일러플레이트만 추출, axes 발산 full-unification 은 defer" — `project_reaper_engine_dry_refactor_920`) 지금 규모에서는 그대로 두는 편이 낫다고 판단되며, 참고용으로만 남긴다. 추가로 반복되면 `_require_image_str(value, place_label) -> str` 같은 작은 헬퍼로 통합을 고려.

- **[INFO]** `k8s_images` 의 컨테이너 목록 추출에서 `_mapping()` 과 대칭되는 시퀀스 가드가 없다.
  - 위치: `.claude/tests/test_minio_image_parity.py:175` — `containers = _mapping(pod_template.get("spec")).get("containers") or []`
  - 상세: 매핑 타입에는 `_mapping()` 헬퍼로 일관되게 방어하면서, 리스트 타입 자리에는 `or []` 를 인라인으로 쓴다. 다만 바로 다음 줄의 리스트 컴프리헨션이 `isinstance(c, dict)` 로 원소를 걸러내므로(`containers` 가 문자열 등 truthy-비리스트여도 반복 시 dict 인 원소가 하나도 안 나와 `named` 가 0개가 되어 안전하게 `PlaceNotFound` 로 귀결), 정확성 결함은 아니다. 스타일 일관성만의 문제.
  - 제안: 필요하면 `_mapping` 과 짝을 이루는 `_sequence(value)` 헬퍼를 추가해 대칭을 맞출 수 있으나, 현재도 안전하므로 필수는 아니다.

## 요약

`.claude/tests/test_minio_image_parity.py` 는 함수 단위가 작고(가장 긴 `k8s_images` 도 약 27줄, 순환 복잡도 낮음) 중첩도 for-루프 안에 순차적 `if` 3개뿐으로 깊지 않다. 네이밍(`compose_images`/`k8s_images`/`pin_violation`/`is_distroless`/`PlaceNotFound`)이 목적을 명확히 드러내고, `_PINNED` 정규식의 `64` 등 숫자·패턴은 모두 인접 주석으로 설명돼 매직 넘버로 보기 어렵다. 모듈 최상단의 긴 docstring(원인·재발 이력·설계 근거)은 이 저장소의 다른 harness 테스트(`test_dependabot_npm_coverage.py` 등)에서도 반복되는 확립된 컨벤션이라 일관성이 있다. 발견한 두 항목은 모두 실제 결함이 아닌 사소한 스타일 관찰(경미한 검증 블록 중복, 매핑/시퀀스 가드 비대칭)이며 코드베이스의 "과잉 통합 지양" 관례에 비추어 현 상태 유지가 합리적이다. `.github/workflows/harness-checks.yml` 은 항목별 근거 주석이 붙은 데이터 목록에 세 줄을 추가한 것으로 기존 파일의 확립된 패턴(pathspec 옆에 왜 등재했는지 주석)을 그대로 따른다. `plan/in-progress/*.md` 두 파일은 코드가 아닌 계획 문서로 구조적 결함은 없다. 전반적으로 이 변경은 가독성·네이밍·복잡도·일관성 모든 축에서 코드베이스 기준을 충족한다.

## 위험도

LOW
