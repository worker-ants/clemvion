### 발견사항

이번 검토 범위(`spec/conventions/`, diff-base=origin/main)에서 해당 worktree(`swagger-passthrough-crossref`)의 실제 변경 파일은:
- `codebase/backend/src/common/swagger/api-wrapped.{ts,spec.ts}`
- `plan/in-progress/swagger-pagination-followups.md`
- `spec/5-system/2-api-convention.md`

`spec/conventions/` 에는 변경이 없다. 따라서 plan 정합성 검토는 spec/conventions/ 의 **현행(기존) 내용**과 in-progress plan 들 간의 충돌·미해소 여부를 확인하는 것으로 수행됨.

---

- **[INFO]** `audit-actions.md` — workspace/member 미구현 액션 사전 명명
  - target 위치: `spec/conventions/audit-actions.md §3 도메인별 분류 레지스트리` (workspace/member 행, 미구현)
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md §결정 4`
  - 상세: `audit-actions.md` 는 `workspace.created/updated/deleted`, `member.invited/role_changed/removed` 를 §2.1 과거분사로 명명하고 미구현으로 표기. `spec-sync-data-flow-12-workspace-gaps.md §결정 4` 는 이 액션들의 적재 **구현 여부**를 결정 옵션으로 제시하고 있으나, 동 plan 본문(line 111–114)이 "spec §4.1(`1-auth.md:366-371`)이 Planned 액션을 이미 캐논명으로 확정했고 명명·시제 결정은 이미 끝났고 구현 여부만 남았다"라고 명시. 즉 audit-actions.md 의 명명은 1-auth.md §4.1 에서 선행 확정된 결정을 레지스트리로 정리한 것으로, 미결 결정을 일방적으로 내린 것이 아님.
  - 제안: 현 상태 유지. 추적 메모로 충분.

- **[INFO]** `cafe24-api-catalog/application.md` — G-2 docs 부재 ops ⚠ 마크 / G-3l open
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md` 하단 footnote
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §G-2 / §G-3l`
  - 상세: `applications_list`·`webhooks_list` 에 ⚠ seed 주석이 있고 `cafe24-backlog-residual.md §G-2 트랙` 을 참조. G-3l은 "production 검증 후 제거 여부 결정 — 미결 유지(2026-06-20 재검증)" 상태로 open. spec과 plan이 정합 — spec이 plan의 미결 결정을 우회하지 않음.
  - 제안: 현 상태 유지.

- **[INFO]** `cafe24-api-catalog/category.md` — `mains_update/delete` seed 처리
  - target 위치: `spec/conventions/cafe24-api-catalog/category.md` footnote `[^seed]`
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §G-2`
  - 상세: `mains_update/delete` 의 docs 부재를 footnote 와 G-2 트랙으로 추적. plan과 정합.
  - 제안: 현 상태 유지.

- **[INFO]** `cafe24-api-catalog/` field-level 파일 — G-4 잔여 재생성 미완
  - target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 등 field-level 파일
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §G-4`
  - 상세: G-4 `[x]` hand-fix 항목(appstore-orders 등 4파일) 은 완료, 잔여(`links` 등)는 재생성 필요로 defer. 현재 target 파일들은 이 partial-fix 상태 — plan 과 정합.
  - 제안: 현 상태 유지. 재생성 트랙은 plan에서 계속 추적.

---

`swagger-pagination-followups.md`(현 worktree 의 plan)는 `spec/conventions/` 를 전혀 참조·변경하지 않으며, 해당 plan의 `spec_impact: spec/5-system/2-api-convention.md` 는 검토 대상 외 경로임.

### 요약

`spec/conventions/` 내용은 현재 in-progress plan 들과 완전히 정합한다. 현 worktree(`swagger-passthrough-crossref`)의 변경 사항은 spec/conventions/ 를 건드리지 않으며, 기존 spec/conventions/ 상태도 어떤 in-progress plan 의 미결 결정을 일방적으로 우회하거나 선행 조건을 위반하지 않는다. audit-actions.md 의 workspace/member 미구현 액션 명명은 1-auth.md §4.1 에서 이미 확정된 결정을 레지스트리로 정리한 것으로, spec-sync-data-flow-12-workspace-gaps.md plan 과 충돌하지 않는다. cafe24-api-catalog 관련 open 항목(G-2 docs 부재 ops, G-3l, G-4 잔여)은 plan과 spec 모두 동일 상태를 반영하고 있다.

### 위험도
NONE
