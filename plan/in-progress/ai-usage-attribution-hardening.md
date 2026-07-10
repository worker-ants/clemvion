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
- [x] **C1** `agent-memory-injection.ts` + `ai-memory-manager.ts`: AI Agent 자동 메모리
      롤링 요약 압축 chat(`buildSummaryBufferUpdate`)에 `llmContext` 전달. memory manager 가
      `args.executionId` + `args.config`(=resume state, engine 이 주입한 workflowId/
      nodeExecutionId)에서 attribution 을 유도. 노드 내부 실행 유일 잔여 갭 해소.

## 테스트

- [x] `agent-memory-injection.spec`: `buildSummaryBufferUpdate` 가 llmContext 를 chat 3번째 인자로 전달
- (ai-memory-manager 유도 로직은 injectMemoryContext 통합 경로 — 기존 spec + 위 단위로 커버)

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

## SPEC-DRIFT (PR-2 로 이관)

C1 이 AI Agent 메모리 압축을 배선하므로 `7-llm-usage §1.3` 표의 해당 row("미배선 — 잔여 갭")가
stale 해진다. 이 spec row 정정은 **PR-2(A-track project-planner spec PR)** 에서 A1~A4 와 함께 반영.

## 워크플로

- [ ] /ai-review + RESOLUTION
- [ ] /consistency-check --impl-done
- [ ] PR
