---
worktree: mcp-client-diagnostics-followups-878f42
started: 2026-07-06
owner: developer
spec_impact:
  - spec/5-system/11-mcp-client.md
  - spec/conventions/error-codes.md
---

# mcp-client 진단 — #840 후속 4종 (단일 PR)

> #840(mcpDiagnostics 구조화 승격) 머지 후 남긴 후속을 한 브랜치에서 종결.
> 관련 spec: spec/5-system/11-mcp-client.md
> base: origin/main fd2460992 (#840 포함)

## 범위 (4종)

### ① call-phase errors[] 누적 (spec §8.1/§6.2 잔여 완성)
- `AgentToolResult` 에 `mcpErrorDelta?: McpDiagnosticError` 추가 (ragDiagnosticsDelta 패턴).
- provider execute 의 **서버측 실패** 사이트에서 delta set:
  - `McpToolProvider.execute` callTool catch → phase=`tools/call`, code=timeout?MCP_TIMEOUT:auth?MCP_AUTH_FAILED:MCP_CALL_FAILED. isError → MCP_TOOL_ERROR.
  - `executeMeta` catch → phase=read_resource:`resources/read`/get_prompt:`prompts/get`/list_resources:`resources/list`/list_prompts:`prompts/list`, code=timeout?MCP_TIMEOUT:MCP_CALL_FAILED.
  - `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` execute 의 **API 호출 실패**(mapError) → phase=`tools/call`, code=CAFE24_*/MAKESHOP_*.
  - **제외**(client-side, 서버 실패 아님): INVALID_TOOL_ARGUMENTS, MCP_UNKNOWN_TOOL, NO_SESSION, UNKNOWN_OPERATION, MISSING_FIELDS 등 → errors[] 미push (tool_result 로만).
- `McpErrorPhase` 에 `resources/list`/`prompts/list` 추가.
- executor `executeProviderToolBatch` choke point: `execResult.mcpErrorDelta` → `mcpDiagnosticsAcc.errors` push (카운터 증가 지점과 동일 루프).
- spec §6.2/§8.1 "call-phase Planned" 캐비어트 제거 → 구현됨. §2.3 Cafe24 errors[] 서술도 "누적됨" 으로 복원.

### ② 에러 message redaction (task_fa96e218)
- `sanitizeMcpErrorMessage`(mcp-error-codes.ts): control-char strip·clamp 에 더해 **secret/URL redaction** 추가 — bearer/api-key 토큰, `user:pass@host` credential-in-URL, query-string 토큰(`?token=`/`api_key=` 등). 3 sink 동일 적용(errors[].message·IntegrationUsageLog.error·last_error 가 모두 이 함수 경유).

### ③ spec Rationale 섹션 + 코드 prefix (task_947e443e)
- `11-mcp-client.md` 끝에 `## Rationale` 섹션 신설 — §2.2(stdio 배제)/§8.4(Internal Bridge 자가회복 예외)/§6.2(진단 스키마 분리)/§3.2(escape hatch throw-vs-warn) 배경 이관.
- `INVALID_TOOL_ARGUMENTS` prefix: rename(breaking, LLM tool_result 노출) 대신 **범용 코드로 error-codes.md 예외 등재** — spec/conventions/error-codes.md §1(시스템 전역 공용 코드)에 명시. 코드 상수 불변.

### ④ McpClientService/test-connection TimeoutError 소비 (§9)
- `McpTestConnectionService`: connect/list 타임아웃(`TimeoutError`)을 `MCP_TIMEOUT` 로 분류. `McpFailureCode` 유니온에 `MCP_TIMEOUT` 추가. spec §9 실패 코드 부분집합에 `MCP_TIMEOUT` 추가.

## 착수 체크리스트
- [x] /consistency-check --impl-prep (22_43_22, BLOCK: NO — WARNING/INFO 는 본 PR #3 이 해소 대상)
- [x] 구현+테스트 (① call-phase errors[] · ② redaction · ③ spec Rationale+prefix · ④ test-conn timeout)
- [x] TEST WORKFLOW (lint·unit·build·e2e 236 통과)
- [x] 커밋 (리뷰 前 — d395fd7cc·88414653b·1374638ef·67279fa20 + redaction 후속)
- [x] /ai-review — 23_20_02(LOW,2W fix)→23_40_32(clean)→00_00_54(MEDIUM, cafe24/makeshop redaction gap + §2.3, 둘 다 fix). RESOLUTION 기록.
- [x] /consistency-check --impl-done — 23_20_02·23_40_32 BLOCK:NO, 00_00_54 BLOCK:YES(§2.3 self-contradiction)→67279fa20 fix→00_16_19 BLOCK:NO. (redaction 후속 postdate 재검증)
- [x] PR (#842)

## 비고
- 잔여 미포함: §3.3 credentials.cached_capabilities 캐시(infra, Integration credentials JSONB 구조 변경) — 별도 유지.
- 교훈(#840): 코드는 리뷰 前 커밋. 게이트는 review-postdates-code(author-date) 요구.
- 교훈(본 PR): Edit "file not read" 실패를 놓쳐 §2.3 spec-sync 무산 → impl-done Critical 로 검출. Edit 실패 후 반드시 재확인.
