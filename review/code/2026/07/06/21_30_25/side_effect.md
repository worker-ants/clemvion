### 발견사항

- **[INFO]** `withTimeout` 반환 타입/거부값 변경 — 하위호환 유지되나 `instanceof` 판별 로직에 미묘한 의존 생김
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts` (신규 `export class TimeoutError extends Error`, `setTimeout` 콜백이 이제 `TimeoutError` 를 reject)
  - 상세: `withTimeout` 은 `McpClientService` 와 `McpToolProvider` 양쪽에서 쓰이는 공유 유틸이다. 기존에는 timeout 시 평범한 `Error` 를 reject 했는데, 이제 `TimeoutError`(여전히 `Error` 서브클래스)를 reject 한다. `message` 포맷(`${label} timed out after ${ms}ms`)은 그대로 보존되어 있어 message 문자열에 의존하던 기존 호출자는 영향이 없다. 다만 `withTimeout` 을 사용하는 다른 호출자(`McpClientService` 등)가 이 변경 전에는 몰랐던 `TimeoutError` 를 신설했으므로, 만약 다른 곳에서 `err.constructor === Error` 같은 엄격한 타입 체크를 하고 있었다면 (`instanceof Error` 가 아니라) 깨질 수 있다. 이번 diff 범위 안에서는 그런 엄격 체크가 발견되지 않았고, `McpToolProvider.openServer` 가 `err instanceof TimeoutError` 로 새 분기를 타는 쪽으로만 소비되므로 실제 파급은 낮다.
  - 제안: `McpClientService` 쪽에서도 이 `TimeoutError` 를 활용해 동일한 granular 분류를 적용할 계획이 있다면 후속 PR로 명시하면 좋겠다 (현재 diff 는 `McpToolProvider` 만 소비). 현재 변경 자체는 안전.

- **[INFO]** `ProviderBuildCtx` 인터페이스에 필드 추가(`mcpDiagnosticErrors`) — 기존 provider 구현체에 대한 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts`
  - 상세: `ProviderBuildCtx.mcpDiagnosticErrors?: McpDiagnosticError[]` 가 optional 필드로 추가됐다. `AgentToolProvider` 인터페이스 자체(메서드 시그니처)는 변경되지 않았고, `buildTools(ctx: ProviderBuildCtx)` 를 구현하는 다른 provider(`KbToolProvider` 등)는 이 필드를 참조하지 않으면 그만이므로 컴파일/런타임 영향 없음. `McpToolProvider` 만 이 필드를 읽어 `pushMcpDiagnosticError` 로 push 한다.
  - 제안: 없음 (안전한 additive 변경).

- **[INFO]** `mcpDiagnosticsAcc` 타입 변경 (`McpServerSummary[]` → `McpDiagnosticsAccumulator`) — 내부 전용 타입이라 외부 호출자 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`TurnOutputAccumulators.mcpDiagnosticsAcc`, `buildTools()` 시그니처의 `mcpDiagnostics?: McpDiagnosticsAccumulator` 파라미터)
  - 상세: `AiTurnExecutor` 는 클래스 내부 private 메서드/헬퍼 시그니처가 다수 바뀌었으나(`buildTools`, `buildMcpDiagnosticsMeta`, `TurnOutputAccumulators` 등) 전부 module-internal 이거나 private 이라 외부 호출자에 노출되지 않는다. 유일하게 외부에 노출되는 표면은 `meta.mcpServerSummaries` → `meta.mcpDiagnostics` 로의 **출력 키 이름 변경**이다 (`buildSingleTurnFinalOutput`/`buildMultiTurnFinalOutput`/`endMultiTurnConversation` 세 곳 모두 `mcpServerSummaries: mcpDiagnosticsAcc` → `mcpDiagnostics: mcpDiagnosticsAcc`). 이는 실행 엔진 output 스키마의 필드 rename 이며, 이 필드를 소비하는 프론트엔드/실행 히스토리 UI가 있다면 영향을 받는다. `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 예시가 이미 `mcpDiagnostics` (구조화 객체) 이름을 쓰고 있었다는 consistency-check WARNING #1 (cross_spec) 과 연결되며, plan(`spec-sync-mcp-client-gaps.md`)에 이 필드명 전환이 명시돼 있어 의도된 변경으로 보인다.
  - 제안: 프론트엔드/실행 히스토리 페이지가 과거 `meta.mcpServerSummaries` 키를 직접 참조하고 있었다면 이번 PR 과 함께 갱신이 필요하다 — grep 으로 확인 권장 (`grep -rn "mcpServerSummaries" codebase/frontend`). 코드 리뷰 관점에서는 이번 diff 는 backend 단독이라, 프론트엔드 소비처 동기화가 별도 후속으로 진행되는지만 확인하면 된다.

- **[INFO]** `ConversationThreadService.push` 호출부에서 `as ConversationTurnToolCall[] | undefined` 캐스트 제거 — 실질적 동작 변화 없음, 타입 정합성 개선
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`result.toolCalls as ConversationTurnToolCall[] | undefined` → `result.toolCalls`), `narrowResumeState`, `readExtractionWatermark(state)` 캐스트 제거 등
  - 상세: 이들은 순수 타입 단언 제거(런타임 값 불변, `z.custom` enrich 로 타입이 이미 명확해져 단언이 불필요해진 것)이며, spec/테스트 코멘트("M-7 enrich 회귀 가드")가 이를 뒷받침한다. 부작용 없음.

- **[INFO]** `mcp-diagnostics.ts` 의 `pushMcpServerSummary` 시그니처는 문서상 "accumulator 대상으로 변경" 언급이 있으나 실제 diff 에서는 `McpServerSummary[] | undefined` 그대로 유지됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` (`pushMcpServerSummary` 함수 시그니처), vs `plan/in-progress/spec-sync-mcp-client-gaps.md` "`pushMcpServerSummary(acc, entry)` 시그니처를 accumulator 대상으로 변경 (내부에서 `acc.serverSummaries.push`) → 기존 5개 provider 호출부 무변경"
  - 상세: 실제로는 `pushMcpServerSummary` 가 여전히 순수 `McpServerSummary[] | undefined` 를 받고, 호출부(`McpToolProvider`)가 `ctx.mcpDiagnostics`(이제 `mcpDiagnosticsAcc?.serverSummaries` 로 전달됨, `ai-turn-executor.ts` L3391 부근 `mcpDiagnostics: mcpDiagnostics?.serverSummaries`)를 넘긴다. 즉 함수 자체는 안 바뀌고 **호출자가 accumulator 의 sub-array 를 골라 넘기는 방식**으로 구현됐다 — plan 문서 서술("함수 시그니처를 accumulator 대상으로 변경")과 실제 구현("함수는 그대로, 호출자가 필드를 골라 전달")이 미묘하게 다르지만 최종 동작(5개 provider 호출부 무변경)은 plan 이 의도한 결과와 동일하다. 코드 동작상 문제는 없고, 문서(plan)와 실제 구현 간 서술 정밀도 차이일 뿐이다.
  - 제안: 실질적 부작용 아님. 굳이 정정한다면 plan 문서의 해당 문장을 "호출자가 accumulator.serverSummaries 를 넘기고, push 함수 자체는 무변경" 으로 다듬을 수 있으나 우선순위 낮음.

- **[INFO]** `classifyMcpCall` 의 새 파일시스템/네트워크/전역 상태 부작용 없음 — 순수 함수
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` (`classifyMcpCall`, `finalizeMcpDiagnostics`, `createMcpDiagnosticsAccumulator`, `pushMcpDiagnosticError`)
  - 상세: 모두 순수 함수이거나(`classifyMcpCall`, `finalizeMcpDiagnostics`) 인자로 전달된 로컬 accumulator 객체만 mutate 한다(`pushMcpServerSummary`, `pushMcpDiagnosticError`, counter 증가). 전역 변수·환경 변수·파일시스템·네트워크 호출 없음.

- **[INFO]** `mcp-tool-provider.ts` 의 `openServer` 실패 경로에서 세션 `close()` 부작용은 기존 동작 유지
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (tools/list 실패 시 `session.close().catch(() => undefined)` 후 `McpBuildPhaseError` 로 wrap 해 re-throw)
  - 상세: 기존에 있던 "연결 후 실패 시 세션 close" 부작용(SSE 누수 방지)은 새 `McpBuildPhaseError` wrapping 이후에도 동일하게 유지된다 (diff 상 `session.close()` 호출 위치·조건 불변, throw 되는 에러 타입만 `McpBuildPhaseError` 로 교체). 테스트(`mcp-tool-provider.spec.ts` "§8.2 tools/list 실패 → ... + 세션 close")로 회귀 고정됨.

- **[INFO]** 새 `McpBuildPhaseError` 클래스는 모듈-로컬(비-export) — 공개 API 표면에 추가되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`
  - 상세: `class McpBuildPhaseError extends Error` 는 export 되지 않고 파일 내부에서만 throw/catch 되며, 외부에서 발생하는 최종 에러(catch 블록에서 re-throw 되는 `err`)는 여전히 원본 타입이 아니라 `McpBuildPhaseError` 인스턴스로 바뀐다. 그러나 이 catch 블록의 바깥 소비자(`Promise.allSettled` 를 쓰는 caller, `openServer` 를 호출하는 곳)는 진단 정보(skipReason/serverSummary/errors[])만 확인하고 빈 `ToolDef[]` 로 격리하므로, 예외 타입 자체를 구체적으로 검사하는 하류 코드가 없다면 영향 없음. 확인 결과 `Promise.allSettled` 소비 지점은 값만 보고 reason 상세 타입을 검사하지 않는다.

- **[INFO]** 리뷰 산출물(`review/consistency/...`, `plan/in-progress/spec-sync-mcp-client-gaps.md`) 자체 파일 변경은 문서/추적 성격 — 코드 부작용 없음
  - 위치: `plan/in-progress/spec-sync-mcp-client-gaps.md`, `review/consistency/2026/07/06/20_59_31/*`
  - 상세: 이 diff 에 포함된 plan/consistency-check 산출물은 워크플로 규약(CLAUDE.md)에 따른 기록물이며 런타임 부작용과 무관. 다만 cross_spec checker 가 지적한 대로 `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 이 아직 갱신되지 않은 상태 — 이는 spec 문서 drift 이지 이번 backend 변경의 side effect 는 아니다.

### 요약
이번 변경은 MCP 진단 데이터 구조(`serverSummaries[]` → 구조화된 `McpDiagnostics` 객체)를 확장하는 리팩터링으로, 새로 도입된 상태(`McpDiagnosticsAccumulator`)는 매 노드/turn 실행마다 로컬로 생성·소유되는 인스턴스이며 전역 변수나 모듈 레벨 공유 상태를 만들지 않는다. `TimeoutError` 신설과 `withTimeout` 의 거부값 교체는 `Error` 서브클래스를 유지해 하위호환이며, `classifyMcpCall`/`finalizeMcpDiagnostics` 등 신규 helper는 순수 함수이거나 인자로 받은 로컬 객체만 mutate한다. 유일하게 실제로 파급력 있는 변경은 노드 실행 출력 meta 의 필드명이 `meta.mcpServerSummaries` → `meta.mcpDiagnostics` 로 바뀐 것인데, 이는 spec(`1-ai-agent.md` §7.1)이 이미 예고하고 있었고 plan 문서에 의도적으로 기록된 전환이다 — 다만 이 필드를 소비하는 프론트엔드/실행 히스토리 UI가 있다면 동기화 여부를 확인할 필요가 있다. `ProviderBuildCtx` 에 추가된 `mcpDiagnosticErrors` optional 필드는 기존 provider 구현체에 영향이 없는 additive 변경이다. 전반적으로 부작용 관점에서는 안전한 변경이며, CRITICAL/WARNING 급 문제는 발견되지 않았다.

### 위험도
LOW
