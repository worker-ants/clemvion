# Cross-Spec 일관성 검토 — Cafe24 Order Coverage Phase 5a

대상 변경: `order_count` / `order_status_update` / `order_status_update_multiple` 3 endpoint planned→supported 전환.

검토 기준 문서:
- `spec/4-nodes/4-integration/4-cafe24.md` §1/§4/§6
- `spec/conventions/cafe24-api-metadata.md`
- `spec/conventions/cafe24-api-catalog/_overview.md` §2/§3/§4
- `spec/5-system/11-mcp-client.md`

---

## 발견사항

### 1 — [WARNING] `order_status_update_multiple` 의 HTTP 207 응답이 spec §4 의 포트 분기와 충돌 가능

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/order.ts` 라인 192-217 (`order_status_update_multiple` description: "Returns HTTP 207 (Multi-Status) when individual orders have differing outcomes.")
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 12 — "2xx → §5.1 (`port:'success'`)", §6 에러 코드 표 — `4xx/5xx` 및 `CAFE24_4XX` 만 정의, 207 은 언급 없음
- **상세**: Cafe24 의 `PUT orders/status` (bulk endpoint) 는 개별 주문마다 결과가 다를 때 HTTP 207 Multi-Status 를 반환한다. 현재 spec §4 step 12 는 분기 조건을 `2xx → success port`, `3xx/4xx/5xx → error port` 로 정의하고 있다. 207 은 2xx 범위(200-299) 안에 있으므로 기술적으로는 `success` 포트로 라우팅되어 코드가 동작하기는 한다. 그러나 §6 에러 코드 표와 §5.1 의 출력 예시가 모두 단일 성공/실패를 가정하고 있어, 207 응답 본문에 포함된 개별 실패 내역을 `output.response` 안에 묻어두는 것이 의도된 동작인지 spec 에 명시되지 않았다. 워크플로 설계자는 `port: 'success'` 를 받고도 일부 주문의 상태 변경이 실패했음을 인식하지 못할 수 있다.
- **제안**: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 12 또는 §6 에 "207 응답은 2xx 로 처리하여 `port: 'success'` 로 라우팅하되, `meta.statusCode = 207` 로 기록한다. 사용자는 `output.response` 를 직접 검사해 개별 주문 결과를 확인해야 한다." 라는 명시적 노트를 추가할 것을 권장한다. spec 변경 없이 현행 동작을 허용하는 것도 가능하나, 다음 Order coverage PR 전에 결정을 기록해 두어야 drift 를 막을 수 있다.

---

### 2 — [INFO] `order_status_update` 와 `order_get` 의 path 동일 (`orders/{order_id}`) — method 가 다르므로 충돌 없음, 카탈로그에 명시 확인 필요

- **target 위치**: `order.ts` 라인 178 (`order_status_update`, `path: 'orders/{order_id}'`, method `PUT`); 라인 48 (`order_get`, `path: 'orders/{order_id}'`, method `GET`)
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/order.md` 표 12행·19행
- **상세**: 동일 path `orders/{order_id}` 에 GET(`order_get`)과 PUT(`order_status_update`) 두 operation 이 존재한다. HTTP method 가 다르므로 실제 API 호출 충돌은 없다. `catalog-sync.spec.ts` 의 Rule 4("method/path 일치")는 `(id, method, path)` 단위로 검증하므로 테스트도 통과한다. 카탈로그 파일에서도 두 행의 method 컬럼이 각각 `GET`/`PUT` 으로 구분되어 있어 표면적 문제는 없다. 다만 같은 path 에 method 가 다른 두 operation 이 존재하는 패턴이 처음 등장하는 것이므로, 향후 `order_get` (GET) 과 `order_status_update` (PUT) 를 같은 path 로 오해하는 경우를 대비해 카탈로그 row 순서 또는 주석으로 관계를 명확히 해 두면 좋다.
- **제안**: 현행 spec/코드 변경은 불필요. 정보 목적의 기록.

---

### 3 — [INFO] `order_count` 의 `requiredFields: []` — spec §4 step 5 의 required fields 검증 로직과 호환 확인

- **target 위치**: `order.ts` 라인 145 (`order_count`, `requiredFields: []`)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 5 — "메타데이터의 `requiredFields` 에 명시된 키가 `config.fields` 에 모두 존재하는지 검증"
- **상세**: `requiredFields` 가 빈 배열인 경우 step 5 검증은 "필수 필드 없음 → 항상 통과"로 처리되어야 한다. spec 본문은 이 엣지 케이스를 명시하지 않으나, 빈 배열에 대한 `Array.every()` 또는 동등한 검증은 항상 `true` 를 반환하므로 구현상 문제가 없다. 기존 operation 중 `requiredFields: []` 패턴이 없었던 것이 첫 사례이므로 기록한다.
- **제안**: 구현 시 `requiredFields: []` 인 operation 에 대해 `CAFE24_MISSING_FIELDS` 가 절대 발생하지 않음을 단위 테스트로 커버하면 충분. spec 본문 변경 불필요.

---

### 4 — [INFO] `order_status_update_multiple` 의 `order_id` (array, body location) — 기존 `order_id` (string, path location) 와 타입·위치가 다름

- **target 위치**: `order.ts` 라인 203-208 (`order_status_update_multiple.fields.order_id: { type: 'array', location: 'body' }`)
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md` §2 형식 — `location: 'path' | 'query' | 'body'` 및 `type: '...' | 'array'` 모두 정의된 합법적 값임. `order_id` 는 동일 resource 의 다른 operation 에서 `{ type: 'string', location: 'path' }` 로 정의됨
- **상세**: `order_id` 라는 필드명이 operation 에 따라 "단일 주문 ID (string, path)" 와 "복수 주문 ID 목록 (array, body)" 의 두 가지 의미로 사용된다. 메타데이터 형식 컨벤션 상 이는 허용된 패턴이다 — 필드명은 operation-scoped 이며, id 의 unique 제약은 resource 레벨이 아니라 field 이름이다. `catalog-sync.spec.ts` 의 Rule 4 가 method/path 를 검증하고 Rule 3 이 `paginated` 를 검증하지만, 같은 이름 필드의 cross-operation 타입 불일치를 잡는 규칙은 없다. 사용자 혼란 위험은 낮으나, `description` 에 `order_no` alias 가 명시되어 있어 충분히 문서화된 상태다.
- **제안**: 현행 구조 유지. 향후 MCP Bridge 의 `tools/list` 가 두 operation 의 스키마를 LLM 에 노출할 때 `order_id` 가 string 인지 array 인지 LLM 이 올바르게 구분할 수 있도록 description 이 명확한지 검토 권장.

---

### 5 — [INFO] `spec/5-system/11-mcp-client.md` — 신규 supported 3건은 MCP allowlist 및 bridge 에 영향 없음

- **target 위치**: 변경된 모든 파일
- **충돌 대상**: `spec/5-system/11-mcp-client.md` §2.3 Internal Bridge, §5 도구 노출
- **상세**: `Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 동적으로 순회하므로 새 row 추가만으로 MCP 도구 목록에 자동 포함된다. allowlist (`mcpServers[].enabledTools`) 는 bare operation id 배열로 저장되고, 신규 id 를 명시하지 않은 기존 allowlist 는 해당 도구를 노출하지 않으므로 기존 Agent 의 동작에 영향이 없다. spec 변경 불필요, 확인 완료.

---

### 6 — [INFO] coverage matrix 카운트 일치 확인

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §5 — order: 9, 합계: 56
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/order.md` 표 내 `status: supported` 행 수
- **상세**: `order.md` 에 `status: supported` 행은 `order_list`, `order_get`, `order_items_list`, `order_shipments_create`, `order_buyer_update`, `order_memos_create`, `order_count`, `order_status_update_multiple`, `order_status_update` — 총 9건. `_overview.md` 의 matrix 값(9)과 일치한다. 합계 56 도 각 resource supported 합산(2+7+9+5+3+1+5+3+6+3+1+1+2+2+1+2+2+1=56)과 일치. 수치 드리프트 없음.

---

## 요약

Phase 5a 의 3 endpoint (order_count, order_status_update, order_status_update_multiple) 는 전반적으로 기존 spec 계약과 정합하다. 메타데이터 형식(`Cafe24OperationMetadata`), 카탈로그 동기 정책, MCP Bridge 자동 반영 모두 이상 없다. 주목할 실질적 리스크는 하나 — `order_status_update_multiple` 이 반환할 수 있는 HTTP 207 Multi-Status 가 현행 spec §4 의 2xx=success 포트 분기에 의해 자동으로 `port: 'success'` 로 라우팅되어 일부 주문의 실패가 사용자에게 비직관적으로 전달될 수 있다는 점이다. 이는 두 spec 이 직접 모순되는 것이 아니라 spec 이 207 케이스를 명시하지 않아 생기는 잠재적 UX 공백이므로 WARNING 등급으로 분류한다. 나머지 발견사항은 INFO 수준의 동작 확인 또는 문서화 권장이다.

## 위험도

LOW
