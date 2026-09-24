# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — harness-only 변경(`spec_impact: none`)이라 target 자체 위반은 없으나, 번들된 기존 spec 문서에서 WARNING 2건(규약 검토 예산 초과로 인한 미검증 축 + `0-overview.md §8` 명명 규칙 서술 stale)과 plan 상호 참조 누락 WARNING 1건 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 검토에서 Critical 발견이 없어 해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 검토 프로세스 결함 — 규약 번들이 예산 초과로 `error-codes.md`·`swagger.md`·`spec-impl-evidence.md`·`migrations.md`·`node-output.md` 등 핵심 규약을 전부 생략하고, 대신 무관한 Cafe24/MakeShop API 카탈로그 leaf 문서 수백 개가 전문 포함되어 예산을 선점 | `_prompts/convention_compliance.md` "정식 규약 모음" 섹션 | 기존 메모리 교훈(`--spec` 예산 누락)과 동일 실패 클래스가 `--impl-prep` 경로에서도 재발 | 번들 생성기가 `*-api-catalog/**/*.md` leaf 문서를 후순위로 미루고 짧고 관련성 높은 규약 파일을 우선 포함하도록 예산 배분을 수정. 그전까지 출력 포맷·문서 구조·API 문서 규약 축 판정은 "미검증"으로 취급 |
| 2 | Convention Compliance | `spec/0-overview.md` §8 문서 맵 표의 "데이터 흐름 ... 알파벳 순 숫자 prefix" 서술이 실제와 불일치 | `spec/0-overview.md` §8, "데이터 흐름" 행 | 실제 `spec/data-flow/`: `13-agent-memory`·`14-chat-channel`·`15-external-interaction` 이 알파벳순이 아니라 도입순으로 append 됨 (`db496a3c2` 가 문구를 갱신하지 않음) | "알파벳 순 숫자 prefix" → "정수 prefix (도입 순, 재정렬하지 않음)" 로 정정. spec 변경이므로 `project-planner` 소관 |
| 3 | Plan Coherence | 향후 `self-hosting-deployment.md` 실행 시 생길 신규 MinIO 이미지 참조 자리(`docker-compose.production.yml`, Helm chart)가 이번 가드의 경로 상수 목록·상호 참조 어디에도 반영 경로가 없음 | `plan/in-progress/minio-image-parity-guard.md` §A 설계 (경로 상수 열거) | `plan/in-progress/self-hosting-deployment.md` §3/§4 (NF-DP-02/03, 아직 미착수) | 두 plan 중 하나에 상호 참조 한 줄 추가: (a) `minio-image-parity-guard.md` 에 "새 MinIO 매니페스트 생기면 경로 목록에 추가" 또는 (b) `self-hosting-deployment.md` §3/§4 체크박스에 "이미지 패리티 가드 경로 목록 갱신" 항목 신설 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | target 문서(`0-overview.md`, `data-flow/4-file-storage.md`)에 spec lifecycle frontmatter(`id`/`status`/`code`) 부재 — 예외 대상인지 미확인(`spec-impl-evidence.md` truncate 로 확정 불가) | 두 문서 최상단 | `spec-impl-evidence.md` 전문 포함한 재검토로 확정하거나 낮은 우선순위 후속 확인으로 남김 |
| 2 | Convention Compliance / Cross-Spec / Naming Collision | 이번 PR 은 harness-only(`spec_impact: none`)라 target 문서와 실제 diff(`docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/local/infra-minio.yaml`·`.claude/tests/test_minio_image_parity.py`)가 직접 겹치지 않음 | N/A (스코프 자체) | 조치 불요 — Critical/Warning 부재를 "target 검증 통과"로 과대해석하지 않도록 기록 |
| 3 | Rationale Continuity | plan 이 과거 결정(#1325 부분반영 실패, #1392 다이제스트 고정)을 뮤턴트 테스트(M1)로 명시적으로 회귀 방지하고 있음(긍정적 관찰) | `plan/in-progress/minio-image-parity-guard.md` §B 뮤턴트 M1 | 조치 불요. 필요 시 `#1325`/`#1392` 근거를 `spec/0-overview.md §2.7` 또는 인프라 convention 문서에 짧게 남기는 것을 고려(강제 아님) |
| 4 | Plan Coherence | 같은 k8s Job(`minio-create-bucket`)을 다루는 별도 열린 백로그 항목(`spec-draft-nullable-notation-followups.md`, 아바타 공개 정책 누락)과의 상호 참조 부재 | `k8s/overlays/local/infra-minio.yaml` | 차단 사유 아님. `minio-image-parity-guard.md` 에 "이 Job 은 별도 미해결 항목의 대상이기도 하다 — 컨테이너 구조 변경 시 확인" 정도 한 줄 상호 참조 권장 |
| 5 | Naming Collision | 신규 테스트 파일 `.claude/tests/test_minio_image_parity.py`, plan 명 `minio-image-parity-guard` 모두 기존 명명과 충돌 없음 | `.claude/tests/`, `plan/complete/minio-silo-image.md` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 번들된 두 spec 문서가 저장소 현재본과 byte-identical — 신규 계약·모델 없음, 충돌 후보 없음 |
| Rationale Continuity | NONE | 번들 Rationale은 애플리케이션 스토리지 설계(무관 영역), plan 은 과거 이미지 전환 결정을 뮤턴트로 회귀 방지 |
| Convention Compliance | LOW | target 자체 위반 없음. 규약 번들 예산 초과(도구 결함, WARNING) + `0-overview.md §8` 명명 규칙 서술 stale(WARNING) |
| Plan Coherence | LOW | target-plan 간 직접 충돌 없음. `self-hosting-deployment.md` 향후 확장 자리 상호 참조 누락(WARNING) |
| Naming Collision | NONE | 신규 식별자(`test_minio_image_parity.py`, plan 명) 기존 컨벤션과 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `spec/0-overview.md` §8 "데이터 흐름 ... 알파벳 순 숫자 prefix" 서술을 "정수 prefix (도입 순)" 로 정정 — `project-planner` 턴에서 처리.
2. (선택, 비차단) `minio-image-parity-guard.md` 또는 `self-hosting-deployment.md` 중 한 곳에 향후 MinIO 이미지 참조 자리 갱신 상호 참조 한 줄 추가.
3. (도구 개선, 이번 PR 무관) consistency-check 번들러가 API 카탈로그 leaf 문서보다 핵심 regular 규약 파일을 예산상 우선하도록 조정.
4. 위 항목 모두 비차단(WARNING/INFO) 이므로 이번 merge 자체에는 추가 조치 불필요.
