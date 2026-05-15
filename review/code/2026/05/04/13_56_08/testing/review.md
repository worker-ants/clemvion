### 발견사항

---

**[WARNING] `withTimeout` 경로가 전혀 테스트되지 않음**
- 위치: `mcp-tool-provider.ts` — `withTimeout()`, `mcp-tool-provider.spec.ts` 전체
- 상세: `listTools`, `callTool`, `listResources/Prompts` 등 모든 외부 호출에 timeout이 걸려 있지만, 타임아웃이 실제로 발동되는 케이스가 단 하나도 없음. 타이머 미정리(dangling timer)나 reject 누락 같은 버그가 있어도 발견 불가.
- 제안: `jest.useFakeTimers()`로 `callTool`이 응답하지 않는 세션을 만들고, `jest.advanceTimersByTime(CALL_TIMEOUT_MS + 1)`로 타임아웃 발동을 검증하는 케이스 추가.

---

**[WARNING] `toConnectParams` — `api_key` / `none` authType 미검증**
- 위치: `mcp-tool-provider.ts:toConnectParams()`, `mcp-tool-provider.spec.ts`
- 상세: `makeIntegration()`이 항상 `authType: 'bearer_token'`을 사용하므로, `api_key` 브랜치(headerName, value)와 `none` 폴백은 한 번도 실행되지 않음. 파라미터 매핑 오류가 있어도 테스트를 통과함.
- 제안: `makeIntegration({ authType: 'api_key', credentials: { url: '...', header_name: 'X-Key', value: 'v' } })` 케이스와 `authType: 'none'` 케이스를 각각 `buildTools` 테스트로 추가.

---

**[WARNING] 메타 툴 성공 경로 — `read_resource`, `list_prompts`, `get_prompt` 미커버**
- 위치: `mcp-tool-provider.spec.ts` — `execute > meta tools` 섹션
- 상세: `list_resources` 성공 경로만 검증되고, 나머지 세 메타 툴은 오류 케이스(인자 누락)만 테스트됨. `readResource`, `listPrompts`, `getPrompt`의 정상 응답 직렬화 로직이 검증 안 됨.
- 제안: 각 메타 툴에 대해 인자가 유효할 때 세션 메서드가 호출되고 응답이 올바르게 직렬화되는 성공 케이스를 추가.

---

**[WARNING] `AiAgentHandler`의 새 cleanup 경로가 테스트되지 않음**
- 위치: `ai-agent.handler.ts` — `execute()` finally 블록, `processMultiTurnMessage()` finally 블록, `cleanupProviders()`
- 상세: 핸들러 레벨에서 `cleanupProviders`가 성공/실패 양쪽 경로에서 항상 호출되는지, multi-turn 일시중단(`waiting_for_input`) 직후에 cleanup이 실행되는지를 검증하는 테스트가 없음. `execution-engine.service.spec.ts`는 `connect: jest.fn()`만 mock하고 핸들러 실행을 직접 테스트하지 않음.
- 제안: `ai-agent.handler.spec.ts`에 "execute 중 예외 발생 시에도 cleanupProviders 호출 확인" 케이스와 "waiting_for_input 반환 후 cleanup 호출 확인" 케이스를 추가.

---

**[WARNING] SID 충돌(collision) 케이스 미테스트**
- 위치: `mcp-tool-provider.ts:shortIntegrationId()`, `findEntryBySid()`
- 상세: `integrationId`의 앞 8자만 잘라 SID를 만드는데, `aaaaaaaa-1111-...`과 `aaaaaaaa-2222-...`처럼 앞 8자가 같은 두 Integration이 동시에 등록되면 `execute()`에서 잘못된 세션으로 라우팅됨. 이 시나리오가 전혀 테스트되지 않아 실제 충돌 시 동작이 불명확함.
- 제안: 앞 8자가 동일한 두 Integration으로 `buildTools`를 호출한 뒤 각각에 대해 `execute`가 올바른 세션을 찾는지(또는 오류를 반환하는지) 검증하는 케이스 추가. 설계 수준에서 SID 길이를 늘리거나 전체 ID 비교로 전환하는 방안도 검토 필요.

---

**[WARNING] `executionId` 미제공(undefined → `__default__`) 케이스 미테스트**
- 위치: `mcp-tool-provider.ts:executionKey()`, `mcp-tool-provider.spec.ts`
- 상세: `executionId`가 없을 때 `'__default__'` 버킷으로 폴백하는 경로는 주석으로만 설명되고, 테스트에서 `executionId`를 생략하는 케이스가 한 건도 없음. `cleanup({ executionId: undefined })`가 전체 세션을 지우는 동작도 검증 안 됨.
- 제안: `buildTools({ config: {...}, workspaceId: 'ws-1' })`(executionId 없음)로 연결 후 `cleanup({ })`을 호출해 세션이 닫히는지 확인하는 테스트 추가.

---

**[INFO] `McpServerSelector` 프론트엔드 컴포넌트 테스트 부재**
- 위치: `mcp-server-selector.tsx`
- 상세: 서버 추가/제거, `includeResources`/`includePrompts` 토글, 빈 상태 메시지 분기, picker 열기/닫기 등 UI 로직이 있지만 컴포넌트 테스트(RTL 등)가 없음. `KbSelector`와 같은 기존 selector 컴포넌트에 테스트가 있다면 일관성 문제.
- 제안: React Testing Library로 `add`, `remove`, `patch` 기본 시나리오와 "all servers attached" 메시지 표시 케이스 추가.

---

**[INFO] `execution-engine.service.spec.ts` mock — `mcpClientService` 전달 검증 없음**
- 위치: `execution-engine.service.spec.ts:258`
- 상세: `McpClientService`가 `ExecutionContextService` 생성 시 컨텍스트에 실제로 주입되는지 확인하는 assertion이 없음. mock 추가는 DI 오류를 방지하는 역할만 함.
- 제안: 현행 테스트 범위 내에서 실행 컨텍스트 생성 후 `context.mcpClientService`가 mock 인스턴스와 동일한지 확인하는 assertion 한 줄 추가.

---

### 요약

`mcp-tool-provider.spec.ts`는 matcher, 빌드/실행/정리 라이프사이클, 오류 격리, idempotency 등 핵심 경로를 폭넓게 커버하는 우수한 테스트로, 전체 구조는 탄탄하다. 그러나 타임아웃 발동 경로가 완전히 비어 있고, `api_key`/`none` authType·메타 툴 성공 경로·SID 충돌이 미검증 상태이며, 핸들러 레벨의 새 cleanup finally 블록에 대한 테스트가 없어 실제 운영 환경에서의 자원 누수나 잘못된 세션 라우팅 버그를 잡지 못할 위험이 있다.

### 위험도

**MEDIUM**