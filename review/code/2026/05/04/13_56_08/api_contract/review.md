### 발견사항

- **[WARNING]** `HandlerDependencies` 인터페이스에 `mcpClientService` 필드가 필수 속성으로 추가됨
  - 위치: `node-component.interface.ts:249`
  - 상세: `HandlerDependencies`는 모든 NodeComponent의 `createHandler(deps)` 팩토리가 공유하는 런타임 의존성 계약이다. 기존 커스텀 노드 구현체 개발자(외부 플러그인, 서드파티 확장 등)는 이 필드를 타입 레벨에서 요구받게 된다. 런타임에는 주입이 보장되므로 실행 오류는 없지만, TypeScript 계약 변경으로 컴파일 에러를 유발할 수 있다.
  - 제안: 단기적으로는 `mcpClientService?: McpClientService` optional로 선언하거나, 변경 로그에 breaking change로 명시한다.

- **[WARNING]** 8자 Short ID(SID) 충돌 가능성
  - 위치: `mcp-tool-provider.ts` — `shortIntegrationId()`, `findEntryBySid()`
  - 상세: `integrationId`(UUID)의 앞 8자를 SID로 사용하고, `findEntryBySid`는 이 SID로 세션을 탐색한다. UUID v4 기준 앞 8 hex 문자(`xxxxxxxx`)가 동일한 두 Integration이 같은 execution에 등록될 경우 `findEntryBySid`가 첫 번째 매칭 항목을 반환하므로 잘못된 서버로 tool call이 라우팅될 수 있다. `mcpToolName`이 생성하는 LLM 노출 이름도 동일하게 충돌한다.
  - 제안: SID 길이를 12~16자로 늘리거나, `sessionsByExecution` 조회 시 `integrationId` 전체 값을 세션 맵 키로 직접 사용하고 `parseMcpToolName`의 역방향 조회를 별도 인덱스로 관리한다.

- **[WARNING]** 프론트엔드-백엔드 `McpServerRef` 타입 동기화 보장 없음
  - 위치: `mcp-server-selector.tsx:14-22` vs `ai-agent.schema.ts:27-59`
  - 상세: `McpServerRef` 인터페이스가 프론트엔드에 복사 선언되어 있다. 의도는 커플링 방지이나, 백엔드 스키마의 `mcpServerRefSchema`에 필드 추가/제거 시 프론트엔드 타입이 자동으로 반영되지 않는다. 특히 `toolOverrides` 배열의 서브 스키마가 백엔드와 프론트엔드 모두 수동 관리 대상이다.
  - 제안: `packages/` 공유 레이어에 타입을 단일 정의하거나, 백엔드 JSON Schema 엔드포인트(`GET /nodes/definitions`)를 통해 런타임에 스키마를 주입하는 현재 패턴을 일관되게 유지하고 프론트엔드 로컬 타입을 제거한다.

- **[INFO]** `executionId` 미제공 시 `__default__` 버킷으로 폴백
  - 위치: `mcp-tool-provider.ts` — `executionKey()`
  - 상세: `executionId`가 없으면 모든 세션이 `__default__` 키 하나를 공유한다. 동시 실행 중인 두 AI Agent가 모두 `executionId`를 전달하지 않을 경우 세션 맵이 혼재되고, 한쪽의 `cleanup`이 다른 쪽의 세션을 닫을 수 있다. 현재 코드 경로에서는 `executionId`가 항상 전달되지만, 향후 다른 호출 경로가 생길 때 무음 버그가 될 수 있다.
  - 제안: `executionId`가 없을 때 warn 로그를 남기거나, `ProviderBuildCtx`에서 `executionId`를 필수(`string`)로 승격하고 호출 지점을 정리한다.

- **[INFO]** `integrationsApi.list({ serviceType: ["mcp"] })` — 배열 필터 계약 미검증
  - 위치: `mcp-server-selector.tsx:43`
  - 상세: 프론트엔드가 `serviceType`을 배열로 전달한다. 이 파라미터 형태가 백엔드 `GET /integrations` 엔드포인트의 공식 계약에 포함되어 있는지 리뷰 범위 내 파일에서 확인이 안 된다.
  - 제안: 통합 API 스펙(OpenAPI 또는 컨트롤러)에서 `serviceType` 쿼리 파라미터가 배열을 허용하는지 확인하고, 단일 값만 지원하는 경우 `serviceType: "mcp"` 단건 필터로 교체한다.

- **[INFO]** `mcpServers`가 multi-turn 재개 상태(state)에 직렬화됨
  - 위치: `ai-agent.handler.ts` — `executeMultiTurnWait` 및 `processMultiTurnMessageInner`
  - 상세: 기존 DB에 저장된 multi-turn 재개 상태에는 `mcpServers` 키가 없다. 코드는 `(state.mcpServers as unknown[]) || []`로 안전하게 처리하므로 런타임 오류는 없으나, 진행 중인 이전 대화 세션에서 MCP 도구가 노출되지 않는 묵시적 동작 차이가 존재한다.
  - 제안: 마이그레이션 노트 또는 릴리스 노트에 "기존 multi-turn 세션은 MCP 도구 없이 재개된다"는 동작을 명시한다.

---

### 요약

이번 변경은 MCP 도구 통합을 AI Agent 노드에 추가하는 순수 확장이며, 기존 HTTP API 엔드포인트나 외부 클라이언트 계약에 직접적인 영향을 주지 않는다. 내부 모듈 계약(HandlerDependencies, AgentToolProvider) 관점에서는 새 필수 필드 추가로 인한 TypeScript 수준의 breaking change가 있고, 8자 SID 기반의 tool 이름 라우팅이 UUID 충돌 시 잘못된 서버로 요청을 라우팅할 수 있는 구조적 취약점이 있다. 나머지 변경은 모두 additive하고 optional 처리되어 하위 호환성이 잘 유지된다.

### 위험도
**LOW**