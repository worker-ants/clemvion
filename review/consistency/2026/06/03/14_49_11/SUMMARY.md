# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**MEDIUM** — Flyway V069 번호 충돌 위험(CRITICAL 1건)과 spec 역방향 링크 단절(WARNING 3건)이 있으나 나머지 cross-spec 정합성은 양호

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | Flyway V069 마이그레이션 번호 충돌 가능성 — `spec-sync-structural-followups.md` 의 `UQ_node_workflow_label` 제약 추가 아이템이 열린 상태로 V069 를 동일하게 참조하고 있어, 두 plan 이 병행 구현될 경우 동일 번호 충돌 발생 | `plan/in-progress/spec-draft-node-execution-cancelled.md` — V069 migration (node_execution.status CHECK 에 `cancelled` 추가) | `plan/in-progress/spec-sync-structural-followups.md` line 189 — "V069 이상 마이그레이션에 `UQ_node_workflow_label` 추가" (열린 아이템) | `spec-sync-structural-followups.md` 의 `UQ_node_workflow_label` 제약 추가는 V070 이상을 사용하도록 두 plan 담당자 간 번호 사전 조율 필요 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 본 plan 미등록 — `spec-impl-evidence.md §R-5` 경고 패턴 ("어떤 plan 도 책임지지 않는 빈 약속") | `spec/conventions/node-cancellation.md` frontmatter | `spec/conventions/spec-impl-evidence.md §2.1`, §R-5 | `node-cancellation.md` frontmatter `pending_plans:` 에 `- plan/in-progress/spec-draft-node-execution-cancelled.md` 추가 |
| 2 | Plan Coherence | `node-cancellation-infrastructure.md §2` 체크박스가 spec-draft plan 분리를 미반영 — spec 결정 단계 완료 여부 추적 단절 | `plan/in-progress/node-cancellation-infrastructure.md §2` — `[ ] NodeExecution.status = 'cancelled' 추가 또는 분류 결정` | `plan/in-progress/spec-draft-node-execution-cancelled.md` (옵션 B 확정) | `node-cancellation-infrastructure.md §2` 해당 항목 노트에 "spec 결정 분리: `spec-draft-node-execution-cancelled.md` (옵션 B 확정, V069 migration 필요)" 추가 |
| 3 | Plan Coherence | `parallel-p2-followups.md §1` 체크박스가 spec-draft 분리 미반영 — "별 plan 권고" 가 구체화됐다는 사실 미기록 | `plan/in-progress/parallel-p2-followups.md §1` — `[ ] NodeExecution.status='cancelled' 추가 (엔티티 + migration) — 별 plan 권고` | `plan/in-progress/spec-draft-node-execution-cancelled.md` | `parallel-p2-followups.md §1` 에 "spec 분리: `spec-draft-node-execution-cancelled.md` (옵션 B 확정) — 구현 plan 은 별도 developer plan 으로 진행 예정" 주석 추가 |
| 4 | Convention Compliance | plan 내 `**##Rationale §4 정합**` 표기가 비표준 — heading marker `##` 가 인라인 텍스트에 혼입되어 마크다운 렌더링 시 의미 없는 `##` 접두 노출 | `plan/in-progress/spec-draft-node-execution-cancelled.md` — `## 변경` 항목 1 | `spec/conventions/spec-impl-evidence.md` 전반 heading 참조 관례 | `**##Rationale §4 정합**` → `**Rationale §4 정합**` 으로 수정 |
| 5 | Naming Collision | `execution.node.cancelled` WS 이벤트가 `spec/data-flow/3-execution.md` line 168 이벤트 표에 누락 — spec 내 소규모 불일치 | `spec/data-flow/3-execution.md` line 168 — WS 이벤트 표 (`execution.node.started/completed/failed` 3개만 열거) | `spec/5-system/6-websocket-protocol.md` §4.1·§4.4 (정본, 이미 `execution.node.cancelled` 정의됨) | `spec/data-flow/3-execution.md` line 168 이벤트 열거에 `execution.node.cancelled` 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/3-execution.md §2.4` WS 이벤트 요약 표에 `execution.node.cancelled` 미반영 — §2.4 하단 주석이 정본을 websocket-protocol.md 로 위임하므로 기능 충돌 없음 | `spec/data-flow/3-execution.md §2.4` line 168 | §2.4 이벤트 표에 `execution.node.cancelled` 행 추가(선택) |
| 2 | Rationale Continuity | `spec/1-data-model.md §Rationale` 에 V069 migration·enum 신설 근거 항목 없음 — 정식 SoT는 `execution-engine.md §Rationale §4` 에 존재하므로 연속성 위반 아님 | `spec/1-data-model.md §Rationale` | `spec/1-data-model.md §Rationale` 에 "NodeExecution.status `cancelled` 신설 (V069)" 항목 추가 후 `execution-engine.md §Rationale §4` / `node-cancellation §5.1` 로 cross-link (선택) |
| 3 | Convention Compliance | plan 문서에 `## Overview` 섹션 없음 — plan 파일은 spec 문서 3섹션 규약 직접 적용 대상 아니므로 강제 아님 | `plan/in-progress/spec-draft-node-execution-cancelled.md` 도입부 | 첫 blockquote 앞에 `## Overview` 섹션 추가 또는 blockquote 를 heading 으로 승격 (선택) |
| 4 | Convention Compliance | `node-cancellation.md §5·§6` 의 `cancelled` 관련 기술이 plan 선언("이미 적용됨")과 불일치 가능성 — 실제 파일 최신성 확인 필요 | `spec/conventions/node-cancellation.md §5·§6` | worktree 파일이 plan 에 기술된 대로 갱신됐는지 확인; 미갱신 시 §5·§6 실제 반영 필요 |
| 5 | Naming Collision | `NodeExecutionStatus.CANCELLED` — spec 에 이미 정의, `node-execution.entity.ts` 에는 미정의 (gap, 충돌 아님) | `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` | 구현 시 `CANCELLED = 'cancelled'` 추가 및 V069 migration CHECK 제약 포함 |
| 6 | Naming Collision | `node.cancelled` 축약 표기가 `execution.node.cancelled` 전체 이름 표기와 혼재 가능성 | `spec/3-workflow-editor/3-execution.md` WS 이벤트 목록 | WS 이벤트 목록에 일관되게 `execution.node.cancelled` 전체 이름 사용 |
| 7 | Plan Coherence | stale worktree 2개 그룹(`spec-sync-audit`, `spec-frontmatter-status-migration-027c17`) — 해당 PR 모두 MERGED, active 충돌 0건 | `.claude/worktrees/` | 필요 시 `cleanup-worktree-all.sh --yes --force` 실행 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 6개 spec 파일 간 cross-spec 정합성 양호. `data-flow/3-execution.md §2.4` WS 이벤트 표 누락 1건(INFO)만 존재 |
| Rationale Continuity | LOW | `execution-engine.md §Rationale §4` 에 번복·이분 정책 적절히 문서화. `data-model.md §Rationale` 항목 미기재(INFO) 1건 |
| Convention Compliance | MEDIUM | `node-cancellation.md` `pending_plans:` 역방향 링크 누락(WARNING), 비표준 heading 참조 표기(WARNING), plan 선언과 실제 파일 상태 불일치 가능성(INFO) |
| Plan Coherence | LOW | 두 parent plan 에서 spec-draft 분리 미반영(WARNING 2건). 미해결 결정 우회 아님(INFO). active 충돌 worktree 0건 |
| Naming Collision | MEDIUM | V069 마이그레이션 번호 충돌 위험(CRITICAL 1건). `execution.node.cancelled` 충돌 없음. `NodeExecutionStatus.CANCELLED` gap(INFO) |

## 권장 조치사항

1. **[BLOCK 해소 — 즉시 필수]** `spec-sync-structural-followups.md` 의 `UQ_node_workflow_label` 제약 추가 아이템을 V070 이상으로 번호 변경하거나, 두 plan 담당자 간 V069 단독 사용 합의를 plan 문서에 명시. V069 가 `node_execution.status CHECK` 에 단독 배정됨을 양쪽 plan 에 기록.

2. **[WARNING 해소 — 진행 전 권장]** `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 `- plan/in-progress/spec-draft-node-execution-cancelled.md` 추가 (`spec-impl-evidence.md §R-5` 역방향 링크 복원).

3. **[WARNING 해소 — 권장]** `plan/in-progress/node-cancellation-infrastructure.md §2` 와 `parallel-p2-followups.md §1` 에 spec-draft 분리 사실 및 옵션 B 확정 주석 추가.

4. **[WARNING 해소 — 권장]** `plan/in-progress/spec-draft-node-execution-cancelled.md` 내 `**##Rationale §4 정합**` → `**Rationale §4 정합**` 수정.

5. **[WARNING 해소 — 권장]** `spec/data-flow/3-execution.md` line 168 이벤트 표에 `execution.node.cancelled` 행 추가.

6. **[INFO — 선택]** `spec/conventions/node-cancellation.md §5·§6` 실제 반영 여부 확인; `spec/1-data-model.md §Rationale` 에 V069 항목 cross-link 추가; WS 이벤트 목록 축약 표기 통일.

---
> **main 후속 (2026-06-03)**: BLOCK 사유였던 Critical #1(V069 번호 충돌)은  의 UQ_node_workflow_label 항목을 V070+ 로 조율하고 V069 를 cancel-status 가 선점함으로써 해소. WARNING 5건(pending_plans, parent plan 노트 2건, draft markdown nit, data-flow §2.4 표) 전부 반영. 잔여 spec 정합은 impl-prep consistency-check 에서 재검증.
