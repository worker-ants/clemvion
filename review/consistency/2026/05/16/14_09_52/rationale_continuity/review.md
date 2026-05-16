# Rationale Continuity Review — Phase 5a (Cafe24 Order Coverage)

세션: `review/consistency/2026/05/16/14_09_52/`
대상: backend `order.ts` 메타데이터 3행 추가 (`order_count`, `order_status_update`, `order_status_update_multiple`) + 카탈로그 `planned → supported` 승격

---

### 발견사항

- **[INFO]** `order_status_update` 의 path placeholder 이름 (`{order_id}`) 이 Cafe24 공식 docs 의 파라미터 이름(`order_no`)과 다름
  - target 위치: `backend/src/nodes/integration/cafe24/metadata/order.ts` L178, `order_status_update.fields.order_id`; 메타데이터 `description` 에 `"Path placeholder reuses the codebase-wide order_id naming (Cafe24 docs call this order_no)."` 명시
  - 과거 결정 출처: `spec/conventions/cafe24-api-metadata.md` §2 — `fields[fieldName].type` / `location` 은 정의하나 placeholder 이름의 규범(Cafe24 verbatim vs 코드베이스 통일)에 대한 결정은 문서화되지 않음. 기존 `order_get`, `order_items_list`, `order_shipments_create`, `order_buyer_update`, `order_memos_create` 모두 `{order_id}` 를 사용하고 있으며 (`catalog/order.md` line 12–16), `spec/4-nodes/4-integration/4-cafe24.md` §4 step 7 의 URL 구성 설명 역시 `fields` 에서 path parameter 를 채운다고만 명시.
  - 상세: "Cafe24 docs names verbatim 을 사용하라"는 과거 결정이 어디에도 존재하지 않는다. 기존 5개 order operation 이 모두 `{order_id}` 를 사용해 코드베이스 내 일관성은 유지된다. 단, 이 선택이 과거에 명시적으로 결정된 것은 아니며 현 PR 에서 새롭게 인라인 주석(`Cafe24 docs call this order_no`)으로 사유를 명시한 것이 처음이다. Rationale 섹션에 명문화된 결정이 없어 향후 다른 contributor 가 혼용할 여지가 있다.
  - 제안: `spec/conventions/cafe24-api-metadata.md` §2 또는 §4 신규 endpoint 추가 절차에 "path placeholder 이름은 Cafe24 공식 docs 의 파라미터 이름을 사용하지 않고 코드베이스 내 통일된 이름을 사용한다" 를 1줄 Rationale 로 추가하면 미래 혼선을 방지할 수 있다. 현 PR 코드 변경은 기존 관행과 일치하므로 즉시 수정 불요.

- **[INFO]** `order_status_update_multiple` 의 HTTP 207 Multi-Status 응답 처리가 spec 에 명시되지 않음
  - target 위치: `backend/src/nodes/integration/cafe24/metadata/order.ts` L196–217, `description` 에 `"Returns HTTP 207 (Multi-Status) when individual orders have differing outcomes."` 명시
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 12 반환 분기 — `2xx → success`, `3xx/4xx/5xx → error`. §6 에러 코드 표 — 2xx 범위에 207 이 포함되나 명시적으로 언급되지 않음.
  - 상세: 207 은 2xx 범위이므로 현재 spec 의 `2xx → port:'success'` 분기를 따라 `success` 포트로 라우팅된다. 그러나 207 응답은 body 안에 개별 order 의 부분 실패 정보를 담을 수 있어, 사용자가 `success` 포트만 보고 일부 주문 상태 변경이 실패했음을 놓칠 수 있다. 과거 결정에서 207 처리를 명시적으로 논의하거나 기각한 Rationale 는 없다 (407 Multi-Status 는 bulk operation 에서 처음 등장). 이를 `success` 로 처리하는 것이 합의된 invariant 위반은 아니지만, 사용자가 부분 실패를 확인하려면 `output.response` 를 직접 파싱해야 한다는 점이 spec 에 문서화되지 않았다.
  - 제안: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 12 또는 §9 Rationale 에 "207 Multi-Status 는 2xx 로 분류되어 `success` 포트로 라우팅된다. 부분 실패 정보는 `output.response` body 에서 확인해야 한다" 를 INFO 수준 노트로 추가. 현재 구현이 spec invariant 를 위반하지는 않으므로 blocking 아님.

---

### 검증 결과 — 점검 관점 5항목

1. **§9.1 Option C (단일 노드 + 메타데이터 테이블) 준수**: 3개 신규 operation 모두 메타데이터 row 1개씩 추가하는 방식으로 Option C 를 준수한다. Option A(endpoint 당 도메인 노드)·Option B(범용 HTTP 노드)로 회귀 없음. **이상 없음**.

2. **§9.3 메타데이터 위치 (backend module = SoT, catalog = SoT for catalog) 준수**: `backend/src/nodes/integration/cafe24/metadata/order.ts` 에 3행 추가, `spec/conventions/cafe24-api-catalog/order.md` 의 3행을 `planned → supported` 로 동시 승격, `_overview.md` §5 coverage matrix 를 `order: 6 → 9`, `합계: 53 → 56` 으로 갱신, `planned.ts` 에서 3개 항목 제거. 카탈로그 ↔ 메타데이터 양방향 동기 계약(`catalog-sync.spec.ts`) 을 준수한다. **이상 없음**.

3. **`spec/conventions/cafe24-api-metadata.md` §2 형식 준수**: 3개 신규 row 모두 `id`, `label`, `description`, `scopeType`, `method`, `path`, `requiredFields`, `fields`, `responseShape` 필드를 올바르게 갖추고 있다. `order_status_update_multiple.fields.order_id` 는 `type: 'array'` 로 선언되어 있어 §2 의 `'array'` 타입 허용 범위 내다. **이상 없음**.

4. **`spec/conventions/cafe24-api-catalog/_overview.md` §3 status enum + §4 sync policy 준수**: `planned → supported` 전환 시 `method`/`path`/`scope`/`paginated` 컬럼을 `?` 에서 구체 값으로 채우는 규칙을 3행 모두 준수한다. **이상 없음**.

5. **§9.9 metadata-driven typed dynamic form (PR #88) 소비 가능성**: 3개 신규 operation 은 기존 동적 폼이 소비하는 동일한 메타데이터 구조(`fields[k].type`, `location`, `requiredFields`)를 사용한다. `order_status_update_multiple.fields.order_id` 의 `type: 'array'` 는 §2 의 허용 타입이므로 폼 렌더러가 `array` 타입 입력 위젯을 구현하고 있어야 한다. `spec/4-nodes/4-integration/4-cafe24.md` §2 / §9.9 에는 `array` 타입 필드의 UI 표현에 대한 결정이 명시되지 않았으나, 이는 §9.9 의 직접 위반이 아니라 미정의 케이스다. **이상 없음 (미정의는 별도 WARNING 아님 — 기존 `order_shipments_create.fields.items` 에도 `type: 'array'` 가 이미 사용됨)**.

6. **path placeholder 이름 규범**: 기존 코드베이스의 5개 order operation 은 모두 `{order_id}` 를 사용하며, 신규 `order_status_update` 도 동일하게 `{order_id}` 를 사용한다. "Cafe24 docs 이름 verbatim 사용" 이라는 과거 결정이 존재하지 않으므로 기각된 결정의 재도입에 해당하지 않는다. **이상 없음** (단, Rationale 미문서화 — 위 INFO 1).

---

### 요약

Phase 5a 의 3개 Order operation 추가(`order_count`, `order_status_update`, `order_status_update_multiple`)는 Rationale 연속성 관점에서 기각된 대안의 재도입이나 합의된 invariant 위반이 없다. §9.1 Option C, §9.3 SoT 이중 위치, `cafe24-api-metadata.md` §2 형식, `_overview.md` §3/§4 sync policy 모두 준수되었다. `order_status_update` 의 path placeholder `{order_id}` 는 코드베이스 내 기존 관행과 일치하며 "Cafe24 docs verbatim" 이라는 과거 결정이 없으므로 위반이 아니다. 다만 이 naming 선택과 `order_status_update_multiple` 의 207 Multi-Status 처리 방식이 Rationale 에 명문화되지 않아 미래 혼선 여지가 있다는 INFO 2건을 제기한다.

### 위험도

LOW
