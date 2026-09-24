# Consistency Check 통합 보고서

**BLOCK: NO**

## 전체 위험도
**LOW** — Critical/차단 사유 없음. WARNING 1건(신규 drift 가드 테스트 파일명이 기존 이미지 패리티 가드와 이름 패턴이 인접해 스코프 혼동 소지)만 존재하며, 구현 착수를 막을 사유는 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 신규 drift 가드 `test_minio_bucket_policy_parity.py` 가 기존 `test_minio_image_parity.py` 와 `test_minio_*_parity.py` 이름 패턴을 공유해, 두 가드가 같은 대상(`k8s/overlays/local/infra-minio.yaml` Job `minio-create-bucket`)을 서로 다른 축(이미지 다이제스트 vs 버킷 정책)으로 검사한다는 사실이 문서·주석에서 드러나지 않으면 "이미 하나가 parity 를 다 본다"는 오인으로 이어져 신규 가드의 트리거 pathspec(`scripts/minio/avatars-public-read.json`) 등재 누락 위험(`#1390` 과 같은 클래스)이 실재함 | `.claude/tests/test_minio_bucket_policy_parity.py` (plan §B "drift 가드") | `.claude/tests/test_minio_image_parity.py` (커밋 `643813935`), `.claude/tests/README.md:48`, `.github/workflows/harness-checks.yml:92-98` 기존 주석 | 이름은 유지하되 (a) 신규 가드 docstring 첫 줄에 `test_minio_image_parity.py` 를 명시적으로 언급하고 "이미지 태그가 아니라 버킷 정책을 본다"고 구분, (b) `harness-checks.yml` 92-95번째 줄 주석을 신규 가드 등재 시 "이미지 참조"로 스코프를 명확히 갱신, (c) `.claude/tests/README.md` 카탈로그에 신규 행을 기존 `test_minio_image_parity.py` 행과 인접 배치해 차이를 한 문장으로 대비 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/0-overview.md` §6.3 로드맵 "배포 자동화 확장"(❌ 미구현)이 이미 상당히 완성된 `README.md`/`k8s/README.md` 배포 가이드와 온도차가 있을 수 있음(단, 내부 운영용 vs 고객 배포 번들 여부는 이번 target 범위 밖) | `spec/0-overview.md` §6.3 로드맵 표 | 이번 plan 스코프 아님. project-planner 가 별도 턴에서 staleness 여부 판단할 후보로만 남김 |
| 2 | rationale_continuity | compose(`docker-compose.yml`/`docker-compose.e2e.yml`)의 `createbuckets` entrypoint 는 `exit 0` 로 정책 적용 실패를 흡수하는 반면, 이번 plan 은 k8s Job 에 `set -e` 로 fail-loud 를 넣어 두 배포 경로의 실패 거동이 갈림(기존에 다뤄진 적 없는 갭이라 "번복"은 아님) | `plan/in-progress/k8s-avatar-policy.md` §B | plan 본문 또는 `.claude/tests/README.md` 에 "compose 는 여전히 `exit 0` 로 흡수한다 — 별도 갭"이라는 한 줄 메모 권장(Rationale 신설 불요) |
| 3 | convention_compliance | `spec/conventions/swagger.md` §2-4 상태 코드 표에 413 이 누락됨(구현·문서·규약 셋은 이미 정합하나 규약 표 자체가 짝을 안 보여줌) | `spec/conventions/swagger.md` §2-4 | project-planner 후속으로 `413 → @ApiPayloadTooLargeResponse` 행 추가 검토(본 plan scope 밖) |
| 4 | convention_compliance | Object Storage 키 네이밍 전용 convention 부재(`kb/…`·`avatars/…`·`{workspaceId}/forms/…` 세 계열의 prefix 정책 차이는 `0-overview.md` Rationale 이 이미 설명 중) | `spec/0-overview.md` §2.7 버킷 구조 표 | 지금 조치 불필요. 키 계열이 하나 더 늘 때 `spec/conventions/object-storage-keys.md` 승격 고려 |
| 5 | naming_collision | 신규 pathspec 대상 `scripts/minio/avatars-public-read.json` 은 아직 어떤 harness-checks.yml pathspec 에도 등재되어 있지 않은 순수 신규 항목(충돌 아님) | `.github/workflows/harness-checks.yml` | 계획대로 신규 pathspec 줄 추가하면 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target(0-overview.md/9-user-profile.md)이 `data-flow/4-file-storage.md`·`1-data-model.md`·compose 설정값과 전 지점 정합. staging/prod 오버레이는 MinIO 미사용이라 패리티 이슈 대상 아님 |
| rationale_continuity | NONE | `mc anonymous set download` 재도입 안 함·`ListBucket` 미허용 invariant 준수·workspaceId prefix 미도입 등 기존 Rationale/기각 이력을 모두 인지·존중. 이중 소스+drift 가드 설계는 Flyway/TypeORM 선례와 같은 패턴 |
| convention_compliance | NONE | error-codes.md·swagger.md·secret-store.md·migrations.md 대조 결과 CRITICAL/WARNING 없음. `_prompts` 번들 절단분은 저장소 원본을 직접 대조해 보완 |
| plan_coherence | NONE | 트래커(`spec-draft-nullable-notation-followups.md`) 미해소 항목·저장소 실물(`infra-minio.yaml:109-115`)·`pending_plans`(`spec-sync-user-profile-gaps.md`, 계층 분리 확인) 모두 plan 과 일치 |
| naming_collision | LOW | 신규 식별자(요구사항 ID·엔티티·API·이벤트·ENV) 없음. 신규 테스트 파일명이 기존 가드와 이름 패턴 인접해 스코프 혼동 소지(WARNING 1건) |

## 권장 조치사항
1. (WARNING 해소 권장, BLOCK 아님) `.claude/tests/test_minio_bucket_policy_parity.py` 신설 시 docstring 첫 줄에 `test_minio_image_parity.py` 와의 축 차이(이미지 태그 vs 버킷 정책)를 명시하고, `harness-checks.yml` 92-95번째 줄 주석과 `.claude/tests/README.md` 카탈로그를 함께 갱신할 것.
2. (INFO, 선택) plan 본문 또는 `.claude/tests/README.md` 에 compose 의 `exit 0` 흡수와 k8s 의 `set -e` 사이 실패-거동 비대칭을 한 줄로 메모.
3. (INFO, project-planner 후속·본 plan scope 밖) `swagger.md` §2-4 표에 413 행 추가, `spec/0-overview.md` §6.3 로드맵 staleness 여부 재검토.
4. 구현 착수를 막을 사유 없음 — plan 대로 진행 가능.
