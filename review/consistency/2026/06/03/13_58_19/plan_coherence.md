# Plan 정합성 검토 결과

> 검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/)
> 대상: `spec/` 전 범위 (spec-sync-audit worktree 변경분)
> 검토 일시: 2026-06-03

---

## 발견사항

### [WARNING] spec-sync-workflow-list-gaps.md — 참조된 plan 파일이 실재하지 않음
- **target 위치**: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` 섹션
- **관련 plan**: 없음 (참조된 파일 `plan/in-progress/spec-sync-workflow-list-gaps.md` 가 `in-progress/` 와 `complete/` 어디에도 없음)
- **상세**: spec-sync-audit 워크트리가 `spec/2-navigation/1-workflow-list.md` 의 `status` 를 `implemented` → `partial` 로 낮추면서 `pending_plans: - plan/in-progress/spec-sync-workflow-list-gaps.md` 를 추가했다. 그러나 해당 plan 파일이 repo 어느 위치에도 존재하지 않는다. `spec/conventions/spec-impl-evidence.md §3` 규칙에 따라 `pending_plans` 에 등재된 plan 은 실재해야 하며, spec frontmatter 의 `partial` 분류 근거가 된다. plan 파일 없이 `partial` + dangling reference 만 남으면 후속 runner 가 orphan 참조를 오류로 인식할 수 있다.
- **제안**: spec-sync-audit worktree 에서 `plan/in-progress/spec-sync-workflow-list-gaps.md` 파일을 함께 생성하거나, 기존에 다루는 plan(예: `node-output-redesign/workflow.md` 등)으로 참조를 교체할 것. 또는 1-workflow-list.md frontmatter 의 `partial` 분류가 정당한지 재확인한 후 기존 plan 참조로 대체.

---

### [WARNING] spec-sync-external-interaction-api-gaps.md — 참조된 plan 파일이 실재하지 않음
- **target 위치**: `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` 섹션
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` (동일 spec 파일에 열린 결정 보유)
- **상세**: spec-sync-audit 워크트리가 `14-external-interaction-api.md` 를 `status: partial` + `pending_plans: - plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 갱신했으나, 해당 plan 파일이 존재하지 않는다. 또한 이미 `plan/in-progress/spec-fix-eia-token-error-codes.md` 가 같은 spec 파일의 미해소 항목(§5.1 `TOKEN_REVOKED` 추가, `SCOPE_MISMATCH` HTTP status 403 vs 401 결정, terminal revoke 신뢰성 명시)을 추적하고 있다. 현재 spec-sync-audit 의 EIA 변경이 `TOKEN_REVOKED`·`SCOPE_MISMATCH` 결정에는 직접 개입하지 않지만, `partial` 의 등재 근거 plan 이 없는 상태이므로 두 plan(신규 생성 vs 기존 `spec-fix-eia-token-error-codes.md` 통합) 중 하나를 택해야 한다.
- **제안**: `spec-sync-external-interaction-api-gaps.md` 파일을 실제로 생성(backoff 간격 미구현·rate-limit 미구현·currentNode null placeholder 등 spec-sync-audit 에서 발견한 갭 목록 포함)하거나, `spec-fix-eia-token-error-codes.md` 의 범위를 확장하여 해당 갭을 통합한 뒤 단일 plan 으로 참조를 통일할 것.

---

### [WARNING] spec-fix-eia-token-error-codes.md — 미해소 결정과 spec 파일 동시 접촉 주의
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` (worktree: TBD — 미착수)
- **상세**: `spec-fix-eia-token-error-codes.md` 는 §5.1 에러 표에 `TOKEN_REVOKED` 행 추가, `SCOPE_MISMATCH` 의 HTTP status 를 403 → 401 `TOKEN_SCOPE_MISMATCH` 로 변경할지를 "결정 필요" 항목으로 보유하고 있다. spec-sync-audit 의 EIA 변경은 §5.1 에러 표를 직접 수정하지 않아 현재 시점에서는 충돌하지 않는다. 그러나 spec-sync-audit PR 이 머지된 후 `spec-fix-eia-token-error-codes.md` 가 착수되면 두 수정이 같은 섹션을 건드리게 된다. 선행 관계가 명시되지 않았다.
- **제안**: spec-sync-audit PR 머지 후 `spec-fix-eia-token-error-codes.md` 착수 시 rebase 필요임을 해당 plan 에 "선행: spec-sync-audit PR 머지 후 착수" 주석으로 명시. 또는 spec-sync-audit 에서 생성할 `spec-sync-external-interaction-api-gaps.md` 에 `spec-fix-eia-token-error-codes.md` 와의 관계를 cross-ref 로 등재.

---

### [INFO] node-output-redesign/README.md plan — spec/conventions/node-output.md 갱신에 대한 WARNING 이미 plan 내 인지됨
- **target 위치**: `spec/conventions/node-output.md` (frontmatter code 필드 추가 + Principle 7 baseline 패턴 설명 정교화)
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` (`pending_plans` 참조 대상)
- **상세**: spec-sync-audit 의 `node-output.md` 변경은 (a) frontmatter `code` 에 `execution-engine.service.ts` 추가, (b) Principle 7 baseline 패턴 설명 1줄 교체다. `conventions-code-data-9b32d5` 워크트리(이미 MERGED, stale)는 같은 파일에서 Principle 7·8.2 내용을 실질적으로 변경했다. `node-output-redesign/README.md` 는 "본 plan 은 conventions 자체는 변경하지 않는다" 고 명시하므로 직접 충돌은 없다. 단, spec-sync-audit 의 Principle 7 baseline 패턴 수정이 `conventions-code-data-9b32d5` 에서 HEAD 에 squash-merge 된 변경과 병합 시 diff context 충돌이 발생할 수 있으므로 merge 시 확인이 필요하다.
- **제안**: 머지 전 `node-output.md` 에 대해 `git diff origin/main` 으로 현재 main 의 상태(conventions-code-data PR 반영본)를 기준으로 spec-sync-audit 패치가 clean apply 되는지 확인.

---

### [INFO] execution-engine-residual-gaps.md — worktree `spec-frontmatter-status-migration-027c17` 미활성
- **target 위치**: `spec/5-system/4-execution-engine.md` 및 관련 spec 파일
- **관련 plan**: `plan/in-progress/execution-engine-residual-gaps.md` (worktree: `spec-frontmatter-status-migration-027c17`)
- **상세**: 해당 worktree 는 `git worktree list` 에 없다. 즉 worktree 가 삭제됐거나 처음부터 생성되지 않은 상태. plan 에는 "G3 구현 완료, G1·G2 BLOCKED" 로 기록돼 있으므로 active 작업이 없는 것으로 보인다. spec-sync-audit 이 `spec/5-system/4-execution-engine.md` 를 수정하는 경우 안전하다.
- **제안**: `execution-engine-residual-gaps.md` frontmatter 의 `worktree` 값(`spec-frontmatter-status-migration-027c17`)이 실제로 존재하지 않으면 정비 대상. plan-lifecycle 규칙에 따라 G1·G2 상태를 정리하거나 plan 을 `complete/` 로 이동 검토.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `code-node-sandbox-979a97` (branch `claude/code-node-sandbox-979a97`) — Step 1: NOT_ANCESTOR (squash merge라 commit hash 변경), Step 2: PR MERGED. **stale** (spec/4-nodes/5-data/2-code.md, spec/4-nodes/0-overview.md, spec/4-nodes/5-data/0-common.md, spec/conventions/node-output.md 겹침 — 모두 이미 main 에 반영됨)
- `conventions-code-data-9b32d5` (branch `claude/conventions-code-data-9b32d5`) — Step 1: NOT_ANCESTOR, Step 2: PR MERGED. **stale** (spec/4-nodes/0-overview.md, spec/4-nodes/5-data/0-common.md, spec/4-nodes/5-data/2-code.md, spec/conventions/node-output.md 겹침 — 이미 main 에 반영됨)
- `spec-drift-resolve-efb608` (branch `claude/spec-drift-resolve-efb608`) — Step 1: NOT_ANCESTOR (squash merge), Step 2: PR MERGED. **stale** (spec/5-system/6-websocket-protocol.md, spec/4-nodes/1-logic/10-parallel.md 겹침 — 이미 main 에 반영됨)
- `system-status-recent-failed-86831b` (branch `claude/system-status-recent-failed-86831b`) — Step 1: NOT_ANCESTOR (squash merge), Step 2: PR MERGED. **stale** (spec/2-navigation/_product-overview.md, spec/5-system/_product-overview.md 겹침 — 이미 main 에 반영됨)
- `feat-web-chat-demo` (branch `claude/fix-web-chat-demo-apibase-cors`) — Step 1: NOT_ANCESTOR, Step 2: PR MERGED. **stale** (spec 파일 겹침 없음, codebase 변경만 존재 — spec 충돌 없음)

위 5개 worktree 가 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다.

---

## 요약

spec-sync-audit worktree 의 `spec/` 전범위 변경은 진행 중 plan 의 **미해소 결정을 일방적으로 번복하는 충돌은 없다** — `spec-fix-eia-token-error-codes.md` 가 다루는 `TOKEN_REVOKED`·`SCOPE_MISMATCH` 결정 영역(§5.1 에러 표)을 건드리지 않았고, `ai-agent-tool-connection-rewrite.md` 의 TBD 도구 연결 모델도 spec-sync-audit 범위 밖이다. 주요 발견사항은 (1) `pending_plans` 에 등재된 plan 파일 2건(`spec-sync-workflow-list-gaps.md`, `spec-sync-external-interaction-api-gaps.md`)이 실재하지 않아 frontmatter 정합성이 깨진 것(WARNING 2건)과 (2) `spec-fix-eia-token-error-codes.md` 와 EIA spec 파일을 공유하므로 머지 후 착수 순서를 명시해야 함(WARNING 1건)이다. worktree 충돌 후보 5건은 모두 Step 2(PR MERGED) 에서 stale 판정되어 CRITICAL 에서 제외했다. 위험도는 dangling plan 참조 2건으로 인한 LOW 로 판단된다.

---

## 위험도

LOW
