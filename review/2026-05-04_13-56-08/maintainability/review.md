### 발견사항

- **[WARNING]** `shortIntegrationId` SID 충돌 가능성
  - 위치: `mcp-tool-provider.ts:96-98` (`shortIntegrationId` 함수)
  - 상세: UUID의 앞 8자만 추출해 SID로 사용한다. `aaaabbbb-0000-...`와 `aaaabbbb-1111-...`는 동일한 SID `aaaabbbb`를 만든다. `findEntryBySid`는 첫 번째 매치를 반환하므로, 두 MCP 서버가 같은 워크스페이스에 등록되어 ID 앞부분이 겹치면 tool_call이 잘못된 서버로 조용히 라우팅된다. 재현하기 어려운 종류의 버그다.
  - 제안: `sid`를 앞 8자 접두사 대신 전체 `integrationId`와 함께 `Map<integrationId, ServerEntry>`로 직접 조회하거나, `findEntryBySid`에 충돌 감지 로직(결과가 2개 이상이면 warn)을 추가한다. `sessionsByExecution`의 key가 이미 `integrationId`이므로 `parseMcpToolName`이 반환하는 `sid`와 `sessions.get(sid)` 대신 `[...sessions.values()].find(e => e.integrationId.startsWith(sid))` 방식은 그대로이나, 더 안전하게는 `mcpToolName`을 `integrationId` 전체 또는 SHA 기반 short hash로 전환한다.

- **[WARNING]** `patch` 함수 파라미터가 외부 함수명을 가림
  - 위치: `mcp-server-selector.tsx:77` — `function patch(integrationId: string, patch: Partial<McpServerRef>)`
  - 상세: 파라미터 이름이 함수 자신과 동일해 함수 내부에서 `patch`가 파라미터를 가리킨다. 재귀 호출은 없어서 런타임 오류는 없지만, 코드 리더가 `patch`를 읽을 때 함수인지 파라미터인지 문맥으로 구분해야 한다.
  - 제안: 파라미터를 `updates` 또는 `changes`로 변경한다.

- **[WARNING]** `executeMeta`가 단일 메서드에서 4종류의 메타 도구를 if-else로 처리
  - 위치: `mcp-tool-provider.ts:469-559`
  - 상세: 각 메타 도구(`list_resources`, `read_resource`, `list_prompts`, `get_prompt`)의 처리 로직이 단일 메서드 안에 중첩 없이 나열되어 있어 현재는 읽힌다. 그러나 메타 도구가 하나 늘 때마다 이 메서드가 커지며, 오류 처리(`catch` 블록)가 4개 케이스 전체를 감싸 어떤 케이스에서 예외가 발생했는지 로그만으로 알기 어렵다.
  - 제안: 각 케이스를 `executeListResources`, `executeReadResource` 등의 private 메서드로 분리해 `executeMeta`가 dispatch만 담당하게 한다. 오류 로깅에 케이스명이 이미 포함되어 있어(`meta` 변수) 큰 문제는 아니지만, 장기 유지보수를 위해 분리가 낫다.

- **[INFO]** `__default__` 매직 문자열
  - 위치: `mcp-tool-provider.ts:308` — `return id ?? '__default__';`
  - 상세: `executionId`가 없을 때 사용하는 폴백 키가 인라인 문자열이다. 모듈 상단의 상수들(`SID_LENGTH`, `SEP`, `PREFIX` 등)과 스타일이 맞지 않는다.
  - 제안: `const FALLBACK_EXECUTION_KEY = '__default__';`로 추출한다.

- **[INFO]** `withTimeout` 복제
  - 위치: `mcp-tool-provider.ts:134-150`
  - 상세: 주석이 복제 이유를 설명하고 있어 의도는 명확하다. 그러나 타임아웃 구현이 두 곳에 있으면 한쪽만 수정되는 drift가 생길 수 있다.
  - 제안: 공유 유틸리티(`backend/src/common/utils/with-timeout.ts`)로 추출해 두 소비자가 같은 구현을 참조하게 한다. 동작 분기가 필요해지면 그때 다시 분리한다.

- **[INFO]** `McpClientService` 목(mock)이 `connect`만 노출
  - 위치: `execution-engine.service.spec.ts:259-264`
  - 상세: `McpClientService`에 다른 public 메서드가 추가되더라도 이 목은 업데이트가 필요하다는 것을 인지하기 어렵다. 현재는 최소 목이 충분하지만 서비스 인터페이스 변경 시 조용히 무효화된다.
  - 제안: `jest.createMockFromModule` 또는 `createMock(McpClientService)` 패턴을 쓰거나, 최소 목임을 명시하는 주석을 남긴다.

- **[INFO]** 프론트엔드 쿼리의 하드코딩된 `limit: 100`
  - 위치: `mcp-server-selector.tsx:42`
  - 상세: 워크스페이스에 MCP 서버가 100개 이상일 때 무음 절단이 발생한다.
  - 제안: 상수로 추출하거나, 인지 가능한 페이지네이션을 추가한다. 현실적으로 100개 초과 사례가 없다면 주석으로 그 가정을 명시한다.

---

### 요약

전체적으로 코드는 책임 분리(`AgentToolProvider` 인터페이스 → `McpToolProvider` 구현), 오류 격리(`Promise.allSettled`), 라이프사이클 명시(`buildTools → execute → cleanup`), 세션 스코핑(`executionId` 단위 Map) 측면에서 유지보수성이 잘 설계되어 있다. 테스트 커버리지도 충분하다. 다만 `shortIntegrationId`의 SID 충돌 가능성은 다수 MCP 서버 환경에서 조용한 라우팅 오류로 이어질 수 있어 수정이 필요하다. `patch` 파라미터 섀도잉, `withTimeout` 복제, `__default__` 리터럴 등은 소규모 정리로 해결 가능한 수준이다.

### 위험도

**MEDIUM**