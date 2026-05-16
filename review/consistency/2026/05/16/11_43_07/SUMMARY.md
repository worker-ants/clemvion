# Consistency Check SUMMARY — Cafe24 API Catalog (Phase 1)

**일자**: 2026-05-16
**대상**: spec/conventions/cafe24-api-catalog/ 신규 + 관련 spec 수정 + plan/in-progress 신설
**worktree**: cafe24-node-ux-catalog-4b8f2c

## 5 checker 결과

| checker | status | issues | 위험도 | 보고서 |
|---|---|---|---|---|
| cross_spec | success | 6 | LOW | [cross_spec/review.md](cross_spec/review.md) |
| naming_collision | medium | 9 | MEDIUM | [naming_collision/review.md](naming_collision/review.md) |
| rationale_continuity | success | 3 | LOW | [rationale_continuity/review.md](rationale_continuity/review.md) |
| plan_coherence | high | 6 | HIGH→해소 | [plan_coherence/review.md](plan_coherence/review.md) |
| convention_compliance | success | 5 | LOW | [convention_compliance/review.md](convention_compliance/review.md) |

## Critical 해소 내역

plan_coherence 가 보고한 2건의 CRITICAL("`4-cafe24.md` / `cafe24-api-metadata.md` 가 `cafe24-spec-sync-e2a8b9` worktree 와 동시 수정") 은:

- `cafe24-spec-sync-e2a8b9` 브랜치가 본 consistency-check 실행 시점 직전 PR #75 로 `origin/main` 에 머지된 상태였고, 본 worktree 의 기점은 그 이전 commit (`fd159315`) 이었다.
- 본 commit (`90ec7f52`) 직후 `git rebase origin/main` 실행 → `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` 한 곳만 충돌 (양쪽이 2026-05-16 row 각각 추가). 두 row 모두 보존, 본 PR row 만 `(후속)` 라벨 부여로 시간순 유지.
- rebase 후 backend `cafe24/metadata` jest 24개 통과.

## Medium / Warning 잔존

### naming_collision (MEDIUM, planned 항목 대상)

4건의 prefix 혼동 권고:
1. `store.privacy_*` (6 ids) vs 독립 resource `privacy` — prefix 충돌
2. `supply.shipping_suppliers_*` (3 ids) vs 독립 resource `shipping` — prefix 충돌
3. `order.order_memos_*` (singular) vs `order.orders_memos_list` (plural) — 단/복수 혼재
4. `store.boards_setting_*` vs `community.boards_settings_*` — 1글자 차이

모두 `status: planned` 단계이므로 구현 시점에 id 재명명으로 해소 가능. 본 PR 에서는 보존하되 후속 plan 의 후속 항목으로 추적. 5건의 INFO 는 단순 가독성 권고.

### plan_coherence (HIGH, WARNING 잔존)

- `cafe24-pending-polish-followup.md` 그룹 C 와 Phase 3 의 `Cafe24Config` 재작성 — 동일 컴포넌트. Phase 3 착수 시 재확인.
- `spec-update-cafe24-app-url-reuse.md` 의 §9.4 outdated — `cafe24-spec-sync` 머지로 일부 해소되었을 가능성 — 별도 확인.

### cross_spec / rationale_continuity / convention_compliance (LOW)

세 checker 모두 success. 가벼운 권고 13건은 plan doc 의 후속 섹션에 흡수.

## BLOCK: NO

CRITICAL 0건 (직렬화 충돌은 rebase 로 해소). MEDIUM/WARNING 은 Phase 1 머지 차단 사유 아님.
