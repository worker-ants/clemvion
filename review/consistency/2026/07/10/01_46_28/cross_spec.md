### 발견사항

없음. target 코드 변경(AI Agent / Information Extractor resume 턴의 `llmContext.workflowId`/`nodeExecutionId` attribution 배선)과 `spec/data-flow/7-llm-usage.md` §1.3·Rationale 은 다른 영역과 다음과 같이 정합적임을 확인:

- **데이터 모델**: `spec/1-data-model.md` §2.14 NodeExecution 의 PK 는 `id UUID` — target/diff 가 `llm_usage_log.node_execution_id` 로 채우는 값(NodeExecution row PK)과 타입·의미 일치. `IntegrationUsageLog.node_execution_id`(§2.10.1)도 동일하게 NodeExecution row FK 로 일관됨. 회귀 방지 테스트(`node-def-1` ≠ `nodeexec-row-1`)가 명시적으로 이 구분을 검증.
- **엔진 스펙과의 교차 참조**: `spec/5-system/4-execution-engine.md` §6.1 ExecutionContext 필드표(`nodeExecutionId` 행)가 이미 "resume 턴은 `ExecutionContext` 미주입이라 엔진 `buildRetryReentryState` 가 재구성 state 에 주입한 현재 turn row PK 를 쓴다 ([data-flow/7-llm-usage §1.3])" 라고 target 문서를 정확히 역참조하며 동일한 사실을 기술 — 두 문서가 서로 모순 없이 대칭.
- **관련 노드 spec**: `spec/4-nodes/3-ai/1-ai-agent.md`, `3-information-extractor.md`, `0-common.md` 는 `_resumeState`/`_retryState` 운반 규약만 서술하고 `workflowId`/`nodeExecutionId` attribution 세부는 다루지 않음 — 상충되는 진술 없음 (단순 미언급이며 target 이 SoT 를 유지).
- **conventions/execution-context.md**: `ExecutionContext` 식별자 3종(`workflowId`/`executionId`/`nodeExecutionId`) 정의와 target 의 attribution 채움 대상이 일치.
- **통계/알림 소비처**(`spec/2-navigation/7-statistics.md`, `9-user-profile.md`, `data-flow/9-observability.md`)는 `llm_cost`/`workflowId` 필터를 언급하되 attribution NULL/완전성에 대한 구체 진술이 없어 target 의 "resume 턴도 이제 채워진다" 갱신과 충돌하는 옛 진술이 없음.

### 요약

이번 diff 는 이미 확정된 `spec/data-flow/7-llm-usage.md` §1.3 / Rationale("`llm_usage_log` 의 nullable context 컬럼들") 이 서술하는 목표 상태(AI Agent·Information Extractor resume 턴도 `workflow_id`/`node_execution_id` attribution 을 채운다)를 코드로 실현한 것이며, 회귀 테스트가 "정의 id(`nodeId`) 오적재" 버그를 명시적으로 봉쇄한다. 데이터 모델(`1-data-model.md` NodeExecution PK)·엔진 스펙(`4-execution-engine.md` §6.1, target 을 정확히 역참조)·AI 노드 spec 군 어디에도 이와 모순되는 정의·상태·계약 서술이 없어, cross-spec 관점에서 새로운 충돌은 발견되지 않았다.

### 위험도
NONE
