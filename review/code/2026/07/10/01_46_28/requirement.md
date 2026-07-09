# 요구사항(Requirement) Review — resume 턴 llm_usage_log attribution (IE node_execution_id 오적재 + ai_agent 메인 chat)

## 검증 방법

diff 9개 파일(CHANGELOG, execution-engine.service.ts, ai-turn-executor.{ts,spec.ts}, information-extractor.handler.{ts,spec.ts}, plan 문서, spec/5-system/4-execution-engine.md, spec/data-flow/7-llm-usage.md) 을 읽고, 실제 worktree 코드(diff 반영 후 HEAD)를 직접 추적해 데이터 흐름을 종단간(end-to-end) 확인했다:

- `retry-turn.service.ts` (`applyRetryLastTurn`) → `buildRetryReentryState(..., { nodeExecutionId: spawnedRow.id })` — retry 재진입 시 spawn 된 RUNNING NodeExecution row PK 주입 확인.
- `ai-turn-orchestrator.service.ts` (`handleAiResumeTurn`) → `buildRetryReentryState(..., { resumeMode: true, nodeExecutionId: ctx.nodeExec?.id })` — resume 재진입 시 대기 NodeExecution row PK 주입 확인.
- `resume-state.schema.ts` `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS` 에 `workflowId`/`nodeExecutionId` 가 이미 등재(선행 PR #877)돼 있어 본 diff 의 소비 사이트가 존재하는 필드를 읽는 것임을 확인.
- `information-extractor.handler.ts` `hydrateState`/`processMultiTurnMessage` → `llmContext: { executionId, workflowId: state.workflowId, nodeExecutionId: state.nodeExecutionId }` — `state.nodeId`(정의 id) 를 더 이상 쓰지 않음을 확인.
- `ai-turn-executor.ts` `processMultiTurnMessage` → `llmContext` const 가 메인 chat 최초 호출 + tool-call 루프 후속 호출 양쪽에 전달됨을 확인(단일 `llmContext` 재사용).
- `llm.service.ts` `chat()` → `usageLogService.record({ workflowId: context?.workflowId, executionId: context?.executionId, nodeExecutionId: context?.nodeExecutionId, ... })` → `llm-usage-log.service.ts` `record()` 가 그대로 INSERT 컬럼에 매핑 — attribution 체인 종단 확인.
- `execution-engine.service.ts` diff는 주석 2줄 추가만이고 `buildRetryReentryState` 본문(코드)은 변경 없음 — CHANGELOG·plan 문서의 "주석만 갱신" 서술과 일치.
- `text-classifier.handler.ts`(비변경 파일)를 대조 확인 — 이 노드는 resume/multi-turn 경로가 없어 `context.*` 만 쓰는 것이 spec 표 서술과 정합.
- `agent-memory-injection.ts`(비변경 파일) 대조 확인 — `llmService.chat` 호출에 context 인자가 없어 spec 의 "잔여 갭" 서술과 정합.
- 관련 unit spec 2개 파일(`ai-turn-executor.spec.ts`, `information-extractor.handler.spec.ts`) 실행 — 66/66 통과.

## 발견사항

- **[INFO]** 신규 테스트는 diff 로 추가된 attribution 필드만 검증하고, 기존 실패 경로(`state.executionId` falsy → `llmContext: undefined`)의 회귀 가드는 IE 쪽에 별도로 없음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:891-897` (`llmContext: state.executionId ? {...} : undefined`)
  - 상세: `executionId` 가 없으면(이론상 발생하지 않아야 하나 방어적 삼항) `workflowId`/`nodeExecutionId` 가 있어도 `llmContext` 전체가 `undefined` 로 떨어져 attribution 이 통째로 스킵된다. 실제로는 `hydrateState`→`buildRetryReentryState` 경로에서 `executionId` 가 항상 채워지므로 실무 영향은 낮다(같은 로직이 diff 이전부터 존재하던 기존 방어 패턴이라 이번 변경의 회귀는 아님).
  - 제안: 필수는 아니나, `executionId` 단독 게이팅 대신 개별 필드를 optional 로 넘기는 편이 더 견고할 수 있음(원치 않으면 무시 가능 — 기존 패턴 유지 범위).

- **[INFO]** ai-turn-executor.ts 의 `llmContext` 는 turn 진입 시 1회만 계산돼 tool-call 루프 내 후속 `chat` 호출까지 재사용된다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2599-2603`, `:2746-2757`
  - 상세: 루프 도중 `state`/`workflowId`/`nodeExecutionId` 가 바뀌지 않으므로(턴 내내 동일 NodeExecution row 에 귀속) 재사용이 의미상 올바르다. 단발 `chat` 호출과 달리 루프형 소비 사이트라 재계산 누락 여부를 짚어봤으나 문제 없음 — 참고용 기록.

- **[INFO]** spec fidelity — `spec/data-flow/7-llm-usage.md` §1.3 표·attribution 채움 현황 콜아웃·§4 표·Rationale, `spec/5-system/4-execution-engine.md` §6.1 소비처 표가 모두 실제 코드(위 end-to-end 추적 결과)와 line-level 로 일치. IE·AI Agent·Text Classifier 3종의 첫 턴/resume 턴 채움 여부, 잔여 NULL 대상(GraphExtractionService·RerankService listwise·AgentMemory 추출 processor·AI Agent 메모리 롤링 요약 압축)도 코드 대조로 확인된 그대로 서술됨. spec 결함 없음.

## 요약

`buildRetryReentryState`(선행 PR #877)가 재구성 state 에 실어주는 `workflowId`/`nodeExecutionId`(현재 turn NodeExecution row PK)를, 미교정 상태였던 두 소비 사이트(Information Extractor resume 턴의 `traceChat` llmContext, AI Agent `ai-turn-executor.ts` `processMultiTurnMessage` 의 메인 chat 2곳)가 이제 정확히 소비하도록 고쳤다. IE 쪽은 과거 `state.nodeId`(노드 정의 id)를 `node_execution_id` 자리에 오적재하던 FK 오류와 `workflow_id` 누락을 모두 교정했고, AI Agent 쪽은 `LlmCallContext` 자체가 전달되지 않아 3컬럼이 NULL이던 갭을 해소했다. 실제 코드를 `retry-turn.service.ts`/`ai-turn-orchestrator.service.ts`(주입원) → handler(소비) → `llm.service.ts`(전달) → `llm-usage-log.service.ts`(INSERT) 까지 전 구간 추적한 결과 데이터 흐름이 의도대로 일관되게 연결돼 있고, 신규 회귀 테스트 2건(row PK vs 정의 id 를 서로 다른 값으로 부여해 혼동을 배제하는 설계)이 그 계약을 정확히 고정하며 전부 통과한다(66/66). `execution-engine.service.ts` 는 코드 변경 없이 주석만 갱신했다는 CHANGELOG/plan 서술과 실제 diff 가 일치한다. `spec/data-flow/7-llm-usage.md`·`spec/5-system/4-execution-engine.md` 의 표·Rationale 갱신도 실측 코드 상태와 line-level 로 부합해 spec fidelity 이슈가 없다. TODO/FIXME, 미완성 분기, 반환값 누락, 에러 시나리오 처리 결함은 발견되지 않았다.

## 위험도

NONE
