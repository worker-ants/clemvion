### 발견사항

---

**[WARNING] `McpConnectParams`의 `bearer_token`·`api_key` 변형에서 타입과 런타임 계약 불일치**
- 위치: `mcp-client.service.ts` — `McpConnectParams` 타입 정의
- 상세: `bearer_token` 변형의 `token?: string`과 `api_key` 변형의 `headerName?: string`, `value?: string`이 모두 선택적(optional)으로 선언되어 있으나, `buildHeaders()`는 이 필드가 없으면 `McpAuthError`를 던진다. 타입은 "없어도 됨"을 말하고 코드는 "없으면 오류"라고 말하는 이중 계약 상태다. 미래 코드 경로에서 사전 검증 없이 이 파라미터를 직접 생성하면 컴파일 타임에 문제를 잡을 수 없다.
- 제안: 런타임 의미와 타입을 일치시킨다. `token: string`, `headerName: string`, `value: string`으로 필수화하거나, 검증이 필요한 코드 경로(현재 `toMcpConnectParams`)에서 호출 전 타입 가드를 통해 좁혀서 넘기도록 한다.

---

**[WARNING] `McpFailureCode`에 `'MCP_INITIALIZE_FAILED'`가 선언되었으나 생성 경로 없음**
- 위치: `mcp-test-connection.service.ts` — `McpFailureCode` 타입 및 `classifyConnectError()`
- 상세: `McpFailureCode`는 `'MCP_INITIALIZE_FAILED'`를 포함하지만, `classifyConnectError()`는 `McpHttpsRequiredError` → `McpAuthError` → 나머지 전부 `MCP_CONNECT_FAILED` 순으로 분기하며 이 코드를 생성하는 경로가 없다. `spec/5-system/11-mcp-client.md §8.2`에는 해당 코드가 명시되어 있어 독자에게 "이 경로는 별도로 처리된다"는 오해를 준다. 이는 API 계약 문서와 구현 간 drift의 씨앗이 된다.
- 제안: 현재 구현 범위에서 실제로 발생 가능한 코드가 아니라면 타입 유니온에서 제거하거나, `MCP_INITIALIZE_FAILED`가 별도 경로로 처리되어야 하는 이유를 주석으로 명시하고 실제 경로를 추가한다.

---

**[WARNING] `service-registry.ts`의 MCP `url` / `default_headers` 필드 정의 3중 복제**
- 위치: `service-registry.ts` — `mcp` 서비스의 `bearer_token`, `api_key`, `none` 세 변형
- 상세: `url` 필드(description 포함 6개 속성)와 `default_headers` 필드가 세 변형에 각각 완전히 동일하게 복제되어 있다. 이 파일의 다른 서비스들(GitHub의 두 변형 등)도 같은 패턴이지만, MCP는 공통 필드가 많아 변경 시 세 곳을 모두 수정해야 한다. URL description의 "HTTPS is required" 문구 하나를 바꾸려면 3곳을 변경해야 하며, 하나를 빠뜨리면 UI가 불일치 상태가 된다.
- 제안: 파일 내에서 공통 필드를 상수로 추출한다. `const MCP_URL_FIELD = { key: 'url', ... }` 형태로 정의하고 세 변형에서 spread 또는 참조로 재사용한다. 기존 서비스들도 같은 문제를 안고 있으므로, 이 MCP 추가를 계기로 공통 필드 추출 패턴을 도입하면 향후 유지보수 비용을 줄일 수 있다.

---

**[INFO] `mcp-test-connection.service.ts`의 `session` 변수 타입이 불필요하게 장황함**
- 위치: `mcp-test-connection.service.ts:49`
- 상세: `let session: Awaited<ReturnType<McpClientService['connect']>> | null = null`은 실질적으로 `McpSession | null`과 동일하다. `connect()`의 반환 타입이 `Promise<McpSession>`이기 때문이다. 구조를 읽는 데 불필요한 인지 부하를 준다.
- 제안: `let session: McpSession | null = null`로 단순화한다.

---

**[INFO] `mcp-test-connection.service.ts`의 `session.close()` 호출 패턴 중복**
- 위치: `mcp-test-connection.service.ts` — `listTools` 실패 경로 및 성공 경로
- 상세: `await session.close().catch(() => undefined)` 호출이 성공·실패 두 경로에 각각 존재한다. 현재는 2곳이라 허용 범위지만, 새 분기(예: `listResources` 에러 처리)가 추가될수록 누락 위험이 커진다.
- 제안: `try/finally` 블록으로 리팩터링하여 `close()`가 항상 단일 경로로 실행되게 한다.

```typescript
async test(params: McpConnectParams): Promise<TestConnectionResult> {
  let session: McpSession | null = null;
  try {
    session = await this.client.connect(params);
  } catch (err) {
    return this.classifyConnectError(err);
  }
  try {
    // ... listTools 등 ...
    return { success: true, ... };
  } catch (err) {
    return { success: false, code: 'MCP_LIST_FAILED', ... };
  } finally {
    await session.close().catch(() => undefined);
  }
}
```

---

**[INFO] `toMcpConnectParams`의 `?? undefined` 표현이 의미 없음**
- 위치: `integrations.service.ts` — `toMcpConnectParams()` 내부
- 상세: `(credentials.default_headers as Record<string, string> | undefined) ?? undefined`에서 `as ... | undefined`로 이미 `undefined`가 가능하고, 왼쪽이 `null`일 때만 의미있는 `?? undefined`가 붙어 있다. `as`로 캐스팅된 값이 `null`이 될 가능성은 사실상 없으므로 이 코드는 독자를 혼란스럽게 한다.
- 제안: `credentials.default_headers as Record<string, string> | undefined`만으로 충분하다. `?? undefined` 제거.

---

**[INFO] `McpClientService.connect()`의 클라이언트 버전 하드코딩**
- 위치: `mcp-client.service.ts:169–172`
- 상세: `name: 'idea-workflow-backend', version: '0.1.0'`이 하드코딩되어 있다. 실제 패키지 버전과 불일치 가능성이 있으며, 버전을 올릴 때 이 파일을 별도로 찾아 수정해야 한다.
- 제안: `package.json`의 버전을 읽어 주입하거나, 애플리케이션 수준 상수로 추출해 단일 출처를 만든다.

---

### 요약

전체적으로 책임 분리(`McpClientService` / `McpTestConnectionService` / `McpModule`)와 테스트 커버리지 수준이 우수하며, 기존 `AgentToolProvider` 추상화를 재사용한 설계 의도가 코드와 스펙 양쪽에 일관되게 반영되어 있다. 핵심 위험 요소는 `McpConnectParams`의 타입-런타임 계약 불일치로, 이것이 해결되지 않으면 향후 코드 경로 추가 시 컴파일 타임에 잡히지 않는 인증 오류로 이어질 수 있다. `MCP_INITIALIZE_FAILED` 미사용 코드와 서비스 레지스트리의 필드 3중 복제는 당장 버그를 일으키지는 않지만 스펙-구현 drift와 변경 비용 증가의 씨앗이다. 나머지 사항들은 가독성 수준의 개선 여지다.

### 위험도

**MEDIUM**