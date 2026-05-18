# Testing Review — cafe24 expired self-healing

## 발견사항

---

### [WARNING] `Cafe24ApiClient.refreshTokenViaQueue` 에 대한 전용 단위 테스트 없음
- **위치**: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` L725-L257 / `cafe24-api.client.spec.ts`
- **상세**: 이번 PR 에서 신설된 `public refreshTokenViaQueue()` 메서드는 두 분기를 가진다. (1) `refreshQueue && refreshQueueEvents` 모두 존재 → `refreshViaQueue()` 경유, (2) 큐 미바인딩(테스트·간이 환경) → `refreshAccessToken()` 직접 호출. `cafe24-api.client.spec.ts` 의 `'queue-backed refresh'` 수트는 `call()` 의 proactive/reactive 경로를 검증하지만 `refreshTokenViaQueue()`를 직접 호출하는 케이스는 없다. 큐 미바인딩 폴백 경로, 및 `source='background'` vs `source='proactive'` 레이블 전달 여부가 검증되지 않는다.
- **제안**: `describe('refreshTokenViaQueue')` 수트를 추가해 (a) 큐 바인딩 시 `refreshViaQueue` 위임 + `source` 전달 확인, (b) 큐 미바인딩 시 `refreshAccessToken` 폴백 확인 두 케이스를 커버한다.

---

### [WARNING] `tryRecoverExpired` 의 "re-read 실패" 경로(lookup_failed 반환) 미테스트
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` L1190-L1200 / `cafe24-mcp-tool-provider.spec.ts`
- **상세**: `tryRecoverExpired` 는 refresh 성공 후 `integrationsService.getForExecution` 를 두 번째로 호출해 fresh row 를 가져온다. 이 두 번째 조회가 throw 할 경우 `{ kind: 'skipped', skipReason: 'lookup_failed' }` 를 반환한다. 현재 테스트의 `'pushes lookup_failed when integrations.getForExecution throws'` 케이스는 첫 번째 조회 실패만 커버하며, refresh 성공 후 두 번째 조회 실패는 별도 케이스가 없다.
- **제안**: `integrationsService.getForExecution.mockResolvedValueOnce(expiredRow)` 로 첫 조회를 통과시키고, `apiClient.refreshTokenViaQueue.mockResolvedValue(undefined)` 로 refresh 성공시킨 뒤, `.mockRejectedValueOnce(new Error(...))` 로 두 번째 조회를 실패시키는 케이스를 추가한다. `summaries[0].skipReason === 'lookup_failed'` 를 단언한다.

---

### [WARNING] `tryRecoverExpired` 의 비-AuthFailed 오류 경로 미테스트
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` L1182-L1187 / `cafe24-mcp-tool-provider.spec.ts`
- **상세**: `refreshTokenViaQueue` 가 `Cafe24AuthFailedError` 이 **아닌** 오류(네트워크 오류, `Cafe24TransportFailedError` 등)를 throw 할 때도 `{ kind: 'skipped', skipReason: 'expired_refresh_failed' }` 로 처리되도록 구현되어 있다. 현재 테스트는 `Cafe24AuthFailedError` throw 케이스만 있고 이 경로는 없다. 잘못된 오류 분류(예: `expired_no_refresh_token` 을 반환하는 회귀)가 탐지되지 않는다.
- **제안**: `apiClient.refreshTokenViaQueue.mockRejectedValue(new Error('ECONNRESET'))` 케이스를 추가하고 `skipReason === 'expired_refresh_failed'` 단언을 추가한다.

---

### [WARNING] `buildMcpDiagnosticsMeta` 헬퍼에 대한 직접 단위 테스트 없음
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L2089-L2094 / `ai-agent.handler.spec.ts`
- **상세**: `private static buildMcpDiagnosticsMeta()` 는 세 곳(단일 turn final, multi-turn turn 중간, multi-turn final)에서 호출된다. `summaries`가 `undefined`이거나 빈 배열(`[]`)이면 `undefined` 반환(omit), 비어있지 않으면 wrapping 하는 두 분기가 있다. `ai-agent.handler.spec.ts` 에서 `mcpDiagnostics` 나 `mcpServerSummaries` 키워드가 전혀 발견되지 않아 이 헬퍼의 동작이 핸들러 통합 수준에서 전혀 검증되지 않는다.
- **제안**: `ai-agent.handler.spec.ts` 에서 MCP provider mock 이 summaries 를 push 하는 케이스를 추가해 최종 meta 출력 오브젝트에 `mcpDiagnostics.serverSummaries`가 올바르게 포함되는지 단언한다. 빈 배열일 때 `mcpDiagnostics` 키 자체가 생략되는지도 확인한다.

---

### [WARNING] `isCafe24RefreshCapable` 의 `refresh_token` 빈 문자열(`""`) 엣지 케이스 미테스트
- **위치**: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` L278-L279 / `integration-expiry-scanner.service.spec.ts`
- **상세**: `isCafe24RefreshCapable` 는 `typeof rt === 'string' && rt.length > 0` 조건으로 빈 문자열을 refresh 불가로 처리한다. `cafe24-mcp-tool-provider.ts` 의 `tryRecoverExpired` 도 동일한 조건을 사용한다. 현재 테스트는 `refresh_token` 키 자체가 없는 경우("no refresh_token")만 커버하며, 빈 문자열(`refresh_token: ""`)인 경우가 양 파일 모두 테스트되지 않는다. 실제 운영 데이터에서 빈 문자열 저장 가능성이 있다.
- **제안**: scanner spec 과 mcp-tool-provider spec 양쪽에 `credentials: { access_token: 'a', refresh_token: '', mall_id: 'myshop' }` 케이스를 추가하고 각각 `expired` 격하 및 `skip` 결과를 단언한다.

---

### [WARNING] `mcpDiagnosticsAcc` 가 `mcpDiagnostics: undefined` 로 전달되는 경우(backward-compat) 테스트 없음
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` L702 / `cafe24-mcp-tool-provider.spec.ts`
- **상세**: `ProviderBuildCtx.mcpDiagnostics` 는 `optional`(`McpServerSummary[] | undefined`)이며, `pushMcpServerSummary` 는 `undefined` 수신 시 no-op 이 되도록 설계됐다. 그러나 `cafe24-mcp-tool-provider.spec.ts` 의 모든 신규 테스트는 명시적으로 `summaries` 배열을 제공한다. `mcpDiagnostics` 를 omit(undefined) 하고 buildTools 를 호출해도 정상 동작하는지(summaries push 시도가 조용히 무시됨, tool 등록은 정상)를 검증하는 케이스가 없다.
- **제안**: 기존 happy-path 테스트 한 건에서 `mcpDiagnostics` 를 제외한 호출을 추가해 throw 없이 동작하고 tools 가 반환됨을 단언한다.

---

### [INFO] `integration-expiry-scanner` spec 의 `savedExpired` 확인 로직이 중복·복잡하며 리팩터링 여지 있음
- **위치**: `integration-expiry-scanner.service.spec.ts` L100-L109, L185-L194
- **상세**: cafe24 refresh-capable 분기에서 `integrationRepo.save` 가 `expired` status 를 포함하지 않음을 단언하는 코드(`savedArgs.some(…)`)가 두 테스트에서 동일하게 중복 작성되어 있다. 가독성이 낮고 차후 assertion 확장 시 누락 위험이 있다.
- **제안**: `expectNoExpiredSave(integrationRepo)` 헬퍼 함수로 추출해 두 케이스와 향후 케이스에서 재사용한다.

---

### [INFO] multi-turn AI Agent 에서 매 turn 마다 `mcpDiagnosticsAcc` 가 갱신되는 동작 통합 테스트 없음
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1396, L1520, L1712
- **상세**: spec 문서(`spec/4-nodes/3-ai/0-common.md §7`)에 따르면 `mcpDiagnostics.serverSummaries[]` 는 노드 실행 단위로 1회 결정되며 turn 단위 delta 와 무관하다. 그러나 multi-turn 경로에서 각 turn 의 `mcpServerSummaries: mcpDiagnosticsAcc` 가 turn 마다 새로 구성된 배열을 사용하는지(turn 단위 갱신) 실제 통합 테스트가 없다. 이 동작은 spec 의 "turn 마다 재build" 기술과 맞물려 중요하다.
- **제안**: multi-turn 경로 케이스를 추가하되 첫 turn 과 두 번째 turn 에서 제공되는 `mcpServerSummaries` 가 각각 독립적임을 단언하거나, 최소한 turn debug history 의 해당 필드가 올바르게 포함되는지를 확인한다.

---

### [INFO] `pushMcpServerSummary` 헬퍼 자체에 대한 단위 테스트 없음
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` L2022-L2028
- **상세**: `pushMcpServerSummary` 는 단순하지만 `acc === undefined` 시 no-op, 아니면 push 를 수행하는 두 분기를 가진다. 현재 `mcp-diagnostics.ts` 에 대한 별도 테스트 파일이 없으며, 이 함수의 직접 단위 테스트는 `cafe24-mcp-tool-provider.spec.ts` 의 통합적 검증으로 간접 커버되는 수준이다. 향후 함수 로직이 바뀔 때 회귀를 빠르게 잡기 어렵다.
- **제안**: `mcp-diagnostics.spec.ts` 파일을 신설하거나 기존 파일 내에 `describe('pushMcpServerSummary')` 수트를 두어 `undefined` 입력 시 no-op, 정상 입력 시 push 되는 두 케이스를 직접 단언한다.

---

## 요약

이번 PR 은 cafe24 expired 자가 회복이라는 비즈니스 로직 변화에 대해 전반적으로 의미 있는 테스트를 추가했다. `integration-expiry-scanner.service.spec.ts` 에는 cafe24 + refresh_token 보유, 누락, enqueue 실패 3가지 핵심 케이스가 추가되었고, `cafe24-mcp-tool-provider.spec.ts` 에는 `tryRecoverExpired` 의 각 분기(install_timeout, no refresh_token, auth_failed, worker flip 미완료, connected summary, lookup_failed)를 잘 분리하여 커버하고 있다. 그러나 이번 PR 에서 신설된 `Cafe24ApiClient.refreshTokenViaQueue` 공개 메서드 자체의 전용 테스트가 없고, `tryRecoverExpired` 의 두 번째 조회 실패 경로와 비-AuthFailed 오류 경로가 미테스트 상태이며, 핸들러 수준에서 `buildMcpDiagnosticsMeta` / `mcpDiagnosticsAcc` 의 통합 동작이 검증되지 않는다는 커버리지 갭이 존재한다. 엣지 케이스로는 빈 문자열 `refresh_token` 과 `mcpDiagnostics` 미주입(undefined) 케이스가 누락되어 있다. 기존 테스트의 회귀 가드는 적절하며(서비스 타입 필터, dedup jobId 검증 등) 테스트 격리와 가독성은 양호하다.

## 위험도

MEDIUM
