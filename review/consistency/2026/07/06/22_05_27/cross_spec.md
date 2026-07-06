### 발견사항

검토 없음. 아래는 확인한 근거.

- `spec/5-system/11-mcp-client.md` §6.2 는 이번 diff (`mcp-diagnostics.ts`: `McpDiagnostics`/`McpDiagnosticsAccumulator`/`finalizeMcpDiagnostics`/`classifyMcpCall`, `ai-turn-executor.ts`: `mcpServerSummaries` → `mcpDiagnostics` 필드명 교체·구조화 객체 emit, `mcp-tool-provider.ts`: `McpBuildPhaseError`/`MCP_ERROR_CODES` phase 분류)와 이미 동기화되어 "구현 현황 (2026-07-06 갱신)" 콜아웃으로 정확히 반영됨을 확인했다.
- `mcpServerSummaries` (구 필드명) 잔존 참조를 `spec/**` 전체에서 grep 했으나 0건 — cross-spec 상 죽은 참조 없음.
- `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 예시 JSON, §9 필드 표, §6.2 상단 서술 모두 신규 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`)와 정확히 일치.
- `spec/4-nodes/3-ai/0-common.md` §7 (`turnDebug[i].mcpDiagnostics` delta 관계) 도 동일 구조 참조.
- `spec/4-nodes/3-ai/3-information-extractor.md` §meta 표, `spec/4-nodes/4-integration/4-cafe24.md` §8.x (skipReason vocabulary·자가 회복 표)도 동일 필드명·구조 사용, 모순 없음.
- 에러 코드 vocabulary (`MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`)는 `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `MCP_ERROR_CODES` 상수와 spec §8.2 표가 1:1 대응 (SoT 코멘트가 spec 섹션을 직접 인용).
- `IntegrationUsageLog` (§8.3, `spec/1-data-model.md` §2.10.1)와 call-phase 에러 잔여 처리(§6.2 "잔여 (Planned)" 콜아웃)가 정합적으로 명시되어 있고, `plan/in-progress/spec-sync-mcp-client-gaps.md` 로 후속 추적 문서가 실재함을 확인.
- `TimeoutError` 클래스 신설(`with-timeout.ts`)은 `instanceof Error` 하위호환을 유지하며, phase 분류(connect/tools-list) 로직과 spec §8.2 "build 단계 타임아웃은 TimeoutError 판정" 서술이 일치.
- WebSocket 프로토콜 spec / data-flow 문서에는 `mcpDiagnostics` 관련 언급 자체가 없어 구 shape 참조로 인한 드리프트 위험도 없음.

### 요약
target 문서(`spec/5-system/11-mcp-client.md`)의 `mcpDiagnostics` 구조화 객체 승격은 AI Agent(§7.1/§9)·AI 공통(§0-common §7)·Information Extractor·Cafe24 노드 spec 및 백엔드 `MCP_ERROR_CODES` SoT 상수와 모두 정합하며, 필드명 변경(`mcpServerSummaries`→`mcpDiagnostics`)의 죽은 참조도 spec 전체에서 발견되지 않았다. Cross-Spec 관점에서 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 영역에서도 충돌이 발견되지 않았다.

### 위험도
NONE
