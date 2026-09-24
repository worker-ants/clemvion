# 요구사항(Requirement) 리뷰 — MinIO 이미지 일치 가드 (2라운드)

## 검토 범위

`.claude/tests/test_minio_image_parity.py`(신설) + 이를 트리거하는 `.github/workflows/harness-checks.yml`
pathspec 3줄 + 문서화 표면(`README.md`·`CHANGELOG.md`·`plan/in-progress/minio-image-parity-guard.md`) +
파생 plan 갱신(`self-hosting-deployment.md`·`spec-draft-nullable-notation-followups.md`) + 1라운드 리뷰
산출물(`review/code/2026/09/25/00_25_55/**`, 커밋됨).

이번 diff 는 1라운드 fix 커밋(`c8a1a59b6`)이 이미 반영된 최종 상태다. 실제 저장소 파일을 직접 Read/실행해
아래를 교차 검증했다(저장소 트리 변경 없음 — 종료 시 `git status --short` 로 확인, 이 세션 출력 디렉터리
외 변경 없음):

- `python3 -m pytest .claude/tests -q` → **1149 passed, 1272 subtests passed** — RESOLUTION.md 가 적은
  수치와 정확히 일치.
- `python3 -c "...all_images()..."` 로 세 실제 파일(`docker-compose.yml`·`docker-compose.e2e.yml`·
  `k8s/overlays/local/infra-minio.yaml`)에서 여섯 값을 직접 추출 — 여섯 모두
  `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:<64hex>` 로 동일, digest 64자 확인.
- `.github/workflows/harness-checks.yml` 의 `.claude/tests/**` 항목이 이미 신규 테스트 파일 자체를
  커버함을 확인 — 이번에 추가된 3줄(compose 2 + k8s 1)은 "가드가 감시하는 **데이터**(이미지 문자열이 박힌
  세 매니페스트)가 가드 자신을 트리거하지 않는다"는 별개 클래스를 막는 것으로, 중복 등재가 아니다.
- 헤더 주석 "PyYAML 이 harness CI 의 유일 허용 의존성" 주장을 워크플로 실제 `pip install "pyyaml>=6,<7"`
  스텝과 대조 — 일치.
- TODO/FIXME/HACK/XXX 검색 — 신규 파일·워크플로·plan 어디에도 없음.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec fidelity 회색지대).
  - 위치: `spec/data-flow/4-file-storage.md`(제품 레벨 S3/MinIO 서술만 존재)
  - 상세: `spec/` 에서 MinIO 를 언급하는 문서는 제품 기능(파일 저장소 역할·엔드포인트 설정)만 다루고,
    docker-compose/k8s 매니페스트의 이미지 태그·다이제스트 고정 같은 배포 인프라 세부는 어느 spec 문서의
    관할도 아니다. 이는 SPEC-DRIFT 가 아니라 애초에 spec 이 다루지 않는 층(harness/infra 회귀 테스트)이다.
  - 제안: 조치 불요.

- **[INFO]** 1라운드 Warning 3건·INFO 1건(코드 동반)이 실제로 해소됐음을 코드 레벨에서 재확인.
  - 위치: `.claude/tests/test_minio_image_parity.py:94-115`(`k8s_images`), `:148-158`
    (`test_k8s_duplicate_resource_is_named`), `:160-164`(`test_compose_malformed_service_is_named_not_attribute_error`)
  - 상세: (1) k8s 중복 리소스 분기(`len(matches) != 1`)가 이제 `test_k8s_duplicate_resource_is_named` 로
    exercise 됨 — 직접 실행해 GREEN 확인(`Job/minio-create-bucket`·`StatefulSet/minio` 중복 fixture 로
    `expected one StatefulSet/minio, found 2` 를 재현). (2) 4단 `.get()` 체인이 `pod_template` 변수 +
    `_mapping()` 헬퍼로 개명·평탄화됨. (3) compose 서비스 값이 mapping 이 아닐 때(list) `_mapping()` 이
    `PlaceNotFound` 로 승격 — "실패는 항상 이름을 댄다" 원칙과 일치. `self-hosting-deployment.md` 의
    스코프 혼입(아바타 정책 세부)도 체크박스 한 줄 + 상호 참조로 축소됨.
  - 제안: 없음 — 긍정 관찰.

- **[INFO]** 데이터 유효성·엣지 케이스 커버리지 양호.
  - 위치: `.claude/tests/test_minio_image_parity.py:130-171`(`ExtractorBoundaryTest`)
  - 상세: 자리 누락(compose/k8s), 중복 리소스, malformed shape(시퀀스가 매핑 자리에), 정규식 4-엣지(디지스트
    없음/디지스트만/짧은 디지스트/정상)까지 injected text 로 먼저 고정한 뒤 실제 파일을 신뢰하는 구조라
    "0개가 서로 같다"는 공허 통과 경로가 없다. `all_images()` 는 항상 `setUp` 에서 호출되므로 어느 자리든
    하나라도 못 찾으면 `MinioImageParityTest` 의 네 단언이 전부 실패(이름을 대며)한다는 것도 실제 실행으로
    확인.
  - 제안: 없음.

## 요약

신규 하네스 가드는 docstring·README·CHANGELOG·plan 이 서술하는 기능(6곳 이미지 문자열 일치, tag+digest
고정, `latest`/`-distroless` 금지, 자리 목록 축소 방지)을 코드로 정확히 구현하고 있으며, 실제 세 매니페스트
파일을 직접 파싱해 여섯 값이 모두 동일함과 harness 전체 스위트(1149 passed)가 RESOLUTION.md 의 수치와
일치함을 실행으로 확인했다. 1라운드 Warning 3건과 동반 INFO 1건은 커밋 `c8a1a59b6` 로 코드 레벨에서
실제 해소됐다(중복 리소스 fixture, `_mapping` 헬퍼, malformed-shape 승격, plan 스코프 축소 — 모두 코드
읽기로 재확인). 이번 변경이 다루는 층(CI harness·배포 매니페스트 이미지 고정)은 `spec/` 어느 문서의
요구사항 본문도 규정하지 않아 spec fidelity 는 순수 회색지대(INFO)이고, TODO/FIXME 류 미완성 표식은 없다.
Critical/Warning 급 요구사항 결함은 발견되지 않았다.

## 위험도

NONE
