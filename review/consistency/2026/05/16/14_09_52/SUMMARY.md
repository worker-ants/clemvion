# Consistency Check SUMMARY — Cafe24 Phase 5a (Order coverage, impl-prep)

**일자**: 2026-05-16
**대상**: planned → supported 전환 3건 (`order_count`, `order_status_update`, `order_status_update_multiple`).
**worktree**: cafe24-coverage-order-b7d4f9

## 5 checker 결과

| checker | status | issues | 위험도 | 보고서 |
|---|---|---|---|---|
| cross_spec | success | 6 | LOW | [cross_spec/review.md](cross_spec/review.md) |
| naming_collision | medium | 3 | LOW | [naming_collision/review.md](naming_collision/review.md) |
| rationale_continuity | success | 2 | LOW | [rationale_continuity/review.md](rationale_continuity/review.md) |
| plan_coherence | success | 4 | LOW | [plan_coherence/review.md](plan_coherence/review.md) |
| convention_compliance | success | 3 | LOW | [convention_compliance/review.md](convention_compliance/review.md) |

## Critical / High

**없음.** 5 checker 모두 LOW. naming_collision 의 status=medium 은 단일 WARNING(아래) + 2 INFO 의 집계 결과.

## WARNING 처리

**`order_status_update` (order resource) vs `orders_status_update` (store resource)** — 두 id 는 다르지만 단/복수 차이만 있고 영문 라벨도 유사. 다른 도메인 (단일 주문 상태 변경 vs 상점 settings 의 상태 라벨 표기) 이라 실질적 충돌은 없음.
- **처리**: 메타데이터 description 에 이미 도메인 차이가 적혀 있음 ("Update the status of a single order" vs store 의 "Update order status displayed"). disambiguation 텍스트 추가 없이 진행.

## INFO 잔존 (검증 완료)

naming_collision 의 INFO 2건은 stale read 결과 (catalog `order.md` 와 `planned.ts` 가 이미 정상 갱신되어 있음 — 본 PR 의 변경 자체). 별도 조치 불요.

- catalog `order.md` 3 행: `supported` + 완전한 method/path/scope 로 갱신됨 (verified).
- `planned.ts` `order` 배열: 3개 id 제거됨 (verified).

cross_spec / convention_compliance / rationale_continuity / plan_coherence 의 INFO 들은 모두 future-improvement 권고 (예: order_count 의 paginated=false 확인 안내) 로 본 PR 차단 사유 아님.

## Test 결과

- backend jest `src/nodes/integration/cafe24/metadata/`: **41/41 통과** (catalog-sync 양방향 + public-meta + 기존 metadata)
- backend jest `src/nodes/ src/modules/nodes/`: **1761/1761 통과**

## BLOCK: NO

CRITICAL/HIGH 0건. WARNING 1건은 도메인 차이로 실 충돌 없음. INFO/잔존 권고는 후속 트랙.
