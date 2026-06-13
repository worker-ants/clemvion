# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `mcpDiagnostics` 배열 외부 뮤테이션 — 의도된 설계, 위험 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — `pushConnectedSummary()` 및 `openServer()` 내부 외부 catch 블록
- 상세: `pushMcpServerSummary(ctx.mcpDiagnostics, ...)` 는 호출자(핸들러)가 소유하고 `ProviderBuildCtx` 를 통해 주입한 배열을 직접 변이한다. 이는 KB `ragDiagnostics` 패턴과 동일한 설계로, `ProviderBuildCtx.mcpDiagnostics` 주석에 "provider 는 push 만" 이라고 명문화되어 있다. `pushMcpServerSummary` 는 `acc` 가 `undefined` 일 때 no-op 이므로 미주입 환경에서도 안전하다.
- 제안: 변경 불필요.

### [INFO] 재사용 세션(inflight 캐시 히트 경로)에서 `pushConnectedSummary` 중복 호출 가능성
- 위치: `mcp-tool-provider.ts` — `materializeServer()` 내 `if (existing)` 분기 및 inflight resolved 이후 경로
- 상세: `existing` 캐시 히트 시 `pushConnectedSummary` 를 즉시 호출한다. 같은 `executionId` + 같은 `integrationId` 로 `buildTools` 가 두 번 호출될 경우(테스트 "caches the session for reuse" 에서 검증됨), 두 번째 호출에서도 `connected` entry 가 한 번 더 push 된다. 의도인지 확인이 필요하다 — 첫 번째 `buildTools` 가 이미 push 했고 두 번째가 동일 세션을 재사용할 때 중복 push 가 발생한다.
- 상세(인과): `sessionsByExecution` 에 세션이 있으면 `existing` 이 truthy 하여 매번 push 된다. `mcpDiagnostics` 배열은 핸들러가 call 마다 새로 넘겨줄 수 있으므로 중복이 문제가 안 될 수도 있지만, 같은 배열을 재사용한다면 serverSummaries 에 같은 integrationId 가 두 번 나타난다.
- 제안: `buildTools` 시나리오를 확인할 것. 핸들러가 매 `buildTools` 호출 시 새 배열을 전달하면 무해. 같은 배열을 재사용한다면 `mcpDiagnostics.some(e => e.integrationId === entry.integrationId)` guard 가 필요하다. `pushMcpServerSummary` 자체에 중복 방어 추가를 고려할 수 있다.

### [INFO] `openServer` 내 외부 catch 에서 `integration.id` 접근 — 스코프 안전
- 위치: `mcp-tool-provider.ts` — `openServer()` 외부 catch 블록(라인 ~1819)
- 상세: 외부 try 는 `integration.status !== 'connected'` 체크부터 시작한다. `getForExecution` 는 이 try 블록 바깥에서 호출되므로, `integration` 변수는 외부 try 진입 전에 이미 resolve 된 상태다. 외부 catch 에서 `integration.id` 를 참조하는 것은 안전하다.
- 제안: 변경 불필요.

### [INFO] `openServer` 외부 catch 에서 `skipped` 를 push 하고 re-throw
- 위치: `mcp-tool-provider.ts` — `openServer()` 외부 catch 블록
- 상세: 외부 catch 는 skipped summary 를 push 한 뒤 `throw err` 한다. 호출자 `materializeServer` 는 `await pending` 으로 이 throw 를 전파하고, `buildTools` 의 `Promise.allSettled` 가 `rejected` 로 잡아 `logger.warn` 을 남긴다. 결국 같은 실패 서버에 대해 `mcpDiagnostics` 에는 `skipped` entry 가 push 되고 logger 에는 warn 이 남는다 — 두 경로가 모두 동작하므로 중복 기록이지만, 진단 배열과 로그는 용도가 달라 의도적 설계로 볼 수 있다.
- 제안: 변경 불필요. 다만 향후 `errors[]` 필드가 도입되면 logger.warn 과 진단 중 하나를 선택하거나 통합할 여지가 있다.

### [INFO] `as unknown as Parameters<typeof provider.buildTools>[0]` 타입 캐스팅 — 테스트 전용, 프로덕션 무영향
- 위치: `mcp-tool-provider.spec.ts` — 신규 테스트 2건 (§6.2 connect+list 성공, §6.2 connect 실패)
- 상세: 테스트에서 `mcpDiagnostics` 필드를 포함한 객체를 `ProviderBuildCtx` 로 넘기기 위해 이중 캐스팅을 사용한다. 이는 `ProviderBuildCtx` 가 `mcpDiagnostics?: McpServerSummary[]` 를 이미 선언하고 있으므로 캐스팅 없이도 타입이 맞아야 한다. 테스트 파일이 `McpServerSummary[]` 대신 `Array<Record<string, unknown>>` 를 선언했기 때문에 캐스팅이 필요해진 것으로, 런타임 동작에는 영향 없다.
- 제안: 테스트에서 `mcpDiagnostics: [] as McpServerSummary[]` 로 타입을 맞추면 캐스팅 불필요 — 가독성 개선이지만 필수 수정은 아니다.

### [INFO] 환경 변수 읽기 (`MCP_MAX_RESPONSE_BYTES`, `MCP_CALL_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CONNECT_TIMEOUT_MS`) — 기존 동작, 변경 없음
- 위치: `mcp-tool-provider.ts` — 모듈 최상위 상수 선언부
- 상세: 이 변경에서 환경 변수 읽기는 추가/제거되지 않았다. 기존 코드와 동일.
- 제안: 변경 불필요.

---

## 요약

이번 변경의 핵심 부작용은 `ProviderBuildCtx.mcpDiagnostics` 배열에 대한 의도된 외부 뮤테이션이다. 이 뮤테이션은 인터페이스에 명문화된 설계 계약이며 `pushMcpServerSummary` 가 `undefined` guard 를 내장하고 있어 안전하다. 새로운 전역 변수, 파일시스템 부작용, 네트워크 호출 추가, 환경 변수 변경, 공개 API 시그니처 변경은 없다. `AgentToolProvider.buildTools` 의 시그니처(`ProviderBuildCtx`)는 변경되지 않았으며 `mcpDiagnostics` 필드는 이미 선택(optional) 필드로 존재했다. 재사용 세션 경로(`existing` 캐시 히트)에서 동일 `buildTools` 호출 내 중복 push 가능성이 있으나, 핸들러가 매 `buildTools` 호출마다 새 배열을 제공하는 패턴이라면 무해하다 — 이 전제를 확인하거나 `pushMcpServerSummary` 에 중복 방어를 추가하면 완전히 안전해진다.

---

## 위험도

LOW
