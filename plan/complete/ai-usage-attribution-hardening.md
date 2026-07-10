---
worktree: ai-usage-attribution-hardening-358929
branch: claude/ai-usage-attribution-hardening-358929
started: 2026-07-10
owner: developer
spec: spec/data-flow/7-llm-usage.md §1.3
spec_impact:
  - spec/data-flow/7-llm-usage.md
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
- [x] **SPEC (§1.3 정정)** `spec/data-flow/7-llm-usage.md`: C1 배선으로 stale 해진 4개 위치(표 L107·
      콜아웃 L113·§4 L162·Rationale)를 "AI Agent 메모리 롤링 요약 압축 = context 채움(단발 `context.*`/
      resume `state.*`)" 으로 정정. 최종 consistency CRITICAL(SoT 붕괴) 해소 — 아래 §SPEC-DRIFT 참조.

## 테스트

- [x] `agent-memory-injection.spec`: `buildSummaryBufferUpdate` 가 llmContext 를 chat 3번째 인자로 전달
      + llmContext 미전달 시 undefined (하위호환)
- [x] `ai-agent.memory.spec`: **single-turn `summary_buffer` 압축**이 `context.*`(workflowId/
      executionId/nodeExecutionId) 를 요약 chat llmContext 로 채우는지 (Critical#1 회귀 고정)
- [x] **(최종 리뷰 WARNING#1)** `ai-agent.memory.spec`: **multi-turn resume `summary_buffer` 압축**이
      재주입된 `state.workflowId`/`state.executionId`/`state.nodeExecutionId` 를 요약 chat llmContext 로
      채우는지 실값 왕복 검증 (`ai-turn-executor.ts:2298~2302` 조립 — IE nodeId↔nodeExecutionId 동일
      클래스 회귀 방지). manager 레이어 forwarding 테스트(`ai-memory-manager.spec`)는 주석 정정(INFO#3).

## TEST WORKFLOW (최종 `0fa772406` 전수 재수행 — stop-hook 요구 반영)

- [x] lint PASS (backend + frontend, 36s)
- [x] build PASS (backend + frontend, tsc — 100s; **frontend 빌드도 통과**)
- [x] unit: **backend 400 suites 전량 PASS**. `ai-agent.memory.spec`(resume-path 신규 포함) 등 영향 spec 그린.
- [x] e2e PASS (249, dockerized, 156s)
- [!] **unit 중 frontend vitest 만 실패** — fresh-worktree **React 중복 해소** 이슈(`Cannot read
      properties of null (reading 'useCallback')`): 루트 hoisted `react` 와 심링크된 `codebase/frontend/
      node_modules` 의 react/react-dom 이 vitest 리졸버에서 2개 인스턴스로 갈라져 dispatcher=null.
      실패 스펙(LocaleSync·auth-provider·providers·model-config)은 전부 **AI 노드와 무관**하고 **본 diff =
      frontend 0파일**이라 provably 무관. 같은 코드가 frontend **build·lint 는 통과** = 코드 결함 아님(vitest
      리졸버 한정 env). 루트 node_modules 전량 dedup 부트스트랩(1.3G)은 backend-only PR 에 비례하지 않아
      미수행. → 진단 완료(단정 아님). 참조: [[reference_worktree_node_modules_bootstrap]].

## SPEC-DRIFT (본 PR 에서 해소 — 최종 consistency CRITICAL 반영)

C1 이 AI Agent 메모리 압축을 배선하므로 `spec/data-flow/7-llm-usage.md §1.3` 표 L107·요약문 L113·
§4 표·Rationale 의 "AI Agent 자동 메모리 롤링 요약 압축 = 미배선/잔여 NULL" 서술이 stale 해진다
(single-turn·multi-turn 양 경로 채움).

최초엔 이 정정을 PR-2(A-track)로 분리하려 했으나, 최종 `/consistency-check --impl-done` 에서
convention_compliance checker 가 이를 **CRITICAL(SoT 붕괴 — 코드가 닫은 갭을 spec 이 여전히
"미배선"으로 서술)로 판정, BLOCK: YES**. code-review·consistency 두 SUMMARY 모두 "drift window 0
을 위해 §1.3 정정을 **본 PR 에 포함**" 을 권고했고, rationale_continuity 는 이 정정이 Rationale 이
이미 결정한 방향의 실현(신규 설계 아님, factual 정정)임을 확인했다. #879 선례(developer PR 이 동일
파일의 결합된 spec 정정을 함께 배선)도 있어 **본 PR 에 §1.3 4개 위치 정정을 포함해 해소**:

- [x] §1.3 표 L107 행: "context 미전달 → 전부 NULL" → "**채움**(단발 `context.*`/resume `state.*`)"
- [x] §1.3 콜아웃 L113: 잔여 NULL 목록에서 "AI Agent 메모리 롤링 요약 압축" 제거 + 노드 발 채움 서술 추가
- [x] §4 Agent Memory 행 L162: "롤링 요약 압축 chat (context NULL)" → "노드 발 — context 채움(추출 processor 만 NULL)"
- [x] Rationale (b) 항: 잔여 NULL 에서 메모리 압축 제거(→ RerankService listwise 단독), 진행 이력에 2026-07 배선 추가

> PR-2(A-track)에는 §1.3 memory-row 정정(구 A5)이 **본 PR 로 이동**했으므로 나머지 A1~A4(인접 문서
> 6-knowledge-base.md·13-agent-memory.md·7-statistics.md·9-user-profile.md·1-data-model.md·
> 4-execution-engine.md §7.4 등)만 남는다. 선행 plan `resume-llm-usage-attribution.md` §"잔여
> follow-up" 참조.

## 워크플로

- [x] /ai-review (초기) — HIGH(Critical#1: single-turn 미배선) → 명시 파라미터 교정 + 회귀 테스트로 해소.
- [x] /ai-review (최종, `review/code/2026/07/10/22_22_19/`) — MEDIUM, Critical 0. WARNING#1(resume
      `state.*` 조립 실값 미검증) → `ai-agent.memory.spec` 에 resume-path 회귀 테스트 추가. INFO#3(manager
      forwarding 테스트 오해 주석) 정정. RESOLUTION.md 작성.
- [x] /consistency-check --impl-done (최종, `review/consistency/2026/07/10/22_22_19/`) — 최초 **BLOCK:YES**
      (convention_compliance CRITICAL: §1.3 SoT drift) → §1.3 4개 위치 정정 반영 후 재검증 **BLOCK:NO**.
      RESOLUTION.md 작성.
- [x] PR — https://github.com/worker-ants/clemvion/pull/900 (base main, rebased onto #899). 머지 후
      plan 을 `plan/complete/` 로 이동.
