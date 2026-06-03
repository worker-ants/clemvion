# Plan 정합성 검토 결과

## 검토 대상
- **Target**: `plan/in-progress/spec-draft-node-execution-cancelled.md` (worktree: `node-cancellation-engine-6bfcaa`)
- **검토 범위**: `plan/in-progress/**` 전체 (65건)

---

## 발견사항

### [WARNING] node-cancellation-infrastructure §2 체크박스가 spec-draft plan 참조 없이 미갱신
- **target 위치**: target plan 제목 및 서문 — "node-cancellation §2 + parallel-p2 §1 의 공유 작업"
- **관련 plan**: `plan/in-progress/node-cancellation-infrastructure.md §2`
  - `- [ ] NodeExecution.status = 'cancelled' 추가 또는 failed + error.name === 'AbortError' 분류 결정`
- **상세**: target plan 이 사용자 확인("CANCELLED enum" 명시, 옵션 B)을 기반으로 spec 을 확정했으나, `node-cancellation-infrastructure.md §2` 의 해당 체크박스는 여전히 미완료(`[ ]`) 상태이며 본 spec-draft plan 에 대한 cross-reference 가 없다. 관련 노트(line 7)에서 "NodeExecution `cancelled` enum 작업은 parallel-p2-followups.md §1 과 동일 작업 — 하나 닫으면 둘 다 닫힘" 이라고 언급하지만, spec 결정 단계가 별도 plan(`spec-draft-node-execution-cancelled.md`)으로 분리됐다는 사실이 반영돼 있지 않다.
- **제안**: `node-cancellation-infrastructure.md §2` 의 해당 항목 노트에 "spec 결정 분리: `spec-draft-node-execution-cancelled.md` (옵션 B 확정, V069 migration 필요)" 를 추가. 체크박스 자체는 구현(enum + engine dispatch + AbortError catch) 완료 시 닫는 것이 올바르나, 현재 spec 확정 단계 완료 여부가 plan 에 반영되지 않은 상태.

### [WARNING] parallel-p2-followups §1 체크박스가 spec-draft 분리 미반영
- **target 위치**: target plan 서문 — "parallel-p2 §1 과 동일 작업"
- **관련 plan**: `plan/in-progress/parallel-p2-followups.md §1`
  - `- [ ] NodeExecution.status='cancelled' 추가 (엔티티 + migration) — 별 plan 권고.`
- **상세**: target plan 이 spec 측 결정(옵션 B: 전용 status, V069 migration 명시)을 완료했으나 `parallel-p2-followups.md §1` 에는 이 spec-draft plan 에 대한 언급이 없다. 체크박스는 구현(엔티티 + migration)을 추적하는 것이므로 그 자체는 아직 열린 상태가 맞지만, "별 plan 권고" 가 실제로 `spec-draft-node-execution-cancelled.md` 로 구체화됐다는 사실이 기록돼야 한다.
- **제안**: `parallel-p2-followups.md §1` 에 "spec 분리: `spec-draft-node-execution-cancelled.md` (옵션 B 확정) — 구현 plan 은 별도 developer plan 으로 진행 예정" 주석 추가.

### [INFO] 미해결 결정 우회 여부 — 문제 없음 (사용자 명시 확인 있음)
- **target 위치**: target plan 서문 — "사용자 'CANCELLED enum' 명시 — 옵션 B(전용 status)"
- **관련 plan**: `node-cancellation-infrastructure.md §2` — "cancelled 추가 또는 failed + AbortError 분류 결정" 항목
- **상세**: 이 결정은 plan 에서 "결정 필요"로 열려 있었으나, target plan 이 사용자 명시 확인을 전제하고 있다("사용자 'CANCELLED enum' 명시"). target plan 의 `## Rationale` 도 `Execution` 레벨 선례와의 정합·취소·실패 의미 구분이라는 논거를 명시했으며, `## 설계 결정` 섹션에서 옵션 A(failed+AbortError 재사용) 기각 사유도 문서화했다. plan §2 의 기존 "결정 필요" 포뮬레이션("추가 또는 분류 결정")을 합법적으로 해소한 것으로 판단한다 — CRITICAL 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석:

target plan 이 수정하는 spec 파일 6건:
- `spec/5-system/4-execution-engine.md`
- `spec/1-data-model.md`
- `spec/conventions/node-cancellation.md`
- `spec/data-flow/3-execution.md`
- `spec/5-system/6-websocket-protocol.md`
- `spec/3-workflow-editor/3-execution.md`

동일 파일을 다루는 plans 의 worktree 후보:

- `spec-sync-audit` (plans: `spec-sync-execution-engine-gaps.md`, `spec-sync-execution-gaps.md`, `spec-sync-websocket-protocol-gaps.md`, `spec-sync-structural-followups.md`) — Step 1 exit 1 (ancestor 아님), Step 2 PR #440 **MERGED** → **stale skip**
- `spec-frontmatter-status-migration-027c17` (plan: `execution-engine-residual-gaps.md`) — Step 1 exit 1, Step 2 PR **MERGED** → **stale skip**

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec-draft-node-execution-cancelled.md` 는 `node-cancellation-infrastructure.md §2` 및 `parallel-p2-followups.md §1` 의 열린 결정 항목("cancelled vs failed+AbortError 분류 결정")을 사용자 명시 확인(옵션 B)에 기반해 합법적으로 해소하는 spec-draft 이며, 미해결 결정 일방 우회로 볼 수 없다. 다만 두 parent plan 이 이 spec-draft 의 존재를 참조하지 않아 추적 단절이 발생한 상태가 WARNING 2건이다. 병렬 worktree 충돌 후보 5개 worktree (spec-sync-audit·spec-frontmatter-status-migration-027c17 해당 plans) 는 모두 MERGED PR 로 stale 판정되어 skip — active worktree 충돌 0건. worktree 충돌 후보 중 stale 2개 그룹 skip, active 0개 분석.

---

## 위험도

LOW
