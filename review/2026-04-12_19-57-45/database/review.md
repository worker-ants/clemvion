### 발견사항

- **[CRITICAL]** `DatabaseQueryHandler`가 매 실행마다 새 `pg.Client`를 생성하고 직접 연결
  - 위치: `database-query.handler.ts` — `execute()` 내 `new PgClient(...)` / `client.connect()`
  - 상세: 커넥션 풀 없이 매 노드 실행마다 TCP 핸드셰이크 + PostgreSQL 세션을 새로 열고 닫습니다. 고빈도 실행 시 커넥션 수가 DB 서버의 `max_connections` 한도를 초과할 수 있으며, 커넥션 설정 비용이 쿼리 자체보다 커질 수 있습니다.
  - 제안: `pg.Pool`을 사용하거나, `integrationId` → Pool 인스턴스를 캐싱하는 레지스트리를 만들어 커넥션을 재사용하세요. 최소한 `Pool`로 교체하고 `pool.connect()` → `client.query()` → `client.release()` 패턴으로 변경하세요.

- **[WARNING]** `connect()` 실패 시 `client.end()`가 호출되지 않을 수 있음
  - 위치: `database-query.handler.ts` — `await client.connect()` 바로 다음 `try` 블록
  - 상세: `client.connect()`가 예외를 던지면 외부 `catch`에서 `logUsage`만 호출하고 `client.end()`는 호출되지 않습니다. 연결 실패 상태의 `PgClient`에 `end()`를 호출해도 오류를 발생시키지 않으므로, 항상 `end()`를 보장하는 구조가 필요합니다.
  - 제안:
    ```ts
    await client.connect();
    try {
      // ... query
    } finally {
      await client.end();
    }
    ```
    를 외부 try의 안으로 옮기거나, connect 이후 즉시 `try/finally`로 감싸세요.

- **[WARNING]** `IntegrationUsageLog` 테이블에 대한 인덱스 확인 필요
  - 위치: `integration-handler-base.ts` — `logUsage()`, `integrations.service.ts` — `logUsage()`
  - 상세: `logUsage`가 `nodeExecutionId`, `workflowId`, `integrationId`를 기록하는데, 이 컬럼들에 대한 인덱스가 없으면 Activity 탭의 조회 쿼리(특히 `WHERE integrationId = ?` 또는 `WHERE workflowId = ?`)가 full scan이 됩니다. 변경된 파일에 마이그레이션이 포함되어 있지 않아 확인이 필요합니다.
  - 제안: `IntegrationUsageLog` 엔티티/마이그레이션에 `@Index('idx_usage_integration', ['integrationId'])`, `@Index('idx_usage_workflow', ['workflowId'])` 인덱스가 있는지 확인하세요.

- **[WARNING]** SQL 파라미터가 사용자 입력이므로 드라이버의 파라미터화 쿼리 의존 필수
  - 위치: `database-query.handler.ts` — `client.query(query, parameters)`
  - 상세: `query` 문자열 자체는 워크플로우 설정에서 오므로 신뢰 가능하지만, `parameters`는 런타임 expression 결과가 주입될 수 있습니다. `pg.Client.query(text, values)`는 서버 사이드 prepared statement를 사용하므로 SQL 인젝션은 차단됩니다. 단, `query` 문자열에 expression 결과가 직접 보간(interpolate)되는 경로가 생기면 즉시 취약점이 됩니다. 현재 구현은 안전하나, 향후 템플릿 쿼리 기능 추가 시 주의가 필요합니다.
  - 제안: 코드 리뷰 가이드라인에 "query 문자열에 expression 결과를 직접 삽입 금지" 원칙을 문서화하세요.

- **[INFO]** `getForExecution()`이 매번 DB 조회를 수행
  - 위치: `integrations.service.ts` — `getForExecution()` → `requireEntity()`
  - 상세: 동일한 execution 내에서 같은 `integrationId`가 여러 노드에서 참조되면, 각 노드마다 별도의 SELECT 쿼리가 발생합니다. 현재 규모에서는 문제가 없지만, 대형 워크플로우에서는 N+1에 준하는 패턴이 될 수 있습니다.
  - 제안: `ExecutionContext`에 integration 캐시를 두거나, execution 시작 시 필요한 integrations를 미리 batch 로드하는 방식을 고려하세요.

- **[INFO]** `integration.entity.ts`, `integration-oauth-state.entity.ts` 컬럼 정의 변경은 포맷팅만 해당
  - 위치: 두 엔티티 파일
  - 상세: `status_reason`, `integration_name` 컬럼의 TypeORM 데코레이터 포맷팅만 변경되었고 스키마 자체는 동일합니다. 마이그레이션 불필요.

---

### 요약

가장 큰 데이터베이스 위험은 `DatabaseQueryHandler`의 **커넥션 관리**입니다. 워크플로우 실행마다 외부 PostgreSQL에 새 커넥션을 생성/해제하는 패턴은 커넥션 고갈 및 성능 저하를 유발할 수 있으며, `connect()` 실패 시 `end()` 미호출 경로도 존재합니다. `pg.Pool` 도입이 필수적입니다. `IntegrationUsageLog` 조회 패턴에 대한 인덱스 존재 여부도 확인이 필요하며, 나머지 변경사항(SQL 파라미터화, 트랜잭션 설계, 엔티티 정의)은 적절하게 구현되어 있습니다.

### 위험도
**HIGH**