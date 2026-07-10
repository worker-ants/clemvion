# Cross-Spec 일관성 검토 — spec/data-flow/7-llm-usage.md

검토 모드: --impl-done, diff-base=origin/main, 코드 SoT=현재 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`)

## 발견사항

- **[WARNING]** target §1.3/§4/Rationale의 "AI Agent 자동 메모리 롤링 요약 압축 attribution 미배선" 서술이 이번 diff로 stale (spec self-drift, 이미 plan 에 후속 PR 로 추적됨)
  - target 위치:
    - `spec/data-flow/7-llm-usage.md:107` — §1.3 Caller 카탈로그 표: "AI Agent 자동 메모리 롤링 요약 압축 ... `context` 미전달 → `workflow_id / execution_id / node_execution_id` 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)"
    - `spec/data-flow/7-llm-usage.md:113` — attribution 채움 현황 요약: "**잔여 NULL** 은 워크플로우 밖·non-node caller(...)와 노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐"
    - `spec/data-flow/7-llm-usage.md:162` — §4 외부 의존, Agent Memory 행: "추출 processor chat + 롤링 요약 압축 chat (usage 적재, context NULL)"
    - `spec/data-flow/7-llm-usage.md:189-208` — Rationale "`llm_usage_log` 의 nullable context 컬럼들": "(b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading, AI Agent 자동 메모리 롤링 요약 압축)"
  - 충돌 대상: 엄밀히는 다른 spec **영역**과의 정면 모순은 아님 — `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/conversation-thread.md`, `spec/5-system/4-execution-engine.md` (L713, L1382-1384) 를 모두 확인했으나 이 세부(메모리 압축 chat 의 attribution 완결 여부)를 직접 다루거나 반대로 단언하는 문서는 없어 spec-vs-spec 직접 모순은 없다. 다만 target 문서 자신이 "일원화 — 단일 진실"(L113)이라고 선언한 caller 카탈로그가 실제 코드 상태와 어긋나, 이 문서를 cross-ref 로 인용하는 다른 영역(`5-system/4-execution-engine.md:713`, `data-flow/13-agent-memory.md:231`, `5-system/7-llm-client.md`)이 참조하는 SoT 의 정확성이 깨진다.
  - 상세: 이번 diff 는 `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`(`buildSummaryBufferUpdate` 에 `llmContext?: LlmCallContext` 추가 후 3번째 인자로 `llmService.chat` 에 forward) · `ai-memory-manager.ts`(`injectMemoryContext` 가 caller 로부터 받은 `llmContext` 를 그대로 전달) · `ai-turn-executor.ts`(single-turn 은 `context.workflowId/executionId/nodeExecutionId`, multi-turn resume 은 재구성 `state.workflowId/nodeExecutionId`+`executionId` 를 조립해 전달) 로 AI Agent 자동 메모리(`summary_buffer`/`persistent`) 롤링 요약 압축 chat 의 `llm_usage_log` attribution 을 채우도록 배선했다(신규 테스트: `ai-agent.memory.spec.ts` 단발 경로, `ai-memory-manager.spec.ts` multi-turn resume 경로, `agent-memory-injection.spec.ts` 헬퍼 단위 테스트가 모두 3번째 인자 전달을 단언). `ai-turn-executor.ts` 의 `injectMemoryContext` 호출부는 단 2곳(`executeSingleTurn` 경로 / resume 경로)뿐이며 둘 다 diff 에 포함돼 있어 이 caller 의 attribution 갭은 코드상 완전히 해소됐다. 그러나 target 문서 4곳은 여전히 "미배선/전부 NULL/잔여 갭"으로 서술해 실제 구현과 어긋난다.
  - 참고(완화 요인): 이 drift 는 이미 인지·추적되고 있다 — `plan/in-progress/ai-usage-attribution-hardening.md` §"SPEC-DRIFT (PR-2 로 이관 — cross-ref)" 가 정확히 이 4개 위치(L107·L113·§4 표·Rationale)를 지목하며 "PR-2(A-track project-planner spec PR)" 로 이관을 명시했고, `plan/in-progress/resume-llm-usage-attribution.md:71-76` 의 체크리스트에도 동일 항목이 "PR `ai-usage-attribution-hardening` = B1+C1 배선 후 필수" 로 등재돼 있다. 즉 이번 PR(PR-1, 코드 전용)은 의도적으로 spec 을 건드리지 않고, 곧바로 이어질 스펙 전용 PR-2 에서 정정할 계획이다.
  - 제안: PR-1(본 diff)과 PR-2(spec 정정) 를 계획대로 연속 병합해 drift window 를 최소화할 것. PR-2 에서 위 4개 위치를 "첫 턴/단발 = `context.*`, resume = `state.*` 채움 — 노드 발 attribution 완전 해소, 잔여 NULL 은 `RerankService` listwise grading·`GraphExtractionService`·AgentMemory 추출 processor(워크플로 밖) 뿐" 으로 갱신 필요. drift window 동안 이 문서를 근거로 다른 작업(예: 신규 caller onboarding, 통계/알림 커버리지 판단)을 진행하면 오도될 수 있으므로, PR-1 단독 병합 후 PR-2 병합까지 지연되지 않도록 권고.

- **[INFO]** 코드 comment 의 `LlmCallOptions` JSDoc 이 존재하지 않는 `spec/5-system/3-llm.md` 를 SoT 로 인용 (본 diff 범위 밖, 사전 존재하는 참조지만 기록해 둠)
  - target 위치: 해당 없음 (target 문서 자체 아님)
  - 충돌 대상: `codebase/backend/src/modules/llm/llm.service.ts:52` (`LlmCallOptions` JSDoc) — "SoT: spec/conventions/node-cancellation.md (signal), spec/5-system/3-llm.md."
  - 상세: `spec/5-system/3-llm.md` 는 존재하지 않는다 (`ls spec/5-system/` 확인 결과 LLM 관련 문서는 `7-llm-client.md` 뿐). 이 줄은 이번 diff 에서 수정되지 않은 기존 코드라 본 PR 범위 밖이지만, 정확한 대상은 `spec/5-system/7-llm-client.md` 로 보인다.
  - 제안: 본 PR 과 무관하므로 차단 사유 아님. 다음에 이 파일을 만지는 PR 에서 주석 경로를 `spec/5-system/7-llm-client.md` 로 교정 권장.

## 요약

이번 diff(AI Agent 자동 메모리 롤링 요약 압축 chat 의 `LlmCallContext` 배선)는 `LlmService.chat(config, params, context?, opts?)` 시그니처(`spec/5-system/7-llm-client.md`, `llm.service.ts` 코드 SoT 와 일치), `ExecutionContext`/재구성 `state` 의 `workflowId`/`executionId`/`nodeExecutionId` 필드 계약(`spec/conventions/execution-context.md`, `spec/5-system/4-execution-engine.md`), `NodeExecution`/`ModelConfig` 데이터 모델(`spec/1-data-model.md`), AI Agent 노드의 계층 책임 분할(`AiTurnExecutor → AiMemoryManager → shared/agent-memory-injection.ts`, `spec/4-nodes/3-ai/1-ai-agent.md`)과 모두 정합적이며, 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 충돌은 발견되지 않았다. 유일한 실질 이슈는 target 문서 자신의 §1.3/§4/Rationale 4개 위치가 이번 코드 변경으로 factually stale 해진 self-drift(WARNING)이며, 이는 다른 spec 영역과의 정면 모순이라기보다 target 이 스스로 선언한 "단일 진실" 캐터록의 정확성 문제다. 다만 이 drift 는 `plan/in-progress/ai-usage-attribution-hardening.md`·`plan/in-progress/resume-llm-usage-attribution.md` 양쪽에 이미 명시적으로 인지·추적되어 후속 spec 전용 PR(PR-2)로 즉시 이관될 계획이라 완화 요인이 있다.

## 위험도

LOW
