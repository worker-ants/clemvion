---
worktree: fix-bg-context-key
started: 2026-05-31
owner: developer
---

# Background 본문 ExecutionContext Map 키 충돌 race 수정

## 배경 (운영 로그)
```
[ctx-trace] deleteContext — executionId=dc17fd2a existed=true  (runExecution finally)
[ctx-trace] setNodeOutput MISSING — executionId=dc17fd2a (race: deleteContext fired earlier)
  at executeBackgroundSubgraph → executeInline → executeNode
Background job failed: Execution context not found: dc17fd2a
```

## 근본 원인
`ExecutionContextService` 는 단일 in-memory `Map<executionId, ExecutionContext>`.
Background 본문은 **부모 실행과 동일한 executionId 를 context Map 키로 재사용**한다:
- `scheduleBackgroundBody` 가 job 에 부모 `executionId` 를 그대로 넣음.
- `executeBackgroundSubgraph` 가 `createContext(job.executionId)` 로 **같은 키**에 별도
  context(스냅샷) 를 만든다 (spec §90 격리 요구로 별도 객체 필수).
- Background 는 fire-and-forget (`queue.add` 만 await) → 부모는 곧 종료하며
  `runExecution` finally 의 `deleteContext(executionId)` 가 **백그라운드 본문이 쓰던
  context 를 같은 키로 삭제** → 후속 `setNodeOutput` 이 MISSING.

spec(`spec/4-nodes/1-logic/12-background.md` §90, §156-158)은 본문이 메인과 **격리된
context** 를 가져야 한다고 명시 — 현재 구현은 Map 키 공유로 이 격리를 위반.

## 수정 방향 (제약: executionId 는 NodeExecution 그룹핑·WS 채널 1차 키이므로 원본 유지)
**context Map 키만 분리**한다.
1. `ExecutionContext.contextKey` 필드 신설 = Map 키. 비-background context 는
   `contextKey === executionId` (동작 불변).
2. `createContext(executionId, workflowId, vars, depth, contextKey?)` — Map 키 = `contextKey ?? executionId`.
3. 엔진의 contextService keyed 호출을 `executionId` → `context.contextKey` 로 치환
   (context 객체를 보유한 모든 forward 경로 site). DB/WS/repository 는 executionId 유지.
4. AI 멀티턴 클러스터(`handleAiMessageTurn`/`handleAiEndConversation`/`handleAiTurnError`)는
   `context` 미보유 → `contextKey: string` 파라미터 추가. 호출자(`runAiConversationLoop`,
   `waitForAiConversation`)는 `context` 보유하므로 `context.contextKey` 전달.
5. `executeBackgroundSubgraph`: bgKey = `bg:${executionId}:${backgroundRunId||parentNodeExecutionId||'root'}`
   로 createContext + **자체 finally 로 deleteContext(bgKey)** (메인 finally 와 분리).

## 영향 없는 경로 (contextKey === executionId)
runExecution / resumeFromCheckpoint / rehydrateContext / 동기 sub-workflow(executeInline
from workflow.handler) — 모두 별도 키 미지정 → executionId 그대로.

## 작업 체크리스트
- [ ] consistency-check --impl-prep
- [ ] 테스트 선작성 (race 재현 + 격리 검증)
- [ ] ExecutionContext.contextKey + createContext 시그니처
- [ ] 엔진 contextService 호출 키 치환
- [ ] AI 클러스터 contextKey 스레딩
- [ ] executeBackgroundSubgraph bgKey + finally
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + fix
