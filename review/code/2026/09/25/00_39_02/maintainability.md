# 유지보수성(Maintainability) 리뷰 — MinIO 이미지 일치 가드 (2라운드)

## 검토 범위

`.claude/tests/test_minio_image_parity.py`(신규, 207줄) + 그 트리거 표면(`harness-checks.yml`
pathspec 3줄, `.claude/tests/README.md` 카탈로그 행, `CHANGELOG.md`, plan 문서 3건, 1라운드
리뷰 산출물 `review/code/2026/09/25/00_25_55/**`). 1라운드(`review/code/2026/09/25/00_25_55`)에서
이미 Warning 3건이 지적되어 `c8a1a59b6` 로 조치됐다 — 그중 maintainability Warning 2(`k8s_images`의
`spec → template → spec → containers` 4단 `.get()` 체인)는 `pod_template` 이름 있는 변수와
`_mapping()` 헬퍼로 이미 완화되어 있는 상태를 대상으로 다시 검토했다. 이번 라운드는 그 조치 이후
상태에서 **새로운** 유지보수성 결함이 있는지, 그리고 조치가 실제로 충분한지를 본다.

## 발견사항

- **[INFO]** "비어있지 않은 문자열" 검증 로직이 두 곳에서 형태만 살짝 다르게 반복된다.
  - 위치: `.claude/tests/test_minio_image_parity.py:88` (`compose_images` 의
    `if not isinstance(image, str) or not image:`) 와 `:112` (`k8s_images` 의
    `if len(images) != 1 or not isinstance(images[0], str) or not images[0]:`)
  - 상세: 두 곳 모두 "값이 존재하고 비어있지 않은 문자열인가"를 인라인으로 반복한다. 각 1줄뿐이고
    주변 조건(리스트 길이 검사 등)과 섞여 있어 지금 당장 가독성을 해치지는 않지만, 세 번째 자리가
    추가되면(`self-hosting-deployment.md` 가 예고하는 Helm chart 등) 같은 조건이 세 번째로 복제될
    가능성이 있다.
  - 제안: 우선순위 낮음. `_nonempty_str(x: object) -> bool` 같은 1줄 헬퍼로 통일할 수 있으나, 지금
    호출부가 2곳뿐이라 강제할 정도는 아니다. 세 번째 자리가 생기는 시점에 재고 권장.

- **[INFO]** `k8s_images` 의 중첩 추출 체인이 1라운드 조치(Warning 2)로 완화되었으나 여전히
  `_mapping()` 이 2단으로 중첩돼 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:106`
    (`pod_template = _mapping(_mapping(matches[0].get("spec")).get("template"))`)
  - 상세: `pod_template` 이라는 이름 있는 중간 변수가 생겨 4단 체인이던 것이 실질적으로 2단(파이프라인이
    아니라 named step)으로 읽히게 됐고, 1라운드 SUMMARY 가 제안한 두 안(이름 있는 변수 / `_dig` 헬퍼)
    중 전자를 택한 것으로 판단된다 — 조치는 유효하다. 다만 `_mapping(_mapping(x).get(a)).get(b))` 형태
    자체는 `compose_images:84` 에도 동일 패턴(`_mapping(_mapping(yaml.safe_load(text)).get("services"))`)으로
    나타나 파일 전체의 일관된 관용구가 되어 있다 — 이는 오히려 읽는 사람이 한 번 배우면 반복 인식되는
    장점으로 본다. 추가 조치 불요.
  - 제안: 없음(관찰 기록).

- **[INFO]** `_mapping()` 의 반환 타입이 파일의 다른 타입 힌트(`dict[str, str]`)와 달리 파라미터화되지
  않은 `dict` 다.
  - 위치: `.claude/tests/test_minio_image_parity.py:76` (`def _mapping(value: object) -> dict:`)
  - 상세: 헬퍼가 감싸는 YAML 노드의 값 타입이 문자열·리스트·중첩 매핑 등으로 다양해 의도적으로
    느슨하게 둔 것으로 보이나, 파일 나머지가 `dict[str, str]` 를 일관되게 쓰는 것과 대비된다.
  - 제안: `dict[str, object]` 로 좁혀도 동작·가독성에 손실이 없다 — 선택 사항.

## 긍정 관찰 (조치 상태 확인)

- 1라운드 Warning 2(4단 `.get()` 체인)는 `pod_template` 명명 + `_mapping()` 헬퍼로 실질적으로
  해소됐다 — 새 경계 테스트(`test_k8s_missing_container_is_named`, `test_k8s_duplicate_resource_is_named`)와
  기존 테스트가 모두 통과하는 상태이며, 동작 변경 없이 가독성만 개선했다는 RESOLUTION.md 서술과
  코드가 일치한다.
- `PlaceNotFound(AssertionError)` 는 저장소 기존 관례(`test_override_floors.py`의
  `StubNotUsed(AssertionError)`)와 동일한 패턴 — "이름 있는 예외로 실패 지점을 특정한다"는 스타일이
  일관적이다.
- 함수 길이·중첩 깊이·순환 복잡도 모두 낮다: 모든 함수가 20줄 이하이고 분기는 2~3개 수준이며,
  `for` 루프 안 리스트 컴프리헨션이 한 겹으로 제한돼 있다.
- 매직 넘버(`sha256` 64자리, digest 접두사 등)는 정규식 주석과 모듈 docstring 양쪽에서 근거가
  설명되어 있어 "왜 이 숫자인지"가 코드 밖에서도 추적된다.
- `all_images()` 의 3줄 반복(compose 두 파일 + k8s 한 파일)은 "새 매니처를 추가하려면 여기 손으로
  더한다"는 설계 의도를 그대로 드러내는 반복이며, 1라운드에서 이미 의도적 반복으로 처분됐다 —
  이번 라운드에서도 동일 결론(추상화가 오히려 그 의도를 흐린다).

## 요약

1라운드에서 지적된 유일한 maintainability Warning(4단 중첩 `.get()` 체인)은 `pod_template` 이름
있는 변수와 `_mapping()` 헬퍼로 적절히 해소됐고, 그 조치가 파일 전체의 기존 관용구(`_mapping()` 2단
중첩 패턴)와 일관되게 녹아들어 있다. 이번 라운드에서 새로 발견된 항목은 모두 INFO 수준의 사소한
잔여 중복/타입 힌트 느슨함으로, 지금 당장 가독성이나 유지보수 비용에 실질적 영향을 주지 않는다.
모듈 docstring 이 6곳의 위치·4개 단언의 회귀 형태·트리거 메커니즘·범위 한계를 촘촘히 서술하고 있어
다음 사람의 재추론 비용이 낮고, 함수 길이·중첩·복잡도·네이밍 모두 저장소 기존 테스트 스위트 관례와
정합적이다.

## 위험도
NONE
