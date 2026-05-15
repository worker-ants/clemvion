## 발견사항

### [CRITICAL] `previewTest` 응답에서 capabilities/preview 데이터 손실
- **위치**: `integrations.service.ts` — `adaptMcpTestResult()` 및 `dispatchTest()` 반환 타입
- **상세**: `adaptMcpTestResult`의 반환 타입이 `{ success: boolean; message: string }` 으로 고정되어 있어, `McpTestConnectionService.test()`가 채운 `capabilities`, `serverInfo`, `preview` 필드가 모두 버려진다. 스펙 §9("성공 시 응답 body에 `{ capabilities, serverInfo, preview: { toolCount, resourceSupported, promptSupported } }` 포함")가 요구하는 등록 UI용 capability 미리보기 데이터가 클라이언트에 도달하지 않는다. 코드 내 주석 스스로도 이 gap을 인정하고 있으나("the public `previewTest` contract only returns `{ success, message }`"), 이것이 스펙 요구사항을 깬다.
- **제안**: `previewTest`의 반환 타입을 확장하거나 MCP 전용 응답 페이로드(`capabilities?`, `serverInfo?`, `preview?`)를 포함하도록 변경. `dispatchTest`가 `{ success, message }` 이상을 반환하도록 하거나, MCP 케이스에서 별도 상위 레이어에서 결과를 직접 전달해야 한다.

---

### [WARNING] `MCP_INITIALIZE_FAILED` 코드가 실제로 생성되지 않음
- **위치**: `mcp-test-connection.service.ts` — `McpFailureCode` 타입, `classifyConnectError()`
- **상세**: `McpFailureCode` 유니온에 `'MCP_INITIALIZE_FAILED'`가 선언되어 있고 스펙 §8.2도 이를 별도 코드로 정의하지만, `classifyConnectError()`는 `McpHttpsRequiredError` / `McpAuthError` / 그 외 세 갈래만 처리하여 initialize RPC 실패도 `MCP_CONNECT_FAILED`로 흡수된다. Phase 구분(TCP/TLS 실패 vs `initialize` RPC 실패)이 필요한 다운스트림 처리(e.g., Stage 2의 `mcpDiagnostics.errors`)에서 잘못된 코드를 참조하게 된다.
- **제안**: SDK의 `client.connect()` 내부에서 transport connect와 initialize가 함께 실행된다면, 두 단계를 분리 catch하거나 에러 타입으로 구분하는 로직을 추가해야 한다. 또는 스펙에서 `MCP_INITIALIZE_FAILED`를 제거하고 `MCP_CONNECT_FAILED`로 통합하는 방향으로 스펙을 수정해야 한다.

---

### [WARNING] URL HTTPS 검증이 구조적 유효성 검사 단계에서 누락됨
- **위치**: `service-registry.ts` — MCP `url` 필드 정의; `validateCredentials()`
- **상세**: `url` 필드는 `required: true`, `type: 'string'`으로만 정의되어 있어 `validateCredentials`는 존재 여부만 검사한다. `https://` 강제는 `McpClientService.requireHttpsUrl()`에서만 수행된다. `previewTest`를 경유하면 문제없지만, Integration `create`/`update` API를 직접 호출할 경우(또는 추후 스펙에서 create 시 test를 선택적으로 만든다면) `http://` URL로 Integration이 등록될 수 있으며 에러는 실행 시점에만 발생한다.
- **제안**: `validateCredentials`에서 MCP `url` 필드에 대해 `https://` 시작 여부를 추가 검증하거나, `CredentialField`에 `pattern` 또는 `validator` 속성을 추가해 서비스 레지스트리 수준에서 포맷을 강제한다.

---

### [WARNING] `McpConnectParams`의 인증 필드가 선택적(optional)으로 선언됨
- **위치**: `mcp-client.service.ts` — `McpConnectParams` 타입 (`token?`, `headerName?`, `value?`)
- **상세**: `bearer_token` variant의 `token`, `api_key` variant의 `headerName`/`value`가 모두 `?`로 선언되어 있어 TypeScript 타입 시스템이 잘못된 조합을 컴파일 타임에 잡지 못한다. 런타임에서는 `McpAuthError`가 정확히 발생하지만, 타입 수준에서는 `{ authType: 'bearer_token', url: '...' }` 같은 불완전한 params가 허용된다.
- **제안**: `bearer_token` variant의 `token: string` (non-optional), `api_key` variant의 `headerName: string; value: string`으로 필수화하여 타입 안전성을 확보한다. 테스트에서 누락 케이스를 시뮬레이션하려면 `as any` 또는 `as never`를 명시적으로 사용하도록 한다.

---

### [INFO] `McpModule`이 현재 `IntegrationsModule`에만 등록됨 — Stage 2 주의
- **위치**: `mcp.module.ts`, `integrations.module.ts`
- **상세**: Stage 2에서 AI Agent 노드 핸들러가 `McpClientService`를 직접 주입해야 할 경우, AI Agent 노드의 NestJS 모듈에서 `McpModule`을 별도로 import해야 한다. 현재 `IntegrationsModule`에만 import되어 있으므로 AI Agent 핸들러가 별개 모듈 경계에 있다면 주입 오류가 발생할 수 있다.
- **제안**: Stage 2 작업 시작 전에 `McpModule`의 소비 경로를 명시적으로 설계하거나, `AppModule`에 직접 포함하는 방안을 검토한다.

---

### [INFO] 스펙 오타 — `includeprompts`
- **위치**: `spec/5-system/11-mcp-client.md §5.6`
- **상세**: "`mcpServers[].includeResources: false` / `includeprompts: false`" — `includeprompts`가 소문자로 잘못 기재됨 (`includePrompts`여야 함). `spec/4-nodes/3-ai-nodes.md`의 `McpServerRef` 필드 정의와 불일치.
- **제안**: `includeprompts` → `includePrompts` 수정.

---

## 요약

Stage 1 Foundation의 구현 범위(패키지 추가, MCP 모듈/서비스 구조, 서비스 레지스트리 등록, 테스트)는 대체로 잘 갖추어져 있고 에러 격리·코드 vocabulary·세션 라이프사이클 설계도 스펙을 잘 반영하고 있다. 그러나 **가장 중요한 gap은 `previewTest` 응답에서 capability preview 데이터(`capabilities`, `serverInfo`, `preview`)가 소실되는 것**으로, 이는 스펙 §9이 명시한 "등록 UI의 capability 미리보기" 기능을 현재 코드로는 구현할 수 없음을 의미한다. 이를 포함해 HTTPS URL 구조적 검증 미적용, `MCP_INITIALIZE_FAILED` 코드 미생성 두 가지도 후속 단계(Stage 2) 전에 해소되어야 할 요구사항 불일치다.

## 위험도

**HIGH**