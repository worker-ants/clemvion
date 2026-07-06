### 발견사항

- **[WARNING]** §2.3 "동일하게 누적" 문구가 §6.2 의 Planned 잔여 범위와 상충
  - target 위치: `spec/5-system/11-mcp-client.md` §2.3 "Internal Bridge" 절, line 81 — "에러 처리: §8 의 에러 vocabulary 그대로 적용. Cafe24 의 경우 `tool_result.error` 의 `code` 는 Cafe24 노드 §6 의 vocabulary(`CAFE24_AUTH_FAILED` 등)를 그대로 사용하며, `mcpDiagnostics.errors` 에는 **동일하게 누적된다**."
  - 충돌 대상: 같은 문서 §6.2 (line 356-362, 2026-07-06 갱신 코멘트) 및 `spec/4-nodes/4-integration/4-cafe24.md` §6.1 (line 430/438, `serverSummaries[]` 만 언급, `errors[]` 언급 없음)
  - 상세: §6.2 는 이번 구현 변경으로 "call 단계(`tools/call`/`resources/read`/`prompts/get`) 실패의 `errors[]` 누적"을 **Planned(미구현)** 로 명시한다. 그런데 §2.3 line 81 은 Cafe24(Internal Bridge, tools/call 만 존재하는 provider)의 에러가 `mcpDiagnostics.errors` 에 "동일하게 누적된다"고 단정적으로 서술해, 같은 문서 §6.2 의 잔여사항과 모순된다. 실제 코드 확인 결과(`Cafe24McpToolProvider` — `pushMcpServerSummary` 만 호출, `pushMcpDiagnosticError` 미호출) Cafe24 provider 는 `errors[]` 를 전혀 push 하지 않는다. 즉 Cafe24 실패는 `tool_result.error` 로만 표면화되고 `mcpDiagnostics.errors[]` 에는 나타나지 않는다 — line 81 의 서술은 코드와도, 같은 문서 §6.2/§8.1 표(line 445)의 "call-phase errors 누적은 Planned" 서술과도 어긋난다.
  - 제안: line 81 을 "`mcpDiagnostics.errors` 에는 (call-phase 누적이 Planned 이므로 현재는) 누적되지 않으며, `tool_result.error` + `IntegrationUsageLog`(§8.3) 로 표면화된다" 로 정정하거나, 최소한 §6.2 잔여 캐비어트로 링크해 "build 단계 한정" 임을 명시할 것.

- **[INFO]** `serviceType='mcp'` 대칭 서술과 실제 대칭 범위 불일치 가능성
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 line 358 — "`serverSummaries[]` 를 push 하는 provider 는 Internal Bridge(`Cafe24McpToolProvider`·`MakeshopMcpToolProvider`) 와 외부 `McpToolProvider` **둘 다**다 ... (Cafe24 와 대칭)"
  - 충돌 대상: 같은 문단의 "errors[]" 서술(line 359, `McpToolProvider.openServer` 에서만 push) 및 `4-cafe24.md`
  - 상세: "Cafe24 와 대칭" 표현이 `serverSummaries[]` push 에 한정된 대칭(정확)인지, `errors[]` 까지 포함한 전체 대칭으로 오독될 수 있는지 문장 구조상 애매하다. 실제로는 `serverSummaries[]` 만 대칭이고 `errors[]` 는 `McpToolProvider` 전용이므로, 위 WARNING 과 같은 오독을 유발할 수 있는 문구다.
  - 제안: "(serverSummaries push 에 한해 Cafe24 와 대칭. errors[] 는 build-phase RPC 가 있는 McpToolProvider 전용)" 로 괄호를 명확화.

### 요약
target(`spec/5-system/11-mcp-client.md`)의 이번 갱신은 `mcpDiagnostics` 를 단일 배열(`serverSummaries[]`)에서 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`)로 확장한 구현을 잘 반영하고 있으며, `spec/4-nodes/3-ai/0-common.md` §7, `spec/4-nodes/3-ai/1-ai-agent.md` §6.2/§7.1/§7.10, `spec/conventions/node-output.md` Principle 3.2(코드 UPPER_SNAKE_CASE)와도 정합적이다. 다만 target 문서 자체 내부에서 §2.3(Internal Bridge 에러 처리)이 §6.2(errors[] 의 call-phase 누적은 Planned)와 모순되는 문장을 포함하고 있고, 이 모순이 `4-cafe24.md` 의 서술(§6.1, `serverSummaries[]` 만 언급)과 실제 코드(Cafe24 provider 는 `pushMcpDiagnosticError` 미호출) 양쪽과 어긋나는 방향으로 영향을 미친다. 이는 시스템 작동 불가를 유발하는 CRITICAL 은 아니며, 문서 정합성 정정이 필요한 WARNING 수준이다.

### 위험도
LOW
