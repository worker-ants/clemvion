## 발견사항

### [INFO] spec/4-nodes/3-ai-nodes.md — Stage 2 구현 상세가 Stage 1 PR에 포함
- **위치**: `mcpDiagnostics` 출력 포맷, `McpToolProvider.buildTools/execute` 흐름, 실행 로직 Single Turn 모드 전면 수정
- **상세**: 본 PR은 Foundation(Infrastructure) 단계이며 `McpToolProvider` 구현체는 포함되지 않는다. 그러나 spec 변경에는 Stage 2의 실행 흐름(`AgentToolProvider` 라우팅, `mcpDiagnostics` 출력 구조, turn delta 누적)까지 확정적으로 기술되어 있다. `mcp.module.ts` 주석(`Stage 2 will add McpToolProvider`)과 일관된 의도로 보이지만, 구현되지 않은 동작이 spec에서 현재 시제(`execute`, `buildTools`)로 서술되면 현재 상태를 오독할 여지가 있다.
- **제안**: 미구현 흐름 절에 `> (Stage 2에서 구현 예정)` 마커를 추가하거나, Stage 2 PR에서 spec을 보완하는 방식으로 분리 고려.

---

### [INFO] package-lock.json — `@nestjs-modules/mailer` 하위 peer/optional 항목 3개 제거
- **위치**: `node_modules/@nestjs-modules/mailer/node_modules/chokidar`, `glob-parent`, `readdirp`
- **상세**: 세 항목 모두 `optional: true, peer: true` 로 선언되어 있었으며, `@modelcontextprotocol/sdk` 추가 후 npm 재 resolve 과정에서 상위 scope의 chokidar(현재 v4계열 기준)로 통합된 결과로 보인다. 의도적 제거가 아니라 lock file 재생성의 부산물.
- **제안**: 별도 조치 불필요. 동작에 영향 없음.

---

### [INFO] `McpFailureCode` — `MCP_INITIALIZE_FAILED` 코드가 현재 구현에서 생성되지 않음
- **위치**: `mcp-test-connection.service.ts:35`
- **상세**: `McpFailureCode` union에 `'MCP_INITIALIZE_FAILED'`가 포함되어 있으나 `classifyConnectError` 는 `McpHttpsRequiredError`, `McpAuthError`, 그 외(→ `MCP_CONNECT_FAILED`) 만 분기한다. initialize RPC 실패와 connect 실패가 동일 코드로 묶이는 현상이 발생한다. spec §8.2는 두 코드를 별도로 정의하고 있다.
- **제안**: 단기적으로는 SDK의 initialize 실패를 별도 예외 타입으로 catch하거나, `MCP_INITIALIZE_FAILED` 코드를 Stage 2에서 추가 예정임을 주석으로 명시.

---

### [INFO] `McpConnectParams` — discriminated union에서 `token?`, `headerName?`, `value?` 가 optional
- **위치**: `mcp-client.service.ts:12–28`
- **상세**: `bearer_token` 브랜치의 `token?: string`, `api_key` 브랜치의 `headerName?`, `value?` 가 optional로 선언되어 있어 타입 레벨에서 누락 감지가 불가능하다. 실제 검증은 `buildHeaders`의 런타임 throw로 처리되며, 테스트에서도 이를 확인한다. 구조적으로는 `token: string` (필수)으로 선언하는 편이 더 안전하다.
- **제안**: 타입 안전성을 위해 각 브랜치에서 필수 필드는 required로 변경 고려. 단, 서비스 레지스트리에서 credentials를 매핑하는 `toMcpConnectParams`가 이미 검증 후에 호출되므로 런타임 위험은 낮음.

---

## 요약

변경 범위는 매우 잘 통제되어 있다. 신규 `McpClientService` / `McpTestConnectionService` / `McpModule` 인프라, `IntegrationsService.dispatchTest`의 MCP 분기 연결, service-registry MCP 항목 추가, 프론트엔드 아이콘/표기, 패키지 의존성 추가, spec 문서 업데이트 모두 MCP Stage 1 Foundation이라는 단일 목적에 집중되어 있다. 관련 없는 파일 수정, 불필요한 리팩토링, 기능 과잉은 발견되지 않았다. 유일한 주의 사항은 spec이 Stage 2 구현 상세까지 현재 시제로 기술하고 있다는 점이며, 이는 실용적인 선택이나 가독성을 위해 미구현 절 표시를 고려할 수 있다.

## 위험도

**LOW**