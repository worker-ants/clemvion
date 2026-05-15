### 발견사항

- **[WARNING]** `auth_type`에 `'none'` 추가 시 마이그레이션 누락 가능성
  - 위치: `spec/1-data-model.md` auth_type Enum 변경, `service-registry.ts` AuthType 타입 추가
  - 상세: `auth_type` 컬럼이 PostgreSQL native ENUM 타입으로 선언된 경우 `ALTER TYPE ... ADD VALUE 'none'` 마이그레이션이 필요하다. `spec/5-system/11-mcp-client.md §11`은 `service_type`(String)에 대해서만 "마이그레이션 불필요"를 명시하고, `auth_type` 변경에 대해서는 명시적 언급이 없다. 실제 TypeORM 엔티티 파일이 이번 diff에 포함되지 않아 컬럼의 실제 저장 방식(native enum vs varchar)을 확인할 수 없다.
  - 제안: `Integration` 엔티티 파일(`integration.entity.ts`)에서 `auth_type` 컬럼 선언을 확인한다. `@Column({ type: 'enum', ... })` 또는 native enum으로 선언된 경우 `ALTER TYPE auth_type_enum ADD VALUE 'none'` 마이그레이션을 추가해야 한다. PostgreSQL 12+에서는 해당 DDL이 테이블 lock을 걸지 않으므로 무중단 배포에 안전하나, 마이그레이션 파일 자체는 반드시 커밋되어야 한다.

- **[INFO]** `McpTestConnectionService`의 외부 HTTP 세션 lifecycle — DB 연결과 무관하나 참고
  - 위치: `mcp-test-connection.service.ts` `test()` 메서드 (connect → listTools → close 흐름)
  - 상세: 테스트 연결 중 `listTools()` 실패 시 `session.close()`를 호출한 뒤 즉시 반환하는 구조(`.catch(() => undefined)`로 close 오류 억제)는 올바르다. DB 커넥션과는 직접 관계없으나, 같은 패턴으로 `IntegrationUsageLog` 기록(spec §8.3) 구현 시 DB 쓰기 실패가 MCP 결과를 덮어쓰지 않도록 분리된 try-catch가 필요하다.
  - 제안: `IntegrationUsageLog` 삽입 로직이 추가될 Stage 2에서 `tools/call` 1회당 1 record 삽입을 별도 `try/catch`로 감싸 MCP 호출 자체의 결과에 영향을 주지 않도록 구현한다.

- **[INFO]** `credentials.cached_capabilities` JSONB 필드 — 신규 컬럼 없이 기존 JSONB에 쓰는 구조
  - 위치: `spec/5-system/11-mcp-client.md §3.3`
  - 상세: 스펙에 따르면 `Integration.credentials` JSONB 내에 `cached_capabilities` 키를 추가 저장한다고 명시되어 있다. 컬럼 추가 없이 기존 JSONB에 키를 추가하는 방식이므로 스키마 마이그레이션은 불필요하다. 단, 이 hint 값이 실행 시점에 재조회 결과로 덮어쓰이는 정책("hint일 뿐")이 코드 레벨에서도 일관하게 구현되어야 한다.
  - 제안: 현재 Stage 1에서는 구현이 없으나, Stage 2에서 `cached_capabilities` 쓰기 시 반드시 실행 시점 capabilities를 우선 조회하는 로직을 별도 guard로 명시한다.

---

### 요약

이번 변경의 핵심은 `@modelcontextprotocol/sdk` 의존성 추가와 `McpClientService` / `McpTestConnectionService` 구현으로, 기존 DB 스키마를 변경하지 않는 설계가 의도적으로 유지되었다. 마이그레이션 안전성 측면에서 `service_type`(String)은 명확히 무마이그레이션이나, `auth_type`에 `'none'`이 추가되는 점은 실제 엔티티의 컬럼 타입에 따라 마이그레이션이 필요할 수 있어 확인이 필요하다. 외부 MCP 세션의 lifecycle(connect/close)은 DB 연결 관리와 분리되어 있고 정상적으로 처리되며, N+1 쿼리·인덱스·트랜잭션 관점에서 이번 diff에 새로 도입된 문제는 없다.

### 위험도
**LOW**