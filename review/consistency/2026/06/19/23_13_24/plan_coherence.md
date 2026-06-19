## 발견사항

### [INFO] assertSameWorkspace fail-closed → spec 반영 SPEC-DRIFT 후속(planner) 미완료
- target 위치: `spec/4-nodes/2-flow/1-workflow.md §2 W-6 callout` (이미 target spec에 반영됨)
- 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` 후속 고려 "assertSameWorkspace" 항 내 SPEC-DRIFT 후속(planner) 절
- 상세: `c1-engine-split.md` 의 `assertSameWorkspace` 완료 항목은 "SPEC-DRIFT 후속(planner)" 로서 `spec/4-nodes/2-flow/1-workflow.md §2 W-6`, `spec/5-system/4-execution-engine.md` workspace-isolation 절, 그리고 `spec/5-system/3-error-handling.md §1.4/§3.2` 에 에러 코드 등재를 요구하고 있다. target spec(`1-workflow.md`) 의 §2 W-6 callout 과 §6 에러 코드 표에 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 이미 등재되어 있어 target 자체는 정합하다. 단, c1-engine-split plan 이 추가로 요구하는 `spec/5-system/3-error-handling.md §1.4/§3.2` 등재와 `spec/5-system/4-execution-engine.md` workspace-isolation 절 갱신이 target 범위 밖이고 plan 에서 미완료(체크 없음)로 남아 있다. 본 target 변경이 그 후속 항목의 필요성을 재확인하지만 직접 충돌은 아니다.
- 제안: `c1-engine-split.md` 의 SPEC-DRIFT 후속 항목 중 `3-error-handling.md`·`4-execution-engine.md` 갱신이 별도 planner 작업으로 진행 중임을 확인·추적. target 범위 내 변경은 정합.

### [INFO] WorkflowForbiddenWorkspaceError typed error 도입 — node-output-redesign plan 의 미결 open items 와 무관
- target 위치: diff 전체(workflow-errors.ts, error-codes.ts, workflow.handler.ts, workflow.handler.spec.ts)
- 관련 plan: `plan/in-progress/node-output-redesign/workflow.md` 개선안 체크박스(미완료)
- 상세: `node-output-redesign/workflow.md` 는 async 정상 케이스의 `output.workflowId` 제거, `output.status` 제거 등 미완료 open items 를 보유하고 있다. target diff 는 이 항목들에 영향을 주지 않는다(async output shape 무변). 충돌 없음.
- 제안: 해당 plan 의 open items 는 현재 target 변경과 독립적으로 유지.

### [INFO] LlmCallRecord / TurnRagDelta rename — c1-engine-split 후속 ③ 완료 사실과의 정합
- target 위치: diff — `ai-agent.handler.ts` llmCalls 타입 `LlmCallRecord[]` 전환, `output-shape.ts` `TurnDebugEntry` → `TurnRagDelta` rename
- 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` 후속 고려 "LLM 호출 기록 도메인 타입 통합" (후속 ③) 및 "(a) ai-agent.handler.ts inline llmCalls → shared 전환 … type-consolidation" 후속 항목
- 상세: c1-engine-split plan 후속 ③은 `shared/llm-tracing/llm-call-record.ts` 신설(PR #632)로 완료됐으나, "(a) ai-agent.handler.ts inline llmCalls → shared 전환" 은 "범위밖·stricter shape loosen 평가" 로 별도 후속(type-consolidation)에 이연되었다. target diff 는 이 후속 항목을 구현하고 있어 plan 이 예정한 이연 작업의 선행 구현에 해당한다. 이는 미해결 결정과의 충돌이 아니라 plan 이 명시한 방향과 일치한다. `TurnDebugEntry` → `TurnRagDelta` rename 은 c1-engine-split plan 후속 ③의 "(c) frontend `TurnDebugEntry` 다중정의 rename(중기)" 항에 대응하며, "중기" 이연을 조기에 진행한 것이다. 단, c1-engine-split plan 이 SPEC-DRIFT 후속으로 요구하는 "(b) `startedAt`/`finishedAt`·canonical SoT → `0-common.md §6`/`1-ai-agent.md §8` 반영" 은 target 범위 밖이며 미완료로 남는다.
- 제안: c1-engine-split plan 의 type-consolidation 후속 항목 체크박스 갱신 고려. SPEC-DRIFT planner 후속(b)는 별도 진행 확인.

### [INFO] spec-sync-common-gaps plan 잔여 미구현 항목(§2 meta 확장)은 target 변경과 무관
- target 위치: `spec/4-nodes/2-flow/0-common.md` frontmatter `pending_plans: spec-sync-common-gaps.md`
- 관련 plan: `plan/in-progress/spec-sync-common-gaps.md` 미완료 항목 — `§2 meta` 확장(`recursionDepth`/`subExecutionId`/`mode`, Planned)
- 상세: target diff 는 이 `(Planned)` 항목에 닿지 않는다. 충돌 없음.

## 요약

target 변경(`spec/4-nodes/2-flow/` 구현 완료 검토)은 `plan/in-progress/` 의 미해결 결정을 일방적으로 우회하거나 충돌하는 사항이 없다. `WorkflowForbiddenWorkspaceError` typed error 도입은 `c1-engine-split.md` 의 완료된 `assertSameWorkspace` 후속 작업으로 plan 과 정합하며, spec 의 `§2 W-6`·`§6` 에러 코드 표에도 정확히 반영되어 있다. `LlmCallRecord`/`TurnRagDelta` 변경은 c1-engine-split plan 이 이연 항목으로 명시한 방향과 일치한다. `node-output-redesign/workflow.md` 의 async output 개편 미완료 항목 및 `spec-sync-common-gaps.md` 의 meta 확장 `(Planned)` 항목은 모두 target diff 와 무관하게 독립적으로 남아 있어 충돌 없다. 추적해야 할 미완료 후속은 c1-engine-split plan 의 `3-error-handling.md`·`4-execution-engine.md` SPEC-DRIFT 갱신(planner 위임)과 type-consolidation SPEC-DRIFT(b) 항목이나, 이는 모두 target 범위 밖 별도 작업이다.

## 위험도

LOW
