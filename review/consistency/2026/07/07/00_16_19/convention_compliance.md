# 정식 규약 준수 검토 — spec/5-system/11-mcp-client.md (impl-done)

## 발견사항

### 명명 규약 (error-codes.md §1, §2)
- 신규/확장 코드 `MCP_TIMEOUT` — `MCP_ERROR_CODES.TIMEOUT`(`mcp-error-codes.ts`)에 이미 등록돼 있던 상수를 그대로 재사용. `<DOMAIN>_<CONDITION>` UPPER_SNAKE_CASE 도메인 prefix 원칙(§1)에 부합하며, 신규 rename 이 아니라 기존 vocabulary 값을 새 코드 경로(connect abort / meta 도구)에서 추가로 emit 하는 것이라 §2 rename-안정성 정책과도 충돌하지 않는다.
- Internal Bridge(Cafe24/Makeshop) 의 `CAFE24_*`/`MAKESHOP_*` `codeForStatus` 매핑은 각 도메인 prefix 를 유지하며 spec §2.3(Internal Bridge 별도 vocabulary)·error-codes.md §1 도메인 prefix 관례와 일치.
- `McpErrorPhase` (`connect`/`initialize`/`tools/list`/`tools/call`/`resources/list`/`resources/read`/`prompts/list`/`prompts/get`) 는 spec §8.1/§8.2 산문에 등장하는 phase 어휘와 1:1 대응 — 신규 값(`resources/list`, `prompts/list`) 이 diff 와 spec 본문 갱신(§6.2 산문) 양쪽에 함께 반영됨.
- `redactMcpSecrets` 함수명·`MCP_EXTRA_SECRET_PATTERNS` 상수명은 기존 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`) 명명 스타일과 정합하며, spec §8.3/§Rationale 이 명시한 "공용 SoT 재사용 + MCP 전용 패턴만 얇게 추가" 설계와 코드가 정확히 일치.

판정: 위반 없음.

### 출력 포맷 규약 (node-output.md Principle 3.2, error-codes.md)
- `output.error.code` / `mcpDiagnostics.errors[].code` 모두 `UPPER_SNAKE_CASE` 유지 (`MCP_TIMEOUT`, `MCP_CALL_FAILED`, `MCP_TOOL_ERROR`, `CAFE24_*`, `MAKESHOP_*`) — node-output.md §3.2 "code 는 UPPER_SNAKE_CASE" 규약 준수.
- `mcpErrorDelta` 신규 필드(`AgentToolResult.mcpErrorDelta`)는 spec §6.2 가 이미 문서화한 "call-phase errors[] 누적은 별도 follow-up" 항목의 실제 구현이며, spec 본문이 diff 와 정확히 동기화되어 있음(§6.2 "구현 현황 (2026-07-06 갱신)" 문단이 `mcpErrorDelta` 경유 call-phase 누적을 명시).
- `IntegrationUsageLog.error.message` redaction 정책(§8.3) — 공용 `SECRET_LEAK_PATTERNS` + MCP 전용 URL-userinfo/bare-token 패턴 조합, 2048자 cap — spec 문서 §8.3 표와 diff 구현이 1:1 일치.

판정: 위반 없음.

### 문서 구조 규약 (CLAUDE.md, spec-impl-evidence.md)
- `spec/5-system/11-mcp-client.md` 는 여전히 Overview(§1 개요) → 본문(§2~§12) → `## Rationale` 3섹션 구조를 유지. 신규 Rationale 항목("timeout 을 별도 TimeoutError 로 분류", "에러 message redaction 은 공용 패턴 재사용")이 각각 §4.4/§8.2, §8.3 본문 결정의 배경을 정확히 설명하며 본문-Rationale 분리 원칙에 부합.
- `## 8. 에러 처리` §8.1/§8.2 표가 diff 반영 후 최신 상태(예: `MCP_CALL_FAILED` 설명에 `resources/list`/`prompts/list` 추가, `MCP_TIMEOUT` 설명에 "모든 단계에서 surface" 갱신)로 갱신되어 spec-코드 동기가 유지됨.

판정: 위반 없음.

### API 문서 규약 (swagger.md)
- 이번 diff 는 컨트롤러/DTO 레이어를 직접 변경하지 않는다. `McpFailureCode` union 에 `'MCP_TIMEOUT'` 이 추가됐으나, 이를 노출하는 `IntegrationResponseDto.lastError.code` 필드는 이미 `{ type: 'string', description: 'UPPER_SNAKE_CASE 에러 코드' }` 형태의 **비-enum 제네릭 string** 으로 선언되어 있어(swagger.md 의 enum 강제 대상이 아님) 신규 코드 추가가 swagger 스펙 갱신을 요구하지 않는다 — 기존 패턴과 정합.

판정: 위반 없음 (변경 범위 밖).

### 금지 항목
- error-codes.md §2(rename 금지) 위반 없음 — 기존 코드 재명명이 아니라 기존 vocabulary 값의 emit 지점 확장.
- node-output.md Principle 8(이중 wrapper 금지) 등 다른 금지 패턴에 해당하는 변경 없음.
- secret redaction 로직을 **별도 SoT 로 파편화**하지 않고 공용 `SECRET_LEAK_PATTERNS` 를 import/재사용한 점은 CLAUDE.md 의 단일 진실 원칙과도 정합.

판정: 위반 없음.

## 요약
diff(코드) 와 target spec 문서(`spec/5-system/11-mcp-client.md`) 양쪽 모두 정식 규약(`spec/conventions/error-codes.md`, `node-output.md`, `swagger.md`)을 위반하는 지점을 찾지 못했다. 에러 코드는 UPPER_SNAKE_CASE·도메인 prefix 원칙을 유지했고, 신규 `MCP_TIMEOUT` emit 확장은 rename 이 아니라 기존 코드의 적용 범위 확장이라 안정성 정책에 저촉되지 않는다. secret redaction 은 공용 SoT(`SECRET_LEAK_PATTERNS`)를 재사용해 파편화를 피했고, spec 문서는 Overview/본문/Rationale 3섹션 구조를 유지하며 §6.2·§8.1·§8.2·§8.3·Rationale 이 코드 변경과 정확히 동기화되어 있다. API 문서(swagger) 레이어는 이번 변경 범위 밖이며 기존 제네릭 string 필드 설계 덕에 갱신이 필요 없었다.

## 위험도
NONE
