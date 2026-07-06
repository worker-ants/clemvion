### 발견사항

- **[INFO]** `[SPEC-DRIFT]` spec/5-system/11-mcp-client.md §6.2/§8.2 의 "미구현 (Planned)" 서술이 본 PR 로 stale 화됨
  - 위치: `spec/5-system/11-mcp-client.md` §6.2 (L358: "구현 현황 (2026-06-14 갱신)" 노트, `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]` 를 "미구현 (Planned)" 으로 명시), §8.2 (`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`/`MCP_TIMEOUT` 각 행의 "현재 emit 지점: §9 연결 테스트 한정" / "미구현 (Planned)" 서술)
  - 상세: 코드(`mcp-diagnostics.ts` `McpDiagnostics`/`finalizeMcpDiagnostics`, `mcp-tool-provider.ts` `openServer`)는 이제 `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]` 전체를 구조화 객체로 emit 하고, `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 를 buildTools 경로(§9 연결 테스트 한정이 아님)에서 granular 하게 분류해 push 한다. 즉 이번 커밋으로 코드가 spec 의 "미구현" 서술을 실제로 구현 완료 상태로 만들었으나, spec 본문 자체는 아직 갱신되지 않았다. 이는 코드 버그가 아니라 의도된 정상적인 spec-sync 작업(계획대로 코드 우선 착수)이며, `plan/in-progress/spec-sync-mcp-client-gaps.md` 체크리스트에도 "spec 동기화 (§6.2/§8.2/1-ai-agent §7.1) + /consistency-check --spec" 이 미완료([ ])로 명시돼 있어 인지·추적되고 있다.
  - 제안: 코드 유지. `project-planner` 가 `spec/5-system/11-mcp-client.md` §6.2 "구현 현황" 노트와 §8.2 코드별 "현재 emit 지점" 서술을 실제 구현(전체 구조화 객체 + buildTools 단계 granular code emit)으로 갱신하고, `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 (L485-491) 예시를 실제 emit shape 와 정렬해야 한다 (이미 impl-prep consistency-check WARNING#1 로 식별·plan 스코프에 반영됨 — 별도 조치 불필요, 완료 전까지 잔여로 추적).

- **[INFO]** call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패는 여전히 `mcpDiagnostics.errors[]` 에 누적되지 않음 (spec §8.1 표 "errors 에도 누적" 부분 커버)
  - 위치: `spec/5-system/11-mcp-client.md` §8.1 표 — `tools/call` 실패 행에 "`mcpDiagnostics.errors` 에도 누적" 명시
  - 상세: 이번 PR 은 build-phase(`connect`/`tools/list`) 실패만 `errors[]` 로 분류한다. call-phase 실패는 `tool_result.error` + `IntegrationUsageLog` 로는 완전히 표면화되지만 `errors[]` 에는 아직 추가되지 않는다. `mcp-diagnostics.ts` 최상단 주석과 plan 문서 "범위 경계 (deferred, follow-up)" 항목에 이 경계가 명시적으로 문서화돼 있어 의도된 범위 축소이며 은폐된 누락이 아니다.
  - 제안: 조치 불필요 — 이미 plan 잔여 항목으로 추적 중. spec 본문이 §8.1 에서 "누적" 을 이미 약속하고 있으므로, 후속 PR 완료 전까지는 spec 이 이 부분에서도 여전히 앞서가 있다는 점만 재확인.

- **[INFO]** `McpErrorPhase` 의 `'initialize'` literal 이 현재 어떤 생산 코드에서도 사용되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `McpErrorPhase` union, `mcp-tool-provider.ts` `openServer` (connect 단계 실패를 전부 `'connect'` phase 로만 emit)
  - 상세: spec §8.2 `MCP_CONNECT_FAILED` 설명("SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움")과 정합 — 의도적으로 `'initialize'` 를 별도로 emit하지 않고 `'connect'` 로 흡수한다. 버그 아님, 향후 SDK 가 두 단계를 분리 노출하게 되면 쓸 자리로 타입에만 예약돼 있음.
  - 제안: 조치 불필요.

### 기능 완전성 / 엣지 케이스 / 에러 시나리오 검증 결과 (문제 없음)

- `finalizeMcpDiagnostics`: acc `undefined` → `undefined`, 모든 카운터·배열이 비어있으면(`attempted=false`) → `undefined` (lean 유지), 하나라도 있으면 `errors: []` 를 포함해 항상 안정된 shape 로 emit — spec §7.1 예시(`"errors": []`)와 일치. 테스트로 4가지 조합(빈 상태/summary+error+counter 혼합/summary만 있고 errors 빈 배열/counter 만 있는 경우) 모두 커버됨.
- `classifyMcpCall`: `mcp_` prefix 아닌 이름(kb_/render_/cond_) → `null`, `list_resources`/`list_prompts`(discovery) → `null`(미집계), `read_resource`/`get_prompt` → 각각 `resource_read`/`prompt_get`, 그 외 → `tool`. sid 에 `__` 가 없다는 전제 하에 첫 `__` 로 분리하는 로직이 `mcp_abcd1234__read_resource_x` 처럼 식별자가 정확히 일치하지 않으면 `tool` 로 폴백하는 것도 테스트로 고정됨.
- 실행 카운터는 `executeProviderToolBatch` 의 `toRun`(budget 내 실제 실행분) 루프에서만 증가하고 `truncated`(budget 초과분)에는 관여하지 않아 주석("실제 실행된(예산 미초과) 호출만 집계")과 구현이 일치.
- `McpToolProvider.openServer`: status precheck 실패/connect 실패/tools-list 실패 3개 지점 모두 `McpBuildPhaseError` 로 wrapping 후 outer catch 에서 `skipped` serverSummary + `errors[]` push 후 re-throw — `Promise.allSettled` 로 서버별 격리, 세션 close 부작용(연결 후 list 실패 시)도 유지됨. `TimeoutError` vs 일반 `Error` 분기로 `MCP_TIMEOUT` vs `MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 코드가 정확히 분류됨(테스트로 4가지 실패 시나리오 + 세션 close 검증 커버).
- 필드 rename(`mcpServerSummaries` → `mcpDiagnostics`, 타입 `McpServerSummary[]` → `McpDiagnosticsAccumulator`/`McpDiagnostics`)은 grep 확인 결과 backend 전역에 잔존 참조 없이 완전히 교체됐고, frontend 에는 아직 소비 코드가 없어 런타임 breaking 없음.
- `TimeoutError` 클래스: `Error` subclass 이므로 기존 `instanceof Error`/메시지 매칭 코드에 영향 없음. 메시지 포맷(`${label} timed out after ${ms}ms`)이 기존과 동일하게 유지되어 하위호환.
- 관련 unit test 3개 파일(`mcp-diagnostics.spec.ts`, `mcp-tool-provider.spec.ts`, `ai-turn-executor.spec.ts`) 실제 실행 결과 전부 통과 (59 + 27 tests green).

### TODO/FIXME
없음. `follow-up`/`deferred` 로 명시된 범위 경계(call-phase errors 미커버)는 plan 문서에 정식 추적 중이라 미완성 방치가 아님.

### 반환값
`finalizeMcpDiagnostics`/`classifyMcpCall`/`buildMcpDiagnosticsMeta` 모든 분기에서 명시적 반환(`undefined` 포함)이 있으며 falls-through 로 인한 암묵적 `undefined` 없음.

### 요약
이번 변경은 `plan/in-progress/spec-sync-mcp-client-gaps.md` 에 계획된 "타입 확장 cluster" 를 정확히 구현한다 — `mcpDiagnostics` 를 `McpServerSummary[]` 단일 배열에서 `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries`/`errors` 구조화 객체로 승격하고, `TimeoutError` 도입으로 timeout 여부를 robust 하게 판별해 `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 를 build-phase 실패에서 granular 하게 분류한다. 코드·테스트 모두 완결적이며 edge case(빈 acc, budget 초과 호출 미집계, discovery 메타도구 미집계, timeout vs 일반 에러 분기, 세션 close 부작용)를 정확히 커버하고, 실측 unit test 도 전부 통과했다. 유일한 간극은 spec 본문(`spec/5-system/11-mcp-client.md` §6.2/§8.2, `1-ai-agent.md` §7.1)이 아직 "미구현 (Planned)" 으로 남아있어 코드가 spec 을 앞서가는 SPEC-DRIFT 상태라는 점인데, 이는 이미 plan 체크리스트에 "spec 동기화" 미완료 phase 로 정확히 추적되고 있어 은폐된 결함이 아니라 정상적인 작업 순서상의 과도기다. call-phase errors[] 미커버 역시 plan 에 명시적으로 deferred 범위로 문서화돼 있다.

### 위험도
LOW
