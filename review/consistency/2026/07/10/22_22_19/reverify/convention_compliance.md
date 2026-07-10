# 재검증 — convention_compliance (§1.3 SoT drift CRITICAL 해소 확인)

scope=`spec/data-flow/7-llm-usage.md`, diff-base=`origin/main`, 검토 시각 기준 HEAD 워크트리 실제 파일(`git show HEAD:...`) 대조.

## 발견사항

- **[해소 확인] 직전 CRITICAL(SoT drift) — 4개 위치 모두 정정 완료**
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 L107, §1.3 콜아웃 L113, §4 표 Agent Memory 행 L162, Rationale L202-208 ("`llm_usage_log` 의 nullable context 컬럼들")
  - 상세: HEAD 본문을 직접 읽어 4곳 모두 "AI Agent 자동 메모리 롤링 요약 압축 chat = **채움**(단발/첫 턴 `context.*`, resume 턴 재구성 `state.*`)" 으로 일관되게 정정된 것을 확인. Rationale (b) "아직 배선되지 않은 caller" 목록에서도 해당 항목이 제거되고 `RerankService` listwise grading 만 남음 — 직전 회차 지적대로 "미배선/전부 NULL" 잔존 서술은 spec 어디에도 남아있지 않다 (`grep -rn "롤링 요약 압축" spec/` 로 spec 전역 재확인, 다른 파일에 stale 참조 없음).
  - 코드 대조: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` `buildSummaryBufferUpdate` 가 `llmContext?: LlmCallContext` 를 받아 `llmService.chat(..., llmContext)` 로 그대로 전달함을 확인. caller `ai-memory-manager.ts` `injectMemoryContext` 도 동일 필드를 forward. 실제 조립 지점 두 곳을 대조:
    - 단발 경로(`ai-turn-executor.ts:1163`): `llmContext: { workflowId: context.workflowId, executionId: context.executionId, nodeExecutionId: context.nodeExecutionId }` — spec 의 "단발/첫 턴은 `context.*`" 과 일치.
    - resume 경로(`ai-turn-executor.ts:2298`): `llmContext: { workflowId: state.workflowId, executionId, nodeExecutionId: state.nodeExecutionId }` — spec 의 "resume 턴은 재구성 `state.*`" 과 일치. `execution-engine.service.ts:4845` `buildRetryReentryState` 가 `resumeState.workflowId = execution.workflowId`, `resumeState.nodeExecutionId = opts?.nodeExecutionId` 로 실제 주입하는 것도 확인 — Rationale 의 "엔진 `buildRetryReentryState` 가 재구성 state 에 workflow_id 와 현재 turn 의 NodeExecution row PK 를 주입" 서술과 코드가 정확히 일치(과다·과소 주장 없음).
  - 판정: **직전 CRITICAL(SoT 붕괴) 해소.** spec 서술과 구현이 4개 위치 모두 정확히 부합한다.

- **[WARNING] §1.3 콜아웃과 Rationale 간 신규 자기모순 — RerankService listwise 를 "워크플로우 밖" 으로 오분류**
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 콜아웃 L113 vs Rationale L206-208
  - 상세: 이번 diff 로 §1.3 콜아웃이 "**잔여 NULL** 은 **워크플로우 밖·non-node caller**(`GraphExtractionService`·`RerankService` listwise·AgentMemory 추출 processor)뿐이다" 로 명시적으로 재서술됐다. 그런데 바로 아래 Rationale 은 동일 잔여 NULL 목록을 두 그룹으로 명확히 구분한다: (a) "워크플로우 **밖** 호출이라 애초에 노드 컨텍스트가 없는 caller(`GraphExtractionService`·AgentMemory 추출 processor)" — **의도된 누락** / (b) "`LlmCallContext` 가 **아직 배선되지 않은** caller(`RerankService` listwise grading)" — **후속 배선 여지**. 즉 Rationale 자신은 RerankService 를 "워크플로우 밖"이 아니라 "노드 컨텍스트는 존재하나 단순 미배선"으로 분류하는데, 콜아웃은 이를 (a) 그룹과 한 데 묶어 "워크플로우 밖·non-node" 로 잘못 라벨링해 두 서술이 서로 모순된다.
  - 코드 검증: `RerankService`(listwise `cross_encoder_llm` escalate) 는 `RagSearchService` 경유로 호출되는데, 실제 node 레이어 caller 는 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` 하나뿐이다 — AI Agent 노드의 KB tool 호출(tool-calling loop 내부, 즉 활성 `ExecutionContext`/`state` 가 존재하는 노드 실행 도중)이다. `GraphExtractionService`(`knowledge-base/queues/graph-extraction.processor.ts`, BullMQ)와 `AgentMemory 추출 processor`(`agent-memory/queues/agent-memory-extraction.processor.ts`, BullMQ) 는 워크플로우 실행과 무관한 백그라운드 큐 잡으로 진짜 "워크플로우 밖" 이 맞다. 반면 RerankService listwise 는 노드 실행 도중 호출되므로 코드상으로도 Rationale (b) 의 "노드 컨텍스트는 있으나 미배선" 이 정확하고, 콜아웃의 "워크플로우 밖·non-node caller" 라벨은 부정확하다.
  - 참고: 이 그룹핑 자체(3개 caller 를 한 괄호에 나열)는 diff 이전에도 존재했지만, 이번 편집이 "워크플로우 밖·non-node caller" 라는 **명시적** 라벨을 새로 붙이면서 바로 아래 Rationale 의 (a)/(b) 구분과 정면으로 충돌하는 형태로 굳어졌다. 콜아웃 자신이 "일원화 — 단일 진실" 이라고 못박은 문장이라 이 모순의 무게가 더 크다.
  - 제안: 콜아웃 L113 을 Rationale 과 동일하게 "워크플로우 밖(`GraphExtractionService`·AgentMemory 추출 processor) + 아직 미배선(`RerankService` listwise)" 처럼 (a)/(b) 구분을 유지한 문구로 수정. 최소 수정안: `워크플로우 밖·non-node caller` → `워크플로우 밖 caller(GraphExtractionService·AgentMemory 추출 processor) + 아직 미배선 caller(RerankService listwise)`.

- **[정식 규약 재확인] 문서 구조·명명 — 위반 없음**
  - target 위치: 파일 전체
  - 상세: `## Overview` → 본문(§1~§4) → `## Rationale` 3섹션 구성 유지, 파일명 `7-llm-usage.md` prefix 넘버링 관행 그대로, frontmatter 변경 없음. 이번 diff 범위(4개 위치 prose 정정)는 구조·명명 규약에 영향을 주지 않는다.

## 요약

직전 회차에서 지적한 CRITICAL(§1.3 4개 위치의 SoT 붕괴 — "AI Agent 자동 메모리 롤링 요약 압축" attribution 미배선 서술과 실제 구현의 괴리)은 이번 diff 로 4개 위치 모두 정확히 해소됐다. HEAD spec 본문을 직접 읽고 `agent-memory-injection.ts` / `ai-memory-manager.ts` / `ai-turn-executor.ts` / `execution-engine.service.ts`(`buildRetryReentryState`) 코드와 대조한 결과 "단발/첫 턴 `context.*`, resume 턴 재구성 `state.*`" 서술은 과다·과소 주장 없이 구현과 정확히 일치한다. 다만 이 과정에서 §1.3 콜아웥이 새로 얻은 "워크플로우 밖·non-node caller" 라벨이 `RerankService` listwise 를 바로 아래 Rationale 의 (b) 분류("노드 컨텍스트는 있으나 미배선")와 모순되게 재분류해 문서 내부 자기모순을 하나 새로 만들었다 — 코드 확인 결과 RerankService listwise 는 실제로 노드 실행 도중(`kb-tool-provider.ts`) 호출되므로 Rationale 쪽이 정확하고 콜아웃 쪽이 틀렸다. 이는 원래 CRITICAL 만큼 구현-스펙 괴리를 일으키지는 않지만(실제 데이터 채움 여부에 대한 서술은 양쪽 다 "NULL"로 일치, 틀린 건 "왜 NULL인가"에 대한 원인 라벨) 같은 문서가 스스로 "단일 진실" 이라 선언한 문단에서 발생한 모순이라 정정을 권고한다.

## 위험도

LOW
