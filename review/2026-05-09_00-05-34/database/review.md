### 발견사항

---

**[WARNING] V035 마이그레이션: ALTER TABLE DROP COLUMN 의 AccessExclusiveLock**
- 위치: `V035__execution_node_log.sql` 마지막 라인 (`ALTER TABLE execution DROP COLUMN execution_path`)
- 상세: PostgreSQL 의 `ALTER TABLE DROP COLUMN` 은 `AccessExclusiveLock` 을 획득한다. 이 lock 은 모든 concurrent read/write 를 차단하며, lock 대기 중에는 신규 쿼리도 대기열에 쌓인다. 단일 트랜잭션 내에서 대용량 `INSERT ... SELECT` 가 선행하므로 실제 DDL 시점에 트랜잭션 duration 이 길 경우 서비스 중단이 발생할 수 있다. 마이그레이션 SQL 주석 스스로 V035a/V035b 분리를 언급하고 있으나, 실제로는 분리되지 않고 단일 파일로 배포되었다.
- 제안: 운영 DB 규모에 따라 V035a (CREATE TABLE + INSERT 이행) / V035b (DROP COLUMN, 이후 배포) 로 분리하거나, `SET lock_timeout = '3s';` 를 DROP 직전에 추가해 lock 대기가 길어지면 즉시 실패(롤백)시켜 서비스 영향을 제한한다.

---

**[WARNING] acquireLock 의 lock value 로 `process.pid` 사용**
- 위치: `continuation-bus.service.ts:acquireLock`
- 상세: 컨테이너 환경에서는 동일 PID (특히 `pid=1`) 를 여러 인스턴스가 공유할 수 있어 lock 소유자 식별이 모호해진다. 또한 lock 해제 API 가 없으므로 누가 lock 을 보유 중인지 점검할 방법이 없다.
- 제안: `${hostname()}_${process.pid}` 또는 모듈 초기화 시 생성한 UUID 를 lock value 로 사용한다. lock 반환 함수도 함께 제공하면 TTL 만료 전 조기 해제가 가능해진다.

---

**[WARNING] recoverStuckExecutions lock 이 TTL 내 완료를 보장하지 않음**
- 위치: `execution-engine.service.ts:recoverStuckExecutions`, TTL = 60s
- 상세: bulk UPDATE 가 60초를 초과하면 lock 이 만료되어 다른 인스턴스가 동시 UPDATE 를 실행할 수 있다. `started_at < now() - 30min` stale 임계값이 있으므로 실제 데이터 손상 가능성은 낮지만, 같은 row 에 대해 중복 FAIL UPDATE 가 발생할 수 있다.
- 제안: lock TTL 을 충분히 크게 설정하거나, 완료 후 `DEL key` 를 호출해 조기 반환하도록 한다. 또는 bulk UPDATE 의 `andWhere` 조건이 이미 atomic UPDATE 이므로 이중 UPDATE 가 benign 함을 주석으로 명시한다.

---

**[WARNING] INSERT ... SELECT ORDER BY 의 BIGSERIAL 부여 순서 의존**
- 위치: `V035__execution_node_log.sql`, INSERT 블록
- 상세: PostgreSQL 은 단일 트랜잭션 내 `INSERT ... SELECT ... ORDER BY` 에서 sequence 값을 ORDER BY 순서대로 부여하는 것이 **사실상(de facto)** 동작이지만, SQL 표준이나 PostgreSQL 공식 문서에 명시된 보장은 아니다. 실무에서는 문제가 없으나, 향후 PostgreSQL 버전 업그레이드 시 동작 변경 가능성이 있다.
- 제안: 이미 코멘트에 언급되어 있으므로 현 상태도 허용 가능. 추가로 `created_at` 컬럼에 ORDINALITY 기반 offset 을 더하는 방식(예: `NOW() + (p.ord * interval '1 microsecond')`)으로 created_at 으로도 순서를 복원할 수 있게 보강하면 이중 안전망이 된다.

---

**[INFO] executionPath 조회 시 select 와 order 컬럼 불일치**
- 위치: `executions.service.ts:findById`
  ```ts
  find({ where: { executionId: id }, order: { id: 'ASC' }, select: { nodeId: true } })
  ```
- 상세: `select: { nodeId: true }` 만 지정하면 TypeORM 생성 SQL 은 `SELECT node_id FROM ... ORDER BY id ASC` 가 된다. PostgreSQL 은 SELECT 목록에 없는 컬럼으로 ORDER BY 하는 것을 허용하므로 현재는 정상 동작한다. 그러나 TypeORM 버전이나 설정에 따라 `id` 가 SELECT 에 강제 포함되어 응답 객체에 노출될 수 있다.
- 제안: 별도 조치 불필요. 혹시 `id` 노출이 우려된다면 쿼리 결과에서 `id` 필드를 제거하는 `.map(r => r.nodeId)` 로직이 이미 적용되어 있으므로 안전하다.

---

**[INFO] Redis 연결 실패 시 모듈 초기화 무음 실패**
- 위치: `continuation-bus.service.ts:onModuleInit`
- 상세: `new Redis(...)` 는 비동기 연결을 시작하고, `subscribe` 는 연결이 완료되면 실행된다. Redis 가 비가용 상태일 경우 ioredis 는 내부적으로 재연결을 시도하지만, `onModuleInit` 은 에러 없이 완료되어 이후 `publish` / `subscribe` 가 실패할 때까지 문제를 인식하지 못한다.
- 제안: `lazyConnect: true` 설정 후 명시적 `.connect()` 와 오류 핸들링을 추가하거나, `error` 이벤트 리스너를 등록해 연결 불가 상태를 즉시 로깅/경보한다.

---

**[INFO] BIGSERIAL 컬럼 TypeScript string 타입**
- 위치: `execution-node-log.entity.ts:id`
- 상세: `bigint` → `string` 매핑은 JavaScript 정수 안전 범위(`Number.MAX_SAFE_INTEGER` = 2^53-1) 초과를 방지하는 TypeORM 표준 패턴으로 올바르다. ORDER BY 는 DB 레벨에서 수치 정렬되므로 문제없다.
- 제안: 현 구현 유지. 단, 이 `id` 값이 클라이언트 API 응답으로 노출될 경우 BigInt JSON 직렬화 이슈가 생길 수 있으니 노출 경로를 확인할 것.

---

### 요약

V035 마이그레이션은 `execution_path` 배열을 append-only `execution_node_log` 테이블로 전환하는 올바른 방향의 스키마 설계다. BIGSERIAL 기반 순서 보장, ON DELETE CASCADE, 복합 인덱스 선택 모두 적절하다. 다만 단일 트랜잭션 내 DDL (`ALTER TABLE DROP COLUMN`) 이 포함되어 운영 트래픽 하에서 AccessExclusiveLock 경합이 발생할 수 있으며, 이는 마이그레이션 주석에서 이미 인지하고 있으나 실제 분리가 이루어지지 않은 점이 가장 큰 위험 요소다. Continuation Bus 의 Redis SET NX 분산 lock 패턴 자체는 정확하지만, 컨테이너 환경에서의 PID 고유성 부재와 lock 반환 미구현이 보완이 필요한 부분이다.

### 위험도

**MEDIUM**