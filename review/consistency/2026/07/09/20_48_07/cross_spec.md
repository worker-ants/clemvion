# Cross-Spec 일관성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 대상 요약

diff 범위는 execution-engine 모듈 내 5개 파일 (`ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `execution-engine.service.ts`(+spec), `retry-turn.service.ts`, `utils/resume-state.schema.ts`) 이며, 회귀(#501) 수정 하나로 수렴한다: AI Agent/Information Extractor multi-turn **resume/retry 재구성 경로**에서 `resumeState.workflowId`/`resumeState.nodeExecutionId` 를 재주입해, provider-tool(cafe24/makeshop/mcp) 의 `logUsage` attribution 게이트(`if (ctx.nodeExecutionId && ctx.workflowId)`)가 resume 턴에서도 통과하도록 한다. `nodeExecutionId` 는 `resumeStateSchema`(in-memory `_resumeState` superset)에만 추가되고, 영속 대상인 `resumeCheckpointSchema`/`credentialStripSubsetShape` 에는 추가되지 않는다 — 코드 자체가 "checkpoint 미영속, 재개 시 재유도" 원칙을 지킨다.

## 발견사항

교차 검토 결과 CRITICAL/WARNING 급 충돌은 발견되지 않았다. 근거:

1. **데이터 모델**: `spec/1-data-model.md` 의 `IntegrationUsageLog`(§2.10.1)·`Execution`/`NodeExecution` 정의에 변경 없음. 신규 컬럼·FK 도입 없음 — `nodeExecutionId` 는 DB 컬럼이 아니라 in-memory `_resumeState` 필드로만 추가됐고, `CREDENTIAL_CONTEXT_FIELDS` 목록에도 들어가 영속 스키마(`resumeCheckpointSchema`)에서는 명시적으로 제외된다(`codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:76-79`, `:110-163`).
2. **API 계약**: REST/WS 엔드포인트·payload shape 변경 없음. `spec/5-system/6-websocket-protocol.md` 의 `execution.retry_last_turn` 등 관련 이벤트 스펙과 충돌 없음.
3. **요구사항 ID**: 신규 요구사항 ID 없음.
4. **상태 전이**: `Execution`/`NodeExecution` 상태 머신(§1.1/§1.2) 무변경. `_resumeState`/`_resumeCheckpoint`/`_retryState` 3종 라이프사이클(§1.3) 구조도 무변경 — 필드 하나가 in-memory superset 에 추가됐을 뿐.
5. **RBAC**: 해당 없음.
6. **계층 책임**: 새 `opts.nodeExecutionId` 흐름은 §1.3 "구현 위치 (C-1 분할 후)" 에 이미 명시된 `AiTurnOrchestrator`(rehydration 재진입) / `RetryTurnService`(retry 재진입) / 엔진 잔류 `buildRetryReentryState` 경계를 그대로 따른다 — 새로운 컴포넌트나 책임 이동 없음.

교차 영역 문서(`spec/2-navigation/4-integration.md:1074` "엔진은 각 노드 실행 직전 `ExecutionContext.nodeExecutionId`를 주입하여 usage 로그의 귀속을 보장한다")가 이미 선언한 보장을, 이번 diff 는 AI multi-turn resume 턴이라는 특수 경로에서도 성립시키는 **정합화 방향**의 수정이다 — 오히려 기존 cross-spec 커밋먼트와의 gap 을 줄인다.

- **[INFO]** §1.3 / AI Agent §7.9 의 credential/context-binding 필드 열거가 예시("`llmConfigId`/`workspaceId` 등")로만 되어 있어 `nodeExecutionId` 가 이 목록의 정식 구성원이 됐다는 점이 spec 본문에서 명시적으로 드러나지 않는다.
  - target 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:150-163` (`CREDENTIAL_CONTEXT_FIELDS`, `nodeExecutionId` 신규 포함)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §1.3 ("credential / context-binding 필드(`llmConfigId`/`workspaceId` 등)는 미동봉... 재개 시 `node.config` 재평가로 재유도"), `spec/4-nodes/3-ai/1-ai-agent.md:721` (동일 패턴)
  - 상세: 모순은 아니다 — `nodeExecutionId` 는 `workflowId` 와 마찬가지로 이미 "재개 시 `node.config` 재유도" 라는 문구가 정확히 들어맞지 않는 필드였다(둘 다 node.config 가 아니라 execution/opts 에서 재유도). 이번 diff 로 그 기존 패턴에 필드 하나가 추가됐을 뿐이라 신규 모순은 아니지만, "등" 으로 뭉뚱그린 예시 나열이라 신규 독자가 정확한 allow-list 를 spec 만으로는 재구성할 수 없다.
  - 제안: 필수 조치 아님 — 후속 spec 정리 시 §1.3 문구를 "node.config 재평가 또는 opts(대기/재시도 NodeExecution row id 등)로 재유도" 로 세분화하면 code(`CREDENTIAL_CONTEXT_FIELDS`)와 spec 서술의 정합이 더 뚜렷해진다.

## 요약

diff 는 execution-engine 내부 AI multi-turn resume/retry 재구성 로직에 한정된 좁은 회귀 수정으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과 직접 모순되지 않는다. 오히려 `spec/2-navigation/4-integration.md` 가 이미 선언한 "노드 실행 직전 nodeExecutionId 주입 → usage 로그 귀속 보장" 이라는 cross-spec 커밋먼트를 resume 경로에서도 충족시키는 정합화 수정이다. 유일한 관찰 사항은 §1.3/§7.9 의 credential/context-binding 필드 예시 나열이 완전 열거형이 아니라는 기존 서술 스타일에서 비롯된 INFO 수준 문서 완결성 항목이며, 이는 이번 diff 가 새로 만든 문제가 아니라 기존 패턴(`workflowId`)의 연장이다.

## 위험도

NONE
