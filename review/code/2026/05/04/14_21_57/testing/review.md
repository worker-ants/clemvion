### 발견사항

---

**[WARNING]** `isError=true` 경로에 대한 usage log 테스트 누락
- 위치: `mcp-tool-provider.ts:354-365` / `mcp-tool-provider.review.spec.ts` — `IntegrationUsageLog hooks`
- 상세: `callTool`이 `isError: true`를 반환하는 경로에서 `logUsage`가 `MCP_TOOL_ERROR`로 호출되지만, `IntegrationUsageLog hooks` describe 블록에는 이 경로에 대한 테스트가 없습니다. "logs failure with MCP_AUTH_FAILED" 테스트는 throw 경로만 커버하고 있어, `isError` 경로의 로깅은 검증되지 않습니다.
- 제안:
  ```typescript
  it('logs failure with MCP_TOOL_ERROR on isError=true response', async () => {
    mcpClient.connect.mockResolvedValueOnce(
      makeSession({
        callTool: jest.fn().mockResolvedValue({
          isError: true,
          content: [{ type: 'text', text: 'tool error' }],
        }),
      }),
    );
    // buildTools + execute + expect(logUsage).toHaveBeenCalledWith(...)
    const args = logUsage.mock.calls[0][0];
    expect(args.status).toBe('failed');
    expect(args.error.code).toBe('MCP_TOOL_ERROR');
  });
  ```

---

**[WARNING]** 403/forbidden auth 패턴 테스트 누락
- 위치: `mcp-tool-provider.ts:373-376` / `mcp-tool-provider.review.spec.ts`
- 상세: 정규식 `/\b40[13]\b|unauthori[sz]ed|forbidden/i`가 401과 403 두 패턴을 모두 처리하지만, 테스트는 401만 커버합니다. 403(`HTTP 403 Forbidden`)이 `MCP_AUTH_FAILED`로 분류되는지는 검증되지 않습니다.
- 제안: 기존 "logs failure with MCP_AUTH_FAILED on 401-shaped errors" 테스트를 `each` 또는 별도 케이스로 확장:
  ```typescript
  it.each([
    'HTTP 401 Unauthorized',
    'HTTP 403 Forbidden',
    'Request unauthorized',
  ])('classifies "%s" as MCP_AUTH_FAILED', async (msg) => { ... });
  ```

---

**[WARNING]** `ai-agent.handler.ts` context 전파에 대한 핸들러 레벨 테스트 없음
- 위치: `ai-agent.handler.ts:392-393`, `570-571`, `768-773`
- 상세: `nodeExecutionId`와 `workflowId`가 `ProviderExecCtx`로 전달되는 3곳(최초 실행 2곳, multi-turn resume 1곳)에 대한 핸들러 레벨 통합 테스트가 검토 대상 파일에 없습니다. provider의 usage log 테스트는 존재하지만, 핸들러가 실제로 이 필드들을 올바르게 주입하는지는 검증되지 않습니다.
- 제안: `ai-agent.handler.spec.ts`에 MCP tool 호출 시 `logUsage`에 올바른 `nodeExecutionId`, `workflowId`가 전달되는지를 확인하는 통합 스펙 추가

---

**[WARNING]** `does NOT flip status for non-auth failures` 테스트의 assertion 불완전
- 위치: `integrations.service.spec.ts:699-715`
- 상세: `status: 'connected'`만 검증하고 `statusReason`이 여전히 `null`인지를 확인하지 않습니다. 향후 누군가 실수로 `statusReason`을 설정하더라도 이 테스트는 통과됩니다.
- 제안:
  ```typescript
  expect(integrationRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'connected',
      statusReason: null,
    }),
  );
  ```

---

**[WARNING]** `logUsage` 이중 swallow의 외부 catch 경로 미검증
- 위치: `mcp-tool-provider.ts:398-406`
- 상세: `McpToolProvider.logUsage`의 try/catch는 `integrationsService.logUsage`가 예외를 던질 경우를 대비하지만, `integrations.service.spec.ts`의 `swallows DB failure` 테스트는 내부 swallow만 커버합니다. 외부 catch가 실제로 tool 실행을 보호하는지(throw를 bubble하지 않는지)는 미검증입니다.
- 제안:
  ```typescript
  it('tool execution succeeds even if logUsage throws', async () => {
    logUsage.mockRejectedValueOnce(new Error('log write failed'));
    const result = await provider.execute(...);
    // result는 에러 없이 정상 content를 반환해야 함
    expect(JSON.parse(result.content).error).toBeUndefined();
  });
  ```

---

**[INFO]** `durationMs` 정확성 미검증
- 위치: `mcp-tool-provider.ts:342`, `386`, `393`
- 상세: `logUsage` 호출 시 `durationMs: Date.now() - startedAt`이 전달되지만, 어떤 테스트도 이 값이 0 이상이고 합리적인 범위인지를 검증하지 않습니다. `jest.useFakeTimers()`로 타이밍을 제어해 `durationMs`의 정확성을 확인할 수 있습니다.

---

**[INFO]** `logUsage.mock.calls[0][0]` 직접 접근 패턴
- 위치: `mcp-tool-provider.review.spec.ts:608-612`, `638-641`
- 상세: `mock.calls[0][0]` 직접 접근보다 `expect(logUsage).toHaveBeenCalledWith(expect.objectContaining({...}))`가 더 일관된 Jest 관용 표현입니다. 현재 코드는 동작하지만 다른 어서션 스타일과 혼재됩니다.

---

**[INFO]** meta tool 호출 시 usage log 미기록 — 의도적 동작 명시 필요
- 위치: `mcp-tool-provider.ts` — `executeMeta` 메서드
- 상세: `list_resources`, `read_resource`, `list_prompts`, `get_prompt` 등의 meta tool 호출에는 `logUsage`가 호출되지 않습니다. 이것이 의도적 설계(meta 조회는 activity 탭에 표시하지 않는다)라면 "skips logging when nodeExecutionId is missing" 테스트처럼 명시적 테스트나 코드 주석으로 기록해야 합니다.

---

### 요약

테스트 구조는 전반적으로 견고합니다. `logUsage` 성공/실패/skip 3가지 핵심 경로와 `integrations.service`의 status flip/non-flip 경로가 모두 명확히 커버됩니다. 그러나 `isError=true` 경로의 usage log, 403 auth 패턴, multi-turn resume의 핸들러 레벨 context 전파, 그리고 meta tool의 의도적 logging skip 동작에 대한 테스트가 부재하여 기능의 전체 커버리지에 갭이 존재합니다. 특히 핸들러 레벨에서 `nodeExecutionId`/`workflowId` 전파가 미검증 상태로 남아 있는 점이 가장 실질적인 위험입니다.

### 위험도

**MEDIUM**