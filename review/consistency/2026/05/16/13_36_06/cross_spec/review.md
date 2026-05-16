# Cross-Spec 일관성 검토

**Target**: `spec/2-navigation/4-integration.md`
**검토 일시**: 2026-05-16

---

## 발견사항

### [INFO] `Attention` 칩 신설 — `spec/2-navigation/_product-overview.md` 동기화 미확인

- target 위치: §2.3 상태 칩 목록 (`[All] [Attention] [Connected] [Expiring] [Expired] [Error]`)
- 충돌 대상: `spec/2-navigation/_product-overview.md` — 내비게이션 PRD의 Integration 화면 요구사항 섹션 (prompt corpus 에 포함되지 않아 직접 확인 불가)
- 상세: target 본문의 Rationale "Attention 가상 필터값" 항(2026-05-16)은 `Attention` 칩을 신설하며 기존 칩 모델이 변경되었다고 명시한다. 내비게이션 PRD(`_product-overview.md §3.4 Integration`)에 기재된 상태 필터 목록이 아직 갱신되지 않았을 경우 두 문서가 동기화 불일치 상태가 된다.
- 제안: `spec/2-navigation/_product-overview.md`의 Integration 요구사항(상태 칩 목록 기술 부분)에 `Attention` 칩 및 `?status=attention` 가상 필터값 추가를 확인·반영한다.

---

### [INFO] `spec/1-data-model.md §2.19 Notification.type` 알림 발사 정책과 target §11.2의 정합성 — 이미 동기화됨

- target 위치: §11.2 알림 생성 — "알림 발사 정책 (2026-05-16 정정)"
- 충돌 대상: `spec/1-data-model.md §2.19 Notification` (corpus 포함)
- 상세: target §11.2는 `integration_expired` 알림을 "refresh_token 없는 provider의 `token_expires_at` 만료(`status_reason='token_expired'`)에만 발사"로 정정하고, `install_timeout`, `error(auth_failed)`, `error(network)`, `error(insufficient_scope)` 전이는 미발사로 명시한다. `spec/1-data-model.md §2.19`의 `Notification.type` 설명에서도 동일한 정책("2026-05-16 두 차례 정정 후")을 이미 반영하고 있다. 두 영역 간 직접 모순은 없으나, 검색 편의를 위해 data-model 쪽 설명의 cross-reference 링크(`§11.2`)가 이미 존재하는 점을 확인.
- 제안: 추가 수정 불필요. 양쪽 동기화 완료 상태.

---

### [INFO] `spec/1-data-model.md §2.10 Integration.status_reason` — `refresh_failed` 제거 명시와 target §6 상태 전이 일치 확인

- target 위치: §6 상태 전이 표 — "connected → error(auth_failed)" 행 (2026-05-16 갱신)
- 충돌 대상: `spec/1-data-model.md §2.10 Integration.status_reason` (corpus 포함)
- 상세: target §6과 data-model §2.10 모두 `refresh_failed` 를 `error(auth_failed)`로 이행 처리하고 `expired` status에서 `refresh_failed` 사유를 제거한다. 양쪽 모두 동일한 "REQ HIGH-2" 결정을 반영하고 있어 직접 충돌 없음.
- 제안: 추가 수정 불필요.

---

### [INFO] `connected-expiry` 스캐너 대상 조건 — target §11.1과 data-model §3 인덱스 표의 경미한 표현 차이

- target 위치: §11.1 스캐너 잡 표 — `connected-expiry` 대상: `status NOT IN (expired, error, pending_install) AND token_expires_at IS NOT NULL`
- 충돌 대상: `spec/1-data-model.md §3 인덱스 전략` — `Integration (token_expires_at)` 인덱스 목적: "만료 스캐너 배치 조회"
- 상세: 인덱스 표는 스캐너 쿼리를 `token_expires_at` 단일 컬럼 인덱스로 지원한다고만 기술하며, 실제 WHERE 절(`status NOT IN ...`)을 명시하지 않는다. 이는 표현 수준의 차이로 기능 충돌은 아니지만, 부분 인덱스로 범위를 좁히면 더 효율적임을 알 수 있다.
- 제안: 선택적 개선 — 인덱스 목적 설명에 스캐너 필터 조건 요약을 추가하거나, 부분 인덱스(`WHERE status = 'connected' AND token_expires_at IS NOT NULL`)로 전환하는 것을 고려.

---

### [INFO] `spec/2-navigation/_product-overview.md` 의 `NAV-INT-*` 요구사항 ID — `Attention` 필터 요구사항 ID 부재 가능성

- target 위치: §2.3, §2.4 (Attention 칩 / 배너 클릭 동작 상세), Rationale "Attention 가상 필터값"
- 충돌 대상: `spec/2-navigation/_product-overview.md` Integration 섹션의 `NAV-INT-*` 요구사항 ID (corpus 미포함)
- 상세: target의 Rationale은 기존 spec 텍스트를 정정하면서 새 동작("합계 = 1일 때 detail 직접 점프", "Attention 칩 신설")을 기술하지만, 이 변경사항에 대응하는 요구사항 ID(`NAV-INT-*`)가 `_product-overview.md`에 등록되었는지 확인할 수 없다. 관련 PRD ID가 없으면 추적성이 낮아진다.
- 제안: `spec/2-navigation/_product-overview.md`의 Integration 요구사항 목록에 Attention 칩·배너 동작에 대응하는 요구사항 항목이 추가되었는지 확인한다. 누락 시 신규 `NAV-INT-*` ID를 부여한다.

---

### [INFO] `spec/4-nodes/4-integration/_product-overview.md` — `pending_install` 필터 칩 미포함 결정의 PRD 반영 여부

- target 위치: §2.3 상태 칩 — "`pending_install`은 포함하지 않는다" (※ 주석), Rationale "`pending_install`은 필터 칩에 추가하지 않는다"
- 충돌 대상: `spec/4-nodes/4-integration/_product-overview.md` (corpus 미포함)
- 상세: target은 `pending_install` 칩 미포함 결정을 Rationale에 명시하며 "별도 수요 발생 시 후속 plan으로 재검토"라고 남긴다. 이 결정이 Integration PRD(`4-nodes/4-integration/_product-overview.md`)에도 반영되어 있는지, 혹은 기존 PRD에 해당 칩이 포함된 상태로 남아 있는지 확인이 필요하다.
- 제안: `spec/4-nodes/4-integration/_product-overview.md`의 통합 관리 화면 요구사항에서 `pending_install` 필터 칩 부재가 명시적으로 기술되어 있는지 확인하고, 누락 시 동기화한다.

---

### [INFO] `spec/data-flow/5-integration.md` — 네 개의 독립 BullMQ job 명칭 동기화

- target 위치: §11 만료 스캐너 및 알림 — "네 개의 독립 BullMQ job (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh`)"
- 충돌 대상: `spec/data-flow/5-integration.md §1.4 OAuth 만료 스캐너 BullMQ integration-expiry` (target §11 본문 cross-reference로 언급)
- 상세: target §11이 data-flow spec을 교차 참조하지만, data-flow spec이 네 개 잡 분리 결정(target §11의 개정사항)을 동일하게 반영하고 있는지 corpus에서 확인 불가. data-flow spec의 `integration-expiry` 단일 job 표현이 남아 있으면 명칭 불일치가 발생한다.
- 제안: `spec/data-flow/5-integration.md §1.4`에서 `connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh` 네 잡 명칭으로 갱신되었는지 확인한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §10` — `INTEGRATION_NOT_CONNECTED` 에러 코드의 상태 커버리지

- target 위치: §14.1 에러 코드 vocabulary — `INTEGRATION_NOT_CONNECTED`: "Integration 상태가 `expired`/`error`"
- 충돌 대상: `spec/5-system/4-execution-engine.md §10 Integration handler 계약` (target §14.1 cross-reference로 언급)
- 상세: target §14.1은 `INTEGRATION_NOT_CONNECTED` 에러가 `expired` / `error` 상태에서 발생한다고 정의한다. 그런데 §6 상태 전이에서 `pending_install` 상태도 노드·AI Agent에서 사용 불가(`INTEGRATION_INCOMPLETE` — §4.2)라고 명시한다. 두 에러 코드 중 `INTEGRATION_NOT_CONNECTED`의 커버리지(expired/error)와 `INTEGRATION_INCOMPLETE`의 커버리지(pending_install 또는 credentials JSONB 필수 필드 누락)가 분리되어 있는데, 실행 엔진 spec이 이 분리를 동일하게 정의하고 있는지 확인이 필요하다. 만약 실행 엔진 spec에서 `pending_install`을 `INTEGRATION_NOT_CONNECTED`로 처리하면 불일치가 된다.
- 제안: `spec/5-system/4-execution-engine.md §10`에서 `INTEGRATION_NOT_CONNECTED`(expired/error)와 `INTEGRATION_INCOMPLETE`(pending_install 포함)의 구분이 target §14.1과 일치하는지 확인하고, 불일치 시 실행 엔진 spec을 갱신한다.

---

### [WARNING] `spec/5-system/2-api-convention.md` — `GET /api/integrations`의 `status` 파라미터 허용값과 API 규약 충돌 가능성

- target 위치: §9.1 목록·CRUD — `GET /api/integrations` `status` 파라미터 허용값에 `expiring`, `attention` 두 가상 필터값 포함
- 충돌 대상: `spec/5-system/2-api-convention.md` (target §9.1 cross-reference로 언급 — 페이지네이션 응답 형식 §5.2)
- 상세: `GET /api/integrations`의 `status` 파라미터는 DB Enum 값(`connected`, `expired`, `error`, `pending_install`)에 더해 `expiring`과 `attention`이라는 가상 필터값을 허용한다. API 규약에 "enum 파라미터는 DB Enum과 일치해야 한다"거나 "허용값 집합을 Swagger에 명시해야 한다"는 규칙이 있는 경우, 가상 필터값이 해당 규약을 위반할 수 있다. 또한 `spec/conventions/swagger.md`에 정의된 Swagger 문서화 규약 관점에서도 가상 필터값의 schema 정의(예: `enum` 또는 `oneOf`) 방식이 명확히 결정되어 있어야 한다.
- 제안: `spec/5-system/2-api-convention.md` 또는 `spec/conventions/swagger.md`에서 "가상 필터값(virtual filter)을 API 파라미터로 허용하는 경우의 문서화 방식"을 명시하거나, target §9.1의 Swagger 표현 방식(예: `description`에 가상값 명시, `enum` 배열에 포함)을 해당 규약 문서에 추가한다.

---

### [WARNING] `spec/5-system/11-mcp-client.md §2.3` — Internal Bridge의 `pending_install` 상태 Integration 처리

- target 위치: §14.2 워크플로우 에디터 — AI Agent의 `mcpServers` 셀렉트가 `service_type='mcp'`와 `service_type='cafe24'`를 모두 받음; §6 상태 전이 — `pending_install`은 노드·AI Agent 사용 불가
- 충돌 대상: `spec/5-system/11-mcp-client.md §2.3 Internal Bridge` (target §14.2 cross-reference)
- 상세: target §6은 `pending_install` 상태의 Integration이 노드·AI Agent에서 사용 불가라고 명시하고 §4.2에서 `INTEGRATION_INCOMPLETE` 에러를 언급한다. MCP Client spec의 Internal Bridge가 `IntegrationSelector`에서 `pending_install` 상태를 제외(비활성 표시 또는 목록 제거)하는 로직을 명시하는지 확인이 필요하다. `pending_install` 상태 Cafe24 Integration이 `mcpServers` 드롭다운에 선택 가능 상태로 노출되면 런타임 에러(`INTEGRATION_INCOMPLETE`)가 발생한다.
- 제안: `spec/5-system/11-mcp-client.md`의 `IntegrationSelector` 관련 섹션 또는 Internal Bridge 섹션에서, `pending_install` 상태 Integration은 선택 불가(비활성 또는 목록 제외)로 처리함을 명시한다.

---

### [WARNING] 상태 배지 §11.4 UI 배지 조건과 §2.4 "Need attention" 배너 포함 조건의 미세 차이

- target 위치: §11.4 UI 배지 — 사이드바 카운트: `status IN (expired, error) OR (token_expires_at <= now() + 7d)`; §2.4 배너 포함 조건: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`
- 충돌 대상: 동일 문서 내 §11.4와 §2.4의 표현 차이
- 상세: §11.4의 사이드바 배지 조건 `token_expires_at <= now() + 7d`는 `token_expires_at IS NOT NULL` 조건과 `token_expires_at > NOW()`(이미 만료되지 않음) 조건을 명시하지 않는다. 반면 §2.4 배너 조건은 두 조건을 명시한다. 이미 `expired` 처리된 행은 `status IN (expired)` 브랜치에서 카운트되어 중복은 없지만, `token_expires_at IS NULL`인 행(MCP 등)이 §11.4 조건에서 의도치 않게 포함될 위험이 있다(실제로 NULL은 비교에서 false를 반환하므로 동작상 차이는 없으나 읽는 사람에게 혼동을 준다). 또한 `token_expires_at < NOW()`(과거 = 만료)인 connected 행이 배너에는 제외되지만 사이드바 공식에서는 포함될 수 있다.
- 제안: §11.4의 사이드바 배지 조건을 §2.4와 동일한 정밀도로 기술하도록 갱신한다: `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`.

---

## 요약

`spec/2-navigation/4-integration.md` draft는 2026-05-16 기준의 대규모 개정(Attention 가상 필터값 도입, refresh 실패 시 `error(auth_failed)` 통일, `install_timeout` 알림 미발사 명문화)을 포함한다. 분석된 corpus(데이터 모델 spec, 아키텍처 개요, 인증 흐름 spec 등) 내에서 직접적인 CRITICAL 충돌(기능이 작동 불가한 수준의 모순)은 발견되지 않았다. 주요 우려 사항은 두 가지 WARNING 영역으로: (1) 실행 엔진 spec의 `INTEGRATION_NOT_CONNECTED` vs `INTEGRATION_INCOMPLETE` 상태 구분이 target과 일치하는지, (2) Internal MCP Bridge의 `pending_install` 상태 Cafe24 Integration 처리 명시 여부다. 이 두 항목은 런타임 에러와 연결될 수 있으므로 구현 착수 전 확인이 권장된다. 나머지 INFO 항목들은 관련 PRD 및 data-flow spec과의 동기화 권장 사항으로, draft 채택 자체를 차단하지 않는다.

---

## 위험도

MEDIUM
