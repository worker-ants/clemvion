# Consistency Check 통합 보고서 (post-impl, Phase 2 cont 본 PR 영역)

**BLOCK: NO** — Phase 2 cont 영역(workflow-resumable-execution Phase 2.x) 에 대한 모든 spec 변경이 일관됨. convention_compliance 가 보고한 4건의 CRITICAL 은 모두 본 PR 외 다른 spec 파일(1-auth, 10-graph-rag, 11-mcp-client, 15-chat-channel)의 pre-existing spec drift 로, 별도 spec PR (project-planner) 이슈로 분리.

## 전체 위험도

본 PR 영역만: **LOW** — Phase 2 cont 변경이 5개 spec 파일에서 완벽히 일관됨.
전체 spec/5-system/ : **HIGH** (pre-existing CRITICAL 4건이 base branch 부터 존재).

## Critical 발견 (out-of-scope, base branch pre-existing)

| # | spec 파일 | 문제 | 본 PR 영향 |
|---|------------|------|------------|
| C1 | `spec/5-system/1-auth.md` | `status: spec-only` + `code: []` 이지만 codebase/backend/src/modules/auth/** 구현 + V058 migration 존재 — spec-impl-evidence §3.1 위반 | 본 PR 무관 (auth 영역 안 건드림) |
| C2 | `spec/5-system/15-chat-channel.md` | `pending_plans` 가 `plan/in-progress/chat-channel-dispatcher-split.md` 참조하나 해당 plan 은 `plan/complete/` 로 이동됨 — spec-pending-plan-existence guard 실패 | 본 PR 무관 |
| C3 | `spec/5-system/10-graph-rag.md` | 본문 "P0~P2 구현 완료" vs frontmatter `status: spec-only` 모순 | 본 PR 무관 |
| C4 | `spec/5-system/11-mcp-client.md` | `codebase/backend/src/modules/mcp/**` 구현 존재 vs `status: spec-only` — spec-impl-evidence §3.1 위반 | 본 PR 무관 |

위 4건은 첫 impl-prep 검토(`07_12_25`) 의 W1/W2 로 식별되어 deferred 된 항목 — 별 spec PR 로 project-planner 픽업 필요. Phase 2 cont PR 차단 사유 아님.

## WARNING (본 PR 영역)

| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| W1 | convention_compliance | `spec/5-system/1-auth.md §1.5.4` invitation 에러 코드 lowercase_snake_case (UPPER_SNAKE_CASE 컨벤션 위반) | base branch pre-existing — 별 spec PR |
| W2 | convention_compliance | `spec/5-system/11-mcp-client.md` `## Rationale` 섹션 부재 | base branch pre-existing — 별 spec PR |
| W3 | plan_coherence | retry-handler-followup.md 의 미결 §4.2 / §7 편집과 본 PR 영역의 잠재적 future edit 충돌 가능성 | retry-handler-followup PR 가 본 PR merge 후 진행 — 이미 본 PR 의 spec-update plan §"권고 후속 흐름 §4" 에 조율 항목 명시 |
| W4 | plan_coherence | `spec-update-workflow-resumable-execution-phase2-followup.md` 의 변경 1/2.1/2.2 가 spec 반영되었으나 plan 에 완료 표시 없음 | **본 SUMMARY 후속으로 plan 완료 표시 추가** |

## INFO (본 PR 영역)

| # | Checker | 발견 |
|---|---------|------|
| I1 | cross_spec | `task-queue` 행 — 이미 삭제 완료 (변경 1 정상 적용 확인) |
| I2 | cross_spec | `INVALID_EXECUTION_STATE` §7.5.1 — 이미 신설됨 (변경 2.1/2.2 정상 적용 확인) |
| I3 | cross_spec | `execution-continuation` BullMQ 큐 — data-flow / 5-system spec 모두 일관됨 |
| I4 | cross_spec | 실행 상태 전이 — 데이터 모델 §2.13 과 실행 엔진 §1.1 완전 일치 |
| I5-I7 | rationale_continuity | Rationale 등재 모두 일관 |

## Checker 별 위험도

| Checker | 위험도 (본 PR 영역) |
|---------|---------------------|
| cross_spec | LOW (모든 변경 일관 적용 확인) |
| rationale_continuity | LOW |
| convention_compliance | HIGH (base branch pre-existing CRITICAL 4건 — 본 PR 무관) |
| plan_coherence | LOW |
| naming_collision | LOW |

## 본 PR 영역 결론

**spec 갱신 5개 파일** (`spec/5-system/3-error-handling.md`, `4-execution-engine.md`, `6-websocket-protocol.md`, `spec/data-flow/0-overview.md`, `3-execution.md`) 가 모두 일관되게 반영됐고, 신규 충돌 0건. retry-handler-followup 의 후속 편집을 위한 조율 가이드는 `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md §"권고 후속 흐름 §4"` 에 명시됨.

**BLOCK: NO** — Phase 2 cont PR 진행 가능. base branch pre-existing CRITICAL 4건은 별 spec PR 로 분리.
