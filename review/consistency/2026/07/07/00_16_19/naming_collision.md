### 발견사항

없음. 신규 식별자 충돌 관점에서 CRITICAL/WARNING 급 문제를 발견하지 못했다.

검토한 신규/확장 식별자와 결과:

- **`TimeoutError` (재사용)** — `mcp-client.service.ts`/`mcp-tool-provider.ts`/`mcp-test-connection.service.ts` 가 새로 import 하지만, 클래스 자체는 `codebase/backend/src/common/utils/with-timeout.ts:17` 에 기존 정의된 것을 그대로 재사용한다. 신규 선언이 아니며, 같은 이름의 다른 의미 클래스(`SubWorkflowTimeoutError` 는 별개 클래스명)와도 충돌하지 않는다.
- **`MCP_ERROR_CODES.TIMEOUT` ('MCP_TIMEOUT')** — `mcp-error-codes.ts` 에 이미 존재하던 상수(기존 #840 PR 도입)를 `mcp-tool-provider.ts`/`mcp-test-connection.service.ts` 에서 새로 소비할 뿐, 신규 코드 값 추가가 아니다.
- **`redactMcpSecrets` / `MCP_EXTRA_SECRET_PATTERNS`** — `mcp-error-codes.ts` 신규 함수/상수. 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts:20`)와 이름이 다르고, 공용 `sanitizeLastErrorMessage`(200자 cap)와도 함수명이 분리(`sanitizeMcpErrorMessage`, 2048자 cap)되어 있다. spec §8.3 에도 두 sink 의 cap 차이가 명시적으로 문서화되어 있어 의도된 분리다.
- **`mcpErrorDelta: McpDiagnosticError` (AgentToolResult 신규 필드)** — 기존 `ragSourcesDelta` / `ragDiagnosticsDelta` 와 동일한 `*Delta` 네이밍 패턴을 따르는 확장이며, 다른 필드와 이름이 겹치지 않는다.
- **`McpErrorPhase` 신규 값 `resources/list` / `prompts/list`** — 기존 union(`connect`/`initialize`/`tools/list`/`tools/call`/`resources/read`/`prompts/get`)에 추가된 값으로, `mcp-tool-provider.ts` 의 `META_PHASE` 매핑(`list_resources→resources/list`, `list_prompts→prompts/list`)과 spec §8.1 vocabulary 가 정확히 일치한다. spec 문서 내 타 영역에서 동일 문자열이 다른 의미로 쓰이는 사례 없음(grep 결과 `11-mcp-client.md` 외 매치 없음).
- **`errorResult(..., errorDelta?: McpDiagnosticError)` 시그니처 확장** — 기존 4-arg 호출부(`toolCallId, code, message, extra?`)는 옵셔널 5번째 인자 추가라 하위 호환. 충돌 없음.
- **`INVALID_TOOL_ARGUMENTS` prefix-less 예외 등재 (`spec/conventions/error-codes.md`)** — 코드 값 자체는 신규가 아니라 기존 코드의 명명 근거를 conventions 문서에 소급 등재한 것. 다른 도메인 코드와 문자열 충돌 없음.
- **파일 경로**: 신규 파일은 `mcp-error-codes.spec.ts` 하나이며 기존 `<name>.ts` ↔ `<name>.spec.ts` colocation 컨벤션을 그대로 따른다. 기존 파일과 경로 충돌 없음.

### 요약

본 PR 은 선행 PR(#840, `fd2460992`)에서 도입된 `mcpDiagnostics` 구조화 타입(`McpErrorPhase`, `McpDiagnosticError`, `MCP_ERROR_CODES`)과 `AgentToolResult.*Delta` 네이밍 패턴을 그대로 확장하는 후속 작업이다. `TimeoutError`, `MCP_TIMEOUT` 등 "신규처럼 보이는" 식별자는 실제로는 기존 정의를 새 소비처에서 import/재사용한 것이며, `resources/list`/`prompts/list` phase 값과 `mcpErrorDelta` 필드, redaction 함수명 모두 기존 명명 컨벤션·SoT 분리 원칙과 충돌 없이 정합적으로 확장되었다. 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/config 키·파일 경로 어느 관점에서도 기존 사용처와의 의미 충돌을 발견하지 못했다.

### 위험도
NONE
