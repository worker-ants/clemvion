### 발견사항

- **[WARNING]** `mcp-client.service.ts` 의 신규 `timedOut` 플래그/`TimeoutError` throw 분기 자체가 실제 abort 경로로 테스트되지 않음
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts` (connect, L269-296), `codebase/backend/src/modules/mcp/mcp-client.service.spec.ts`
  - 상세: 이번 diff 의 핵심 로직은 "connect timeout 이 `timedOut=true` 상태에서 abort → catch 에서 `TimeoutError` 로 재분류"인데, `mcp-client.service.spec.ts` 에는 실제 `setTimeout`/`AbortController` 경합을 트리거해 `connect()` 가 `TimeoutError` 를 throw 하는지 검증하는 테스트가 없다. 대신 `mcp-test-connection.service.spec.ts` 는 `TimeoutError` 를 직접 `new` 해서 `connect.mockRejectedValueOnce(new TimeoutError(...))` 로 주입 — 이는 하위 소비자(classify 로직)만 검증할 뿐, `mcp-client.service.ts` 자신이 언제 이 에러를 만들어내는지는 커버하지 않는다. 특히 "SDK/네트워크가 자체적으로 abort 신호를 보낸 경우(`timedOut=false`)에는 원본 err 를 그대로 throw" 하는 분기(else path)도 미검증.
  - 제안: `jest.useFakeTimers()` 로 `connectTimeoutMs` 를 경과시켜 `client.connect` 가 hang 하는 mock 을 걸고 실제로 `TimeoutError` 가 throw 되는지, `timedOut=false` 인 상태(예: SDK가 즉시 다른 에러로 reject)에서는 원본 에러가 그대로 전파되는지 각각 검증하는 유닛 테스트를 `mcp-client.service.spec.ts` 에 추가.

- **[WARNING]** `McpToolProvider` 메타도구(`list_resources`/`list_prompts`/`get_prompt`) 실패의 `mcpErrorDelta.phase` 매핑이 일부만 테스트됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1051-1066 (공용 catch, `META_PHASE` lookup), `mcp-tool-provider.spec.ts` L710-2109
  - 상세: `META_PHASE` 는 4개 메타도구(`list_resources`→`resources/list`, `read_resource`→`resources/read`, `list_prompts`→`prompts/list`, `get_prompt`→`prompts/get`)를 매핑하지만, spec 에는 `read_resource` 실패(`phase: 'resources/read'`) 케이스 1건만 `mcpErrorDelta` 를 단언한다. `list_resources`/`list_prompts`/`get_prompt` 실패 시 delta 의 `phase` 값이 실제로 올바른 문자열로 나오는지는 미검증 — lookup 테이블 오타(예: `resources/list` ↔ `resources/read` 스왑)가 있어도 현재 테스트 스위트가 잡지 못한다.
  - 제안: 4개 메타도구 각각에 대해 실패 케이스 + `mcpErrorDelta.phase` 단언을 추가하거나, 최소한 파라미터화된 테스트(`it.each`)로 테이블 전체를 순회 검증.

- **[INFO]** `finalizeMcpDiagnostics`/`McpErrorPhase` 타입 확장(`resources/list`, `prompts/list` 추가)에 대한 전용 유닛 테스트 부재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` (McpErrorPhase 유니온 확장), `mcp-diagnostics.spec.ts`
  - 상세: 순수 타입 추가라 런타임 로직 변경은 없으나, `mcp-diagnostics.spec.ts` 자체는 이 두 값을 전혀 참조하지 않는다. 위 WARNING 항목의 provider-레벨 테스트로 간접 커버되면 충분하므로 우선순위는 낮음.

- **[INFO]** `sanitizeMcpErrorMessage`/`redactMcpSecrets` 신규 유닛 테스트는 양호하나 몇 가지 엣지케이스가 비어있음
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.spec.ts`
  - 상세: redaction 정규식 5종(userinfo, Bearer, header, query/kv, 대소문자)과 clamp-boundary, null/non-Error 입력을 모두 커버해 엣지케이스 커버리지가 준수한 편이다. 다만 다음은 비어 있다: (1) 이미 redact 된 placeholder 문자열(`[redacted]`) 자체가 다시 매칭돼 재귀적으로 변형되지 않는지(idempotency), (2) 여러 secret 패턴이 한 문자열에 겹쳐 나타날 때(URL userinfo + query token 동시) 순서 의존적 상호작용, (3) `MCP_ERROR_MESSAGE_MAX_LEN` 정확히 경계값(off-by-one)에서의 clamp. 현재 테스트가 값진 회귀 방지 역할을 하지만 위 3가지는 정규식 유지보수 시 재발하기 쉬운 지점이라 추가할 가치가 있음.
  - 제안: 필수는 아니나 회귀 방지 차원에서 `it.each`로 3개 케이스 추가 검토.

- **[INFO]** `ai-turn-executor.spec.ts` 신규 테스트의 mock provider 는 실제 `AgentToolProvider` 구현체와 괴리 없이 인터페이스 계약(`execute` 반환값의 `mcpErrorDelta`)만 정확히 흉내내고 있어 적절함
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L291-368
  - 상세: choke point(`executeProviderToolBatch`)가 `execResult.mcpErrorDelta` 를 accumulator 로 push 하는 로직만 검증하는 좁은 범위의 테스트로, mock 이 실제 MCP provider 의 세부 로직(HTTP, SDK)에 의존하지 않아 격리가 잘 되어 있다. 다만 이 테스트가 "call-phase" 만 검증하고 있어 "build-phase(`buildTools` 중 push 되는 `mcpDiagnostics` 배열)와 call-phase(`errors[]`)가 동일 노드 실행에서 함께 나타날 때의 병합" 케이스는 별도로 없음 — 기존 `serverSummaries` 테스트와 조합된 통합 케이스가 있으면 회귀 방지에 더 유리하나 현재도 각 관심사가 분리 테스트되어 있어 크리티컬하지 않음.

- **[INFO]** Cafe24/Makeshop provider 의 `mcpErrorDelta` 테스트는 4xx(401) 케이스만 커버, 5xx(서버 에러) 및 `codeForStatus` 의 상태코드별 분기 경계는 미검증
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts` L698-1550, `makeshop-mcp-tool-provider.spec.ts` L568-1657
  - 상세: 두 provider 모두 `status === 'error'` 조건(`result.status >= 400`)에서 `mcpErrorDelta` 를 채우는데, 테스트는 각각 401(Cafe24)/404(Makeshop) 한 가지 상태코드만 검증한다. `codeForStatus` 자체의 상태코드 분기(예: 400 vs 401 vs 404 vs 500)에 따라 다른 코드 문자열을 반환할 가능성이 높은데(기존 로직 재사용이라 이번 diff 범위는 아니지만), delta 의 `code` 필드가 그 분기를 그대로 반영하는지 5xx 케이스로 최소 1건 더 검증하면 회귀 방지에 유리. 다만 `codeForStatus` 자체는 이번 diff 대상이 아니고 기존 테스트에서 이미 커버되었을 가능성이 있어 중대성은 낮음.

- **[INFO]** 테스트 가독성 및 명명 규약 양호
  - 위치: 전체 신규/변경 테스트 (`mcp-error-codes.spec.ts`, `mcp-test-connection.service.spec.ts`, `mcp-tool-provider.spec.ts`, `cafe24-/makeshop-mcp-tool-provider.spec.ts`, `ai-turn-executor.spec.ts`)
  - 상세: 한국어 `it()` 설명이 spec 섹션 번호(`§8.1`, `§8.2`, `§9`)를 명시적으로 인용해 의도-스펙 추적성이 뛰어나다. client-side vs server-side 실패의 구분(예: "client-side CAFE24_MISSING_FIELDS 는 mcpErrorDelta 를 보고하지 않는다")을 별도 케이스로 명시해 "무엇을 하지 않아야 하는가"까지 커버하는 좋은 패턴. Mock 도 `makeSession`/`makeCall` 헬퍼로 재사용되어 있고 실제 SDK 타입 서명과 어긋나지 않는다.

- **[INFO]** 테스트 격리는 전반적으로 양호
  - 상세: 검토한 모든 신규 테스트가 `beforeEach` 로 mock 을 새로 생성하고, `jest.fn().mockResolvedValueOnce`/`mockRejectedValueOnce` 를 사용해 테스트 간 상태 누수가 없다. `mcp-test-connection.service.spec.ts` 의 `Logger.prototype.warn` spy 는 각 테스트에서 `mockRestore()` 로 정리되어 있어 격리가 유지된다(단, 신규 추가된 두 timeout 테스트는 spy 를 사용하지 않아 해당 우려 없음).

### 요약
이번 변경은 MCP 클라이언트의 timeout 분류(`TimeoutError`→`MCP_TIMEOUT`), 에러 메시지 secret redaction, call-phase 실패의 `mcpErrorDelta` 누적이라는 3개 축을 다루며, 전반적으로 spec 섹션을 인용한 명확한 신규 테스트가 각 축마다 충실히 추가되어 있다(특히 `mcp-error-codes.spec.ts` 의 redaction 커버리지와 client-side/server-side 구분 테스트는 모범적). 다만 두 가지 실질적 커버리지 갭이 있다: (1) `mcp-client.service.ts` 자체의 신규 `timedOut` 플래그/abort 경합 로직이 실제 타이머 기반으로 검증되지 않고 하위 소비자에서만 `TimeoutError` 를 직접 생성해 주입하는 방식으로 우회 테스트되어 있어, connect 단계의 진짜 회귀(예: `timedOut` 플래그가 항상 false 로 남는 버그)를 잡지 못할 위험이 있다. (2) `McpToolProvider` 메타도구 4종 중 `read_resource` 하나만 `mcpErrorDelta.phase` 매핑이 검증되어 나머지 3종(`list_resources`/`list_prompts`/`get_prompt`)의 lookup 테이블 오류는 테스트로 걸리지 않는다. 두 갭 모두 CRITICAL 급 리스크는 아니며(로직이 단순하고 유사 경로가 이미 부분 검증됨), 저비용으로 보강 가능한 WARNING 수준이다.

### 위험도
LOW
