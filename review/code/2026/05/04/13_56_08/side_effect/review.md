## 발견사항

### [WARNING] `materializeServer`의 동시성 Race Condition
- **위치**: `mcp-tool-provider.ts` — `materializeServer()` 메서드
- **상세**: 동일 `executionId` + `integrationId` 쌍에 대해 `buildTools`가 동시에 두 번 호출될 경우, `sessions.get(ref.integrationId)`가 두 호출 모두에서 `undefined`를 반환하고 `openServer`가 두 번 실행된다. 첫 번째 세션은 `sessions.set`으로 덮어써져 orphan 상태가 되며, `cleanup`도 호출되지 않아 연결이 누수된다.
- **제안**:
  ```ts
  // openServer 호출 전, in-flight 프로미스를 캐시하는 Map 추가
  private readonly inflight = new Map<string, Promise<ServerEntry>>();
  ```
  또는 세션 키에 대해 `Promise`를 먼저 저장한 후 resolve하는 패턴으로 guard 처리.

---

### [WARNING] 기존 멀티턴 persisted state의 `executionId` 부재
- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()` (변경 후 outer wrapper)
- **상세**: DB에 이미 저장된 멀티턴 state에는 `executionId` 필드가 없다. `stateExecutionId`가 `undefined`이면 outer wrapper의 finally에서 cleanup이 스킵되지만, inner `buildTools` 호출은 `undefined` executionId로 진행된다. 이때 `executionKey(undefined)`는 `'__default__'`를 반환하므로, 동시에 실행 중인 다른 `undefined` executionId 실행과 세션 맵을 공유하게 된다.
- **제안**: 기존 state resume 시 `executionId`가 없으면 즉시 경고 로그를 남기고, `context.executionId` 같은 외부 값으로 보완하거나 명시적으로 `'legacy-<timestamp>'`식 폴백 키를 부여.

---

### [WARNING] `sessionsByExecution` 맵의 무제한 증가
- **위치**: `mcp-tool-provider.ts` — `McpToolProvider` 클래스 (인스턴스가 프로세스 수명 동안 공유됨)
- **상세**: `cleanup()`은 `finally` 블록에서 호출되지만, `cleanupProviders` 내부에서 개별 provider cleanup 실패는 삼켜진다(`Promise.allSettled` + `.catch`). 그러나 세션이 청소되더라도 맵에서 키가 삭제되므로 정상 경로에서는 문제없다. 단, 프로세스가 비정상 종료되거나 `BackgroundExecutionProcessor`에서 예외가 핸들러 `finally` 전에 propagate되면 `sessionsByExecution`에 dead entry가 잔류하며 외부 MCP 커넥션이 열린 채로 남는다.
- **제안**: 장기 운영 환경에서 세션 맵 크기를 `Logger`로 주기적으로 모니터링하거나, `OnModuleDestroy`에서 전체 세션 강제 close 로직 추가.

---

### [WARNING] `withTimeout`이 underlying Promise를 취소하지 않음
- **위치**: `mcp-tool-provider.ts` — `withTimeout()` 함수
- **상세**: 타임아웃이 발생해 `reject`가 호출된 후에도 원본 Promise는 계속 실행된다. `cleanup()`이 세션을 삭제한 뒤 지연된 `callTool` 응답이 도착하면 이미 삭제된 세션 객체를 통해 내부 상태를 건드릴 수 있다. 실질적 손상은 적지만 로그에 불필요한 경고가 출력되거나, 다음 실행의 `connect` 직후 이전 응답이 캐시된 세션에 충돌할 가능성이 있다.
- **제안**: Node.js `AbortController`를 SDK가 지원한다면 연동; 아니면 현재 동작을 주석으로 명시적으로 문서화.

---

### [INFO] 테스트 mock의 불완전성 — `McpClientService`
- **위치**: `execution-engine.service.spec.ts` (line 258~265)
- **상세**: mock에 `connect: jest.fn()` 하나만 정의되어 있다. 테스트 경로 중 `McpClientService`의 다른 메서드(예: `disconnect`, `isConnected` 등)가 호출되면 런타임에 `TypeError: ... is not a function`이 발생한다. 현재 테스트가 핸들러 실행을 직접 트리거하지 않는다면 문제없지만, 향후 테스트 확장 시 누락된 mock이 혼란을 일으킬 수 있다.
- **제안**: `McpClientService`의 공개 메서드 전체를 mock 오브젝트에 선언하거나 `jest.createMockFromModule` 사용.

---

### [INFO] 환경 변수 모듈 로드 시 고정
- **위치**: `mcp-tool-provider.ts` — 모듈 최상단 (line ~40~43)
- **상세**: `MCP_MAX_RESPONSE_BYTES`, `MCP_CALL_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`가 모듈 로드 시점에 평가된다. 런타임 중 환경 변수가 변경되어도 반영되지 않는다. 이는 의도된 설계이지만, 테스트 환경에서 각 spec 파일이 독립적으로 환경 변수를 설정할 경우 Jest 모듈 캐싱으로 인해 예상치 못한 값이 사용될 수 있다.
- **제안**: 테스트에서 이 상수를 덮어써야 한다면 `jest.resetModules()` + `jest.isolateModules()` 패턴 사용 또는 상수를 getter 함수로 래핑.

---

### [INFO] SID 충돌 가능성
- **위치**: `mcp-tool-provider.ts` — `shortIntegrationId()` / `findEntryBySid()`
- **상세**: UUID의 첫 8글자만 SID로 사용한다. UUID v4는 랜덤 기반이므로 실제 충돌 확률은 낮지만, 커스텀 ID(예: `00000001-...`, `00000002-...`)를 사용하는 환경에서는 같은 SID가 다른 서버를 가리켜 잘못된 세션이 조회될 수 있다.
- **제안**: SID 길이를 늘리거나, `findEntryBySid` 대신 `Map<integrationId, ...>` 직접 조회를 `execute` 경로에도 적용.

---

### [INFO] MCP Server Selector의 하드코딩된 limit
- **위치**: `mcp-server-selector.tsx` — `queryFn` (line ~44)
- **상세**: `limit: 100`이 고정값이라 워크스페이스에 MCP 통합이 100개를 초과하면 목록에 나타나지 않는다. 사용자에게 조용한 누락(silent omission)이 발생한다.
- **제안**: 커서 기반 페이지네이션 또는 검색 필터 추가. 적어도 응답에 `total > 100`이면 "추가 서버가 있습니다" 메시지 표시.

---

## 요약

이번 변경은 MCP 툴 프로바이더를 AI Agent 실행 파이프라인에 통합하는 것으로, 전반적인 설계는 `executionId` 기반 격리와 `finally` 블록 cleanup으로 잘 구성되어 있다. 다만 `materializeServer`의 동시성 race condition(같은 실행 내 동시 `buildTools`), 기존 persisted 멀티턴 state의 `executionId` 미보유로 인한 `__default__` 키 공유, 그리고 `withTimeout`이 underlying Promise를 중단시키지 않는 점이 실제 운영 환경에서 세션 누수나 교차 실행 오염을 유발할 수 있는 실질적 위험이다.

## 위험도

**MEDIUM**