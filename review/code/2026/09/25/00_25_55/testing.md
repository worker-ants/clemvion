# 테스트(Testing) 리뷰 — MinIO 이미지 일치 가드

## 발견사항

- **[WARNING] `k8s_images` 의 "동일 kind/name 리소스가 2개 이상 발견" 분기가 어떤 테스트로도 검증되지 않는다**
  - 위치: `.claude/tests/test_minio_image_parity.py:96-97` (`if len(matches) != 1: raise PlaceNotFound(...)`)
  - 상세: `matches` 는 `kind`+`metadata.name` 이 일치하는 YAML 문서 목록이고, 코드는 `!= 1` 로 "0개(못 찾음)"
    와 "2개 이상(중복)" 을 같은 분기에서 처리한다. 그런데 `ExtractorBoundaryTest.test_k8s_missing_container_is_named`
    (같은 파일 128번 줄)는 **컨테이너가 없는 경우만** 만들 뿐, 같은 `kind`+`name` 문서가 두 번 등장하는
    fixture 는 어디에도 없다. 이 PR 은 §B 뮤턴트 표(M1~M5, `plan/in-progress/minio-image-parity-guard.md`)에서
    "예측을 먼저 적고 실측으로 반증한다"는 방식을 스스로 강하게 표방하는데, 정작 자신이 새로 짠 `!= 1` 비교의
    절반(">1" 쪽)은 그 규율 밖에 있다. `!= 1` 을 `< 1` 로 바꾸는 뮤턴트를 넣어도 기존 스위트로는 잡히지 않는다
    (0-매치 케이스만 존재하는 fixture 로는 `!=1` 과 `<1` 이 동일하게 동작하기 때문).
  - 제안: k8s YAML 에 같은 `kind`+`metadata.name` 문서가 두 번 나오는 `ExtractorBoundaryTest` 케이스를
    하나 추가해 "found 2" 메시지를 `assertRaisesRegex` 로 고정한다. kustomize 오버레이는 base+patch 병합
    실수로 이런 중복이 실제로 생길 수 있는 형태라 가치가 낮지 않다.

- **[INFO] compose 쪽 서비스 값이 dict 가 아닌 경우(예: 리스트) 매핑 없이 원시 `AttributeError` 로 죽는다**
  - 위치: `.claude/tests/test_minio_image_parity.py:81` (`image = (services.get(svc) or {}).get("image")`)
  - 상세: `services.get(svc)` 가 `None`/falsy 가 아니면서도 dict 가 아닌 값(예: YAML 오탈자로 시퀀스가 들어간
    경우)이면 `.get("image")` 호출에서 `AttributeError` 가 나며, 이 가드가 스스로 표방하는 "실패는 항상
    자리 이름을 대는 `PlaceNotFound` 여야 한다"(docstring 1번 항목, README 신규 행)는 계약을 벗어난다.
    현재 `ExtractorBoundaryTest` 는 "키 자체가 없는" 경우만 다루고 "키는 있는데 형태가 잘못된" 경우는
    다루지 않는다. 실제 compose 파일이 이런 형태로 깨질 확률은 낮아 심각도는 낮지만, 이 가드 자신의
    "이름을 대며 실패한다" 원칙과의 괴리라 기록해 둔다.
  - 제안: 우선순위는 낮음 — 후속 강화 시 `isinstance(services.get(svc), dict)` 체크를 추가해 이 경우도
    `PlaceNotFound` 로 승격하는 편이 원칙과 일치한다.

## 긍정적 관찰 (참고)

- `compose_images`/`k8s_images`/`all_images` 가 파일 경로가 아니라 **텍스트**를 받도록 설계되어
  `ExtractorBoundaryTest` 가 실제 리포지토리 파일에 앞서 추출기 자체를 주입된 텍스트로 먼저 고정한다 —
  의존성 주입이 잘 되어 있어 테스트 용이성이 높다.
- `MinioImageParityTest.setUp` 이 실제 저장소 세 파일을 읽어 `self.images` 를 세팅하고, 각 테스트는
  그 결과만 순수하게 assert 한다 — 파일 I/O 는 read-only 이고 테스트 간 공유 mutable 상태가 없어 격리에
  문제가 없다(순서 무관하게 독립 실행 가능함을 로컬 실행으로 확인: `python3 -m unittest discover -s
  .claude/tests -p 'test_minio_image_parity.py' -v` → 7 tests OK).
  `test_harness_checks_paths_coverage.py` (신규 pathspec 3줄 반영 대상)도 로컬에서 26 tests OK로 회귀 없음을 확인했다.
- 각 단언이 실패 시 "어떤 회귀 형태인지" 이름을 대는 메시지를 갖는다(`_render`로 자리별 값 전부 출력,
  `subTest(place=place)`로 어느 자리인지 특정) — 테스트 가독성·디버깅 용이성이 높다.
- 플랜 문서(`plan/in-progress/minio-image-parity-guard.md` §B)의 뮤턴트 표(M1~M5)는 예측을 먼저 적고
  실측을 나중에 채우는 방식으로 검증됐고, M3 에서 예측이 반증되자(`setUp` 에서 추출 실패 시 네 단언이
  모두 RED) 그 결과를 반영해 단언 1의 서술 자체를 고쳤다(§A, 취소선 처리) — 근거를 실측 없이 적지 않는
  이 리포지토리 관례를 잘 지킨 사례다.
- mock 을 전혀 쓰지 않고 실제 파일을 읽는 설계가 이 가드의 목적(실제 저장소 상태의 일치를 검증)과
  정확히 부합한다 — 이 맥락에서는 mock 을 쓰는 쪽이 오히려 실제 동작과의 괴리를 만들었을 것이다.
- `_PINNED` 정규식의 경계 테스트(digest 없음·digest만 있고 tag 없음·digest 길이 부족)가 "tag AND digest"
  라는 계약을 정확히 겨냥해 짜여 있다.

## 요약

신규 `test_minio_image_parity.py` 는 추출기를 텍스트 주입으로 먼저 고정하고 실제 파일 검증을 분리하는
등 테스트 용이성·격리·가독성이 전반적으로 우수하며, mock 없이 실제 파일을 읽는 설계도 가드의 목적에
부합한다. 다만 이 PR 자신이 강조하는 뮤턴트 기반 회귀 검증 규율에도 불구하고 `k8s_images` 의
`len(matches) != 1` 분기 중 "중복 리소스(2개 이상 매치)" 쪽 절반은 어떤 fixture 로도 실측되지 않아
`!= 1` → `< 1` 급의 뮤턴트를 놓칠 수 있다(WARNING). compose 쪽의 malformed-type 방어 부재는 발생
가능성이 낮아 INFO 로 남긴다. 두 항목 모두 이번 가드의 핵심 목적(6곳의 이미지 일치)에는 영향이 없고
병합을 막을 사안은 아니다.

## 위험도
LOW
