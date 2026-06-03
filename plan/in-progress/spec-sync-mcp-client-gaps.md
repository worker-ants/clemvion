---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# mcp-client — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec(`spec/5-system/11-mcp-client.md`)을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/11-mcp-client.md

## 미구현 항목
- [ ] §6.2 `mcpDiagnostics` 의 `attempted` / `serverCount` / `toolCalls` / `resourceReads` / `promptGets` / `errors[]` 필드 emit — 현재 `serverSummaries[]` slice 만 wired (`mcp-diagnostics.ts` · `ai-agent.handler.ts buildMcpDiagnosticsMeta`). 나머지는 follow-up 주석으로만 존재.
- [ ] §6.2 외부 `service_type='mcp'` 통합의 진단 표면 노출 — `McpToolProvider` 는 build/connect/list 실패 시 `logger.warn` 만 하고 `serverSummaries[]` / `errors[]` 에 아무것도 push 하지 않음. 현재 push 주체는 `Cafe24McpToolProvider` (Internal Bridge) 뿐.
- [ ] §8.2 `MCP_TIMEOUT` 코드의 실제 emit — 노드 실행 경로 타임아웃이 plain Error 로 흡수되어 `MCP_CALL_FAILED` 또는 warn 으로만 surface. (`mcp-error-codes.ts` 에 상수는 존재하나 미사용)
- [ ] §8.2 `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` 의 노드 실행 buildTools 단계 surface — 현재 두 코드는 §9 연결 테스트(`McpTestConnectionService`) 경로에서만 emit. buildTools 단계의 connect/list 실패는 코드 없이 warn 처리.
- [ ] §3.3 `credentials.cached_capabilities` capability 캐시 — 코드베이스에 심볼 부재. 미리보기는 매번 live `initialize` 사용.

## 비고
- 각 항목의 근거(claim→코드부재/불일치)는 audit findings/5-system/5-system__11-mcp-client.md 참조.
- spec 본문은 위 항목을 "미구현 (Planned)" 으로 명시 표기 완료 (§3.3 / §6.2 / §8.2).
- 반대로 audit 가 지적한 §8.2 신규 코드(`MCP_TOOL_ERROR`·`MCP_UNKNOWN_TOOL`)와 §9 응답 형식(200 OK body, rotate 경로 400)·`MCP_HTTPS_REQUIRED` 정정은 spec 본문 패치로 완료(구현 일치).
