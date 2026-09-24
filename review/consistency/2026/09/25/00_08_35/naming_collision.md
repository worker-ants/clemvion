# 신규 식별자 충돌 검토 — `minio-image-parity-guard`

## 검토 범위 확인

Target 은 `plan/in-progress/minio-image-parity-guard.md` (harness-only, `spec_impact: none`) 다.
번들에 포함된 `spec/0-overview.md §2.7`·`spec/data-flow/4-file-storage.md` 는 scope 매칭(`scope-storage/`)으로
딸려온 **참조용 기존 spec** 이며, target 이 이 문서들을 수정하지 않는다 — 즉 target 이 spec 층에
새로 도입하는 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var 는 없다. 아래 항목별로 실제 신규
식별자만 대조했다.

## 발견사항

- **[INFO]** 신규 하네스 테스트 파일명은 기존 명명 컨벤션과 충돌 없음
  - target 신규 식별자: `.claude/tests/test_minio_image_parity.py`
  - 기존 사용처: `.claude/tests/` 디렉터리 전체 (예: `test_harness_checks_paths_coverage.py`, `test_dependabot_npm_coverage.py`)
  - 상세: `ls .claude/tests/`로 전수 확인한 결과 동일 이름·유사 이름 파일 없음(`grep -rln "minio" .claude/tests/` 0건). `test_<subject>.py` 컨벤션에도 부합한다.
  - 제안: 없음 (충돌 없음 — 참고용으로만 기록)

- **[INFO]** plan 이름 `minio-image-parity-guard` 는 선행 plan `minio-silo-image` 와 구별됨
  - target 신규 식별자: `plan/in-progress/minio-image-parity-guard.md` (worktree 이름도 동일)
  - 기존 사용처: `plan/complete/minio-silo-image.md` (2026-09-24 종결, 이미지를 `pgsty/silo` 로 교체한 선행 작업), `plan/complete/e2e-minio-registry.md`
  - 상세: 두 plan 명이 "minio" 접두를 공유하지만 목적이 다르다 — `minio-silo-image`는 이미지 교체 자체, `minio-image-parity-guard`는 교체 후 6개 참조처의 일치를 지키는 회귀 가드. target 문서 본문이 스스로 전자를 명시적으로 참조(`#1392`)하고 있어 혼동 여지가 낮다.
  - 제안: 없음 — 현재로도 구분 가능. 다만 향후 유사 접두 plan 이 늘어나면 `plan/complete/` 인덱스에서 짧은 설명을 함께 두는 것을 권장.

- **[INFO]** harness-checks.yml pathspec 3줄은 새 파일 경로가 아니라 기존 파일의 신규 "등재"
  - target 신규 식별자: `docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/local/infra-minio.yaml` 를 `harness-checks.yml` `changes.pathspecs` 에 개별 항목으로 추가
  - 기존 사용처: `.github/workflows/harness-checks.yml` 의 기존 pathspec 목록 (`.claude/**`, `.github/workflows/**`, `scripts/*.py` 등)
  - 상세: 세 경로 모두 저장소에 이미 존재하는 실제 파일이며 신규 파일 생성이 아니다. 현재 pathspec 목록에 `docker-compose*.yml`/`k8s/**` 항목이 없음을 확인했고(`grep -n "docker-compose\|k8s/" harness-checks.yml` 0건), `test_harness_checks_paths_coverage.py::PRODUCT_PREFIXES`에도 `k8s/`가 빠져 있어 target 이 서술한 "k8s 는 PRODUCT_PREFIXES 밖" 전제와 일치한다. 이름 충돌 여지 없음.
  - 제안: 없음

- **[INFO]** MinIO 관련 기존 식별자(서비스명 `minio`/`createbuckets`, ENV `S3_ENDPOINT` 등)는 target 이 그대로 재사용할 뿐 새로 정의하지 않음
  - target 신규 식별자: 없음 (target 뮤턴트 표·설계 섹션이 언급하는 `minio`/`createbuckets`/이미지 문자열은 `#1392`가 이미 도입한 기존 식별자)
  - 기존 사용처: `docker-compose.yml:30,59` / `docker-compose.e2e.yml:65,80` / `k8s/overlays/local/infra-minio.yaml`
  - 상세: 새 ENV var·config key·엔티티명이 target 에 없으므로 충돌 가능성 자체가 성립하지 않는다.
  - 제안: 없음

## 요약

Target 은 `spec/` 을 건드리지 않는 harness-only 회귀 테스트 추가(`spec_impact: none`)로, 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var 등 스펙 층의 신규 식별자를 하나도 도입하지 않는다. 유일한 신규 이름은 테스트 파일 `.claude/tests/test_minio_image_parity.py` 이며 기존 `.claude/tests/` 명명 컨벤션(`test_<subject>.py`)과 충돌 없이 부합한다. plan 이름 `minio-image-parity-guard` 도 선행 완료 plan `minio-silo-image` 와 명확히 구분되고 본문이 그 관계를 스스로 밝히고 있다. harness-checks.yml 에 추가할 pathspec 3줄은 이미 존재하는 파일 경로를 등재하는 것일 뿐 새 경로 충돌이 아니다. 신규 식별자 충돌 관점에서 문제 될 항목이 없다.

## 위험도

NONE
