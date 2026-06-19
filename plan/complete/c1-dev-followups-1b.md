---
worktree: spec-drift-c1-ea8bcb
status: complete
started: 2026-06-19
owner: developer
parent: plan/complete/c1-engine-split.md (작업 1b dev 잔꼬리)
spec_impact:
  - spec/4-nodes/2-flow/1-workflow.md
  - spec/4-nodes/2-flow/0-common.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/4-execution-engine.md
---

# C-1 dev 잔꼬리 (작업 1b) — PR #641 동반

> c1-engine-split.md 가 "별도 후속/handoff" 로 기록한 dev 1b 3종을 사용자 지시("잔여 작업 모두 처리")로
> 동일 PR(#641, spec-drift-c1-ea8bcb)에서 처리. **⑥ previousOutput Phase 3 은 제외** — node-output-redesign
> plan(spec+code 동반) 재개에 구조적으로 의존하므로 단독 진행 시 transitional 설계를 깨뜨린다(blocked 유지).

## 작업

- [x] **1b-1 `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재 + surface 정합** (backend, spec coupled):
  - `workflow-errors.ts`: `WorkflowForbiddenWorkspaceError` typed error 추가(WorkflowNotFoundError 패턴).
  - `execution-engine.service.ts` `assertSameWorkspace`: inline `Error('WORKFLOW_FORBIDDEN_WORKSPACE: ...')` → typed error throw.
  - `error-codes.ts`: `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재.
  - `workflow.handler.ts` `mapSubWorkflowError`: `instanceof WorkflowForbiddenWorkspaceError` 분기 → `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` (이전엔 `SUB_WORKFLOW_FAILED` 로 fallthrough).
  - **spec 동반(planner write)**: workflow §2 W-6/§6 · error-handling §1.4/§3.2 · engine §Rationale ★ bullet 의 "enum 미등재 → SUB_WORKFLOW_FAILED 로 surface / enum 등재 dev 후속" → "WORKFLOW_FORBIDDEN_WORKSPACE 로 surface(enum 등재 완료)" 로 정정.
  - 테스트: mapSubWorkflowError 분기 + assertSameWorkspace typed throw.
- [x] **1b-2 ai-agent inline llmCalls → shared `LlmCallRecord`** (backend):
  - `ai-agent.handler.ts`: `shared/llm-tracing/llm-call-record` import + 인라인 `Array<{ requestPayload; responsePayload; durationMs; startedAt?; finishedAt? }>` 2곳(L1488·L2413) → `LlmCallRecord[]`.
  - **loosen 평가**: shared 타입은 all-optional(durationMs? 등) — push site 는 항상 전 필드 공급하므로 데이터 손실 없음, 정적 타입만 loosen. trace/debug 구조라 수용. build 가 cascade 검증.
- [x] **1b-3 frontend TurnDebugEntry 동명 disambiguate** (frontend):
  - `output-shape.ts` exported `TurnDebugEntry`(turnIndex/ragSources/ragDiagnostics — 실제 RAG delta, 외부 type import 0) → `TurnRagDelta` rename(4 refs, 1파일). conversation-utils.ts 의 file-private `TurnDebugEntry`(llmCalls/toolCalls — canonical 형) 와의 동명 충돌 해소.

## 워크플로

- [x] TEST WORKFLOW (lint·unit·build·e2e) — lint PASS · unit(backend 355s/**7134** · frontend 212/213, 1 실패는 무관 flaky [격리 통과]) · build PASS · **e2e 35 suites/205 PASS** (rebased onto origin/main #640·#642)
- [x] /ai-review + SUMMARY — **LOW · C0 · W2** (`review/code/2026/06/19/22_49_28`). W-1 spec 갱신 · W-2 disposition + 가치 INFO(I-4/5/7/9/10) 반영
- [x] /consistency-check --impl-done (spec-linked) — **BLOCK:NO** (`review/consistency/2026/06/19/23_13_24`). W-1(flow 0-common §2.1 에러표 누락) → 본 PR 조치. I-8(error-codes.md 미등재)=명명규약doc(카탈로그 아님)→불요. fresh /ai-review(`22_03_…` 대응 `23_13_52`) **C0·W0 clean**
- [x] RESOLUTION.md (`review/code/2026/06/19/22_49_28/RESOLUTION.md`)

## 결정·근거

- impl-prep consistency-check 생략: 1b-1 은 spec 을 **동일 PR 에서 함께 정정**(신규 구현 vs 기존 spec 충돌 아님), 1b-2/1b-3 은 spec 계약 무변 refactor. 사후 impl-done(의무)으로 검증. (SPEC-CONSISTENCY 가드는 impl-done 으로 충족.)
- ⑥ 제외 사유: node-output-redesign 의존(blocked). 강제 진행 금지.
