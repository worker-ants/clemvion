# 요구사항(Requirement) 리뷰 — mcpDiagnostics 구조화 객체 승격 + build-phase granular error codes

## 발견사항

- **[INFO]** call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패는 `mcpDiagnostics.errors[]` 에 여전히 누적되지 않음 (build-phase 만 커버)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (execute 경로, `MCP_CALL_FAILED` 는 `tool_result.error` 로만 표면화), `spec/5-system/11-mcp-client.md` §6.2 "잔여 (Planned)" / §8.1 표
  - 상세: 이번 PR 의 3개 신규 코드(`MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`)는 모두 buildTools(connect/tools-list) 단계 실패만 다룬다. call 단계 실패는 `tool_result` + `IntegrationUsageLog`(§8.3) 로 이미 표면화되고 있어 사용자에게 완전히 안 보이는 것은 아니나, spec §6.2/§8.1 이 명시하는 "call 단계도 errors[] 에 누적" 목표 모델과는 아직 간극이 있다.
  - 판단: spec 본문이 이 간극을 "잔여 (Planned)" 로 명시적으로 인정하고 `plan/in-progress/spec-sync-mcp-client-gaps.md` 에 follow-up 으로 추적 중이므로 **의도된 범위 축소** — CRITICAL/WARNING 아님. 코드 fix 대상 아님.
  - 제안: 조치 불필요(코드), follow-up PR 로 계속 추적.

- **[INFO]** `McpErrorPhase` 의 `'initialize'` literal 이 현재 프로덕션 코드 경로에서 실제로 emit 되지 않음 (connect 단계 실패는 모두 `phase: 'connect'` 로 emit)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `McpErrorPhase` 타입 정의; `mcp-tool-provider.ts` `openServer()` 의 connect try/catch
  - 상세: spec §8.1 vocabulary 에 `initialize` 단계가 별도로 정의돼 있으나, MCP SDK 가 connect 와 initialize RPC 를 하나의 호출로 묶어 처리하므로 코드에서 두 단계를 분리하지 못한다. spec §8.2 의 `MCP_CONNECT_FAILED` 설명(“SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움”)이 이 제약을 이미 문서화하고 있어 spec 과 코드가 정합한다.
  - 제안: 조치 불필요 — 타입에 `initialize` literal 을 남겨두는 것은 향후 SDK 가 분리 지원 시 대비한 의도된 설계로 보임.

- **[INFO]** `finalizeMcpDiagnostics` 의 `attempted` 파생 로직이 spec §6.2 문구("serverSummary·error·counter 중 하나라도 있으면 true")와 정확히 line-level 일치
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts:596-602` vs `spec/5-system/11-mcp-client.md:359`
  - 상세: `acc.serverSummaries.length > 0 || acc.errors.length > 0 || acc.toolCalls > 0 || acc.resourceReads > 0 || acc.promptGets > 0` — spec 문구와 완전히 대응. `errors` 는 비어도 항상 `[]` 로 emit (spec §7.1 예시가 `"errors": []` 를 명시 — 코드도 `finalizeMcpDiagnostics` 에서 `errors: acc.errors` 로 무조건 포함, 테스트 `mcp-diagnostics.spec.ts` "errors 는 비어도 항상 [] 로 포함" 로 검증됨). 문제 없음, spec fidelity 확인.

- **[INFO]** `classifyMcpCall` 의 tool-name 분류 규칙이 spec §5.2 naming convention(`mcp_<sid>__<identifier>`, 첫 `__` split, 예약어 `read_resource`/`get_prompt`/`list_resources`/`list_prompts`) 과 정확히 일치
  - 위치: `mcp-diagnostics.ts:570-582` vs `spec/5-system/11-mcp-client.md:219-232`
  - 상세: `list_resources`/`list_prompts` → discovery 로 미집계(`null`) 처리가 spec §6.2 "discovery 메타도구는 미집계 (§8.3 의 usage 로그 제외와 정합)" 문구와 일치. `mcp_` prefix 아닌 이름(`kb_`/`render_`/`cond_`) → `null` 처리도 타 provider 네임스페이스와 충돌 없음을 보장. 문제 없음.

- **[INFO]** `openServer()` 의 에러 분류/누적 제어 흐름 — status precheck 실패, connect 실패, tools/list 실패 3개 지점이 각각 정확한 phase/code 로 분류되고 이중 래핑 방지(`err instanceof McpBuildPhaseError` 가드)가 존재
  - 위치: `mcp-tool-provider.ts:655-777`
  - 상세: status precheck(비-connected) → `phase:'connect', code:CONNECT_FAILED`; connect 실패 → `TimeoutError` 판정으로 `TIMEOUT` vs `CONNECT_FAILED` 분기; tools/list 실패 → 동일하게 `TIMEOUT` vs `LIST_FAILED` 분기, 세션 close 후 재throw. 바깥 catch 는 `McpBuildPhaseError` 인스턴스면 그 phase/code 를 쓰고, 아니면 방어적 기본값(`connect`/`CONNECT_FAILED`)으로 fallback — 이 fallback 경로는 현재 도달 불가능해 보이나(모든 throw 지점이 McpBuildPhaseError 로 래핑됨) 안전한 방어적 설계로 문제 없음. `mcp-tool-provider.spec.ts` 의 신규 4개 테스트(§8.2 connect 실패/타임아웃/list 실패/list 타임아웃/status precheck)가 각 분기를 모두 커버.

- **[INFO]** spec 문서 갱신 상태 — 본 PR 은 코드와 함께 `spec/5-system/11-mcp-client.md` §6.2/§8.1/§8.2, `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 을 같은 diff 로 동기화 완료 (spec write 는 project-planner 소관 원칙에 따라 `plan/in-progress/spec-update-mcp-client-diagnostics.md` draft 경유). §7.1 예시 JSON 이 executor 의 실제 emit shape 및 신규 테스트 assertion 과 필드 단위로 정확히 일치 (`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`). 이전 회차 리뷰(`review/code/2026/07/06/21_30_25/SUMMARY.md`)에서 지적된 SPEC-DRIFT(WARNING 1, spec 이 "미구현"으로 낡음)는 본 diff 에 포함된 spec 갱신으로 이미 해소됨 — RESOLUTION.md 에도 "해소" 로 기록.
  - 판단: SPEC-DRIFT 아님 (이미 반영 완료). 잔여 Planned 항목(call-phase errors[], §3.3 캐시)도 spec 본문에 명시적으로 남아 실제 구현 상태와 정합.

- **[INFO]** `TimeoutError` 도입이 `with-timeout.ts` 의 기존 계약(하위호환: 여전히 `Error` subclass, message 포맷 불변)을 지키면서 granular 분류를 가능케 함 — `McpClientService` 는 아직 이 분류를 소비하지 않으나(§9 연결 테스트 경로는 별도), 이는 plan 에 follow-up 으로 명시된 의도된 범위 제한.
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 판단: 문제 없음, 조치 불필요.

## 요약

`mcpDiagnostics` 를 단일 `serverSummaries[]` 배열에서 spec §6.2 가 정의하는 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`)로 승격하는 변경으로, 신규 타입·helper(`finalizeMcpDiagnostics`/`classifyMcpCall`/`pushMcpDiagnosticError`)와 build-phase(`connect`/`tools/list`) granular 에러 코드(`MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`) 분류가 spec 본문과 필드명·값·파생 로직 수준에서 정확히 일치하며, 관련 spec 문서(`11-mcp-client.md` §6.2/§8.1/§8.2, `1-ai-agent.md` §7.1)도 같은 PR 에서 동기화되어 이전 리뷰가 지적한 SPEC-DRIFT 가 이미 해소된 상태다. 에러 분류 제어 흐름(status precheck/connect/tools-list 3개 실패 지점)은 이중 래핑 방지 가드까지 갖춰 견고하고, `classifyMcpCall` 의 tool-name 파싱 규칙도 spec §5.2 naming convention 과 정확히 대응한다. call-phase(`tools/call` 등) 실패의 `errors[]` 미누적은 spec 이 "잔여 (Planned)" 로 명시하고 plan tracker 에 follow-up 으로 기록된 의도된 범위 축소이며 실사용자 영향은 `tool_result`/`IntegrationUsageLog` 로 이미 완전히 커버되므로 결함이 아니다. TODO/FIXME 성 미완성 주석 없음, 반환값 누락 경로 없음(모든 분기가 `ServerEntry`/`null`/`throw` 3종 계약을 지킴), 192개 관련 테스트 전부 통과 확인. CRITICAL/WARNING 급 요구사항 결함 없음.

## 위험도
NONE
