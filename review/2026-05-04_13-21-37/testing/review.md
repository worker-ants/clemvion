## 발견사항

### [WARNING] `listResources` / `listPrompts` 세션 메서드 테스트 누락
- **위치**: `mcp-client.service.spec.ts` — `session methods proxy to underlying Client` 블록
- **상세**: `McpSession` 인터페이스가 `listResources`, `listPrompts` 를 선언하고 `SessionImpl` 이 구현하고 있으나, `callTool`, `readResource`, `getPrompt` 와 달리 이 두 메서드에 대한 프록시 검증 테스트가 없음. 향후 `McpToolProvider.buildTools` 가 두 목록을 호출할 때 회귀 포인트가 될 수 있음.
- **제안**: `listResources` / `listPrompts` 호출이 각각 내부 `Client` 의 동명 메서드로 위임되는지 확인하는 테스트 2개 추가.

---

### [WARNING] `McpAuthError` — `api_key` 자격증명 누락 경로 미검증
- **위치**: `mcp-client.service.spec.ts` / `mcp-client.service.ts:buildHeaders`
- **상세**: `bearer_token` 의 `token` 누락은 `McpAuthError` 로 검증되어 있지만, `api_key` 에서 `headerName` 또는 `value` 가 누락되었을 때의 동일 경로에 대한 테스트가 없음. `service-registry` 레이어의 structural validation 이 선행하지만 클라이언트 자체 방어 로직은 테스트되지 않음.
- **제안**:
  ```typescript
  it('throws McpAuthError when api_key credential is incomplete', async () => {
    await expect(service.connect({ url: 'https://...', authType: 'api_key', headerName: 'X-Api-Key' })).rejects.toThrow(McpAuthError);
  });
  ```

---

### [WARNING] `MCP_INITIALIZE_FAILED` 코드가 dead code
- **위치**: `mcp-test-connection.service.ts:McpFailureCode` / `classifyConnectError`
- **상세**: `McpFailureCode` 타입에 `'MCP_INITIALIZE_FAILED'` 가 정의되어 있고 spec `§8.2` 에도 등재되어 있으나, `classifyConnectError` 는 이 코드를 실제로 생성하지 않음. `initialize` 실패는 `MCP_CONNECT_FAILED` 로 대체 처리됨. 이 코드를 트리거하는 경로 자체가 없으므로 테스트 추가가 불가능한 상태.
- **제안**: `McpClientService.connect()` 가 `initialize` 단계에서 별도 에러를 던질 수 있도록 구분하거나, `MCP_INITIALIZE_FAILED` 를 `McpFailureCode` 에서 제거하고 spec 과 일치시킬 것.

---

### [WARNING] `adaptMcpTestResult` — `code` 미설정 폴백 경로 미검증
- **위치**: `integrations.service.spec.ts` / `integrations.service.ts:adaptMcpTestResult`
- **상세**: `result.success === false` 이면서 `result.code` 가 `undefined` 인 경우 `'MCP_CONNECT_FAILED'` 로 폴백하는 로직이 있으나 테스트되지 않음.
- **제안**:
  ```typescript
  it('adaptMcpTestResult uses MCP_CONNECT_FAILED as fallback when code is absent', async () => {
    mcpTestConnection.test.mockResolvedValueOnce({ success: false, message: 'unknown' });
    const result = await service.previewTest({ serviceType: 'mcp', authType: 'none', credentials: { url: 'https://x.com' } });
    expect(result.message).toBe('[MCP_CONNECT_FAILED] unknown');
  });
  ```

---

### [WARNING] `toMcpConnectParams` — `authType='none'` 경로 미검증
- **위치**: `integrations.service.spec.ts`
- **상세**: `bearer_token` 위임 테스트는 존재하지만 `none` 타입의 `McpConnectParams` 변환 경로가 직접 검증되지 않음. `defaultHeaders` 전달 여부도 `integrations.service.spec.ts` 수준에서는 확인되지 않음.
- **제안**: `authType: 'none'` 으로 `previewTest` 를 호출하고 `mcpTestConnection.test` 가 `{ authType: 'none', url, defaultHeaders: undefined }` 로 호출되었는지 검증하는 테스트 추가.

---

### [INFO] `McpConnectParams` 타입 — optional token 으로 TypeScript 가드 약화
- **위치**: `mcp-client.service.ts:McpConnectParams`
- **상세**: `bearer_token` 브랜치에서 `token?: string` 으로 선언되어 있어 컴파일 타임에 `token` 누락이 감지되지 않음. 런타임 가드(`McpAuthError`)는 존재하지만 타입 시스템의 보호가 약함.
- **제안**: `token: string` (required) 으로 변경하면 `McpAuthError` 테스트 케이스가 컴파일 오류로 전환되므로 별도 `Partial` 타입이나 타입 캐스트를 사용하는 방향으로 테스트 수정이 필요하지만, 프로덕션 코드의 타입 안전성이 향상됨.

---

### [INFO] `close()` 실패 시 경고 로그 경로 미검증
- **위치**: `mcp-client.service.spec.ts` / `mcp-client.service.ts:SessionImpl.close`
- **상세**: `client.close()` 가 예외를 던질 때 `logger.warn` 을 호출하고 예외를 억제하는 동작이 테스트되지 않음. 중요도는 낮으나 에러 억제 정책을 명시적으로 검증하는 테스트가 있으면 리그레션에 유리.

---

### [INFO] `mcp.module.ts` 단위 테스트 없음 (수용 가능)
- **위치**: `mcp/mcp.module.ts`
- **상세**: NestJS 모듈 클래스는 순수 DI 설정이므로 개별 단위 테스트가 없는 것은 일반적으로 허용됨. 하지만 `IntegrationsModule` 에 `McpModule` 이 정상 임포트되는지를 검증하는 e2e / 통합 테스트가 존재하는지 확인 권장.

---

## 요약

`McpClientService`, `McpTestConnectionService`, `service-registry` 세 영역 모두 happy path 와 주요 실패 모드(HTTPS 위반, 인증 오류, 네트워크 실패, list RPC 실패)를 잘 커버하고 있으며, mock 전략(SDK 모듈 단위 jest.mock, 생성자 주입)도 적절하다. 다만 `listResources`·`listPrompts` 프록시 미검증, dead code인 `MCP_INITIALIZE_FAILED` 경로, `bearer_token` 대비 `api_key` 인증 실패 미검증, `adaptMcpTestResult` 폴백 경로 누락이 복합적으로 남아 있어 향후 AI Agent Stage 2(`McpToolProvider` 구현)에서 이 경로들이 실제로 사용될 때 회귀 위험이 있다.

## 위험도

**LOW** — 핵심 경로의 커버리지는 충분하고, 누락된 테스트들은 보조 경로·방어 로직에 국한되어 있음. 단, `MCP_INITIALIZE_FAILED` dead code 는 spec과의 불일치로 Stage 2 구현 시 혼란을 유발할 수 있어 조기 정리 권장.