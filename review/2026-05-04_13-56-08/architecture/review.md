## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** `HandlerDependencies` 인터페이스 — 인터페이스 분리 원칙(ISP) 위반 심화
- 위치: `node-component.interface.ts:249`
- 상세: `mcpClientService`가 `HandlerDependencies`에 추가됨으로써 MCP를 전혀 사용하지 않는 모든 노드 핸들러(Switch, Loop, HTTP 등 수십 개)가 `McpClientService` 의존성을 암묵적으로 주입받게 된다. 이미 `llmService`, `ragSearchService`, `knowledgeBaseService`, `integrationsService`가 혼재하여 "모든 것을 아는 의존성 가방"이 되어가고 있으며, 이번 변경으로 패턴이 더 굳어진다.
- 제안: `McpClientService`는 MCP를 실제로 사용하는 노드 컴포넌트(`ai-agent`)의 `createHandler` 팩토리 시그니처에서만 요구하는 별도 인터페이스(`McpCapableDeps`)로 분리하거나, 적어도 `HandlerDependencies`를 기본 의존성과 확장 의존성으로 나눠 선택적 합성 구조로 전환을 고려해야 한다.

---

**[WARNING]** `buildTools()` — 동일 `executionId`에 대한 동시 호출 시 race condition
- 위치: `mcp-tool-provider.ts` `materializeServer()` 내부
- 상세: `sessions.get(ref.integrationId)` 체크 후 `openServer()` 결과를 `sessions.set()`하기 전까지 원자성이 보장되지 않는다. 동일 `executionId`로 두 개의 `buildTools()` 호출이 거의 동시에 진입하면(멀티-턴 재개 + 새 노드 실행 등) 동일 서버에 두 개의 MCP 세션이 열릴 수 있고, 그 중 하나는 cleanup 경로에서 누락된다.
- 제안: `Map` 캐시 패턴의 표준 해법인 "연산 중임을 표시하는 Promise를 먼저 저장" 방식을 적용한다. `sessions.set(ref.integrationId, openServer(...))` 형태로 Promise 자체를 저장하고 `await`한 뒤 결과를 사용하면 중복 연결이 방지된다.

---

**[WARNING]** in-process 세션 캐시 — 수평 확장(horizontal scaling) 시 아키텍처 결함
- 위치: `mcp-tool-provider.ts:159` (`sessionsByExecution` Map)
- 상세: `McpToolProvider`가 싱글턴으로 동작하며 MCP 세션을 프로세스 메모리에 보관한다. 백엔드가 복수의 인스턴스로 확장될 경우, multi-turn 대화의 각 메시지가 다른 인스턴스로 라우팅되면 해당 인스턴스에는 세션이 없어 `MCP_UNKNOWN_TOOL`이 반환된다. 현재 스펙 주석(`// spec/5-system/11-mcp-client.md §4.3`)이 이 한계를 명시하는지 확인이 필요하다.
- 제안: 단기적으로는 sticky session 라우팅이나 단일 인스턴스 배포를 문서화하고, 중기적으로는 세션 재연결을 buildTools 시점에 투명하게 수행하는 구조(각 turn에서 config로부터 세션을 재생성)로 전환해야 한다. 현재 cleanup 후 재연결이 동작하도록 설계되어 있어 이 방향은 이미 절반 준비되어 있다.

---

**[WARNING]** `executionKey()` 의 `__default__` 폴백 — 묵시적 메모리 누수 경로
- 위치: `mcp-tool-provider.ts:278`
- 상세: `executionId`가 `undefined`일 때 `__default__`라는 단일 키로 모든 세션을 누적한다. 이 키에 대한 cleanup은 `AiAgentHandler`가 `finally` 블록에서 `cleanupProviders(context.executionId)`를 호출하는데, executionId가 없었다면 cleanup도 동일한 `__default__` 키로 지워야 한다. 현재 `cleanupProviders`는 `context.executionId`를 직접 넘기므로, 만약 executionId가 실제로 제공된다면 `__default__` 버킷의 세션은 절대 정리되지 않는다.
- 제안: `executionId`가 없는 경우를 방어적으로 처리하기보다, `executionId`를 required로 만들거나 없으면 `buildTools`를 early-return시키는 편이 안전하다. 또는 `__default__` 키를 완전히 제거하고 `executionId` 없는 호출은 세션 캐시 없이 매번 연결-해제하도록 처리할 수 있다.

---

**[INFO]** `shortIntegrationId()` — 8자 UUID 접두사 충돌 가능성
- 위치: `mcp-tool-provider.ts:88`
- 상세: Integration UUID의 앞 8자를 SID로 사용한다. UUID v4에서 앞 8자리가 충돌할 확률은 낮지만, 같은 워크스페이스에 두 개의 MCP Integration이 `aaaaaaaa-xxxx...`와 `aaaaaaaa-yyyy...` 형태로 등록되면 `execute()`의 `findEntryBySid()`가 잘못된 서버로 라우팅된다.
- 제안: SID를 16자로 늘리거나, 세션 맵을 SID가 아닌 전체 integrationId로 조회하는 방식으로 변경한다. tool name의 길이 제한이 문제라면 UUID를 Base62 인코딩하여 압축하는 방법도 있다.

---

**[INFO]** `withTimeout()` 함수 중복 — 공유 유틸리티 부재
- 위치: `mcp-tool-provider.ts:108`
- 상세: 코드 내 주석이 직접 "`McpTestConnectionService`에서 복제됨"이라고 명시하고 있다. 현재는 두 곳만이지만 MCP 관련 서비스가 늘어날수록 동일한 타임아웃 로직이 증식된다.
- 제안: `backend/src/modules/mcp/utils/with-timeout.ts` 등 공유 위치로 추출하여 하나의 구현을 참조하도록 한다. 현재 두 구현이 동일하므로 리팩토링 리스크가 낮다.

---

**[INFO]** `ProviderBuildCtx` / `ProviderExecCtx` 인터페이스 중복 구조
- 위치: `agent-tool-provider.interface.ts:52–70`
- 상세: 두 인터페이스가 `config`, `workspaceId`, `executionId?` 세 필드를 공유한다. 지금은 동일하며, 앞으로도 차이가 생길 근거가 명확하지 않다.
- 제안: 기반 인터페이스 `ProviderCtxBase`를 추출하고 `ProviderBuildCtx extends ProviderCtxBase`, `ProviderExecCtx extends ProviderCtxBase` 형태로 구성하면 향후 한 쪽에만 필드가 추가될 때 의도가 명확해진다.

---

**[INFO]** `McpServerRef` 타입 — 프론트엔드/백엔드 이중 정의
- 위치: `mcp-server-selector.tsx:14`, `ai-agent.schema.ts:26`
- 상세: 코드 주석이 이중 정의를 의도적이라고 명시하고 있으나, `enabledTools`, `includeResources`, `includePrompts`, `toolOverrides` 필드가 한 쪽에서 변경될 때 다른 쪽이 조용히 달라질 수 있다.
- 제안: 이중 정의 자체는 레이어 분리 측면에서 방어적 선택이나, 최소한 두 파일 모두에 상호 참조 주석(`// Mirror of McpServerRefSchema in ai-agent.schema.ts — keep in sync`)을 유지하고, 향후 공유 패키지(`@workflow/shared-types`)로 이관을 고려한다.

---

### 요약

이번 변경은 `AgentToolProvider` 인터페이스에 선택적 `cleanup` hook을 추가하고, `executionId` 기반 세션 캐시 격리를 통해 MCP 서버 통합을 비교적 깔끔하게 구현했다. Provider 패턴 확장, finally 블록 기반 생명주기 관리, `Promise.allSettled`를 이용한 서버 간 장애 격리는 올바른 설계 판단이다. 그러나 `HandlerDependencies` 인터페이스가 "의존성 가방"으로 계속 성장하는 ISP 위반이 구조적으로 누적되고 있으며, in-process 세션 캐시는 수평 확장 시 silent failure를 유발하는 아키텍처 제약으로 스펙 문서에 명시적으로 기록되어야 한다. `buildTools()`의 동시 호출 race condition과 `__default__` 폴백 키의 메모리 누수 경로는 프로덕션 부하에서 재현될 수 있으므로 우선 보완을 권장한다.

### 위험도
**MEDIUM**