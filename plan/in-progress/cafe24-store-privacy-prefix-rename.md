---
worktree: TBD (follow-up — 본 작업은 별도 worktree 에서 진행 권장)
started: 2026-05-17
owner: TBD
type: follow-up
parent_session: review/consistency/2026/05/17/12_37_41/ (W-7)
---

# PLAN: store 카탈로그의 `privacy_*` planned operation id 재명명

## 배경

impl-prep consistency-check (`review/consistency/2026/05/17/12_37_41/` W-7) 가 `spec/conventions/cafe24-api-catalog/store.md` 의 6 planned row 가 `privacy_` 접두사를 사용해 별개 resource 인 `privacy.md` 와 명명 혼동을 유발한다고 지적.

영향 row (모두 `status=planned`):

- `privacy_boards_get` / `privacy_boards_update`
- `privacy_join_get` / `privacy_join_update`
- `privacy_orders_get` / `privacy_orders_update`

## 결정 필요 사항

1. 새 prefix 선택 — `store_privacy_*` (resource prefix 유지) vs `policy_privacy_*` (정책 그룹 명시) vs 기타.
2. catalog row 갱신 + 향후 backend 메타데이터 row 추가 시 일관성 유지.
3. `cafe24-restricted-scopes.md` / `cafe24-api-metadata.md` 본문에 별도 영향 없음 (별도 승인 대상 아님 — 일반 store scope).

## 진행 조건

- 본 작업은 본 worktree 의 spec 변경에 종속되지 않음 (별도 worktree 에서 가능).
- `cafe24-restricted-scopes-a1b2c3` PR 머지 후 진행 권장 (catalog 표 수정 충돌 회피).

## 비목표

- backend 메타데이터 변경 — 본 6 row 가 planned 라 backend metadata 미존재.
- 다른 resource 의 명명 일관성 점검 — 별도 plan.
