# Plan 정합성 검토 결과

> 검토 모드: `--impl-prep`
> Target: `spec/conventions/cafe24-api-catalog` (18 resource 전체)
> Target plan: `plan/in-progress/cafe24-planned-implementation.md` (worktree: `cafe24-planned-impl-060c7f`)
> 검토 기준: `plan/in-progress/**` 전체 (2026-05-21 기준)
> 검토 일시: 2026-05-21

---

## 발견사항

### [CRITICAL] `privacy_*` 행 id 변경 미결 결정을 우회한 채 planned → supported 승격 진행

- **target 위치**: `cafe24-planned-implementation.md` §Phase 1 Batch 1-G — `privacy_boards(2) + privacy_join(2) + privacy_orders(2)` 6건을 supported 로 승격하는 작업 포함.
- **관련 plan**: `plan/in-progress/cafe24-restricted-scopes-followups.md §3` — "store 카탈로그의 `privacy_*` planned operation id 재명명" 항목. 체크박스 `[ ] prefix 결정` 이 미해소 상태. 선택지:
  - `store_privacy_*` (resource prefix 유지)
  - `policy_privacy_*` (정책 그룹 명시)
  - 기타
- **상세**: `spec/conventions/cafe24-api-catalog/store.md` 의 6 planned row (`privacy_boards_get/update`, `privacy_join_get/update`, `privacy_orders_get/update`) 는 `privacy.md` resource 와 id prefix 혼동을 유발한다는 이유로 rename pending 상태다 (consistency-check W-7 근거, `review/consistency/2026/05/17/12_37_41/`). 해당 rename 이 결정·완료되기 전에 target plan 이 이 6 row 를 현 id 그대로 backend metadata 에 추가하면, 이후 rename plan 이 (a) backend metadata id rename + (b) catalog row rename + (c) `planned.ts` 반영 전부를 다시 손대야 한다. 더 심각한 것은 `catalog-sync.spec.ts` 의 id unique / resource-내 일관성 검증 하에서 `privacy_*` id 가 store resource metadata 에 등록된 채로 rename 시 테스트 파편화가 발생한다는 점이다. 즉, target plan 이 prefix 결정을 사실상 "현 id 유지"로 일방적으로 결정하게 된다.
- **제안**: Batch 1-G 진입 전 `cafe24-restricted-scopes-followups.md §3` 의 prefix 결정을 사용자·project-planner 와 합의한다. 세 가지 중 하나를 선택하고, 해당 plan 의 `[ ] prefix 결정` 체크박스를 닫은 뒤 store.md row id 를 갱신하고, 그 이후 Batch 1-G 에서 supported 승격을 진행한다. 대안으로, Batch 1-G 의 privacy_* 6건만 "이번 PR 비-scope" 로 분리하고 rename 완료 후 별 batch 로 처리한다.

---

### [WARNING] store.md 동일 파일 동시 수정 — worktree 간 경합

- **target 위치**: `cafe24-planned-implementation.md` §Phase 1 전체 — `store.md` 에서 98개 planned row 를 supported 로 갱신.
- **관련 plan**: `plan/in-progress/cafe24-restricted-scopes-followups.md §3` — `store.md` 의 `privacy_*` 6 row id rename 작업이 별도 worktree 로 pending.
- **상세**: target plan 의 worktree `cafe24-planned-impl-060c7f` 가 `store.md` 전체를 대규모 편집하는 동안, restricted-scopes-followups §3 도 같은 파일의 6 row id 를 수정하려 한다. `cafe24-restricted-scopes-followups.md` 의 worktree 는 `TBD (per-item)` 이므로 아직 미생성 상태이나, restricted-scopes-followups §3 가 이 파일을 직접 수정 대상으로 적시하고 있다. Phase 1 이 merge 된 뒤 별도 worktree 에서 rename 을 진행하면 충돌 없이 처리 가능하지만, 만약 두 작업이 동시 진행될 경우 merge conflict 및 `catalog-sync.spec` 의 id 검증 연쇄 fail 위험이 있다.
- **제안**: CRITICAL 항목이 해소되면 (prefix 결정 → store.md rename 완료 → Batch 1-G 처리) 이 WARNING 도 자연 해소된다. restricted-scopes-followups §3 를 target plan Phase 1 merge 이전 또는 이후 중 어느 시점에 처리할지를 plan 에 명시적으로 기록할 것.

---

### [WARNING] Batch 1-G 의 `privacy_*` scope = `scope` 분류 — `cafe24-restricted-scopes.md` 확인 없이 진행 불가

- **target 위치**: `cafe24-planned-implementation.md` §Phase 1 Batch 1-G 비고 컬럼 — "privacy = scope (cafe24-restricted-scopes.md 확인)".
- **관련 plan**: `plan/in-progress/cafe24-restricted-scopes-followups.md §3` — store 의 privacy_* row 는 별도 scope-level restricted 인지 아닌지가 결정되지 않았다.
- **상세**: target plan 스스로 "cafe24-restricted-scopes.md 확인" 이라고 주석을 달았으나, `store.md` 의 privacy_* 6 row 가 `restricted: scope` 인지 빈칸인지는 `cafe24-restricted-scopes.md §1` (scope 단위 별도 승인 목록) 에 store scope 가 포함되어 있지 않아 빈칸으로 봐야 할 가능성이 있다. 단, privacy_* row 의 실제 Cafe24 scope (`mall.read_store` vs `mall.read_privacy`) 가 확인되지 않은 상태에서 batch 를 진행하면 `catalog-sync.spec §8` (restricted 동기 검증) 에서 fail 이 발생할 수 있다.
- **제안**: Batch 1-G 진입 전 cafe24 공식 docs 에서 해당 6 endpoint 의 실제 scope 값을 먼저 확인하고, `cafe24-restricted-scopes.md §1` 의 scope 목록과 대조한 결과를 plan §결정 로그에 기록한다.

---

### [INFO] cafe24-bg-refresh-tuning plan 의 spec 갱신 위임 항목이 미처리

- **target 위치**: `spec/conventions/cafe24-api-catalog` — target plan 의 직접 영역은 아님.
- **관련 plan**: `plan/in-progress/cafe24-bg-refresh-tuning.md` §후속 — "`spec/2-navigation/4-integration.md` / `spec/data-flow/integration.md` 의 cafe24 background refresh 주기 / cutoff 마진 명시 갱신 (project-planner 위임)".
- **상세**: cafe24-bg-refresh-tuning (worktree `cafe24-bg-refresh-tuning-fb72d5`) 이 backend 변경(`REFRESH_PROACTIVE_THRESHOLD_DAYS` 10 → 7, cron 6h) 을 진행 중이며, 그 spec 갱신 후속이 미완 상태다. target plan(`cafe24-planned-implementation.md`) 과 직접 충돌하지는 않으나, `spec/2-navigation/4-integration.md` 는 `cafe24-backlog-residual.md` §F-2 에서도 수정 대상으로 언급되고 있어 spec 의 integration 문서가 동시 수정 대상이 될 수 있다.
- **제안**: target plan 착수와 직접 관련은 없으나, bg-refresh-tuning 의 spec 갱신 위임 항목이 장기 미완 시 integration.md 의 refresh 주기 기술이 코드와 불일치 상태가 된다. 해당 plan 의 "project-planner 위임" 처리를 조속히 진행하기를 권장한다.

---

### [INFO] cafe24-test-spec-guard-cleanup-followups §W-8 — translation.ts TODO spec 결정 선행 조건

- **target 위치**: target plan 이 `order.md` / `product.md` / `store.md` 를 수정하며, translation resource 는 비-scope 로 제외됨.
- **관련 plan**: `plan/in-progress/cafe24-test-spec-guard-cleanup-followups.md §W-8` — `translation.ts:2565~2567` 의 `translation/` vs `translations/` 경로 불일치 TODO. "spec 결정이 선행되어야 할 경우 project-planner 위임" 으로 남아있음.
- **상세**: target plan 은 translation resource 를 건드리지 않으므로 직접 충돌은 없다. 다만 cafe24 metadata 전반을 일관성 있게 관리하는 관점에서, translation spec 결정이 완료되지 않은 채 다른 resource 의 metadata 를 대거 추가하면 향후 translation 정합화 시 추가 overhead 가 발생할 수 있다. 추적 메모 수준.
- **제안**: target plan 진행과 병행하여 §W-8 의 spec 결정 위임을 진행하거나, target plan 완료 후 별도 처리를 명시한다.

---

## 요약

target plan(`cafe24-planned-implementation.md`, worktree `cafe24-planned-impl-060c7f`) 의 핵심 위험은 Batch 1-G 에 포함된 `privacy_*` 6 row 의 처리다. `cafe24-restricted-scopes-followups.md §3` 가 이 row 들의 id prefix 를 rename 해야 한다는 미해결 결정을 열어둔 채, target plan 이 현재 id 그대로 backend metadata 에 `supported` 로 등록하려 하고 있다. 이는 rename 결정을 사실상 "현 id 유지" 로 일방 우회하는 것이며, 이후 rename 시 catalog-sync 동기 테스트 파편화가 불가피하다. Batch 1-G 진입 전 prefix 결정을 합의·반영하는 것이 선행 조건이다. 그 외 store.md 동일 파일 경합 및 restricted scope 분류 확인도 Batch 1-G 와 연동되어 함께 해소 가능하다. Phase 1 의 나머지 batch (1-A ~ 1-F, 1-H ~ 1-J)와 Phase 2/3 는 현재 알려진 미해결 결정과 충돌하지 않아 진행 가능하다.

## 위험도

**MEDIUM**

> Batch 1-G (privacy_* 6건) 를 제외하고 나머지 230건은 NONE. Batch 1-G 는 CRITICAL 조건 해소 후 진행 가능. 전체 plan 자체를 차단하지는 않으나, Batch 1-G 에 먼저 진입하면 CRITICAL로 상향된다.
