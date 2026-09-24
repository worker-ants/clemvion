# 아키텍처(Architecture) 리뷰 — MinIO 이미지 일치 가드

## 검토 범위

이번 diff 는 `codebase/**` 를 건드리지 않는 harness 전용 변경이다: 신규 회귀 테스트
`.claude/tests/test_minio_image_parity.py`, 그 트리거를 여는 `harness-checks.yml` pathspec 3줄,
그리고 카탈로그(README)·CHANGELOG·plan 문서 갱신. 아키텍처 관점의 실질 검토 대상은 사실상
`test_minio_image_parity.py` 하나이며, 이미 라운드 1(forced 7명, `review/code/2026/09/25/00_25_55`)에서
maintainability Warning 2(`k8s_images` 4단 `.get()` 체인 → `pod_template` 명명 + `_mapping()` 헬퍼)가
지적·조치되어 현재 파일에 반영되어 있음을 실제 파일(`Read`)로 확인했다. 아래는 그 지적과 중복되지 않는
아키텍처 고유 관점의 관찰이다.

## 발견사항

- **[INFO]** `PlaceNotFound` 가 `Exception` 이 아니라 `AssertionError` 를 상속해, 순수 파싱/추출 로직(`compose_images`,
  `k8s_images`)이 테스트 프레임워크의 타입에 결합되어 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:72-73` (`class PlaceNotFound(AssertionError)`), 이를 발생시키는
    `compose_images`(`:89`)·`k8s_images`(`:105`, `:113`)
  - 상세: 두 추출기 함수는 `ExtractorBoundaryTest` 에서 파일 I/O 없이 순수 함수로 단위 테스트되고(`:133-164`),
    docstring 도 "일반적인 YAML 자리 추출 유틸리티"로 서술한다 — 즉 레이어상 "테스트 assertion" 이 아니라
    "도메인 파싱 로직"에 가깝다. 그런데 그 로직이 실패를 나타내는 방식으로 `unittest`의 assertion 계열 타입을
    직접 상속해 쓴다. 이 파일 하나의 스코프(가드 전용, 재사용 없음)에서는 실질 위험이 없지만, 만약 이 추출기가
    다른 스크립트(예: CI 사전 검증 CLI)에서 재사용된다면 "장소를 못 찾음"이라는 정상적인 비즈니스 예외를
    `AssertionError` 로 캐치해야 하는 부자연스러운 결합이 드러난다.
  - 제안: 현재 스코프에서는 조치 불요(가드 전용 단일 파일, 재사용 계획 없음). 향후 추출기가 이 테스트 파일 밖으로
    재사용될 일이 생기면, 그 시점에 `PlaceNotFound`를 순수 `Exception` 서브클래스로 두고 테스트 쪽에서
    `assertRaises(PlaceNotFound)`로 감싸는 편이 레이어 경계가 더 깨끗하다.

- **[INFO]** `all_images()` 는 개방-폐쇄 원칙을 의도적으로 포기하고, 신규 매니페스트 추가 시 함수 본문을 직접
  고치도록 설계되어 있다(3줄 반복, 추상화 없음).
  - 위치: `.claude/tests/test_minio_image_parity.py:118-123`
  - 상세: 이는 라운드 1 SUMMARY INFO 14 에서 이미 "의도된 설계 — 지금 추상화하면 오히려 흐림"으로 처분되었고,
    module docstring(`:42-45`)과 `plan/in-progress/self-hosting-deployment.md`/`plan/in-progress/minio-image-parity-guard.md`
    양쪽에 "새 매니페스트는 자리 목록과 pathspec 에 손으로 추가"라는 확장 절차가 명시되어 있다. 세 파일·두 자료구조
    형태(`COMPOSE_SERVICES`: 문자열 튜플, `K8S_PLACES`: 3-tuple 튜플)를 억지로 공통 `Place` 프로토콜로
    통합하지 않은 것도 같은 판단이다 — 이 규모(3파일, 2추출기)에서 공통 인터페이스를 미리 만드는 것은 과도한
    추상화가 됐을 것이다. 확장 시나리오(Helm chart, production compose)가 `self-hosting-deployment.md` 체크리스트에
    구체적으로 반영되어 있어, "다음 사람이 잊는다"는 실패 모드에 대한 문서적 안전장치도 있다.
  - 제안: 조치 불요 — 현재 규모에서는 적절한 추상화 수준 판단으로 본다. 매니페스트가 4개 이상으로 늘어나는
    시점에 재검토하면 된다(이미 plan 체크리스트가 그 트리거를 명시).

- **[INFO]** (긍정 관찰) 추출기가 파일 경로가 아니라 원문 텍스트(`text: str`)를 인자로 받도록 설계되어 있어,
  I/O(파일 읽기, `all_images()`)와 파싱 로직(`compose_images`/`k8s_images`)이 분리된다.
  - 위치: `.claude/tests/test_minio_image_parity.py:83`, `:94`, `:118-123`
  - 상세: 이 분리 덕분에 `ExtractorBoundaryTest`(`:130-171`)가 실제 저장소 파일에 의존하지 않고 주입한 텍스트로
    경계 조건(누락된 서비스, 누락된 컨테이너, 중복 리소스, 형식 오류)을 독립적으로 고정할 수 있다 — Humble Object
    패턴에 가까운 구조로, 순수 로직과 부작용(파일 시스템 접근)을 테스트 용이성 관점에서 잘 분리했다. 별도
    조치 불요, 참고 사항으로만 기재.

- **[INFO]** (레이어 경계 관찰) `test_minio_image_parity.py`가 검사하는 세 파일(`docker-compose.yml`,
  `docker-compose.e2e.yml`, `k8s/overlays/local/infra-minio.yaml`)의 SoT 부재는 도구 생태계의 구조적 한계이며,
  이 가드는 그 한계를 해소하지 않고 **사후 검증으로 보완**한다.
  - 위치: `plan/in-progress/minio-image-parity-guard.md:26-27` (compose 와 kustomize 는 변수를 공유할 수 없어 SoT 를
    하나로 모을 수 없다는 서술), `.claude/tests/test_minio_image_parity.py:3-11`
  - 상세: 이는 이번 PR 의 의도된 스코프(구조 개선이 아니라 회귀 가드)이므로 결함이 아니다. 다만 두 compose
    파일(`docker-compose.yml`/`docker-compose.e2e.yml`) 자체는 YAML anchor/merge key 로 `minio`/`createbuckets`
    서비스 정의를 파일 **내부에서는** 공유할 수 있는 여지가 있어 보인다(다만 두 파일이 서로 다른 최상위 문서이므로
    파일 **간** 공유는 여전히 불가). 이 PR 의 범위 밖이므로 지금 처리할 사안은 아니고, 향후 compose 구조 리팩터링
    기회가 있을 때 참고할 메모 수준으로 남긴다.
  - 제안: 조치 불요 — 참고용 기재.

- **[INFO]** (교차 결합 관찰, 신규 아님) `test_minio_image_parity.py`의 모듈 수준 경로 상수(`DEV_COMPOSE` 등)는
  `test_harness_checks_paths_coverage.py`의 AST 기반 파서가 인식하는 특정 구문 형태(`ROOT / "a" / "b"`)를 따라야만
  pathspec 커버리지가 성립하는, 두 독립 테스트 파일 간의 암묵적 구문 계약이 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:56-58`
  - 상세: 이 계약은 타입 시스템이 아니라 다른 테스트의 통과/실패로만 강제되며, 이번 PR 이 새로 도입한 것이 아니라
    저장소에 이미 확립된 관례(`.claude/tests/README.md`의 `test_harness_checks_paths_coverage.py` 항목 서술)를
    그대로 따른 것이다. 실제로 이번 변경에서 그 형태를 지켰다는 것은 `test_harness_checks_paths_coverage.py`가
    pathspec 등재 전 세 파일을 지목하며 RED 였다가 등재 후 GREEN 이 됐다는 plan 의 TDD 순서 기록(`plan/in-progress/minio-image-parity-guard.md:79-81`)으로 뒷받침된다.
  - 제안: 조치 불요 — 기존 관례를 올바르게 따랐다.

## 검증용 뮤테이션

이번 리뷰에서는 저장소 파일을 별도로 뮤테이션하지 않았다 — plan 문서(`plan/in-progress/minio-image-parity-guard.md`
§B)에 M1~M5 다섯 개 뮤턴트의 예측·실측이 이미 기록되어 있고(M3 가 예측과 달랐던 사실까지 포함), 그 결과가
`test_minio_image_parity.py`의 단언 1 서술(`:24-29`)에 반영되어 코드·docstring·plan 세 표면이 일치함을 `Read`로
대조 확인했다. `git status --short` 로 워킹트리에 잔여 변경이 없음을 확인했다(리뷰 시작 시점부터 아무 파일도
쓰지 않았다).

## 요약

이번 변경은 프로덕션 코드(`codebase/**`)가 아니라 harness 회귀 테스트 한 개와 그 CI 트리거 등록으로 국한되어
있어 SOLID/레이어 분리/순환 의존성 관점에서 위험이 거의 없다. 추출기(파싱)와 I/O(파일 읽기)를 분리해 텍스트
주입 기반 경계 테스트를 가능케 한 구조는 이 규모의 가드에 적절한 설계이고, `all_images()`의 수동 확장 지점은
과도한 추상화를 피하면서도 plan 체크리스트로 확장 절차를 명문화해 두어 향후 매니페스트 추가 시 누락 위험을
낮춘다. 유일하게 짚을 만한 점은 `PlaceNotFound`가 `AssertionError`를 상속해 순수 파싱 로직이 테스트 프레임워크
타입에 약하게 결합된 것인데, 이 파일이 재사용 계획 없는 단일 목적 가드인 현재 스코프에서는 실질적 위험이
아니다. Critical/Warning 급 아키텍처 결함은 발견하지 못했다.

## 위험도
NONE
