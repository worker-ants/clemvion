---
name: fix-resume-turn-usage-log-attribution
worktree: .claude/worktrees/spec-sync-review-08a15a
status: in-progress
started: 2026-07-09
owner: developer
spec_impact: none
---

# 멀티턴 AI 에이전트 resume 턴 통합 사용 로그 누락 회귀 수정

## 문제 (root cause)

멀티턴(대화형) AI 에이전트의 **2번째 이후(resume) 턴**에서 cafe24(및 makeshop/mcp)
MCP 툴 호출은 성공·응답하지만 `integration_usage_log` 에 기록되지 않는다.

- resume 턴의 provider-tool 실행은 `state.nodeExecutionId`/`state.workflowId` 를 읽어
  cafe24 MCP provider 의 기록 게이트 `if (ctx.nodeExecutionId && ctx.workflowId)` 에 넘긴다
  (`ai-turn-executor.ts:2684-2685`, `cafe24-mcp-tool-provider.ts:500`).
- resume state 재구성기 `buildRetryReentryState`(`execution-engine.service.ts:4845`)가
  `executionId`/`nodeId`/`workspaceId` 는 재주입하면서 **`workflowId`·`nodeExecutionId`
  는 빠뜨린다**. 두 필드는 checkpoint 저장 시 제거되고(allow-list `buildResumeCheckpoint`,
  `CREDENTIAL_CONTEXT_FIELDS`) 재개 시 재유도 대상인데 재유도가 누락된 것.
- 게이트가 false → `logUsage` 미호출 → 로그 누락. 외부 호출은 정상이라 응답은 옴.
- `resumeStateSchema` 는 `workflowId` 를 필수로 선언하지만 런타임 `.parse` 미호출이라
  누락이 조용히 통과.

**회귀 커밋**: #501 (`5e0c5e449`) — in-memory `runAiConversationLoop`(1턴 state 객체
재사용) 제거로 checkpoint 재구성이 유일 resume 경로가 되면서 노출됨. 1턴은 full
ExecutionContext 로 정상 기록되므로 완전 0 은 아니며, 대화형 사용(2턴+)이 누락된다.

## 수정

`buildRetryReentryState` 가 두 필드를 재주입하도록 한다 (공유 재구성기라 AI resume +
retry-last-turn 양 경로 동시 수정).

- [x] `execution-engine.service.ts buildRetryReentryState`: `workflowId: execution.workflowId`
      + `nodeExecutionId: opts?.nodeExecutionId` 재주입. opts 타입에 `nodeExecutionId?: string` 추가.
- [x] `engine-driver.interface.ts`: `buildRetryReentryState` opts 타입 동기.
- [x] `ai-turn-orchestrator.service.ts handleAiResumeTurn`: `nodeExecutionId: ctx.nodeExec?.id` 전달.
- [x] `retry-turn.service.ts`: `nodeExecutionId: spawnedRow.id` 전달.
- [x] `resume-state.schema.ts`: `nodeExecutionId: z.string()` 를 resumeStateSchema 에 추가 +
      `CREDENTIAL_CONTEXT_FIELDS` 에 `nodeExecutionId` 추가(persist 금지·재개 재유도 대칭).

### 부수 발견 (TEST WORKFLOW 중 조치)

- [x] 사전 결함 수정: `execution-engine.service.spec.ts` 의 `reentryWorkflowInput` describe(#868)
      가 out-of-scope `service` 참조 → `ReferenceError` 로 2건 실패(HEAD 에서도 실패). 해당
      describe 의 로컬 인스턴스 `svcMetrics` 로 교체. (ISSUE FIX 정책 — 발견 시 조치)

## 워크플로 체크리스트

- [ ] 3. consistency-check --impl-prep/impl-done (spec 연결 시 impl-done 로 검증)
- [x] 5. 회귀 테스트 선작성 (buildRetryReentryState 가 workflowId/nodeExecutionId 재주입)
- [x] 6. 구현
- [ ] 8. TEST WORKFLOW — lint[x]·unit[x]·build[x]·e2e[ ]
- [ ] 9. REVIEW WORKFLOW (/ai-review + fix + impl-done)
