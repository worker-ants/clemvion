# 신규 식별자 충돌 검토 — `spec/4-nodes/4-integration/5-makeshop.md`

## 발견사항

### 발견사항 없음 — CRITICAL / WARNING 0건

전 관점에서 실질적 충돌을 발견하지 못했다. 아래는 INFO 수준의 일관성 보완 사항 2건이다.

---

### [INFO] Node.type 테이블에 `makeshop` 미등재

- **target 신규 식별자**: Node.type `makeshop` (노드 핸들러 타입 문자열로 사용 — `spec/4-nodes/4-integration/5-makeshop.md §1`, `spec/4-nodes/0-overview.md` 표에 이미 등재됨)
- **기존 사용처**: `spec/1-data-model.md` §2.6 Node.type 전체 목록 테이블 (line 176 범위) — `cafe24` 는 등재되어 있으나 `makeshop` 행이 없음
- **상세**: `spec/4-nodes/0-overview.md` 의 노드 타입 표와 `spec/4-nodes/4-integration/_product-overview.md` 에는 `makeshop` 이 "(Planned)" 로 정상 등재되어 있다. 그러나 데이터 모델의 `Node.type 전체 목록` 표에는 `cafe24` 행만 있고 `makeshop` 이 누락되어 있다. 충돌은 아니지만 구현 착수 시 DB 마이그레이션 체크리스트에서 누락될 수 있다.
- **제안**: `spec/1-data-model.md` §2.6 Node.type 전체 목록 테이블에 `| integration | makeshop | MakeShop Shop API (Resource × Operation) — **Planned** ([Spec MakeShop 노드](./4-nodes/4-integration/5-makeshop.md)) |` 행을 추가한다 (구현 PR 이전 spec 갱신). 이미 `spec/4-nodes/0-overview.md` 와 `_product-overview.md` 에는 등재되어 있으므로 단순 동기화 작업이다.

---

### [INFO] `api_label` 표기에서 makeshop 명시 미비 (`IntegrationUsageLog` 설명)

- **target 신규 식별자**: catalog key 형식 `makeshop.<resource>.<operation>` (§4 step 11 · §8.2)
- **기존 사용처**: `spec/1-data-model.md` §2.10.1 `IntegrationUsageLog.api_label` 컬럼 설명 (line 939 근방) — "cafe24 = `cafe24.<resource>.<operation>` … http-request / database-query / send-email = NULL" 로 기술되어 있고 `makeshop` 이 예시에 없음. `spec/2-navigation/4-integration.md` line 816 의 `apiLabel` 설명도 "나머지 3종은 NULL" 로 표현되어 있다.
- **상세**: target 이 도입한 `makeshop.<resource>.<operation>` catalog key 형식은 기존 `cafe24-api-metadata.md` §7.5 패턴과 의미·형식이 동일하므로 실질 충돌은 없다. 그러나 데이터 모델과 통합 API 명세의 `api_label` 설명이 cafe24 만 예시로 들어 makeshop 을 암묵적 NULL 처럼 읽힐 수 있다.
- **제안**: 구현 PR 시 `spec/1-data-model.md` §2.10.1 `api_label` 컬럼 설명과 `spec/2-navigation/4-integration.md` §9.1 `apiLabel` 항목에 "makeshop = `makeshop.<resource>.<operation>`" 을 추가한다. 기능 동작에는 영향 없고 문서 명확화 목적이다.

---

## 충돌 없음 확인 — 관점별 요약

| 관점 | 결론 |
|------|------|
| 요구사항 ID | `INT-SV-09` — `spec/4-nodes/4-integration/_product-overview.md` 에서 이미 선점·등재됨. 중복·충돌 없음 |
| 엔티티/타입명 | `MakeshopMcpToolProvider`, `MakeshopApiClient` — 기존 `Cafe24McpToolProvider`, `Cafe24ApiClient` 와 prefix 로 구분, 의미 충돌 없음. `MakeshopOperationMetadata` (`makeshop-api-metadata.md`) 도 기존 `Cafe24OperationMetadata` 와 충돌 없음 |
| 에러 코드 | `MAKESHOP_4XX`, `MAKESHOP_404`, `MAKESHOP_422`, `MAKESHOP_AUTH_FAILED`, `MAKESHOP_RATE_LIMITED`, `MAKESHOP_5XX`, `MAKESHOP_TRANSPORT_FAILED`, `MAKESHOP_UNKNOWN_OPERATION`, `MAKESHOP_MISSING_FIELDS`, `MAKESHOP_INVALID_SHOP_UID` — `CAFE24_*` 계열과 prefix 분리됨. spec 전체에서 이 코드들을 다른 의미로 사용하는 곳 없음 |
| API endpoint | `GET /api/integrations/services/makeshop/catalog` — 기존 `GET /api/integrations/services/:type/catalog` 의 파라메트릭 경로에 해당하며 새 path 충돌 없음. `GET /api/3rd-party/makeshop/install/...` (Planned) — 기존 `GET /api/3rd-party/cafe24/install/:installToken` 와 provider prefix 로 분리됨 |
| 이벤트/메시지명 | 신규 이벤트 이름 없음. CPIK webhook 은 범위 밖으로 명시적 제외됨 (§9.6) |
| 환경변수·설정키 | target 이 신규 ENV var 를 직접 정의하지 않음. 기존 OAuth 인프라 재사용. 충돌 없음 |
| 파일 경로 | `spec/4-nodes/4-integration/5-makeshop.md` — 기존 `4-cafe24.md` 의 `4-` prefix 다음으로 `5-` 를 부여하여 컨벤션 일치. 충돌 없음 |
| config 필드 | `integrationId`, `resource`, `operation`, `fields`, `pagination` — Cafe24 §1 의 동일 필드명과 동형이며 의도적 패턴 재사용. 혼동 가능성 없음 (별개 노드 타입 스코프) |
| `mall_id` 컬럼 공유 | MakeShop 의 `shop_uid` 가 `Integration.mall_id` 컬럼에 투영되는 것은 `spec/1-data-model.md §2.10` 에 "MakeShop(Planned) 은 `credentials.shop_uid`" 로 명시되어 있음. cafe24 `mall_id` 와 의미가 다른 값을 같은 컬럼에 쓰는 설계이나, partial UNIQUE 인덱스가 `service_type` 별로 분리되어 있어 DB 레벨 충돌 없음. spec 차원 설계 결정 — 충돌 아님 |

## 요약

`spec/4-nodes/4-integration/5-makeshop.md` 가 도입하는 모든 신규 식별자 (`MAKESHOP_*` 에러 코드, `MakeshopMcpToolProvider`, `MakeshopApiClient`, `makeshop` service_type, `makeshop.<resource>.<operation>` catalog key, `5-makeshop.md` 파일 경로 등)는 기존 `CAFE24_*` / `cafe24` / `Cafe24*` 계열과 prefix 수준에서 명확히 분리되어 있으며, 다른 의미로 이미 사용 중인 식별자와 충돌하는 경우가 없다. API endpoint 도 기존 `:type` 파라메트릭 패턴에 맞아 신규 경로 충돌이 없다. INFO 항목 2건은 데이터 모델 Node.type 표와 `api_label` 컬럼 설명의 makeshop 누락 동기화 문제로, 기능 동작에 영향을 주지 않는 문서 갱신 항목이다.

## 위험도

NONE
