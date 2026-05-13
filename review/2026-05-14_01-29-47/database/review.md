### 발견사항

- **[INFO]** 마이그레이션 무중단 안전성 확인
  - 위치: `V041__integration_oauth_state_provider_meta.sql`
  - 상세: `ALTER TABLE ... ADD COLUMN provider_meta JSONB NULL`은 PostgreSQL에서 metadata lock만 짧게 점유하며 테이블 리라이트를 수행하지 않습니다. nullable + default 없음 조합은 zero-downtime 배포 관점에서 안전합니다.
  - 제안: 해당 없음

- **[WARNING]** `provider_meta`에 `client_secret` 평문 저장
  - 위치: `V041__integration_oauth_state_provider_meta.sql`, `integration-oauth-state.entity.ts`
  - 상세: Private 앱 OAuth 흐름에서 `{ client_id, client_secret }`이 JSONB 컬럼에 평문으로 기록됩니다. TTL 10분, 콜백 시 DELETE-RETURNING으로 즉시 삭제되는 임시 저장소 설계이므로 노출 시간은 짧습니다. 그러나 DB 수준 컬럼 암호화(pgcrypto 등)나 애플리케이션 레벨 암호화 없이 `pg_dump`, 슬로우 쿼리 로그, 복제 스트림 등에서 평문 값이 노출될 수 있습니다.
  - 제안: `client_secret` 값을 저장 전에 AES-GCM 등으로 암호화하거나, TTL이 짧다는 것을 근거로 허용 리스크로 문서화하고 pg_audit 로그에서 `provider_meta` 컬럼이 제외되도록 설정하세요.

- **[WARNING]** 토큰 갱신 트랜잭션에 행 잠금(SELECT FOR UPDATE) 누락 가능성
  - 위치: `cafe24-api.client.ts`(diff 생략), `cafe24-api.client.spec.ts` 내 `dataSource.transaction` mock
  - 상세: 테스트 mock에서 `findOne` → `save` 패턴이 사용되는데, 프로덕션 구현에서 `findOne`에 `lock: { mode: 'pessimistic_write' }` 없이 트랜잭션만 감쌀 경우 멀티 인스턴스 배포 환경에서 두 요청이 동시에 stale 토큰을 읽고 각각 Cafe24 refresh 엔드포인트를 호출할 수 있습니다. Cafe24 refresh token은 일회성 사용이므로 두 번째 요청이 실패하고 integration이 `auth_failed` 상태로 전이될 위험이 있습니다. `__resetCafe24LocksForTesting` 존재는 인-메모리 락이 구현되어 있음을 시사하지만, 이는 단일 프로세스 내에서만 유효합니다.
  - 제안: 트랜잭션 내 `findOne` 호출에 `pessimistic_write` 락을 추가하거나(`SELECT ... FOR UPDATE`), 현재 인-메모리 락 설계가 단일 인스턴스 전제임을 아키텍처 문서에 명시하세요.

- **[INFO]** `provider_meta` 컬럼 인덱스 부재
  - 위치: `V041__integration_oauth_state_provider_meta.sql`
  - 상세: `provider_meta`는 state row 단건 조회(PK 또는 `state` 토큰 기반)에서 같이 읽히는 페이로드 컬럼입니다. 필터 조건으로 사용되지 않으므로 GIN 인덱스가 불필요합니다.
  - 제안: 해당 없음

- **[INFO]** OAuth state 원자적 소비(DELETE-RETURNING) 패턴 확인
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `dataSource.query.mockResolvedValueOnce([stateRecord])`
  - 상세: 콜백 핸들러가 raw SQL `DELETE ... RETURNING` 패턴으로 state row를 원자적으로 소비합니다. 이중 소비(replay attack) 방어가 올바르게 구현되어 있습니다.
  - 제안: 해당 없음

- **[INFO]** N+1 쿼리 위험 없음
  - 위치: `candidate-lookup.service.ts` `lookupMcpServers`
  - 상세: `serviceType: ['mcp', 'cafe24']` 확장이 단일 `findAll` 쿼리로 처리됩니다. 반복문 내 개별 쿼리 없음.
  - 제안: 해당 없음

---

### 요약

마이그레이션(`V041`)은 nullable JSONB 컬럼 추가로 PostgreSQL 무중단 배포 기준에 적합합니다. 핵심 위험은 두 가지입니다. 첫째, Private 앱 `client_secret`이 JSONB에 평문으로 10분간 저장되며 DB 감사 로그 등에서 노출 가능성이 있습니다. 둘째, 토큰 갱신 트랜잭션이 행 수준 락 없이 `findOne → save` 패턴을 쓸 경우 멀티 인스턴스 환경에서 refresh token 소모 경쟁이 발생할 수 있습니다. 나머지 변경사항(DTO 확장, 서비스 레지스트리, 메타데이터 테이블)은 데이터베이스 관점에서 별도 위험이 없습니다.

### 위험도
**MEDIUM**