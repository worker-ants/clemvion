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
- [x] rebase 후 재검증: lint/unit/build/e2e 전부 PASS (e2e 247)
- [x] rebase 후 /ai-review (genuine diff) — LOW, Critical 0 / WARNING 0 (`review/code/2026/07/10/01_46_28/`) + INFO 3건 fix + RESOLUTION.md
- [x] rebase 후 /consistency-check --impl-done (genuine diff) — BLOCK:NO, Critical 0 (`review/consistency/2026/07/10/01_46_28/`)
- [ ] PR (push + gh pr create)

## 잔여 follow-up (별도 project-planner 트랙, 본 PR 범위 밖 — 상세 인라인)

> 근거를 로컬 backup 브랜치에 의존하지 않도록 상세를 여기 인라인한다(consistency
> plan_coherence WARNING 반영). 원 draft: backup 브랜치 `backup-pre-rebase-elastic-shannon`
> 커밋 `7a270a923` 의 `plan/in-progress/spec-update-7-llm-usage.md` (로컬 전용, 미푸시).

- [ ] `spec/data-flow/6-knowledge-base.md:348` · `spec/data-flow/13-agent-memory.md:231` —
      "모든 LLM 호출은 `llm_usage_log` 적재" stale 문구를 "chat 계열만 적재 / embed 계열 미적재
      (§1.3)" 로 정정 (두 파일 동일 문구, 이번 PR §1.3 확정과 상충).
- [ ] `spec/data-flow/7-statistics.md` §3 · `spec/2-navigation/9-user-profile.md` §6.3 —
      `workflowId` 스코프 계약의 attribution 갭 캐비어트 재검토(노드 발까지 채워져 갭 축소).
- [ ] `spec/1-data-model.md` — `LlmUsageLog` 전용 서브섹션 신설 검토 (자매 로그 `IntegrationUsageLog`
      §2.10.1 은 보유).
- [ ] `spec/5-system/4-execution-engine.md` §7.4 재구성 설명 + `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 —
      credential/context-binding 2분류 서술에 3번째 "턴 가변 식별자(`nodeExecutionId`, caller opts
      전달, node.config 재유도 불가)" 문구 추가 (consistency rationale_continuity WARNING 반영).
- [x] **(PR `ai-usage-attribution-hardening` = B1+C1 배선 후 필수 → 그 PR 에서 완료)**
      `spec/data-flow/7-llm-usage.md` §1.3 표 L107 · 요약문 L113 · §4 Agent Memory 행 L162 ·
      Rationale L189~206 의 "AI Agent 자동 메모리 롤링 요약 압축 = 미배선/전부 NULL/잔여 갭" 서술을
      "첫 턴/단발 = `context.*`, resume = `state.*` 채움"으로 정정 (C1 이 배선 완료 → 다른 AI 노드
      row 와 동일 패턴). 잔여 NULL 은 `RerankService` listwise + GraphExtraction/AgentMemory 추출
      processor(워크플로 밖)만. **최종 consistency CRITICAL(SoT) 로 PR-2 분리 대신 PR-1
      (`ai-usage-attribution-hardening`) 에 포함해 해소** — drift window 0.

### 최종 /ai-review(02_09_15) INFO — 선택적 후속 (review-loop 재무장 방지로 본 PR 미포함)

- [x] `ai-turn-executor.ts` `llmContext` 에 `LlmCallContext` 명시 타입 주석 추가(INFO#1) →
      **후속 plan `ai-usage-attribution-hardening.md` B1 로 처리(PR-1)**.
- [ ] Text Classifier(단발, resume 없음) 모호 서술을 `spec/5-system/4-execution-engine.md` §6.1 표 셀 +
      `CHANGELOG.md` 항목에도 전파 정정(INFO#3 — §1.3 콜아웃은 이미 정정) → PR-3(B2) 예정.
- [ ] IE `runTurnWithCollectionRetries` collection-retry 루프에 ai_agent tool-loop 와 대칭인
      2번째 chat attribution 단언 테스트 추가(INFO#4) → PR-3(B3) 예정.
