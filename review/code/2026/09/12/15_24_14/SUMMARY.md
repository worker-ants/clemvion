# Code Review 통합 보고서

## 전체 위험도
**LOW** — 애플리케이션 코드 변경 없는 순수 인프라(MinIO 이미지 레지스트리 전환) 수정. Critical 없음. WARNING 2건은 모두 "이번 처분의 완결성/문서 동기화" 문제이며 코드 결함이 아니다. forced reviewer(security·documentation·dependency) 3명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency/Infra | 같은 결함 클래스(Docker Hub `minio/*` 익명 pull 거부)를 가진 세 번째 위치가 이번 처분에서 빠졌다. `k8s/overlays/local/infra-minio.yaml` 도 `minio/minio`·`minio/mc` 를 Docker Hub 에서 그대로 가져오며 태그도 `latest`(저장소 자신의 주석이 경고하는 안티패턴)다. 이번 plan 이 스스로 세운 "한쪽만 고치면 다음 사람이 다시 진단한다"는 완결성 원칙이 이 파일 앞에서 깨진다. (documentation reviewer 는 "현재 어떤 Makefile/CI 도 이 오버레이를 참조하지 않아 즉각 영향 없음"을 근거로 INFO 로 판단했으나, dependency reviewer 는 완결성 원칙 위반 자체를 문제 삼아 WARNING 으로 판단 — 두 견해 모두 반영) | `k8s/overlays/local/infra-minio.yaml:38`, `:99` | 같은 처분(quay.io 전환 + 구체 태그 고정)을 이 파일에도 적용하거나, 의도적으로 제외한다면 plan 문서에 사유(예: "이 로컬 overlay 는 현재 아무 자동화에서도 안 쓴다")를 실측과 함께 남긴다. |
| 2 | 문서/SoT 동기화 | 이번 PR 이 실행한 처분이 이미 존재하던 트래커 항목의 "처분 후보 (사용자 결정 필요)" 상태를 갱신하지 않았다. `spec-sync-external-interaction-api-gaps.md` 의 해당 블록은 여전히 (a)quay.io 전환/(b)CI 로그인/(c)GHCR 미러 중 사용자 결정이 필요하다고 말하는데, 이번 plan 이 (a)를 이미 실행·검증했다. 두 문서가 같은 사실을 다르게 말하는 SoT drift. | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (Docker Hub 익명 pull rate limit 항목 하위 "⚠️ 2026-09-12 — 이 처분의 전제가 반증됐다" 블록) | 같은 커밋(또는 `e2e-minio-registry.md` 를 `complete/` 로 옮기는 커밋)에서 해당 블록에 취소선/후속 노트로 "실행됨 → `plan/.../e2e-minio-registry.md` 참조"를 추가해 닫는다. 역방향 링크도 `e2e-minio-registry.md` 에 남기면 좋다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Supply-chain | 이미지가 digest 가 아닌 tag 로만 고정되어 있어 mutable 참조다(태그가 재푸시되면 다른 바이트를 받을 수 있음). 기존 Docker Hub 참조 때부터 있던 성격이며 이번 diff 가 새로 만든 위험은 아니다. plan 문서에 이미 두 이미지의 sha256 이 실측·기록돼 있어 digest pin 전환 비용은 낮다. | `docker-compose.e2e.yml:68,81`, `docker-compose.yml:38,56` | `image: quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z@sha256:6c83c74c8028…` 형태로 digest pin 검토(우선순위 낮음, e2e/dev 전용 인프라). |
| 2 | Dependency | 새 레지스트리(quay.io) 자체도 제3자 인프라이며, 향후 동일하게 익명 pull 이 제한될 가능성을 배제할 근거는 없다. 다만 GHCR 미러링 같은 완화책은 plan 이 "지금 필요 없다"로 의도적으로 defer — 인지된 채 수용된 리스크. | `plan/in-progress/e2e-minio-registry.md` ("왜 이 처분인가" 표) | 조치 불요. 동일 클래스 장애 재발 시 이 판단을 재검토 지점으로 plan 히스토리 참고. |
| 3 | Security | e2e 전용 시크릿(`JWT_SECRET`, `ENCRYPTION_KEY`, `MINIO_ROOT_PASSWORD` 등) 하드코딩은 diff 범위 밖 기존 상태이며, "운영 절대 사용 금지" 주석이 이미 적절히 붙어 있다. | `docker-compose.e2e.yml` (JWT_SECRET/ENCRYPTION_KEY 부근, 이번 diff 비대상) | 조치 불요 — 참고용 기록. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 레지스트리 전환은 quay.io(MinIO 공식 배포처)로의 이동이라 안전. image ID 동일성 실측으로 뒷받침됨. INFO 만 존재(digest pin 미비, 기존 시크릿 하드코딩은 범위 밖). |
| documentation | LOW | compose 주석 자체는 정확·일관. WARNING: 트래커 plan(`spec-sync-external-interaction-api-gaps.md`) 미동기화로 SoT drift. |
| dependency | LOW | 새 패키지·버전·라이선스 리스크 없음. WARNING: `k8s/overlays/local/infra-minio.yaml` 이 동일 결함 클래스를 가진 채 처분 범위에서 누락. |

## 발견 없는 에이전트

없음 — 실행된 3개 에이전트(security·documentation·dependency) 모두 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. `k8s/overlays/local/infra-minio.yaml` 에 동일 처분(quay.io + 구체 태그)을 적용하거나, 의도적으로 제외한다면 plan 문서에 그 사유를 실측과 함께 남긴다 — 이 PR 이 막으려던 "한쪽만 고치면 다음 사람이 다시 진단한다"는 상황이 재현되지 않도록.
2. `spec-sync-external-interaction-api-gaps.md` 의 "처분 후보 (사용자 결정 필요)" 블록을 이번 실행 결과로 갱신/폐쇄하고, `e2e-minio-registry.md` 쪽에도 역참조를 남겨 두 문서가 같은 사실을 같은 상태로 말하게 한다.
3. (선택, 낮은 우선순위) 여유가 있으면 두 이미지 참조에 `@sha256:...` digest pin 을 추가해 태그 mutable 리스크를 원천 차단한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `documentation`, `dependency` (3명)
  - **강제 포함(router_safety)**: `security`, `documentation`, `dependency` (3명 전원 forced이며 결과 확보됨 — 화이트리스트 미이행 없음)
  - **제외**: 11명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff(compose 파일의 이미지 레지스트리 경로 문자열 변경, 애플리케이션 코드 미변경)를 해당 없음으로 판단 |
  | architecture | 상동 |
  | requirement | 상동 |
  | scope | 상동 |
  | side_effect | 상동 |
  | maintainability | 상동 |
  | testing | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |