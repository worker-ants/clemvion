# 신규 식별자 충돌 검토 — `spec-draft-webhook-endpoint-reservation.md`

## 검토 방법

target 이 새로 도입하는 식별자를 추출해 각각 저장소 전역에서 grep 대조했다.

| 신규 식별자 | 종류 | 대조 범위 |
|---|---|---|
| `WebhookEndpointReservation` / `webhook_endpoint_reservation` | 엔티티/테이블 | `spec/`, `plan/`, `codebase/backend/migrations`, `codebase/backend/src` |
| `§2.8.1` (data-model.md 신설 절, anchor `#281-webhookendpointreservation`) | 문서 섹션 번호 | `spec/1-data-model.md` 헤딩 목록 · 기존 `#281-*` 앵커 참조 |
| `webhook_endpoint_reservation_owner` | DB 제약 이름 | `codebase/backend/migrations/*.sql` |
| `reserved_at` | 컬럼명 | `spec/`, `codebase/backend/src`, migrations |
| V133 (암묵적 다음 마이그레이션 번호, 체크리스트 항목에만 등장) | 마이그레이션 버전 | `codebase/backend/migrations/` 최신 번호, 다른 `plan/in-progress/*.md` |
| `TRIGGER_ENDPOINT_PATH_CONFLICT` (재사용, 신규 아님) | 에러 코드 | `spec/5-system/3-error-handling.md` |
| `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` | 파일 경로 | `plan/in-progress/`, `plan/complete/` |

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 참고용 INFO 하나.

- **[INFO]** DB 트리거(BEFORE INSERT OR UPDATE) 이름이 draft 본문에 명시되지 않음
  - target 신규 식별자: `trigger` 테이블에 붙일 `BEFORE INSERT OR UPDATE OF endpoint_path` DB 트리거 — 이름 미지정
  - 기존 사용처: `codebase/backend/migrations/V001__initial_schema.sql:375-386` 의 `trg_<table>_updated_at` 명명 컨벤션(예: `trg_trigger_updated_at`), `V081__rerank_config.sql:29` 의 `trg_rerank_config_updated_at`
  - 상세: draft §설계 는 강제 메커니즘(“`INSERT … ON CONFLICT DO NOTHING`” + `unique_violation`)과 제약 이름(`webhook_endpoint_reservation_owner`)은 명시했지만, 트리거 자체의 이름은 구현(developer) 단계로 남겨뒀다. 기존 `trg_trigger_updated_at` 과 이름이 겹치지 않게만 하면 충돌은 없다 — 실제 충돌 위험은 낮지만 명시가 없어 구현자가 `trg_trigger_updated_at` 과 유사한 이름(예: `trg_trigger_endpoint_path_reservation`)을 짓다 실수로 기존 이름을 재사용할 여지가 있다.
  - 제안: spec 반영 시 트리거 이름을 `trg_trigger_endpoint_path_reservation` 등으로 명시하거나, 최소한 "기존 `trg_trigger_updated_at` 과 별개"라는 한 줄을 §2.8.1 또는 Rationale 에 추가. 차단 사유는 아님 — 정보성 제안.

## 상세 대조 결과 (충돌 없음 확인)

1. **요구사항 ID 충돌** — 새 요구사항 ID(WH-\*, V1xx 같은 spec 고유 ID)를 신설하지 않는다. 유일하게 재사용하는 기존 ID 는 `TRIGGER_ENDPOINT_PATH_CONFLICT`(`spec/5-system/3-error-handling.md:238`)이며, target 은 그 **의미를 확장**할 뿐 새 ID 를 부여하지 않는다 — 의도된 재사용(응답 구분 안 함이 설계 목표)이라 충돌 아님.
2. **엔티티/타입명 충돌** — `WebhookEndpointReservation` / `webhook_endpoint_reservation` 은 `spec/`, `plan/`, `codebase/backend/migrations`, `codebase/backend/src` 전역에서 target 자기 자신 외 매치 0건. `spec/1-data-model.md` §1 ER 다이어그램(20~53행)에도 동명 노드 없음. 신설 섹션 번호 `§2.8.1` 도 현재 헤딩 목록(`### 2.8 Trigger` 다음이 `### 2.9 Schedule`)에서 비어 있는 슬롯 — 기존 `### 2.8.1` 헤딩 없음. anchor 규칙(`#2101-integrationusagelog` 같은 기존 서브섹션 패턴과 동일하게 `#281-webhookendpointreservation`)도 기존 관례와 일치해 별도 앵커 충돌 없음.
3. **API endpoint 충돌** — target 은 새 endpoint 를 만들지 않는다. 기존 트리거 생성/변경 endpoint(`spec/2-navigation/2-trigger-list.md`)와 기존 수신 endpoint(`/api/hooks/:endpointPath`)를 그대로 재사용 — 수신 쪽은 "지금처럼 404" 로 명시해 동작 변경도 없음.
4. **이벤트/메시지명 충돌** — webhook/queue/SSE 이벤트를 신설하지 않는다.
5. **환경변수·설정키 충돌** — 새 ENV var / config key 없음.
6. **파일 경로 충돌** — `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 는 `plan/in-progress/`, `plan/complete/` 어디에도 동명 파일이 없다. 선행 draft `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 와는 이름이 명확히 구분되고, `spec-draft-*` 명명 컨벤션도 준수한다.

부수적으로 확인한 항목(신규 식별자는 아니지만 잠재 충돌 후보로 grep 함):
- `webhook_endpoint_reservation_owner` 제약 이름 — 기존 migrations 의 `_owner` 계열 식별자(`tool_owner_id`, `uq_workflow_test_dataset_owner_name`, `uq_workspace_personal_owner`)와 문자열 겹침 없음.
- `reserved_at` 컬럼명 — 저장소 전역에서 grep 0건, 완전 신규.
- V133 마이그레이션 번호 — 현재 최신은 V132 라 다음 번호로 비어 있다. 다른 `plan/in-progress/*.md` 어디에도 V133 을 예약하는 언급 없음. 동시 진행 브랜치 간 번호 경합은 이 저장소가 이미 3중 가드(`migrations.spec.ts`, `scripts/check-migration-versions.py`, `check-duplicate-versions.sh` — `spec/conventions/migrations.md §6`)로 빌드/CI 시점에 잡으므로 이 draft 가 별도로 언급할 필요는 없다.

## 요약

target 이 새로 도입하는 식별자(`WebhookEndpointReservation`/`webhook_endpoint_reservation` 엔티티, `§2.8.1` 섹션 번호, `webhook_endpoint_reservation_owner` 제약, `reserved_at` 컬럼)는 모두 저장소 전역 grep 에서 기존 사용처가 0건이며, 재사용하는 유일한 기존 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT`)도 의도된 의미 확장이지 다른 의미와의 충돌이 아니다. 새 API endpoint·이벤트명·환경변수·설정키도 도입하지 않는다. 파일 경로도 기존 관례를 따르고 동명 파일이 없다. DB 트리거 이름 미지정 1건만 정보성으로 남긴다.

## 위험도

NONE
