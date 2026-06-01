# Parallel P2 — 후속 작업 완료 기록

> 작성일: 2026-05-30 / 분리: 2026-06-01 (split)
> `parallel-p2-followups.md` 의 **완료된 구현 기록**. 잔여(e2e·ai-review·user-doc·IE multi-turn signal·
> NodeExecution.status·§7 W-1/W-2)는 [`plan/in-progress/parallel-p2-followups.md`](../in-progress/parallel-p2-followups.md) 에 유지.
> 분리 출처: `plan/complete/parallel-p2.md` (본체 7 PR #363~#370 완료).

## 1. signal-aware 노드 확장 — 완료분

- [x] Database 노드 — `execute()` 진입 직전 `context.abortSignal?.aborted` 사전 체크 + AbortError throw. driver 별 도중 cancel(pg/mysql2/mongo)은 별 PR.
- [x] AI Agent — `executeSingleTurn` 2곳 chat 호출 signal 전파 (PR #377).
- [x] Text Classifier + Information Extractor single-turn — `chat()` 호출에 `{ signal: context.abortSignal }` (PR #375).
- [x] Send Email (SMTP) — `execute()` 진입 직전 사전 체크.
- [N/A] chat-channel 노드 — 노드 자체가 없음 (Trigger 메커니즘으로 통합).
- [x] 각 노드별 사전 체크 / 단위 테스트 (DB/Email · HTTP/LLM 이전 PR).

## 2. cross-node-warning-rules frontend canvas 통합 — 완료분

- [x] frontend canvas 가 graph 변경 시점 debounced(500ms) `workflowsApi.graphWarnings` 호출 — `workflow-editor.tsx` useEffect.
- [x] `editor-store` 의 `graphWarnings: { results, hasError, hasWarning }` state + `fetchGraphWarnings` action.
- [x] severity UI — 저장 버튼 `graphWarnings.hasError` 시 disable + title 첫 error message.
- [x] SSOT — endpoint 호출만으로 처리(옵션 B). (이후 cross-node PR 에서 shared package 로 재설계됨 — cross-node-warning-rules plan 참조.)

## 3. workflow save endpoint 자동 reject hook — 완료분

- [x] `WorkflowsService.saveCanvas` 트랜잭션 안에 `evaluateGraphWarnings(savedNodes, savedEdges)` — severity `error` 시 `BadRequestException { code: 'GRAPH_VALIDATION_FAILED', … }` → rollback.
- [x] 일관성 보장 — `dataSource.transaction` 안 syncNodes → syncEdges → evaluate → throw 시 rollback. 단일 진입점.
- [x] 단위 테스트 — error rule → GRAPH_VALIDATION_FAILED reject + warning-only 저장 통과 (2건 신규).

## 4. parallel-p2 §5 통합 테스트 — 완료분

- [x] 별 spec 파일 `execution-engine/__test__/parallel-p2-integration.spec.ts` 신설.
- [x] cancel-others-on-fail × HTTP fetch signal cascade — 첫 분기 실패 시 다른 분기 signal abort.
- [x] cancel-others-on-fail vs errorPolicy=stop 비교 — stop 은 controller 미생성으로 abortSignal === undefined.
- [x] nested concurrency cap silent clamp — parent=16 × intended=8 → actual=2.
- [x] nested concurrency cap pass — parent=8 × intended=4 = 32 → no clamp.

## 7. ExecutionContext God Object — ParallelBranchContext 분리 — 핵심 구현 완료

> 핵심 구현 완료 (2026-05-31, commit `ec0f56e1`) — spec(`1a411542`) 확정 후 같은 worktree 구현.
> tsc 신규 에러 0 + jest 575 통과. ai-review (review/code/2026/05/31/20_55_42/) Critical 0 / Warning 2(잔여는 in-progress).
> 출처: `plan/complete/spec-fix-execution-context-god-object.md` (C-1 옵션 a, 2026-05-30).

- [x] `parentParallelConcurrency` 를 `ExecutionContext` 에서 제거하고 `ParallelBranchContext extends ExecutionContext` 로 이동 (`node-handler.interface.ts` / `parallel-executor.ts`).
- [x] branchContext 생성처 + 하위 노드 호출처 타입 좁히기 — `execute()` 4번째 인자 `parentParallelConcurrency?` 운반, `runBranch`/branchContext 타입을 `ParallelBranchContext` 로 좁힘. 엔진은 `'parentParallelConcurrency' in context` narrowing.
- [x] 단위 테스트 `parallel-p2-integration.spec.ts` + `parallel-executor.spec.ts` 시그니처 수정 — jest parallel 21/21, execution-engine 554/554 pass.
- [x] `spec/4-nodes/1-logic/10-parallel.md §Rationale 결정 G` 갱신 — spec `1a411542`, 코드 `ec0f56e1`.
