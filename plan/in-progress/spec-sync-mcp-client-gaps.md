---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# mcp-client — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec(`spec/5-system/11-mcp-client.md`)을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/11-mcp-client.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-mcp-client-gaps PR)**: §6.2 외부 MCP serverSummaries push(항목 2) 구현.
> 나머지(`errors[]`/`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets` 필드 + MCP_TIMEOUT/
> CONNECT_FAILED/LIST_FAILED 코드 granularity)는 **McpDiagnostics 타입 확장(serverSummaries[] → 구조화 객체)
> cluster** 로 묶여 별도 PR 권장 — ProviderBuildCtx.mcpDiagnostics 인터페이스 + buildMcpDiagnosticsMeta +
> 전 push 사이트 동시 변경. §3.3 capability 캐시는 Integration 엔티티 credentials 구조 변경(infra)으로 별도.

- [ ] §6.2 `mcpDiagnostics` 의 `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]` 필드 emit — **타입 확장 cluster**: 현재 `mcpDiagnostics` 가 `McpServerSummary[]` 단일 배열이라, 위 필드를 담으려면 구조화 객체로 승격 필요(전 소비/생산처 동시 변경).
- [x] §6.2 외부 `service_type='mcp'` 통합의 진단 표면 노출 — **완료**: `McpToolProvider.materializeServer` 가 connect+list 성공 시 connected serverSummary(toolCount) push, `openServer` 가 serviceType=mcp 확정 이후 status/connect/list 실패 시 skipped(skipReason=error) push(Cafe24 Internal Bridge 와 대칭). serviceType 판정 전 lookup 실패는 미push(double-push 회피). 테스트 2건.
- [ ] §8.2 `MCP_TIMEOUT` 코드 emit — **타입 확장 cluster**: 코드 granularity 는 `errors[]` 필드(위)에 담겨야 의미 — skipReason vocabulary(error/expired_*/...)에는 timeout/connect/list 값이 없음.
- [ ] §8.2 `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` buildTools surface — **타입 확장 cluster**: 동상. 현재는 skipped(skipReason=error)로 일괄 표면화, 코드 분류는 errors[] 도입 시.
- [ ] §3.3 `credentials.cached_capabilities` capability 캐시 — **보류 (infra)**: Integration 엔티티 credentials JSONB 구조 변경 + preview test 저장 경로. spec L142-148 Planned(캐시는 hint, 실행 시 재조회).

## 비고
- 각 항목의 근거(claim→코드부재/불일치)는 audit findings/5-system/5-system__11-mcp-client.md 참조.
- spec 본문은 위 항목을 "미구현 (Planned)" 으로 명시 표기 완료 (§3.3 / §6.2 / §8.2).
- 반대로 audit 가 지적한 §8.2 신규 코드(`MCP_TOOL_ERROR`·`MCP_UNKNOWN_TOOL`)와 §9 응답 형식(200 OK body, rotate 경로 400)·`MCP_HTTPS_REQUIRED` 정정은 spec 본문 패치로 완료(구현 일치).
