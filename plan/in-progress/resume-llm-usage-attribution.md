---
worktree: elastic-shannon-e52824
branch: claude/ie-resume-llm-attribution-c82918
started: 2026-07-09
rebased: 2026-07-10 (onto origin/main = #877)
owner: developer
spec: spec/data-flow/7-llm-usage.md §1.3
---

# 멀티턴 resume 턴 llm_usage_log attribution (IE 오적재 + ai_agent 메인 chat)

> **stale-base 정리(2026-07-10)**: 본 브랜치는 `#874` 기반으로 생성됐는데, 그 뒤 `#877`
> ("resume 턴 통합 usage-log attribution 복원 (#501 회귀)")이 main 에 머지됐다. `#877` 이
> 공유 재구성기 `buildRetryReentryState` 의 `workflowId`/`nodeExecutionId` 재주입 +
> `resume-state.schema` 등재 + caller wiring + 그 테스트를 이미 구현했다. 최초 본 브랜치의
> 핵심 커밋(`b75b0bc12`)이 이를 **독립 중복 구현**했음이 최종 /ai-review 에서 발견돼,
> `git rebase`(reset onto origin/main + genuine 증분 재적용)로 중복을 제거했다.
> 남은 genuine 증분 = 아래 두 소비 사이트 + spec 정정 (모두 `#877` 미포함).

## 배경 / 결함

`#877` 이 engine 재주입을 고쳐 재구성 `state` 에 `workflowId`/`nodeExecutionId` 가 채워지지만,
**LLM usage-log(`llm_usage_log`) 소비 사이트 2곳**이 그 값을 쓰지 않고 있었다:

1. **Information Extractor resume 턴** (`information-extractor.handler.ts`):
   `node_execution_id` 자리에 `state.nodeId`(Node **정의** id ≠ NodeExecution row PK)를 넣어
   attribution FK 오적재 + `workflow_id` 누락 (첫 턴은 `context.*` 로 정상 — 대칭 위반).
2. **AI Agent resume 턴 메인 chat 2곳** (`ai-turn-executor.ts` `processMultiTurnMessage`):
   `LlmCallContext`(3번째 인자) 미전달 → 세 컬럼 NULL. (tool-batch 는 이미 `state.*` 소비.)

## 변경 세트 (genuine, #877 미포함)

- [x] `information-extractor.handler.ts`: `MultiTurnState` 에 `workflowId?`/`nodeExecutionId?` +
      `hydrateState` 읽기 + resume llmContext 사이트가 `state.nodeExecutionId`/`state.workflowId` 소비
- [x] `ai-turn-executor.ts`: resume 메인 chat 2곳(2599 llmContext const)에 `state.*` 전달
- [x] `execution-engine.service.ts`: `#877` 주석에 llm_usage_log 소비처 1줄 추가(문서 정확성)
- [x] `spec/data-flow/7-llm-usage.md` §1.3 표·113 콜아웃·§4 표·Rationale 정정
- [x] `spec/5-system/4-execution-engine.md` §6.1 소비처 표에 llm_usage_log 추가
- [x] CHANGELOG Unreleased 항목

## 테스트 (genuine)

- [x] IE resume llmContext 가 row PK·workflowId 담고 정의 id 안 담는지 (`information-extractor.handler.spec.ts`)
- [x] ai_agent resume 메인 chat 3번째 인자가 row PK·workflowId·executionId 담는지 (`ai-turn-executor.spec.ts`)
- (engine wiring / caller 테스트는 `#877` 에 이미 존재 — 중복 제거)

## 워크플로 체크리스트

- [x] consistency-check --impl-prep / --spec / --impl-done (rebase 전, 동일 spec 영역) BLOCK:NO
- [ ] rebase 후 재검증: lint/unit/build/e2e
- [ ] rebase 후 /ai-review (genuine diff)
- [ ] rebase 후 /consistency-check --impl-done (genuine diff)
- [ ] PR

## 잔여 follow-up (별도 project-planner 트랙, 본 PR 범위 밖)

- [ ] 7-llm-usage 인접 문서 정정 4건 (6-knowledge-base/13-agent-memory "모든 LLM 호출 적재",
      7-statistics/9-user-profile workflowId 캐비어트, 1-data-model LlmUsageLog 서브섹션,
      4-execution-engine/1-ai-agent 재구성 3분류 문구). backup 브랜치 `spec-update-7-llm-usage.md` 참조.
