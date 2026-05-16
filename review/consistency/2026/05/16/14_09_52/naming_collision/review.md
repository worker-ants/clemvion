# Naming Collision Review — Phase 5a Order Operation IDs

**Target**: 3 new operation ids promoted from `planned` to `supported` in the `order` resource:
- `order_count`
- `order_status_update`
- `order_status_update_multiple`

**Checked sources**:
- `backend/src/nodes/integration/cafe24/metadata/order.ts` (CAFE24_OPERATIONS_BY_RESOURCE.order)
- `backend/src/nodes/integration/cafe24/metadata/planned.ts` (CAFE24_PLANNED_BY_RESOURCE)
- `spec/conventions/cafe24-api-catalog/order.md` (catalog rows)
- `spec/conventions/cafe24-api-catalog/store.md` (cross-resource)
- All other resource metadata files in `metadata/` (cross-resource id scan)

---

## 발견사항

### [WARNING] `order_status_update` vs `orders_status_update` — 유사 이름, 다른 resource

- **target 신규 식별자**: `order_status_update` (order resource, `order.ts` line 172)
- **기존 사용처**: `planned.ts` line 83 — `store` resource 의 planned entry `orders_status_update` (라벨: "주문 상태 표기 수정"); `spec/conventions/cafe24-api-catalog/store.md` line 58 동일 id 존재.
- **상세**: 두 id 는 서로 다르다 (`order_status_update` vs `orders_status_update`). 충돌은 아니지만 접두어만 단수/복수로 갈리며 영문 라벨도 유사해 혼동 가능성이 있다.
  - `order_status_update` (order resource): "Update an order status" — 단일 주문 상태 변경 (PUT `orders/{order_id}`)
  - `orders_status_update` (store resource): "Update order status displayed" — 주문 상태 표기(UI 라벨) 설정 수정 (PUT `orders/status` on store settings API)
  둘의 도메인·동작이 실질적으로 다르므로 의미 충돌은 없으나, AI Agent tool 목록에 나란히 노출될 때 혼동을 줄 수 있다.
- **제안**: `store` resource 의 `orders_status_update` description 에 "(store setting, not order state)" 등의 disambiguation 문구를 추가한다. `order_status_update` 의 description 에도 "(single order state change — distinct from store's orders_status_update)" 한 줄 추기를 권장.

---

### [INFO] catalog `order.md` 의 3개 행이 여전히 `status: planned` 상태

- **target 신규 식별자**: `order_count`, `order_status_update`, `order_status_update_multiple`
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/order.md` lines 17–19 — 3개 행 모두 `status` 컬럼이 `planned` 이고 `method`/`path`/`scope` 컬럼이 `?`
- **상세**: `order.ts` 에 완전한 메타데이터(method, path, fields)로 추가됐으나 카탈로그 행이 갱신되지 않았다. `catalog-sync.spec.ts` 는 id 의 양방향 존재 여부를 검증하지만 `status` 컬럼 및 실제 path/method 내용은 별도 수작업 갱신 대상이다. 이 상태로 두면 카탈로그가 실제 구현과 불일치한다.
  - `order_count`: 실제 path = `orders/count`, method = GET — catalog 에는 `?`
  - `order_status_update`: 실제 path = `orders/{order_id}`, method = PUT — catalog 에는 `?`
  - `order_status_update_multiple`: 실제 path = `orders/status`, method = PUT — catalog 에는 `?`
- **제안**: 카탈로그 3개 행을 `supported` 로 변경하고 `method`/`path`/`scope`/`paginated` 컬럼을 실제 메타데이터 값으로 채운다. `_overview.md` §5 coverage matrix 카운트도 함께 갱신.

---

### [INFO] `CAFE24_PLANNED_BY_RESOURCE.order` 에 3개 id 가 여전히 잔류

- **target 신규 식별자**: `order_count`, `order_status_update`, `order_status_update_multiple`
- **기존 사용처**: `planned.ts` — `order` 배열 (lines 262–371) 검색 결과 3개 id 없음 (이미 제거됨). 확인 완료: 잔류 없음.
- **상세**: planned.ts 의 `order` 블록에 위 3개 id 가 존재하지 않는다. 이 점검 항목은 이상 없음.
- **제안**: 없음 (정상).

---

### [INFO] Resource-internal uniqueness — order resource 내 중복 없음

- `order.ts` 내 id 목록: `order_list`, `order_get`, `order_items_list`, `order_shipments_create`, `order_buyer_update`, `order_memos_create`, `order_count`, `order_status_update`, `order_status_update_multiple` — 9개, 중복 없음.
- `order.md` 카탈로그 내 `order_` prefix 행 전수 검사: 중복 id 없음.
- **제안**: 없음 (정상).

---

### [INFO] Path placeholder 일관성 — `{order_id}` vs Cafe24 docs `{order_no}`

- **target 신규 식별자**: `order_status_update` (path: `orders/{order_id}`), `order_status_update_multiple` (body field: `order_id`)
- **기존 사용처**: `order_get` (`orders/{order_id}`), `order_items_list` (`orders/{order_id}/items`), `order_shipments_create` (`orders/{order_id}/shipments`), `order_buyer_update` (`orders/{order_id}/buyer`), `order_memos_create` (`orders/{order_id}/memos`) — 모두 `{order_id}` 사용.
- **상세**: 신규 3개 operation 이 기존 order resource 와 동일하게 `{order_id}` 를 사용해 일관성을 유지한다. Cafe24 공식 문서가 `{order_no}` 를 사용하는 것과 다르지만, `order_status_update` description 에 "Path placeholder reuses the codebase-wide `order_id` naming (Cafe24 docs call this `order_no`)" 라고 명시돼 있어 의도적 결정임이 문서화되어 있다.
- **제안**: 없음 (정상). 단, `order_status_update_multiple` 의 `order_id` field description 에도 동일 괄호 주석("Cafe24 docs label this `order_no`")이 이미 있어 일관됨.

---

## 요약

3개 신규 식별자(`order_count`, `order_status_update`, `order_status_update_multiple`)는 resource-internal 및 cross-resource 수준에서 실질적인 id 충돌이 없다. `CAFE24_PLANNED_BY_RESOURCE.order` 에서 정상 제거되었고, `CAFE24_OPERATIONS_BY_RESOURCE.order`(`order.ts`)에 완전한 메타데이터로 추가되었다. 경로 placeholder `{order_id}` 도 기존 order operations 와 일관된다. 다만 카탈로그 `order.md` 의 3개 행이 `planned` + `?` 상태로 남아있어 구현과 불일치하므로 갱신이 필요하다(INFO). `store` resource 의 `orders_status_update` 와 `order` resource 의 `order_status_update` 는 이름이 유사하나 도메인이 다르며 혼동 리스크는 낮으므로 경고(WARNING) 수준으로 기록한다.

## 위험도

LOW
