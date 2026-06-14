# Database Review

## 발견사항

- **[INFO]** `execution` 테이블 `started_at` 컬럼에 대한 인덱스 부재 가능성
  - 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` + `auth-configs.service.ts` 기간별 집계 쿼리
  - 상세: `getUsage` 의 기간별 집계 쿼리(`COUNT(*) FILTER (WHERE e.started_at >= :sinceXX)`)는 `trigger_id IN (...)` 필터와 `started_at` 범위 조건을 조합한다. `trigger_id` 단독 인덱스는 있을 수 있으나 `(trigger_id, started_at)` 복합 인덱스가 없으면 대용량 `execution` 테이블에서 범위 스캔 비용이 증가한다. V096 마이그레이션은 두 신규 컬럼을 추가하면서 해당 인덱스를 생성하지 않는다.
  - 제안: `trigger_id` 카디널리티와 실제 `execution` 규모를 확인 후, 필요시 별도 마이그레이션으로 `CREATE INDEX CONCURRENTLY idx_execution_trigger_started ON execution (trigger_id, started_at DESC);` 추가를 검토한다.

- **[INFO]** 기간별 집계와 `totalCalls` 조회가 별도 쿼리 2회 발행
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (기간 집계 쿼리 + `getCount()` 쿼리)
  - 상세: `totalCalls` 는 `getCount()` 로, 기간별 카운트는 `getRawOne()` 로 두 번 분리 조회한다. 두 쿼리 모두 동일한 `WHERE trigger_id IN (...)` 필터를 공유하므로 단일 `SELECT COUNT(*), COUNT(*) FILTER (...) ...` 쿼리로 병합 가능하다. 현재 구조는 기능상 문제없고 `recentCalls` 포함 총 3회 쿼리인데, 이미 `USAGE_RECENT_CALLS_LIMIT=20` 으로 최근 건만 제한하므로 성능 위험 수준은 낮다.
  - 제안: 향후 최적화 시 `COUNT(*) AS total, COUNT(*) FILTER (WHERE e.started_at >= :since24h) AS last24h ...` 단일 쿼리로 병합 가능.

- **[INFO]** 마이그레이션 안전성 — LOCK 없는 안전한 `ADD COLUMN`
  - 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
  - 상세: PostgreSQL 에서 `ALTER TABLE ... ADD COLUMN ... NULL` (default 없음 또는 상수 default) 은 행 재작성을 유발하지 않으며 짧은 `ACCESS EXCLUSIVE LOCK` 으로 완료된다. 두 컬럼 모두 `NULL` default 이므로 무중단 배포 안전하다. DOWN 스크립트가 주석으로 포함되어 있어 롤백 가이드도 제공된다.
  - 제안: 없음. 현재 방식 적절.

- **[INFO]** `response_code VARCHAR(10)` 타입 선택 적절성
  - 위치: `V096` 마이그레이션, `execution.entity.ts`
  - 상세: HTTP 응답 코드를 문자열로 저장하는 설계 선택(정수가 아닌 varchar)은 spec 주석에 의도가 명시되어 있다('202' 문자열, 비-HTTP 트리거는 status enum 폴백). 10자는 충분하나, 비-HTTP 트리거 폴백 값이 status enum 문자열(`'completed'`, `'failed'` 등 최대 19자 — `waiting_for_input`)임을 감안하면 LENGTH=10 이 폴백 값을 잘라낼 수 있다. 단, 서비스 코드를 보면 `response_code` 컬럼에는 실제 HTTP 코드('202' 등)만 저장하고, 폴백(`e.responseCode ?? e.status`)은 API 응답 매핑 계층에서만 발생한다. 따라서 DB 저장 값 자체는 10자를 초과하지 않는다.
  - 제안: 없음. 구현 흐름 확인 결과 DB 에는 HTTP 코드 문자열만 저장되므로 VARCHAR(10) 충분.

## 요약

V096 마이그레이션은 `execution` 테이블에 nullable 컬럼 2개(`source_ip VARCHAR(45)`, `response_code VARCHAR(10)`)를 추가하는 안전한 스키마 변경이다. PostgreSQL ADD COLUMN NULL 은 행 재작성 없이 단기 락으로 완료되어 무중단 배포에 적합하다. 기간별 집계 쿼리는 `trigger_id IN (...)` + `started_at` 범위 조건을 사용하는데, 대용량 `execution` 테이블에서 `(trigger_id, started_at)` 복합 인덱스 부재 시 성능 저하 가능성이 있으나 현재 `recentCalls` 20건 제한 등 부하 통제 장치가 있어 즉각적 위험은 낮다. SQL 인젝션은 TypeORM QueryBuilder 파라미터 바인딩(`:triggerIds`, `:since24h` 등)으로 방지되어 있다. N+1 문제 없음, 트랜잭션 불필요(단순 INSERT + SELECT), 커넥션 관리는 NestJS TypeORM DI 패턴 준수.

## 위험도

LOW
