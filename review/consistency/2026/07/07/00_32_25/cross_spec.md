### 발견사항

없음. `spec/5-system/11-mcp-client.md` 는 이번 구현 변경(connect-phase `TimeoutError` 분류, `mcpErrorDelta`/`errors[]` call-phase 누적, `redactMcpSecrets` MCP 전용 마스킹, `McpErrorPhase` 에 `resources/list`/`prompts/list` 추가)을 본문에 이미 반영한 상태이며, 교차 검증한 인접 영역과 모순이 없다.

교차 검증 상세:

- **에러 코드 vocabulary (§8.2)** — 코드의 `MCP_ERROR_CODES`(`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`/`MCP_CALL_FAILED`/`MCP_TOOL_ERROR`/`MCP_TIMEOUT`/`MCP_AUTH_FAILED`/`MCP_HTTPS_REQUIRED`/`MCP_UNKNOWN_TOOL`/`INVALID_TOOL_ARGUMENTS`/`MCP_RESPONSE_TOO_LARGE`)와 target 문서 §8.2 표가 정확히 일치. `MCP_TIMEOUT` 신설이 §4.4·§9(연결 테스트)·§8.2 세 군데 모두에 일관되게 반영됨.
- **Internal Bridge call-phase 위임 (§2.3/§6.2/§8.1)** — `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 의 `mcpErrorDelta.code` 가 각각 `CAFE24_*`(`codeForStatus`)·`MAKESHOP_*` vocabulary 를 그대로 재사용하며, 이는 [`spec/4-nodes/4-integration/4-cafe24.md` §6](spec/4-nodes/4-integration/4-cafe24.md) / [`5-makeshop.md` §6](spec/4-nodes/4-integration/5-makeshop.md) 의 기존 코드 정의와 일치. target 문서 §2.3/§6.2 가 "Internal Bridge 는 CAFE24_*/MAKESHOP_* vocabulary" 라고 명시해 새 요구사항 ID 충돌 없음.
- **`IntegrationUsageLog` (데이터 모델 §2.10.1)** — 엔티티 정의(`error JSONB? { code, message }`)에 길이 제한을 명시하지 않으며, target 문서 §8.3 이 MCP 한정으로 2KB clamp(§8.2 의 2048, 공용 `sanitizeLastErrorMessage` 의 200 과 별개)를 부기한 것은 상위 엔티티 정의를 좁히는 구체화이지 모순이 아님 — target 문서 Rationale 에서도 의도적 분리로 명시.
- **secret redaction 정책** — `redactMcpSecrets` 는 공용 `SECRET_LEAK_PATTERNS`(`codebase/backend/src/shared/utils/sanitize-error-message.ts`)를 그대로 적용한 뒤 MCP 전용 패턴(URL userinfo·bare `token=`)만 얹는 구조이며, target §8.3/Rationale 의 서술과 정확히 일치. 다른 영역(`spec/2-navigation/4-integration.md` 의 HMAC 로그 정책)과도 공용 SoT 참조로 상충 없음.
- **`McpErrorPhase` 열거값** — 코드에 `resources/list`/`prompts/list` 가 추가된 것과 target §4.4(타임아웃 표)·§6.2·§8.1 의 phase 서술이 모두 5종(`tools/call`/`resources/read`/`prompts/get`/`resources/list`/`prompts/list`) 을 동일하게 열거. RAG/`AgentToolResult` 등 다른 spec 문서는 이 내부 타입 shape 를 별도로 문서화하지 않아 충돌 표면 자체가 없음.
- **RBAC/권한·계층 책임** — 이번 변경은 에러 분류·진단 표면 확장에 국한되며 Integration RBAC(`@Roles('editor')`), 워크스페이스 스코프, 계층 분할(서버 서비스 vs AI Agent 핸들러)에는 손대지 않음. `spec/2-navigation/4-integration.md §8`·`spec/0-overview.md` §6.1 의 RBAC 서술과 무관.

### 요약
target 문서(`spec/5-system/11-mcp-client.md`)는 이번 diff 가 구현한 connect-timeout 분류(`TimeoutError`→`MCP_TIMEOUT`), call-phase `mcpErrorDelta`/`errors[]` 누적(외부 MCP + Cafe24/MakeShop Internal Bridge), MCP 전용 secret redaction 확장을 본문(§4.4, §6.2, §8.1–§8.3, Rationale)에 이미 동기화해 반영했다. Cafe24/MakeShop 노드 spec 의 에러 코드 vocabulary, 데이터 모델의 `IntegrationUsageLog` 엔티티 정의, 공용 secret-redaction 유틸리티(`SECRET_LEAK_PATTERNS`)와 대조한 결과 모두 상보적으로 일관되며 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 모순이 발견되지 않았다.

### 위험도
NONE
