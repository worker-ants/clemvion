## 발견사항

- **[WARNING]** `McpTestConnectionService.test()` — 세션 정리가 `try...finally` 없이 수동 분기 처리됨
  - 위치: `mcp-test-connection.service.ts` — `test()` 메서드 내 두 try-catch 사이 구간
  - 상세: `session = await this.client.connect(params)` 성공 후, 내부 try 블록 진입 전까지 `capabilities`, `serverInfo` 접근 및 `toolCount` 선언이 동기 코드로 존재함. 현재는 throw 가능성이 없어 실제 누수는 발생하지 않지만, 이후 이 구간에 await 연산이 추가될 경우 세션이 close 되지 않고 누수됨. 스펙 주석("The session opened here is **always** closed")과 달리 `finally` 보장이 없는 구조.
  - 제안:
    ```typescript
    try {
      session = await this.client.connect(params);
    } catch (err) {
      return this.classifyConnectError(err);
    }
    try {
      // listTools, 결과 조합 등 모든 후속 작업
    } catch (err) {
      return { success: false, code: 'MCP_LIST_FAILED', message: ... };
    } finally {
      await session.close().catch(() => undefined);
    }
    ```

- **[WARNING]** `McpClientService` — 스펙에 명시된 `MCP_MAX_CONCURRENT_CONNECTIONS` 상한이 미구현
  - 위치: `mcp-client.service.ts` — `connect()` 메서드
  - 상세: 스펙 §4.3에 "워크스페이스 단위 동시 connect 수는 `MCP_MAX_CONCURRENT_CONNECTIONS` (기본 20)로 상한한다"고 명시되어 있으나, 실제 코드에는 semaphore / counter 구현이 없음. 동시에 20건 초과 AI Agent 노드가 실행되면 외부 MCP 서버에 제한 없이 연결이 열릴 수 있음. 특히 `McpTestConnectionService`가 UI에서 "aggressively" 호출될 수 있다고 명시한 만큼 테스트 트래픽 급증 시 위험.
  - 제안: `McpClientService`에 `p-limit` (이미 `package.json`의 의존성) 또는 단순 카운터 기반 semaphore 추가:
    ```typescript
    private readonly connectionLimiter = pLimit(
      parseInt(process.env.MCP_MAX_CONCURRENT_CONNECTIONS ?? '20', 10)
    );
    
    async connect(params: McpConnectParams): Promise<McpSession> {
      return this.connectionLimiter(() => this._connect(params));
    }
    ```

- **[INFO]** 스펙 §4.3 규정 "(integrationId, executionId) 캐시 — 같은 노드 실행 내 동일 서버 connect 1회" 미구현
  - 위치: `mcp-client.service.ts`
  - 상세: Stage 1 의도적 생략으로 보이나, Stage 2 `McpToolProvider` 구현 시 `buildTools` + `execute` 각각 `connect()`를 호출하면 같은 executionId 내에서 중복 세션이 생성될 수 있음. 세션 객체가 caller에 반환되므로 현재 서비스 레이어에서는 추적 불가.
  - 제안: `McpToolProvider` 구현 시 `Map<string, McpSession>` 캐시를 executor context에 바인딩하거나, `McpClientService`가 `(integrationId, executionId)` 키로 weak-reference 캐시를 유지.

- **[INFO]** `SessionImpl` — close 중 진행 중인 RPC와의 race 보호 없음
  - 위치: `mcp-client.service.ts:271` — `SessionImpl.close()`
  - 상세: `close()`가 호출된 직후 `callTool()` 등이 동일 세션에서 호출될 경우 SDK 내부 동작에 의존함. 현재 단일 노드 실행 라이프사이클 내에서 caller가 순차 관리하므로 실제 위험은 낮으나, Multi-turn 재개(resume) 구현 시 close와 재연결 사이의 window에서 잔여 turn 처리와 충돌 가능성 있음.

---

## 요약

변경 코드는 MCP 클라이언트 추상화를 NestJS 싱글턴 서비스(`McpClientService`)로 상태 없이 구현하여 기본적인 스레드 안전성은 확보되어 있다. async/await 전환(`dispatchTest`) 및 에러 격리 패턴도 올바르게 적용됐다. 그러나 `McpTestConnectionService`의 세션 정리 패턴이 `finally` 보장 없이 수동 분기에 의존하고, 스펙에 명시된 동시 연결 상한(`MCP_MAX_CONCURRENT_CONNECTIONS`)이 실제 코드에 구현되지 않아 부하 환경에서 리소스 고갈로 이어질 수 있다. Stage 1 범위 내 즉각적 버그는 없으나, Stage 2 `McpToolProvider` 구현 전에 connection limiter와 `try...finally` 패턴을 적용하는 것을 권장한다.

## 위험도

**LOW**