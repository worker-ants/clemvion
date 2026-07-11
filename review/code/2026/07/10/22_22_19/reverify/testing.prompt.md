# 재검증 (testing) — WARNING#1(resume state.* 조립 미검증) 해소 확인

코드 리뷰 재검증. diff-base=`origin/main`.
워크트리(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`.

## 배경 — 직전 WARNING

직전 회차(`review/code/2026/07/10/22_22_19/testing.md`)에서 당신은 WARNING 을 보고했다: multi-turn
resume 경로(`ai-turn-executor.ts:2296-2302`, `applyMultiTurnTurnMemory`)의 재주입
`state.workflowId`/`state.nodeExecutionId` → 요약 압축 chat `llmContext` 조립이 **실값 end-to-end 로
미검증**(single-turn 은 검증됨, 비대칭). 기존 `ai-memory-manager.spec.ts` 테스트는 caller 가 만든
`llmContext` 리터럴의 forwarding 만 검증. IE `nodeId`↔`nodeExecutionId`(커밋 `2db810893`) 동일 클래스
재발 위험.

## 이번 변경

`git diff origin/main...HEAD -- codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts
codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` 를 확인하라. 신규 추가:

- `ai-agent.memory.spec.ts`: `it('multi-turn resume: summary 압축 chat 이 재주입된 state.* 를
  llm_usage_log llmContext 로 채운다 ...')` — `handler.execute` → `_resumeState` 에
  `state.workflowId='wf-resume'`/`executionId='exec-resume'`/`nodeExecutionId='ne-resume-row'` 를
  주입(엔진 재주입 시뮬레이션) → `processMultiTurnMessage` 로 압축 트리거 →
  `mockLlmService.chat.mock.calls[0][2]` (요약 chat 3번째 인자) 가 세 값을 그대로 담는지 단언.
- `ai-memory-manager.spec.ts`: forwarding 테스트의 오해 주석을 "manager 레이어 forwarding 계약만
  검증, state.* 실 조립은 ai-agent.memory.spec 이 담당" 으로 정정.

## 임무

1. HEAD 의 신규 테스트(`git show HEAD:.../ai-agent.memory.spec.ts` 해당 it 블록)를 읽고, 이 테스트가
   실제로 `applyMultiTurnTurnMemory` 의 `state.*` → `llmContext` 조립을 **실값으로 왕복 검증**하는지
   (즉 값을 틀리게 조립하면 실패하는지) 확인한다. 특히 요약 chat 이 정말 `calls[0]` 인지,
   `summarized:true` 전제 단언이 압축 실발생을 보장하는지 검토.
2. 직전 WARNING 이 해소됐는지 판정. 신규 테스트 자체의 결함(과약속·flaky·잘못된 call index 가정 등)이
   있으면 보고.

## 출력
`output_file` 에 `## 발견사항` / `## 요약` / `## 위험도`. 반환 라인:
`STATUS=success ISSUES=<n> PATH=<output_file> RESET_HINT=`.
