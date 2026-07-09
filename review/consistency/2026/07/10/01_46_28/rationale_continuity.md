# Rationale 연속성 Check — `spec/data-flow/7-llm-usage.md`

## 발견사항

- **[WARNING]** resume 체크포인트에 `workflowId`/`nodeExecutionId` 를 새로 실었지만 `ai-agent.md §7.4` 의 "context-binding 필드 미동봉" 서술이 갱신되지 않음
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 + `## Rationale` "`llm_usage_log` 의 nullable context 컬럼들" 항 (본 PR 에서 갱신됨). 관련 코드: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`llmContext` 에 `state.workflowId`/`state.nodeExecutionId` 신규 전달), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`MultiTurnState.workflowId`/`MultiTurnState.nodeExecutionId` 신규 필드 + `raw.workflowId`/`raw.nodeExecutionId` 역직렬화 — 즉 `_resumeCheckpoint`/`_retryState` 에 영속되는 스키마 자체에 추가됨)
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 (`_resumeState`/`_resumeCheckpoint`/`_retryState` 생명주기 비교표 직후) — "세 필드 모두 credential / **context-binding** 필드(`llmConfigId` 가 가리키는 provider secret, **`workspaceId` 등**)는 미동봉이며 (`maskSensitiveFields` boundary strip), 재개 시 `node.config` 에서 재유도한다."
  - 상세: target PR 은 `buildRetryReentryState` 가 재구성하는 resume state(`_resumeState`→`_resumeCheckpoint`/`_retryState` 로 영속)에 `workflowId`·`nodeExecutionId`(현재 turn NodeExecution row PK) 두 필드를 **신규로 실어 나르도록** 코드·target spec 을 갱신했다. 그런데 이 필드들은 `node.config` 에서 재유도 가능한 값이 아니다(node.config 에는 workflowId/nodeExecutionId 개념 자체가 없음) — 즉 정확히 `ai-agent.md §7.4` 가 "미동봉·재유도" 원칙의 예시로 든 `workspaceId` 와 같은 성격의 **실행 컨텍스트 바인딩 식별자**를 상태 안에 직접 실어 나르는 설계다. `ai-agent.md §7.4` 의 필드별 표(§7.4, `_resumeState.ragSources`/`_resumeState.turnDebugHistory`/`_resumeState.pendingFormToolCall` 나열)에도 `workflowId`/`nodeExecutionId` 가 반영되지 않았다. target 문서(`7-llm-usage.md`)와 `execution-engine.md §6.1` 표는 이번 PR 에서 갱신됐지만, 가장 직접적으로 `_resumeState`/체크포인트 스키마를 상세 기술하는 `ai-agent.md §7.4` 는 손대지 않아 두 Rationale 사이에 서술 불일치가 생겼다.
  - 다만 완화 요인: (1) `executionId`/`nodeId` 는 이미 diff 이전부터 `MultiTurnState`/state 에 존재하던 필드라(신규 도입 아님) `ai-agent.md §7.4` 의 "미동봉" 서술은 이 PR 이전부터도 완전히 정확하지는 않았다. (2) `execution-engine.md §Rationale "암호화(ENCRYPTION_KEY 기반 secret-store) 기각"` 항이 이미 "`_resumeState` 는 raw secret 을 담지 않는다 — `llmConfigId` 등 **참조 ID** 만 가지며 provider secret 은 secret-store ref 로 분리돼 있다" 고 명시해, reference-ID(비민감 식별자)를 state 에 싣는 것 자체는 기존에 합의된 패턴과 상충하지 않는다. 즉 이번 변경이 새 invariant 위반을 만든 것은 아니지만, `ai-agent.md §7.4` 문구는 "credential" 한정이 아니라 "context-binding(workspaceId 등)" 까지 포괄하는 더 넓은 표현을 쓰고 있어 지금 정확히 반박되는 상태다.
  - 제안: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 "credential / context-binding 필드 ... 미동봉" 문구를 "credential(시크릿) 값만 미동봉 — `llmConfigId`/`workflowId`/`executionId`/`nodeExecutionId` 등 **참조 ID 는 포함될 수 있다**" 로 좁혀 정정하고, `_resumeState` 필드 표(§697-710)에 `workflowId`/`nodeExecutionId` 행을 추가해 `data-flow/7-llm-usage.md §1.3` 로 상호 링크. (target PR 범위를 넘는 정정이라면 최소한 follow-up spec 패치로 명시.)

## 요약

target 문서(`spec/data-flow/7-llm-usage.md`) 자체는 Rationale 연속성 모범 사례에 가깝다 — 과거 "attribution 갭"/"workflowId 는 state 에 없어 null, 추후 개선 가능" 이라는 기존 Rationale 이 명시적으로 예고했던 개선을 이번에 실현하면서, 옛 서술("구판 문서가 약속했던 3-ID 채움은 현행 코드와 다르다")을 지우고 "결정: 코드 수정 채택 (완료)" 로 새 Rationale 을 명확히 남겼으며, 과거 IE resume 의 `nodeId`→`node_execution_id` 오적재를 "회귀" 로 정확히 명명해 교정 이력을 보존했다. `execution-engine.md §6.1` 표도 함께 갱신되어 두 문서 간 1차 정합은 확보됐다. 다만 세 번째로 관련된 `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 checkpoint 서술("credential/context-binding 필드는 미동봉, node.config 에서 재유도")이 이번 변경으로 도입된 `workflowId`/`nodeExecutionId` state 필드를 반영하지 못해 문구상 모순이 생겼다 — invariant 자체(참조 ID 는 담아도 됨, secret 은 안 됨)는 이미 execution-engine.md 의 다른 Rationale 항이 지지하므로 실질 위반은 아니나, 문서 정합 갱신 누락으로 판단된다.

## 위험도

LOW
