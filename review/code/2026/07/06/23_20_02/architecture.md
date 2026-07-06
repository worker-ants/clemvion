### 발견사항

- **[INFO]** `errorResult()` 포지셔널 파라미터 4개 중 3번째(`extra`)가 항상 `undefined` 로 skip 되는 호출부 존재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:1049` (`executeMeta` catch), `:483` 부근 (`this.errorResult(call.id, code, ..., undefined, {...})`)
  - 상세: `errorResult(toolCallId, code, message, extra?, errorDelta?)` 시그니처에 5번째 파라미터를 신설하면서 호출부가 `extra` 자리를 명시적 `undefined` 로 메워야 하는 상황이 반복된다. 포지셔널 optional 파라미터가 늘어날수록(현재 2개) 호출부 가독성이 떨어지고, 다음 필드 추가 시 또 한 자리가 밀린다.
  - 제안: `errorResult`를 `{ extra?, errorDelta? }` 형태의 options 객체 인자로 리팩터링하면 순서 의존 없이 확장 가능(개방-폐쇄 원칙 관점에서 유리).

- **[INFO]** `mcpErrorDelta` 적재 로직이 provider 4곳(McpToolProvider 2개 사이트, Cafe24, Makeshop)에 거의 동일한 형태로 중복
  - 위치: `mcp-tool-provider.ts` (`tools/call`/`executeMeta` 두 catch 블록), `cafe24-mcp-tool-provider.ts:519-527/570-577`, `makeshop-mcp-tool-provider.ts` 동일 패턴
  - 상세: "client-side 실패는 delta 미set, 서버측 실패만 set" 이라는 규칙이 각 provider 구현부에 주석으로만 명시되고 코드로 강제되지 않는다. 신규 provider 추가 시(예: 향후 3rd MCP bridge) 이 판별 로직을 다시 손으로 작성해야 하며, 실수로 client-side 에러에도 delta 를 채우는 회귀를 코드 리뷰 외에는 막을 방법이 없다.
  - 제안: `McpDiagnosticError` 생성 자체를 헬퍼(`buildCallPhaseErrorDelta(integrationId, phase, code, message, { isServerSide })`)로 뽑아 provider 들이 공통 호출하게 하면 정책이 한 곳에 응집된다. 지금은 여러 파일에 동일 의도의 코드가 복제되어 있어 DRY 위반 소지가 있다(현재 스케일에서는 CRITICAL 은 아님).

- **[INFO]** `AgentToolResult`/`ProviderBuildCtx`에 `*Delta` 필드가 계속 누적되는 확장 패턴 — 인터페이스가 점점 "여러 관심사의 합집합"이 되어가는 중
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` (`ragSourcesDelta`, `ragDiagnosticsDelta`, `mcpErrorDelta`, `presentationPayload`, `blockingFormRender`, `presentationSchemaViolation`, `presentationCall` 등 optional 필드 7개+)
  - 상세: `AgentToolProvider`/`AgentToolResult` 는 KB, MCP, render 세 가지 서로 다른 provider 계열의 diagnostics/side-channel 을 하나의 flat 인터페이스에 전부 optional 필드로 나열하는 구조다. 지금까지는 기존 패턴(`ragDiagnosticsDelta`)을 그대로 답습해 `mcpErrorDelta` 를 추가한 것이라 국소적으로는 일관성이 있으나, provider 종류가 늘어날 때마다 이 인터페이스가 계속 넓어지는 궤적이다(ISP 관점에서 provider 는 자신과 무관한 delta 필드들도 타입상 알아야 함).
  - 제안: 현 시점에 리팩터링을 요구할 정도는 아니지만, 다음 provider 계열 추가 시점에는 `AgentToolResult` 를 `{ base, diagnostics?: ProviderDiagnosticsDelta }` 형태로 판별 유니온화하거나 provider별 delta 를 하나의 `diagnosticsDelta: { rag?, mcp?, presentation? }` 로 묶는 것을 고려. 현재 변경분은 기존 컨벤션을 따른 것이므로 이번 PR 범위에서 강제할 사항은 아님.

- **[INFO]** `McpClientService.connect()` 의 `timedOut` 플래그 도입은 국소적이나 "AbortController 기반 하드 타임아웃"과 "`withTimeout` 기반 소프트 타임아웃" 두 가지 타임아웃 메커니즘이 계층에 공존
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts:269-296` (connect, AbortController), `mcp-tool-provider.ts`(`withTimeout` 사용, call/list 단계)
  - 상세: 코드 주석(`// This AbortController genuinely cancels the in-flight fetch (unlike withTimeout's soft deadline)...`)에서 이미 이 이원화를 인지하고 있고 의도적 설계로 명시되어 있다(fetch 취소 가능 여부 차이). 두 메커니즘 모두 최종적으로 `TimeoutError` 라는 공통 타입으로 수렴하도록 통일되어 있어(`connect` 실패 시 `TimeoutError` re-throw), 상위 소비자(`McpTestConnectionService`, `McpToolProvider`)는 `instanceof TimeoutError` 하나만 알면 되는 균일한 계약을 유지한다 — 이는 좋은 추상화 경계다. 다만 "connect 만 hard-abort, call/list 는 soft" 라는 비대칭이 향후 새 phase(예: `resources/list` 자체 hard timeout 필요)가 생기면 다시 판단해야 하는 지점이라 INFO 로 남긴다.
  - 제안: 현재는 문제 없음. 향후 새로운 타임아웃 지점을 추가할 때 이 두 전략 중 어느 쪽을 쓸지 결정 기준(주석에 있는 "fetch 취소 가능 여부")을 spec 이나 코드 주석에 더 명시적으로 재사용 가능한 가이드로 남기면 좋음.

- **[INFO]** `mcp-error-codes.ts` 의 `redactMcpSecrets` 정규식 체인이 순수 함수로 잘 분리되어 있고 단일 책임(레이어) 원칙을 지킴
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:456-480`
  - 상세: redaction 로직이 `sanitizeMcpErrorMessage` 라는 기존 sink 정규화 함수 내부에 흡수되지 않고 별도 export 함수로 분리되어, 단위 테스트(`mcp-error-codes.spec.ts`)가 독립적으로 검증 가능하다. 3개 sink(`errors[].message`/`IntegrationUsageLog.error`/`Integration.last_error`)가 전부 동일 `sanitizeMcpErrorMessage` 를 경유하므로 정책이 한 곳(single source of truth)에 응집되어 있다 — 아키텍처 관점에서 바람직한 구조. "redact 후 clamp" 순서(토큰이 clamp 경계에서 반쯤 노출되지 않도록)도 방어적으로 올바르게 배치됨.

- **[INFO]** call-phase 진단 파이프라인의 레이어 책임 분리가 명확함
  - 위치: `mcp-diagnostics.ts` (accumulator/타입 정의) → `agent-tool-provider.interface.ts` (delta 계약) → provider 구현체(`mcp-tool-provider.ts`/`cafe24-*`/`makeshop-*`, delta 생성) → `ai-turn-executor.ts:943-960` (choke point, accumulator push)
  - 상세: provider 는 accumulator 를 직접 알지 못하고 `mcpErrorDelta` 라는 값만 반환하며, executor 가 유일한 accumulate 지점(choke point)에서 push 한다. build-phase(`mcpDiagnosticErrors` ctx 경유 push)와 call-phase(`mcpErrorDelta` 반환값 경유 push)가 서로 다른 전달 경로를 쓰는 것이 처음엔 비대칭으로 보이지만, 이는 build 단계(provider 가 executor 호출 전에 여러 서버를 순회하며 직접 배열에 push 가능)와 call 단계(provider.execute 가 단일 호출 결과만 반환하는 기존 계약) 각각의 제어 흐름 차이에서 기인한 합리적 설계이며 주석에도 "대칭" 관계로 명시되어 있다. 결합도가 낮고 책임이 잘 나뉘어 있다.

### 요약
이번 변경은 기존에 확립된 패턴(`ragDiagnosticsDelta`, `pushMcpServerSummary`/`pushMcpDiagnosticError`, `TimeoutError` 단일 타입)을 그대로 답습해 call-phase 에러 누적, secret redaction, connect/test-connection 타임아웃 분류라는 세 가지 후속 작업을 낮은 결합도로 확장한 구조다. provider(비즈니스 로직) → interface(계약) → executor(누적 choke point) 의 레이어 분리가 유지되고, `McpDiagnosticError`/`TimeoutError` 같은 공유 타입을 통해 provider 구현체 간 순환 의존 없이 일관된 계약을 강제한다. 다만 `AgentToolResult`/`ProviderBuildCtx` 인터페이스가 provider 계열이 늘어날 때마다 optional delta 필드로 계속 넓어지는 궤적, `errorResult()` 의 포지셔널 파라미터 확장, 그리고 "서버측 vs client-side" 판별 로직이 provider 마다 복제되는 점은 향후 확장성 관점에서 가벼운 리팩터링 후보로 남을 만하나 이번 PR 범위에서 아키텍처적으로 차단할 사안은 없다.

### 위험도
LOW
