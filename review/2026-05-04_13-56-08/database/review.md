### 발견사항

- **[INFO]** 병렬 N 쿼리 패턴 — `getForExecution` 호출이 MCP 서버 수만큼 발생
  - 위치: `mcp-tool-provider.ts` `openServer()` → `buildTools()` 내 `Promise.allSettled`
  - 상세: 노드에 MCP 서버가 N개 설정되면 `integrationsService.getForExecution()` 이 N번 호출된다. `Promise.allSettled`로 병렬 실행하므로 순차 N+1보다 낫지만, 한 번의 `WHERE id IN (...)` 배치 쿼리로 대체 가능하다. 현재 실무 사용 규모(노드당 서버 수 소수)에서는 허용 범위이며, `executionId` 캐시 덕분에 같은 실행 내 2차 `buildTools` 호출 시엔 DB 재조회가 없다.
  - 제안: `IntegrationsService`에 `getMultipleForExecution(ids: string[], workspaceId: string)` 메서드를 추가하고 `WHERE id = ANY($1)` 단일 쿼리로 교체하면 더 깔끔해진다. 단, 현시점 우선순위는 낮다.

- **[INFO]** 프런트엔드 `limit: 100` 고정값
  - 위치: `mcp-server-selector.tsx` L44
  - 상세: `integrationsApi.list({ serviceType: ["mcp"], limit: 100 })` 로 고정 페이징. 워크스페이스에 MCP 서버가 100개를 초과하면 드롭다운에서 일부가 노출되지 않는다. 현실적으로 MCP 서버 수는 소수이므로 즉각적인 문제는 없으나 하드코딩이다.
  - 제안: 서버 단에서 `service_type='mcp'` 필터가 이미 범위를 좁혀주므로 실용상 문제는 없다. 한계값을 상수(`MCP_SERVER_LIST_LIMIT`)로 추출해 두면 나중에 수정하기 쉽다.

---

### 요약

이번 변경은 데이터베이스 스키마 변경(마이그레이션, 새 엔티티, 인덱스 추가)이 없고, SQL 인젝션 위험이나 트랜잭션 정합성 문제도 없다. DB 접근은 기존 `IntegrationsService.getForExecution()` 패턴을 재사용하는 것에 한정되며, MCP 세션 상태는 완전히 인메모리(`sessionsByExecution` Map)에서 관리된다. 실질적인 DB 위험 요소는 `buildTools` 초기 호출 시 MCP 서버 수만큼 발생하는 병렬 조회뿐이며, `executionId` 캐시로 반복 조회가 차단되어 있으므로 현 규모에서 허용 가능한 수준이다.

### 위험도
**LOW**