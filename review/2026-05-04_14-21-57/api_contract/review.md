### 발견사항

- **[WARNING]** `logUsage` 메서드의 암묵적 사이드 이펙트
  - 위치: `integrations.service.ts:508-517`
  - 상세: `logUsage`는 메서드 시그니처(`params: { integrationId, nodeExecutionId, ... }`)와 JSDoc(`"Record an integration call for activity tracking"`)이 순수한 기록 오퍼레이션임을 암시한다. 그러나 이번 변경으로 `error.code === 'MCP_AUTH_FAILED'`일 때 `integration.status`와 `statusReason`을 변이하는 사이드 이펙트가 추가됐다. 이 메서드를 호출하는 다른 핸들러가 동일한 코드 문자열을 우연히 전달하면 의도치 않게 Integration 상태가 전환될 수 있다.
  - 제안: JSDoc을 갱신하여 "MCP_AUTH_FAILED 코드 수신 시 integration.status를 error로 전환한다"를 명시하거나, 상태 전환 로직을 별도의 `onAuthFailure(integrationId)` 메서드로 분리해 호출 측이 의도적으로 선택할 수 있도록 한다.

- **[WARNING]** 휴리스틱 기반 인증 실패 감지 — 계약 불안정
  - 위치: `mcp-tool-provider.ts` (catch 블록, `/\b40[13]\b|unauthori[sz]ed|forbidden/i`)
  - 상세: `MCP_AUTH_FAILED` vs `MCP_CALL_FAILED` 분류를 Error 객체의 `message` 문자열 패턴 매칭으로 결정한다. MCP SDK는 에러 메시지 형식을 표준화하지 않으므로, 동일한 401 응답이 공급자마다 다르게 직렬화될 수 있다. 이로 인해 실제 인증 실패가 `MCP_CALL_FAILED`로 누락되거나, `"401 items processed"` 같은 도구 레벨 메시지가 `MCP_AUTH_FAILED`로 오분류될 수 있다. 더 심각한 문제는 `MCP_AUTH_FAILED`가 Integration을 `error` 상태로 전환하기 때문에 오탐이 사용자 워크플로를 중단시킨다는 점이다.
  - 제안: MCP SDK가 구조화된 에러 타입(예: HTTP 상태 코드 필드)을 제공하는 경우 그것을 우선 확인한다. 불가능하다면 패턴 조건을 코드 주석에 명시하고 오탐 시 수동 복구 경로(`reauthorize` 또는 `rotate`)가 있음을 운영 문서에 기록한다.

- **[INFO]** Multi-turn resume 시 `nodeExecutionId` 귀속 불일치
  - 위치: `ai-agent.handler.ts:763-768`
  - 상세: Multi-turn resume 경로에서 `state.nodeExecutionId`(최초 waiting NodeExecution의 ID)를 재사용한다. 실제 resume turn의 MCP 호출은 새로운 NodeExecution에 속하지만, 활동 로그는 이전 NodeExecution에 기록된다. 이는 Activity API 응답에서 `nodeExecutionId` 외래키의 의미를 흐릴 수 있다.
  - 제안: 현재의 "Acceptable for activity-tab readability" 판단은 이해하나, 향후 `nodeExecutionId`를 기준으로 집계하는 API(예: 노드별 성공률)가 추가될 경우 데이터 정합성 문제가 드러날 수 있다. 중기적으로 resume NodeExecution ID를 state에 포함하거나, 귀속 한계를 API 응답 필드(예: `attributedToNodeExecutionId`)로 명시하는 방안을 검토한다.

- **[INFO]** `ProviderExecCtx` 인터페이스 확장 — 하위 호환성 유지
  - 위치: `agent-tool-provider.interface.ts:68-74`
  - 상세: `nodeExecutionId`와 `workflowId`가 선택적 필드(`?`)로 추가되어 기존 `AgentToolProvider` 구현체(`KbToolProvider` 등)는 수정 없이 동작한다. 하위 호환성은 유지된다.

---

### 요약

이번 변경은 MCP 도구 호출을 `IntegrationUsageLog`에 기록하고 인증 실패 시 Integration 상태를 자동 전환하는 기능을 추가한다. API 계약 관점에서 주요 위험은 두 가지다. 첫째, `logUsage`가 순수 기록 메서드처럼 보이지만 실제로는 Integration 엔티티를 변이하는 사이드 이펙트를 가지게 되었으나 이것이 메서드 시그니처나 문서에 반영되지 않았다. 둘째, `MCP_AUTH_FAILED` 분류를 에러 메시지 문자열 패턴 매칭으로 결정하는 구조는 MCP SDK 공급자간 표준 부재로 인해 Integration을 잘못된 `error` 상태로 전환시키는 오탐 위험을 내포한다. 두 이슈 모두 내부 서비스 API 계약 명확성 및 안정성에 관한 것이며, 외부 REST API 스키마 변경은 없다.

### 위험도

**LOW**