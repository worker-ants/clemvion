---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# execution-history — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/14-execution-history.md

## 미구현 항목
- [x] 목록 페이지 Nodes 열의 `완료 수/전체 수` 표시 — 현재 목록 API(`GET /api/executions/workflow/:workflowId`)의 `ExecutionDto` 는 노드 실행을 응답하지 않아(`toExecutionDto` 가 `executionPath: []` 만 채우고 `nodeExecutions` 부재) 클라이언트 집계가 항상 0 → 열이 늘 `—`. 목록 DTO 에 노드 집계 컬럼(예: `completedNodeCount` / `totalNodeCount`) 추가 또는 nodeExecutions 포함이 필요.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 의 execution-history 섹션 참조.
- 참고로 다음 항목은 audit 가 지적했으나 spec 변경 없이 처리(또는 코드측 처리)로 분류:
  - 상세 `nodeExecutions` 응답은 `findById` 가 raw `NodeExecution` 엔티티(중첩 `node`, `inputData`, `retryCount` 포함)를 그대로 반환하므로 spec §5 detail 예시와 런타임이 일치. Swagger `NodeExecutionSummaryDto`(평탄·`nodeLabel`) 와의 불일치는 백엔드 DTO 정합성 이슈로, 본 plan 범위 밖.
