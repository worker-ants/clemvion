### 발견사항

- **[WARNING]** `dispatchTest` 내 `if (serviceType === 'mcp')` 분기가 OCP(개방-폐쇄) 원칙 위반
  - 위치: `integrations.service.ts`, `dispatchTest` 메서드
  - 상세: Phase C 주석대로 transport 테스트가 필요한 서비스가 추가될수록 `if/else` 체인이 늘어남. 서비스별 transport 테스터를 `ServiceTransportTester` 인터페이스로 추출하고 레지스트리에 등록하는 패턴이 자연스러운 확장 방향
  - 제안: 단기는 현 구조 유지 가능하나, Phase C 착수 전에 `Map<serviceType, TransportTester>` 레지스트리 패턴으로 리팩토링 권장

- **[WARNING]** `adaptMcpTestResult`가 capabilities/serverInfo/preview를 소멸시킴
  - 위치: `integrations.service.ts:adaptMcpTestResult`, `dispatchTest` 반환 타입
  - 상세: `spec §9`는 성공 시 `{ capabilities, serverInfo, preview }` 포함을 명시하나 `dispatchTest`의 반환 타입이 `{ success, message }`로 고정되어 데이터 손실이 구조적으로 발생. 현 구조에서는 등록 UI가 capability preview를 받을 방법이 없음. JSDoc 주석이 이를 인지하고 있으나 해결 경로가 없음
  - 제안: MCP 전용 엔드포인트(`POST /integrations/mcp/preview-test`) 별도 신설하거나, `dispatchTest` 반환 타입을 서비스 타입별 결과를 포함할 수 있는 확장형으로 변경

- **[WARNING]** `McpConnectParams`의 `token?: string` / `value?: string` 필드가 type-level에서 optional
  - 위치: `mcp-client.service.ts:McpConnectParams` 타입 정의
  - 상세: `authType: 'bearer_token'` 분기에서 `token`은 실질적으로 필수이나 `?` 로 선언되어 컴파일 타임 보호가 없음. `buildHeaders`에서 런타임 throw로만 방어. `validateCredentials`가 선행한다는 암묵적 전제를 타입 시스템이 표현하지 못함
  - 제안: `token: string` (required)로 변경하고 `toMcpConnectParams`가 타입 어설션 없이 할당 가능하도록 조정. `McpAuthError` 런타임 체크는 외부 직접 호출 방어용으로 유지

- **[INFO]** `toMcpConnectParams` 변환 로직이 `IntegrationsService`에 내재
  - 위치: `integrations.service.ts:toMcpConnectParams`
  - 상세: Integration credentials(snake_case JSONB) → `McpConnectParams`(camelCase) 변환이 `IntegrationsService`에 있어 두 도메인(integrations, mcp)의 스키마 지식이 혼재. Integration credential 형식이 바뀌면 `IntegrationsService`도 수정 필요
  - 제안: `McpTestConnectionService`에 `testFromCredentials(authType, credentials)` 오버로드를 추가하거나 `McpCredentialAdapter`를 분리. 현 규모에서는 INFO 수준

- **[INFO]** `McpFailureCode`에 `MCP_INITIALIZE_FAILED` 정의되나 `classifyConnectError`에서 미매핑
  - 위치: `mcp-test-connection.service.ts:McpFailureCode` 타입
  - 상세: 타입 union에 선언된 코드가 실제 분류 로직에서 사용되지 않음. SDK가 `initialize` 단계에서 던지는 에러가 `MCP_CONNECT_FAILED`로 흡수됨
  - 제안: 현 단계에서 제거하거나, SDK initialize 실패를 감지하는 별도 에러 타입/조건을 추가

---

### 요약

Stage 1 Foundation으로서 `McpClientService`(transport) / `McpTestConnectionService`(오케스트레이션) / `McpModule`(NestJS 캡슐화) 3계층 분리는 기존 `KbToolProvider` 패턴과 일관되고 응집도가 높다. `SessionImpl`의 `McpSession` 인터페이스 구현, discriminated union 기반 `McpConnectParams`, 에러 격리 전략 모두 아키텍처적으로 적절하다. 다만 `adaptMcpTestResult`에서 발생하는 capability preview 데이터 손실이 스펙 §9의 등록 UI 요구사항과 구조적 불일치를 만들고 있어, Stage 2 진입 전에 MCP 전용 preview 엔드포인트 도입 또는 `dispatchTest` 반환 타입 확장을 결정해야 한다.

### 위험도

**LOW**