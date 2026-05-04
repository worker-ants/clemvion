## 문서화 리뷰 결과

### 발견사항

---

**[INFO] `IntegrationsService.logUsage` JSDoc이 상태 전환 side-effect를 언급하지 않음**
- 위치: `integrations.service.ts` — `logUsage` 메서드 JSDoc
- 상세: 현재 JSDoc은 "Record an integration call for activity tracking and error surfacing"으로 끝나지만, `MCP_AUTH_FAILED` 수신 시 Integration의 `status`와 `statusReason`을 변경하는 상태 전환 로직이 추가됨. 이는 단순한 logging을 넘어 Integration 엔티티를 변형하는 side-effect이므로 JSDoc에 명시되어야 함
- 제안:
  ```typescript
  /**
   * Record an integration call for activity tracking and error surfacing.
   * Invoked by execution engine handlers after they complete an integration call.
   *
   * Side-effect: when `error.code === 'MCP_AUTH_FAILED'`, flips the
   * integration to `status='error' / statusReason='auth_failed'` so the
   * editor can surface a reauthorization prompt. Other failure codes leave
   * the integration status unchanged.
   */
  ```

---

**[INFO] `ProviderExecCtx.workflowId` 설명이 참조 엔티티를 명시하지 않음**
- 위치: `agent-tool-provider.interface.ts` — `workflowId` 필드 주석
- 상세: `/** logUsage 외래키. nodeExecutionId 와 한 묶음으로 흐름을 따라간다. */` — "외래키"만 언급하고 어떤 엔티티(`Workflow`)를 참조하는지, `IntegrationUsageLog` 테이블의 어떤 컬럼인지가 불명확
- 제안:
  ```typescript
  /**
   * `IntegrationUsageLog.workflowId` 외래키 — Workflow 엔티티 id.
   * nodeExecutionId 와 한 묶음으로 logUsage 에 전달된다.
   */
  workflowId?: string;
  ```

---

**[INFO] `ai-agent.handler.ts` 신규 필드 전달 위치에 의도 설명 없음**
- 위치: `ai-agent.handler.ts` — 첫 번째(L390)·두 번째(L569) 패치 위치
- 상세: `nodeExecutionId`, `workflowId` 두 필드가 주석 없이 추가됨. 세 번째 패치 위치(L763, 멀티턴 resume)에는 귀속 이유를 설명하는 주석이 있으나, 앞 두 곳에는 없어 일관성이 부족함. 작은 변경이지만 독자가 "왜 이 두 필드가 필요한가"를 추적해야 함
- 제안: 간결한 주석 한 줄 추가
  ```typescript
  nodeExecutionId: context.nodeExecutionId, // for IntegrationUsageLog
  workflowId: context.workflowId,           // for IntegrationUsageLog
  ```

---

**[INFO] Spec이 신규 Usage Tracking 기능을 반영하지 않음**
- 위치: `spec/4-nodes/3-ai-nodes.md` — `mcpServers` 항목 및 MCP 관련 섹션
- 상세: "(Stage 2에서 핸들러 통합 예정)" 문구 제거는 적절하나, 이번 Stage에서 추가된 핵심 기능인 "MCP 도구 호출이 Integration Activity 탭에 기록됨"과 "인증 실패 시 Integration 상태가 자동 전환됨" 두 동작이 Spec에 전혀 언급되지 않음. 향후 프론트엔드 개발자나 기획자가 Spec만 보고는 이 동작을 알 수 없음
- 제안: `spec/5-system/11-mcp-client.md` 또는 `spec/4-nodes/3-ai-nodes.md`의 `mcpServers` 주석에 아래 내용 추가
  ```markdown
  > MCP 도구 호출은 `IntegrationUsageLog`에 기록되어 Integration 상세 페이지의
  > Activity 탭에 표시된다. `MCP_AUTH_FAILED` 오류 발생 시 Integration 상태가
  > `error(auth_failed)`로 자동 전환되어 에디터에 재인증 배지가 표시된다.
  ```

---

**[INFO] `McpToolProvider.logUsage` 이중 catch 패턴의 설명이 `IntegrationsService` 쪽에서 보장되는지 불명확**
- 위치: `mcp-tool-provider.ts` — `logUsage` private 메서드 catch 블록
- 상세: `// logUsage already swallows internally` 주석이 `IntegrationsService.logUsage`의 catch 동작을 가정함. 그러나 `IntegrationsService.logUsage`의 JSDoc에는 에러를 삼킨다는 명시가 없어, 미래에 구현이 바뀌었을 때 이 가정이 깨질 수 있음
- 제안: `IntegrationsService.logUsage` JSDoc에 "Never throws — all DB errors are swallowed and logged via `console.warn`" 문구를 추가하여 contract를 명시

---

### 요약

전반적으로 이번 변경의 문서화 품질은 높음. 인라인 주석에서 "왜(WHY)"를 설명하는 관행이 잘 지켜지고 있으며, 특히 `McpToolProvider.logUsage`의 JSDoc과 멀티턴 resume 지점의 귀속 설명은 모범적. 주요 개선 영역은 두 가지: `IntegrationsService.logUsage`의 JSDoc이 중요한 status-flip side-effect를 누락한 점, 그리고 Spec 문서가 이번 Stage에서 추가된 usage tracking 및 자동 상태 전환 동작을 반영하지 않은 점. 나머지는 일관성 향상을 위한 사소한 제안.

### 위험도

**LOW**