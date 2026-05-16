---
worktree: cafe24-coverage-order-b7d4f9
started: 2026-05-16
owner: developer
---

# Plan: Cafe24 Coverage 확장 — Order resource Phase 5a

`plan/in-progress/cafe24-followup-backlog.md` (PR #87) 의 "planned → supported 전환" 트랙의 첫 묶음. Order resource 에서 자동화 워크플로우에 가장 자주 필요한 3 endpoint 를 supported 로 승격한다.

## 범위

| id | label | method | path | scope | 근거 |
|---|---|---|---|---|---|
| `order_count` | 주문 개수 조회 | GET | `orders/count` | read | dashboard / pagination control 의 사전 카운트 |
| `order_status_update` | 주문 상태 변경 | PUT | `orders/{order_id}` | write | 단일 주문 상태 자동 전이 |
| `order_status_update_multiple` | 주문 상태 일괄 변경 | PUT | `orders/status` | write | 야간 배치·일괄 상태 변경 |

## 작업 단위

- [x] `backend/src/nodes/integration/cafe24/metadata/order.ts` 에 3 row 추가
- [x] `backend/src/nodes/integration/cafe24/metadata/planned.ts` 에서 3 id 제거 (sync test mirror)
- [x] `spec/conventions/cafe24-api-catalog/order.md` 3 row 의 `status: planned → supported` + method/path/scope/paginated 채움
- [x] `spec/conventions/cafe24-api-catalog/_overview.md` coverage matrix `order: 6 → 9`, 합계 `53 → 56`, CHANGELOG 추가
- [ ] backend jest — catalog-sync.spec.ts + metadata.spec.ts + public-meta.spec.ts 통과
- [ ] /consistency-check (impl-prep) — Critical 0
- [ ] PR open

## 결정 사항

- **path placeholder 이름**: Cafe24 docs 는 `{order_no}` 를 사용하지만 codebase 의 기존 `order_get` / `order_buyer_update` / `order_memos_create` 가 `{order_id}` 를 사용하므로 일관성 유지를 위해 새 row 도 `order_id` 사용. metadata description 에 Cafe24 docs 의 별칭(`order_no`) 명시.
- **status 값 enum 미고정**: docs 가 보여준 "pending_payment / paid / preparing / shipped / delivered / cancelled" 는 사용자 친화 라벨이고, 실제 Cafe24 status 코드는 mall workflow 별로 다른 N00/N10/N20 체계. enum 으로 박지 않고 string + description 으로 유지.
- **order_status_update_multiple 의 order_id 필드는 array** — Cafe24 docs 의 "Order number(s)" 표현 + bulk endpoint 의 통상 의미.

## 수용 기준

- backend `findCafe24Operation('order', '<id>')` 가 3 id 모두 반환
- `CAFE24_PLANNED_BY_RESOURCE.order` 가 3 id 미포함
- `catalog-sync.spec.ts` 양방향 동기 통과
- 카탈로그 coverage matrix 가 9 / ~300 으로 일치
- `buildCafe24Extras().operationsByResource.order.length === 9`

## 후속 (다음 PR 들)

- 다른 Order endpoint (planned 96+) — 사용 빈도 우선순위 따라 묶음 PR
- Product / Customer / Promotion 등 핵심 resource 의 coverage 확장
- 별 트랙: `cafe24-followup-backlog.md` 의 B-1~B-5 medium 묶음
