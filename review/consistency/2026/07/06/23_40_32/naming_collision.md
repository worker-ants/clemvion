### 발견사항

- **[WARNING]** `redactMcpSecrets`/`sanitizeMcpErrorMessage` 가 기존 공용 secret-redaction 유틸(`sanitizeLastErrorMessage`)과 목적 중복 — 서로 다른 placeholder/cap 로 파편화
  - target 신규 식별자: `redactMcpSecrets()`, `MCP_REDACTED_PLACEHOLDER = '[redacted]'` (`codebase/backend/src/modules/mcp/mcp-error-codes.ts`)
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `sanitizeLastErrorMessage()` + `SECRET_LEAK_PATTERNS`(placeholder `***`, cap 200자). 파일 상단 주석에 "Originally defined in integration-oauth.service; extracted to this **neutral location so execution-engine and other non-OAuth modules can import** without creating a cross-layer dependency" 라고 명시 — 정확히 이번 MCP 신규 유틸과 같은 목적(OAuth 토큰·Bearer·secret= 쿼리 마스킹)으로 이미 범용화되어 있고, `execution-engine`(`ai-turn-orchestrator.service.ts`)·`integrations`(`integration-oauth.service.spec.ts`) 등 여러 모듈이 이미 소비 중.
  - 상세: 두 함수 모두 "에러 메시지에서 bearer 토큰/시크릿을 마스킹 후 clamp" 라는 동일한 문제를 각자 정규식으로 재구현했다. 커버 패턴도 겹친다(Bearer, `client_secret`/`token=`/`password=` 류 kv, `Authorization:` 헤더) — `redactMcpSecrets` 는 여기에 URL userinfo(`user:pass@host`) 패턴을 추가로 커버하는 정도의 차이만 있다. 결과적으로 동일 관심사(민감정보 redaction)에 대해 리포지토리에 **placeholder 문자열이 다른(`[redacted]` vs `***`) 두 개의 SoT** 가 생겨, 로그/DB 에 저장된 redaction 마커의 의미가 모듈마다 달라진다. 이후 새 통합(3rd MCP-like 모듈)이 추가될 때 개발자가 어느 유틸을 기준으로 확장해야 하는지 판단하기 어렵고, 이미 있는 `SECRET_LEAK_PATTERNS` 확장 대신 4번째 정규식 세트가 또 생길 위험이 있다.
  - 제안: 신규 함수를 유지하려면 최소한 (a) `mcp-error-codes.ts` 주석에 `shared/utils/sanitize-error-message.ts` 와의 관계(왜 재사용하지 않고 별도로 뒀는지 — 예: MCP 는 URL-in-message 패턴이 특화되어 있고 cap 이 2048 로 다르다는 등)를 명시하거나, (b) 가능하면 `sanitizeLastErrorMessage` 의 `SECRET_LEAK_PATTERNS` 에 URL-userinfo 패턴을 추가해 `redactMcpSecrets` 를 그 위에 얇게 얹는 방식으로 통합해 placeholder/cap 파편화를 줄인다. 최소 조치로 spec(`11-mcp-client.md §8.2` 인근 또는 Rationale)에 "MCP 전용 redaction 을 별도로 둔 이유"를 한 줄 남기면 이후 리뷰어의 동일 지적 반복을 막을 수 있다.

- **[INFO]** `sanitizeErrorMessage`(background-execution.processor.ts, local) 와 `sanitizeMcpErrorMessage`(mcp-error-codes.ts) 이름 유사 — 실제 충돌은 아님
  - target 신규 식별자: 없음 (기존 `sanitizeMcpErrorMessage` 의 동작만 확장됨, 이름 자체는 변경 없음)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:28` 의 module-local `function sanitizeErrorMessage(err: unknown): string`
  - 상세: 두 함수는 서로 다른 파일에 각각 로컬/export 로 존재하고 import 충돌은 없다. 다만 "sanitize*ErrorMessage" 계열 함수가 이제 3개(`sanitizeLastErrorMessage`, `sanitizeErrorMessage`, `sanitizeMcpErrorMessage`) 로 늘어 검색·탐색 시 혼동 가능성이 있다.
  - 제안: 실제 조치 불필요 (이번 diff 로 새로 생긴 충돌 아님). 향후 sanitize 유틸 통합 시 함께 정리 권장.

### 요약
target(`spec/5-system/11-mcp-client.md` §6.2/§8.1/§8.2, 및 대응 구현)이 이번 diff 로 새로 도입한 식별자 — `MCP_TIMEOUT`(McpFailureCode 추가), `resources/list`/`prompts/list`(McpErrorPhase 추가), `mcpErrorDelta`/`McpDiagnosticError`(AgentToolResult 확장), `TimeoutError` 재사용 — 는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로 어느 관점에서도 기존 사용처와 직접 충돌하지 않는다. `MCP_ERROR_CODES` 는 `mcp-error-codes.ts` 단일 SoT 로 잘 네임스페이스되어 있고, `TimeoutError` 는 `common/utils/with-timeout.ts` 의 기존 클래스를 그대로 재사용해 신규 정의가 아니다. 다만 새로 추가된 `redactMcpSecrets`/`MCP_REDACTED_PLACEHOLDER` 는 완전히 새 이름이라 "식별자 충돌"은 아니지만, 이미 같은 목적으로 존재하며 여러 모듈이 소비 중인 `shared/utils/sanitize-error-message.ts`(`sanitizeLastErrorMessage`/`SECRET_LEAK_PATTERNS`)와 **개념적으로 중복**되어 redaction placeholder 가 두 갈래(`[redacted]` vs `***`)로 파편화되는 점이 유일한 실질 지적이다. CRITICAL 은 없음.

### 위험도
LOW
