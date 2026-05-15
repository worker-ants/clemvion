### 발견사항

- **[WARNING]** `materializeServer` TOCTOU 경쟁 조건 — 동일 `integrationId` 중복 처리
  - 위치: `mcp-tool-provider.ts` `materializeServer()`, 약 301~312행
  - 상세: `Promise.allSettled`로 여러 서버를 병렬 처리할 때, `refs` 배열에 동일한 `integrationId`가 두 번 포함된 경우 두 `materializeServer` 호출이 모두 `sessions.get(ref.integrationId) → undefined`를 동기적으로 읽은 뒤, 각자 `await this.openServer()`를 호출한다. 두 `openServer`가 모두 완료되면 `sessions.set()`이 두 번 호출되어 먼저 완료된 세션이 덮어씌워지고 누출된다. JavaScript의 단일 스레드 이벤트 루프에서도 `await` 경계를 사이에 둔 check-then-act 패턴은 동일한 논리적 경쟁 조건을 유발한다.
  - 제안: `materializeServer` 시작 시점에 이미 진행 중인 `openServer` Promise를 캐싱하는 `inFlight: Map<string, Promise<ServerEntry>>` 를 추가해 동일 키의 중복 연결을 차단한다. 또는 스키마 레벨에서 `integrationId` 중복을 zod `superRefine`으로 사전 차단한다.

---

- **[WARNING]** `mcpClient.connect()` 에 타임아웃 없음 — 무한 블로킹 위험
  - 위치: `mcp-tool-provider.ts` `openServer()`, `const session = await this.mcpClient.connect(params)` 라인
  - 상세: `listTools()`에는 `LIST_TIMEOUT_MS` 래핑이 적용되어 있지만, `connect()` 자체에는 타임아웃이 없다. MCP 서버가 TCP 연결을 수락한 후 응답을 보내지 않거나 네트워크 홀이 발생하면, 해당 `buildTools()` 호출이 OS 수준의 TCP 타임아웃(수 분~수십 분)이 발생할 때까지 Node.js 이벤트 루프를 블로킹하지 않더라도 해당 실행(execution)이 무기한 대기한다.
  - 제안: `withTimeout(this.mcpClient.connect(params), CONNECT_TIMEOUT_MS, ...)` 형태로 연결 단계에도 별도 타임아웃(`MCP_CONNECT_TIMEOUT_MS` 환경 변수)을 적용한다.

---

- **[WARNING]** `listTools` 타임아웃 시 이미 열린 세션 누출
  - 위치: `mcp-tool-provider.ts` `openServer()`, `withTimeout(session.listTools(), ...)` 라인
  - 상세: `connect()` 성공 후 `listTools()` 단계에서 타임아웃이 발생하면 `openServer()`가 예외를 던지고 `entry`는 `sessions` Map에 저장되지 않는다. 이로 인해 이미 열린 `session` 객체는 어떤 `executionId` 버킷에도 속하지 않아 `cleanup()`이 영구히 호출되지 않는 고아(orphan) 세션이 된다.
  - 제안: `openServer()` 내부를 `try/catch`로 감싸 `connect()` 성공 후 이후 단계에서 예외가 발생하면 즉시 `session.close()`를 호출한다.
    ```typescript
    const session = await this.mcpClient.connect(params);
    try {
      const list = await withTimeout(session.listTools(), LIST_TIMEOUT_MS, ...);
      // ...
    } catch (e) {
      await session.close().catch(() => undefined);
      throw e;
    }
    ```

---

- **[INFO]** `__default__` 공유 버킷 — `executionId` 미제공 시 전역 오염
  - 위치: `mcp-tool-provider.ts` `executionKey()` 메서드
  - 상세: `executionId`가 `undefined`인 경우 모두 `'__default__'` 하나의 버킷을 공유한다. 이 상태에서 어느 호출자가 `cleanup({ executionId: undefined })`를 수행하면 다른 모든 미키드(unkeyed) 실행의 세션이 함께 닫힌다. 현재 코드 경로에서 `executionId`는 항상 공급되므로 실제 발생 가능성은 낮지만, 미래 호출 경로 추가 시 무성한 버그가 될 수 있다.
  - 제안: `executionKey()` 내 `id ?? '__default__'` 대신 `id`가 `undefined`이면 경고를 로깅하고, 경우에 따라 고유 임시 키(`crypto.randomUUID()`)를 생성해 버킷 오염을 원천 차단한다.

---

- **[INFO]** `withTimeout` 내부 Promise 취소 불가 — 타임아웃 후 연결 지속
  - 위치: `mcp-tool-provider.ts` `withTimeout()` 함수
  - 상세: 타임아웃이 발생해 `reject`되더라도 래핑된 원본 Promise(예: `listTools()`)는 계속 실행된다. 타임아웃 후 원본 Promise가 완료되어도 그 결과는 무시되지만, 내부적으로 이미 서버 자원(대역폭, 스레드)을 소비한다. AbortController를 지원하는 MCP SDK라면 취소 신호를 전달하는 것이 이상적이다.
  - 제안: MCP SDK가 `AbortSignal`을 지원한다면 `AbortController`를 타임아웃에 연결해 실제 요청 취소를 구현한다.

---

### 요약

이번 변경의 핵심 동시성 구조는 `McpToolProvider`의 `sessionsByExecution` Map이다. `executionId` 키로 실행 간 격리를 구현하고 `cleanup()`에서 Map을 원자적으로 삭제해 이중 클로즈를 방지하는 설계는 전반적으로 올바르다. 그러나 `materializeServer`에서 `await openServer()` 경계를 사이에 둔 TOCTOU 패턴은 중복 `integrationId` 입력 시 세션을 누출시키고, `connect()` 단계에 타임아웃이 없어 원격 서버 장애가 실행 전체를 무기한 블로킹할 수 있으며, `listTools` 타임아웃 이후 이미 열린 세션이 정리되지 않는 리소스 누출 경로가 존재한다.

### 위험도

**MEDIUM**