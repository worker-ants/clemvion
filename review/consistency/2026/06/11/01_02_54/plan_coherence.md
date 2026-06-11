# Plan 정합성 검토 — spec/2-navigation/ (impl-done, integration-expiry-fixes-1d7c7d)

## 발견사항

- **[INFO]** Rationale 내 "향후 신설 검토" 표현 → "결정·구현 완료"로 격상
  - target 위치: `spec/2-navigation/4-integration.md` §11.2 Rationale "알림 정책 (§11.2)" 마지막 절
  - 관련 plan: 없음 (main branch Rationale 에 "향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토" 로 남아 있던 미결 표현)
  - 상세: main branch 의 `spec/2-navigation/4-integration.md` Rationale(L1425) 에는 `error(*)` 전이 시 알림을 `integration_action_required` 로 발사하는 것이 "향후 신설 검토"로 표현되어 있었으나, integration-expiry-fixes-1d7c7d 에서 이를 "결정·구현 완료"로 확정하고 §11.2 표에 `integration_action_required` 알림을 정식 등재했다. plan/in-progress/ 에 이 결정을 "결정 필요" 또는 "TBD"로 명시한 계획서는 없고, `integration-expiry-fixes.md` 자체가 이 결정(V-07)의 출처임을 명기하고 있어 미해결 결정 우회에 해당하지 않는다. 다만 추후 main 병합 시 Rationale 이전 텍스트를 신중히 검토할 필요가 있다.
  - 제안: 현 처리 방식 적절. 추가 조치 불필요.

- **[INFO]** `spec-sync-structural-followups.md` 의 구 알림 정책 텍스트 잔존 가능성
  - target 위치: `spec/2-navigation/4-integration.md` §11.2
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` (worktree: spec-sync-audit — branch/worktree 미존재, stale)
  - 상세: `spec-sync-structural-followups.md` 는 spec 동기화 중 발견된 코드 갭을 추적하며 `integration_action_required` 를 "향후 신설 검토" 문맥에서 인용했다. 그러나 해당 plan 의 worktree `spec-sync-audit` 는 이미 main 에 병합된 상태(branch 미존재)다. 따라서 해당 plan 항목이 integration-expiry-fixes 의 §11.2 결정과 충돌할 active 위험 없음.
  - 제안: spec-sync-structural-followups.md 의 §C 항목에서 `integration_action_required` 참조가 본 결정으로 해소됐는지 플래너가 점검 후 체크 처리 권장.

- **[INFO]** `spec-sync-workflow-list-gaps.md` — target 과 무관하나 pending_plans 참조 존재
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans`
  - 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` (worktree: spec-sync-audit — stale)
  - 상세: `1-workflow-list.md` 는 `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]` 를 참조하지만 integration-expiry-fixes-1d7c7d 는 해당 파일을 수정하지 않으므로 충돌 없음. 단, spec-sync-audit worktree 가 더 이상 존재하지 않는다.
  - 제안: 조치 불필요(worktree stale, 별도 cleanup).

- **[INFO]** `unknown_error` 에러 코드 변경 (§5.4 Database Query)
  - target 위치: `spec/2-navigation/4-integration.md` §5.4 Database Query 테스트 절
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` C항목들, `node-output-redesign/database-query.md`
  - 상세: integration-expiry-fixes 가 §5.4 의 `error.code` 정규화 값을 `unknown` → `unknown_error` 로 변경했다. 이는 `spec/conventions/error-codes.md` 의 의미 기반 명명 원칙(F-3 follow-up — 완료)과 부합하는 수정이며, 기존 어떤 in-progress plan 도 이 `unknown` 코드에 "결정 필요" 표시를 두지 않았다. 다만 `node-output-redesign/database-query.md` 가 Database Query 노드 출력 재설계를 추적하므로 그 plan 의 spec 상 error 코드 열거와 일치시켜야 한다.
  - 제안: `node-output-redesign/database-query.md` 담당자에게 `unknown` → `unknown_error` 변경을 인지시킬 것.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보를 위한 §5번 검토를 수행했다. target(`claude/integration-expiry-fixes-1d7c7d`)이 수정한 `spec/2-navigation/4-integration.md` 를 다른 active worktree 가 동시에 수정하는지 확인:

- `claude/unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`): `spec/2-navigation/{13-user-guide.md, 5-knowledge-base.md, 6-config.md, _layout.md, _product-overview.md}` 수정. `4-integration.md` 미수정 → **파일 수준 worktree 충돌 없음**.
- `claude/health-probe-status-d9a184`, `claude/ws-resumed-ack-spec`: `spec/2-navigation/` 내 파일 수정 없음.

plan frontmatter `worktree` 필드에 기재된 worktree 중 실제 git worktree 목록에 없는 것:

- `spec-sync-audit` (다수 spec-sync-*.md 플랜이 참조) — Step 1: branch 미존재 → step 2: PR 없음 → **stale (branch 자체 없음, main 에 포함 추정)**. spec-sync 시리즈 PR #443~#452 가 squash 병합됨으로 Step 1 ancestor 체크 불통과하나 PR CLOSED/MERGED 로 stale 확인 가능.
- `spec-sync-audit-998544` (spec-sync-common-gaps.md, spec-code-cross-audit-2026-06-10.md) — Step 1: branch 미존재 → step 2: PR 없음 → **stale (branch 자체 없음, 2026-06-10 커밋 이력에 포함 추정)**.

이 두 worktree 는 §5번 검토 대상에서 제외했으며, 아래 목록에 INFO 로 기록.

**skip 목록:**

- `spec-sync-audit` (branch `spec-sync-audit`) — Step 1: branch 미존재(git branch --all 에서 확인 불가). Step 2: PR 없음. stale 추정. 관련 plan 다수(spec-sync-workflow-list-gaps.md 외 20여 개).
- `spec-sync-audit-998544` (branch `spec-sync-audit-998544`) — Step 1: branch 미존재. Step 2: PR 없음. stale 추정. 관련 plan: spec-sync-common-gaps.md, spec-code-cross-audit-2026-06-10.md 등.

위 두 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/2-navigation/` 에 대한 plan 정합성 검토 결과, CRITICAL 또는 WARNING 에 해당하는 충돌·중복·선행 미해소 항목이 없다. integration-expiry-fixes-1d7c7d 가 수정하는 `spec/2-navigation/4-integration.md` 는 다른 active worktree 가 동시에 수정하지 않으며, 수정 내용(V-01 makeshop refresh-capable 일반화, V-07 §11.2 알림 passive/active 분리 확정, V-15 큐 레지스트리 동기)은 plan `integration-expiry-fixes.md` 에 사용자 결정이 명기되어 있어 미해결 결정 우회가 아니다. `unknown` → `unknown_error` 에러 코드 변경만 `node-output-redesign/database-query.md` plan 과의 사소한 정합 확인이 필요하다. worktree 충돌 후보 4건 중 active 0건, stale 2건 skip(spec-sync-audit, spec-sync-audit-998544).

## 위험도

NONE

STATUS: SUCCESS
