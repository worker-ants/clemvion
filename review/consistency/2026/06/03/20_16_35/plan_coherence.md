# Plan 정합성 검토 결과

검토 대상: `spec/4-nodes/4-integration/5-makeshop.md`
검토 모드: `--spec`
검토 일시: 2026-06-03

---

## 발견사항

### [INFO] plan/in-progress/makeshop-integration.md 의 등록(registration) 체크박스 미완 — 단, 현재 작업중

- target 위치: `5-makeshop.md` 전체 (§9.3, §9.6, §9.8 에서 registration 파일 cross-ref)
- 관련 plan: `plan/in-progress/makeshop-integration.md` §산출물 > 등록(registration) 편집
- 상세: plan 의 등록 파일 7건(`_product-overview.md`, `spec/0-overview.md`, `spec/1-data-model.md`, `spec/4-nodes/0-overview.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/11-mcp-client.md`) 이 체크박스 미완(`[ ]`) 상태로 남아 있다. 그러나 `git status` 확인 결과 해당 파일 전부가 이미 staged(`M`/`A`) 상태 — 즉, 편집은 완료됐지만 plan 체크박스가 아직 갱신되지 않았다. 충돌 아님, 단순 체크박스 미표시.
- 제안: 7개 등록 파일 편집이 실제로 완료됐음을 확인한 뒤 plan 의 체크박스를 `[x]` 로 표시. 추가로 `/consistency-check --spec` 게이트 체크박스도 완료 후 갱신.

### [INFO] cafe24-backlog-residual.md C-6 체크박스 미완 — target 이 C-6 를 자체 해소 선언

- target 위치: `5-makeshop.md` §9.8 "buildIntegrationMeta derived 필드 일반화 (C-6 동반 해소)"
- 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` C-6 항목 (`[ ]` 상태)
- 상세: target spec 과 `makeshop-integration.md §C-6 편입` 은 "이번 spec 작업에서 C-6 를 함께 해소한다" 고 선언하나, C-6 는 구현(backend `buildIntegrationMeta` 리팩토링)을 포함한다. 현재 `cafe24-backlog-residual.md` 의 C-6 항목은 여전히 미완(`[ ]`)이고, `5-makeshop.md` 자체는 `status: planned` — 구현 착수 전이다. spec 작성 단계에서 "C-6 동반 해소" 를 선언하는 것은 spec 의도 명시로는 적합하나, 실제 구현 PR 전까지는 C-6 체크박스를 닫을 수 없음에 주의.
- 제안: `cafe24-backlog-residual.md` C-6 를 즉시 닫지 말고, makeshop 구현 PR 완료 시점에 닫도록 plan 에 명시(현재 `makeshop-integration.md §C-6 편입` 이 구현 트랙까지 포함하므로 구현 완료 시 cafe24-backlog-residual C-6 에 `→ resolved by makeshop-integration PR` 주석 추가 권장). spec 이 이 의도를 기록하는 것 자체는 적절.

### [INFO] `5-makeshop.md` §9.6 — `plan/in-progress/makeshop-integration.md` 참조 (이제 실재)

- target 위치: `5-makeshop.md` §9.6 Rationale
- 관련 plan: `plan/in-progress/makeshop-integration.md` (worktree 내 신규 파일 — main 미합류)
- 상세: target spec 이 `plan/in-progress/makeshop-integration.md §후속` 을 cross-link 하는데, 해당 파일은 현재 worktree 에만 존재하고 main 에는 없다. 머지 전까지 main 에서 해당 링크가 dead ref 이다. 단, 이 spec 과 plan 이 같은 PR 에서 함께 머지될 것이므로 실질적 문제 없음.
- 제안: PR 을 단일 원자적 커밋으로 구성해 spec + plan 이 동시에 머지되도록 한다. 이미 staged 상태이므로 현재 방향 적절.

### [INFO] `spec/1-data-model.md` §2.10 — `makeshop` service_type 과 `shop_uid` 이미 target worktree 에 등재됨 (plan 체크박스는 미완)

- target 위치: `5-makeshop.md` §9.3 "단일 호스트 + shop_uid path segment"
- 관련 plan: `plan/in-progress/makeshop-integration.md` §산출물 등록 편집 `spec/1-data-model.md`
- 상세: `5-makeshop.md` §9.3 은 `data-model §2.10` 에 `(workspace_id, shop_uid) UNIQUE` 인덱스 선언을 가정하는데, target worktree 의 `spec/1-data-model.md` 확인 결과 `service_type` 열거에 `makeshop` 추가, `mall_id` 컬럼에 `shop_uid` projection 주석, 인덱스 표에 `WHERE service_type='makeshop'` partial UNIQUE 이 이미 기재돼 있음. spec 과 data-model 이 정합하다.
- 제안: 이미 정합. 추가 조치 불요.

### [INFO] `spec/2-navigation/4-integration.md §5.9` — 미확인 항목(rate limit·timezone·HMAC 구성) 이 spec 에 "open question" 으로 명시됨

- target 위치: `5-makeshop.md` §4.1 Timezone, §9.7 미확인 항목, §4 step 9 rate-limit
- 관련 plan: `plan/in-progress/makeshop-integration.md` §메이크샵 고유 분기 표 (timezone ⚠, rate limit ⚠)
- 상세: spec 과 plan 모두 timezone·rate limit·POST/PUT envelope 를 "구현 전 검증 필요" 로 명시해 일관됨. 이는 미해결 결정을 일방적으로 닫지 않고 open question 으로 남겨둔 올바른 처리다.
- 제안: 추가 조치 불요. 구현 착수 시 `developer` 가 확정해야 할 사항으로 plan 에 이미 명시됨.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `cafe24-api-catalog-1665bd` (branch `claude/cafe24-api-catalog-1665bd`) — Step 2 PR MERGED
- `code-node-sandbox-979a97` (branch `claude/code-node-sandbox-979a97`) — Step 2 PR MERGED
- `conventions-code-data-9b32d5` (branch `claude/conventions-code-data-9b32d5`) — Step 2 PR MERGED
- `feat-web-chat-demo` (branch `claude/workspace-allowed-origins-settings`) — Step 2 PR MERGED
- `fix-presentation-tool-default-dcecc3` (branch `claude/fix-presentation-tool-default-dcecc3`) — Step 2 PR MERGED
- `node-cancellation-engine-6bfcaa` (branch `claude/node-cancellation-engine-6bfcaa`) — Step 2 PR MERGED
- `plan-grooming-2ec306` (branch `claude/plan-grooming-2ec306`) — Step 2 PR MERGED
- `spec-drift-gates-b26bce` (branch `claude/spec-drift-gates-b26bce`) — Step 2 PR MERGED
- `spec-drift-resolve-efb608` (branch `claude/spec-drift-resolve-efb608`) — Step 2 PR MERGED
- `spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-groom-c7568b`) — Step 2 PR MERGED
- `spec-sync-audit` (branch `claude/switch-regex-workspace-uq`) — Step 2 PR MERGED
- `spec-sync-impl-644d19` (branch `claude/spec-sync-impl-644d19`) — Step 2 PR MERGED
- `system-status-recent-failed-86831b` (branch `claude/system-status-recent-failed-86831b`) — Step 2 PR MERGED
- `workflow-turn-timing-69fee2` (branch `claude/workflow-turn-timing-69fee2`) — Step 2 PR MERGED

worktree 충돌 후보 14건 전부 Step 2(PR state MERGED)로 stale 확정. active worktree 간 충돌 0건.

이 stale worktree 들이 활성으로 남아 있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/5-makeshop.md` 는 진행 중 plan(`plan/in-progress/makeshop-integration.md`)과 정합한다. target spec 이 가정하는 모든 사전 조건(data-model §2.10 makeshop 등재, §5.9 통합 화면 spec 신설, makeshop-api-catalog/metadata 파일 존재)이 동일 worktree 안에서 이미 편집 완료(staged)됐다. 미해결 결정(timezone·rate limit·POST envelope)은 spec 과 plan 양쪽에 "open question" 으로 일관되게 명시돼 있으며, target spec 이 일방적으로 이를 닫고 있지 않다. active worktree 간 충돌은 0건이다. 발견된 항목은 모두 INFO 등급으로, plan 체크박스 갱신·C-6 체크박스 연동 시점 관리가 주요 후속이다. worktree 충돌 후보 14건은 모두 MERGED PR stale 로 skip 처리됐다.

---

## 위험도

NONE
