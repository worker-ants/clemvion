---
worktree: ai-usage-attribution-hardening-358929
branch: claude/ai-usage-attribution-hardening-358929
started: 2026-07-10
owner: developer
spec: spec/data-flow/7-llm-usage.md §1.3
precedent: PR #879 (resume 턴 llm_usage_log attribution) 의 follow-up B1+C1
---

# LLM-usage attribution hardening (B1 타입 주석 + C1 메모리 압축 배선)

PR #879 의 최종 /ai-review INFO 후속 (PR-1/3):

## 변경 세트

- [x] **B1** `ai-turn-executor.ts`: resume `llmContext` 에 `LlmCallContext` 명시 타입 주석
      — 필드 오탈자를 TS excess-property check 로 컴파일 타임 차단(이번에 고친 attribution
      오사입 회귀 클래스 예방). 카스트 등 다른 라인 무변경(주의: `eslint --fix` 전체 파일
      적용은 `no-unnecessary-type-assertion` 이 3122행의 필요한 카스트를 오제거해 tsc 깨짐
      → import·주석만 수동 적용).
- [x] **C1** `agent-memory-injection.ts` + `ai-memory-manager.ts` + `ai-turn-executor.ts`: AI Agent
      자동 메모리 롤링 요약 압축 chat(`buildSummaryBufferUpdate`)에 `llmContext` 전달. **ai-review
      Critical#1 반영**: `injectMemoryContext` 가 config 파생이 아니라 `workflowId`/`nodeExecutionId`
      를 **명시 파라미터**로 받고, caller 가 전달 — **single-turn**(`applySingleTurnMemoryInjection`)은
      `context.*`, **multi-turn resume**(`applyMultiTurnTurnMemory`)은 `state.*`. (초기 구현은
      config 파생이라 single-turn 의 config=사용자 노드 config 에 키가 없어 NULL 이던 버그를 리뷰가
      포착 → 명시 파라미터로 교정.) 노드 발 attribution 갭 완전 해소.

## 테스트

- [x] `agent-memory-injection.spec`: `buildSummaryBufferUpdate` 가 llmContext 를 chat 3번째 인자로 전달
      + llmContext 미전달 시 undefined (하위호환)
- [x] `ai-agent.memory.spec`: **single-turn `summary_buffer` 압축**이 `context.*`(workflowId/
      executionId/nodeExecutionId) 를 요약 chat llmContext 로 채우는지 (Critical#1 회귀 고정)

## TEST WORKFLOW

- [x] lint PASS
- [x] backend jest 전수 PASS (399 suites / 7927 tests) + 영향 3 spec 108
- [x] backend build(tsc) 0 errors (B1 타입 검증)
- [x] e2e PASS (247, dockerized)
- [!] **frontend vitest/build**: fresh-worktree `@workflow/expression-engine` **stale dist**
      부트스트랩 이슈로 실패(frontend node_modules 를 main 심링크 → main 은 #878/#880 이전
      커밋이라 expression-engine dist 가 origin/main frontend 소스와 불일치). **본 diff 는
      backend 4파일 전용·frontend 0파일**이라 provably 무관. 전량 frontend 부트스트랩(node_modules
      복사 + 워크트리 패키지 빌드)은 backend-only PR 에 비례하지 않아 미수행.

## SPEC-DRIFT (PR-2 로 이관 — cross-ref)

C1 이 AI Agent 메모리 압축을 배선하므로 `spec/data-flow/7-llm-usage.md §1.3` 표 L107·요약문 L113·
§4 표·Rationale 의 "AI Agent 자동 메모리 롤링 요약 압축 = 미배선/잔여 NULL" 서술이 stale 해진다
(single-turn·multi-turn 양 경로 채움). 이 정정은 **PR-2(A-track project-planner spec PR)** 에서
A1~A4(선행 plan `plan/in-progress/resume-llm-usage-attribution.md` §"잔여 follow-up" 61~70행)와
함께 §1.3 row 를 "첫 턴/resume 모두 `context.*`/`state.*` 채움"으로 반영. 병합 순서: PR-1 → PR-2
연속으로 drift window 최소화(리뷰 WARNING 반영).

## 워크플로

- [x] /ai-review — HIGH(Critical#1: single-turn 미배선) → 명시 파라미터 교정 + 회귀 테스트로 해소.
      WARNING(CHANGELOG·spec-drift·plan cross-ref) 반영. RESOLUTION.md 작성.
- [x] /consistency-check --impl-done — BLOCK:NO (flaky checker 재실행 후 확정)
- [ ] PR
