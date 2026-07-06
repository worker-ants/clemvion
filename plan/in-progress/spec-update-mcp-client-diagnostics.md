---
worktree: spec-sync-audit
started: 2026-07-06
owner: developer→planner
---

# spec-update draft — mcp-client `mcpDiagnostics` 타입 확장 반영

> developer 가 `mcpDiagnostics` 구조화 승격을 구현(commit `refactor(mcp)`)한 뒤, spec/ 본문의
> 낡은 "미구현 (Planned)" 표기를 구현 반영으로 갱신하기 위한 draft. spec write 는 project-planner
> 소관 (developer spec read-only). 적용 전 `/consistency-check --spec` 통과 의무.
> 추적 tracker: `plan/in-progress/spec-sync-mcp-client-gaps.md`.

## 적용 대상 파일
1. `spec/5-system/11-mcp-client.md` §6.2 (구현 현황 노트) + §8.2 (MCP_TIMEOUT/CONNECT_FAILED/LIST_FAILED 3행)
2. `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 예시 (mcpDiagnostics 예시에 serverSummaries 필드 추가로 실제 emit shape 정합)

## 구현된 사실 (근거)
- `mcpDiagnostics` 는 구조화 객체 emit: `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]` (전 필드). `mcp-diagnostics.ts finalizeMcpDiagnostics`, `ai-turn-executor.ts buildMcpDiagnosticsMeta`.
- build-phase(connect/initialize/tools/list) 실패는 `errors[]` 에 granular code (`MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`) + phase 로 누적 (`McpToolProvider.openServer`). skipped serverSummary 와 병존.
- counters(`toolCalls`/`resourceReads`/`promptGets`)는 executor choke point 에서 `mcp_*` 호출 종류별 집계. `list_resources`/`list_prompts` discovery 는 미집계.
- **call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패의 errors[] 누적은 아직 미구현 (follow-up)** — 현재 `tool_result` + `IntegrationUsageLog`(§8.3)로 표면화. §8.1 표의 "mcpDiagnostics.errors 에도 누적" 은 이 call-phase 부분만 Planned 로 남긴다.

## §6.2 구현 현황 노트 — 교체
- BEFORE: "아래 예시의 나머지 필드 (`attempted` / … / `errors[]`) 는 … **미구현 (Planned)**" 문단.
- AFTER (요지): `mcpDiagnostics` 는 구조화 객체로 승격 완료(2026-07-06), 전 필드 emit. build-phase 실패는 `errors[]` 에 granular code 누적. **잔여 Planned**: call-phase 실패의 `errors[]` 누적(현재 tool_result/UsageLog 로 표면화) + §3.3 capability 캐시.

## §8.2 — 3개 코드 행 갱신
- `MCP_CONNECT_FAILED`: "현재 emit 지점: §9 연결 테스트 한정 … buildTools 단계의 connect 실패는 logger.warn 만" → **"§9 연결 테스트 + 노드 실행 buildTools(`McpToolProvider.openServer`) 양쪽에서 emit — buildTools 실패는 `mcpDiagnostics.errors[].code` 로 surface"**.
- `MCP_LIST_FAILED`: "현재 emit 지점: §9 연결 테스트 한정 (buildTools 단계 list 실패는 §6.2 미구현으로 미surface)" → **"§9 + buildTools tools/list 실패 → `mcpDiagnostics.errors[]`"**.
- `MCP_TIMEOUT`: "**미구현 (Planned)** … 별도 MCP_TIMEOUT 코드를 surface 하지 않는다" → **"build-phase(connect/tools/list) 타임아웃은 `TimeoutError` 판정으로 `mcpDiagnostics.errors[].code=MCP_TIMEOUT` 로 surface. call-phase(`tools/call` 등) 타임아웃은 아직 `MCP_CALL_FAILED` 로 흡수(call-phase errors[] 미구현 — follow-up)"**.
- §8.2 상단 표 `MCP_TIMEOUT` 행의 "미구현 (Planned)" 문구도 위와 동일 취지로 정정.

## 1-ai-agent §7.1 예시 — mcpDiagnostics 정합
- 현재 예시(L485-491)는 `serverSummaries` 필드 누락. 실제 emit 은 항상 `serverSummaries[]` 포함 → 예시에 connected 1건 추가:
  ```json
  "mcpDiagnostics": {
    "attempted": true, "serverCount": 1,
    "toolCalls": 1, "resourceReads": 0, "promptGets": 0,
    "serverSummaries": [
      { "integrationId": "uuid", "serviceType": "mcp", "status": "connected", "toolCount": 3 }
    ],
    "errors": []
  }
  ```
- (impl-prep consistency-check WARNING#1 해소.)

## frontmatter
- `spec/5-system/11-mcp-client.md` status 는 `partial` 유지 (call-phase errors[] + §3.3 캐시 잔여). `pending_plans` 유지.
