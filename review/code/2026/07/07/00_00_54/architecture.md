### 발견사항

- **[INFO]** `errorResult()` 포지셔널 optional 파라미터가 5개까지 누적됨 (`extra?`, `errorDelta?`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:1096-1115` (`errorResult(toolCallId, code, message, extra?, errorDelta?)`), 호출부 `:482` (`this.errorResult(call.id, code, ..., undefined, {...})`)
  - 상세: 이번 diff 로 5번째 자리에 `errorDelta?: McpDiagnosticError` 가 추가되면서, `extra` 를 쓰지 않는 호출부는 `undefined` 를 명시적으로 채워야 한다. 개방-폐쇄 원칙 관점에서, 새 옵션이 추가될 때마다 기존 호출부를 건드리지 않고 확장하기 어려운 형태다(포지션이 늘어날수록 순서 착오 리스크도 커짐). 이미 직전 리뷰 라운드(`review/code/2026/07/06/23_20_02`, `23_40_32`)에서 동일 항목이 INFO 로 지적되었고 follow-up 백로그로 명시적으로 이연되어 있어 이번 PR 에서 새로 발견된 문제는 아니다.
  - 제안: 기존 제안대로 `errorResult(toolCallId, code, message, { extra?, errorDelta? })` 형태의 options 객체로 전환 — 이번 PR 필수 아님, 계속 백로그 유지 적절.

- **[INFO]** `mcpErrorDelta` 생성 로직이 provider 3~4곳(McpToolProvider 2 사이트, Cafe24, Makeshop)에 거의 동일 shape 로 반복
  - 위치: `mcp-tool-provider.ts` (`tools/call` catch, `executeMeta` catch), `cafe24-mcp-tool-provider.ts:516-533/567-575`, `makeshop-mcp-tool-provider.ts:516-533/565-573`
  - 상세: `{ integrationId, phase: 'tools/call', code, message }` 형태가 provider 별로 복붙되어 있고, "client-side 실패는 delta 미set" 규칙이 각 구현부 주석으로만 강제된다. 신규 MCP bridge provider 추가 시 이 판별 로직을 또 손으로 작성해야 하고, 실수로 client-side 에러에 delta 를 채우는 회귀를 컴파일러가 잡아주지 못한다. 이 역시 직전 리뷰(23_20_02/23_40_32)에서 이미 지적·백로그 등재된 사항이며 금번 diff 는 그 패턴을 그대로 답습(3rd provider 추가 없이 기존 2개 provider 에 동일 shape 적용)한 것이라 새로운 부채 유입은 아니다.
  - 제안: `buildCallPhaseErrorDelta(integrationId, phase, code, message)` 공통 헬퍼로 추출 — 기존 follow-up 백로그 유지가 합리적.

- **[INFO]** `AgentToolResult` 인터페이스가 provider 계열별 `*Delta` optional 필드로 계속 확장되는 궤적 (ISP 관점)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts:117-128` (`ragSourcesDelta`, `ragDiagnosticsDelta`, 신규 `mcpErrorDelta`)
  - 상세: 금번 diff 는 기존 `ragDiagnosticsDelta` 패턴을 그대로 답습해 `mcpErrorDelta` 를 추가한 것으로 국소적 일관성은 유지되나, RAG/MCP/render 세 계열 provider 의 side-channel 필드가 하나의 flat 인터페이스에 계속 합류하는 구조다. 모든 provider 구현체가 자신과 무관한 delta 필드 타입까지 알아야 하는 형태(ISP 미준수 여지)지만, optional 필드라 실질적 결합 비용은 낮다.
  - 제안: 당장 조치 불요. provider 계열이 하나 더 늘어나는 시점에는 `diagnosticsDelta: { rag?, mcp?, presentation? }` 같은 판별 유니온화를 고려할 만하나 이번 PR 범위 밖.

- **[INFO]** `McpClientService.connect()` 의 hard AbortController 타임아웃과 `withTimeout` 소프트 타임아웃이 계층에 공존하되 `TimeoutError` 로 수렴하는 설계는 견고한 추상화 경계
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts:269-296` (connect, `timedOut` 플래그 + `abort.abort()`), `mcp-tool-provider.ts` (`withTimeout` 사용, call/list 단계)
  - 상세: connect 단계는 in-flight fetch 를 실제로 취소해야 하므로 AbortController(hard) 를, call/list 단계는 `withTimeout` 소프트 데드라인을 쓰는 비대칭 설계이나, 두 경로 모두 최종적으로 동일한 `TimeoutError` 타입으로 정규화되어 상위 소비자(`McpTestConnectionService`, `McpToolProvider`)는 `instanceof TimeoutError` 하나만 알면 되는 균일 계약을 유지한다. `timedOut` boolean 클로저로 "우리 데드라인 vs SDK/네트워크 자체 abort" 를 구분하는 방식도 의도가 주석에 명확히 남아 있다. 결합도가 낮고 실패 분류 책임이 한 곳(각 계층의 경계)에 응집되어 있다.
  - 제안: 조치 불요. 향후 새로운 타임아웃 지점 추가 시 두 전략 중 선택 기준을 spec/주석에 좀 더 재사용 가능한 가이드로 남기면 좋음(경미).

- **[INFO]** call-phase 진단 파이프라인의 레이어 책임 분리가 명확 — provider → interface 계약 → executor choke point
  - 위치: `mcp-diagnostics.ts`(accumulator/타입) → `agent-tool-provider.interface.ts`(`mcpErrorDelta` 계약) → provider 구현체(delta 생성) → `ai-turn-executor.ts:943-960`(choke point, accumulator push)
  - 상세: provider 는 accumulator 를 직접 참조하지 않고 값(`mcpErrorDelta`)만 반환하며, executor 가 유일한 누적 지점에서 push 한다(build-phase 의 `ctx.mcpDiagnosticErrors` 직접 push 방식과는 경로가 다르지만, control-flow 차이에서 기인한 합리적 비대칭으로 주석에도 근거가 명시됨). provider 구현체 간 순환 의존은 없으며, `McpDiagnosticError`/`TimeoutError` 라는 공유 타입을 통해 provider 들이 executor 나 서로를 몰라도 되는 낮은 결합도를 유지한다.
  - 제안: 조치 불요 — 아키텍처 관점에서 우수한 사례로 특기.

- **[INFO]** `redactMcpSecrets` 가 MCP 전용 패턴만 로컬 정의하고 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)를 재사용하는 구조는 SoT 파편화를 피한 바람직한 설계
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:280,300-329`
  - 상세: MCP 모듈이 URL userinfo·bare query token 등 자신만의 케이스만 `MCP_EXTRA_SECRET_PATTERNS` 로 얹고, bearer/labelled secret 등 범용 패턴은 공용 모듈에서 그대로 가져와 적용한다. 이는 단일 책임(모듈은 자신의 도메인 특수 패턴만 소유)과 중복 방지(SoT) 를 동시에 만족하는 설계로, 향후 다른 모듈이 같은 방식을 벤치마크하기 좋은 선례다.
  - 제안: 조치 불요.

### 요약
이번 변경분은 앞선 리뷰 라운드(`review/code/2026/07/06/23_20_02`, `23_40_32`)에서 이미 지적·백로그로 이연된 아키텍처 개선 후보(`errorResult` positional 파라미터, provider 간 `mcpErrorDelta` 생성 중복, `AgentToolResult` optional 필드 누적)를 그대로 답습하는 선에서 4개 후속 항목(call-phase errors[] 누적, secret redaction, spec Rationale/코드 prefix, connect/test-connection TimeoutError 소비)을 구현한 것으로, 신규로 유입된 구조적 문제는 없다. provider(비즈니스 로직) → interface(계약) → executor(누적 choke point) 레이어 분리와 `TimeoutError`/`McpDiagnosticError` 공유 타입을 통한 낮은 결합도는 일관되게 유지되며, redaction 로직도 공용 SoT 를 재사용해 파편화를 피했다. 순환 의존, 레이어 책임 붕괴, 안티패턴은 발견되지 않았고, 남아있는 INFO 항목들은 모두 이미 인지되어 follow-up 백로그로 명시적으로 이연된 경미한 확장성 개선 후보다.

### 위험도
LOW
