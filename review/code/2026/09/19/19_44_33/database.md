# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `CREATE TRIGGER` 가 기존 `trigger` 테이블에 짧지만 실재하는 쓰기 차단 구간을 만든다
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:58-62` (`CREATE TRIGGER trg_trigger_reserve_endpoint_path ... ON trigger`), 백필은 같은 트랜잭션의 `:64-67`
  - 상세: 이 마이그레이션에는 `.conf` 파일이 없어(V132 와 달리) Flyway 기본값대로 파일 전체가 **하나의 트랜잭션**으로 실행된다. `CREATE TRIGGER ... ON trigger` 는 대상 테이블에 `SHARE ROW EXCLUSIVE` 를 커밋까지 보유하며, 이는 해당 트랜잭션이 끝날 때까지 `trigger` 테이블에 대한 `INSERT`/`UPDATE`(ROW EXCLUSIVE 를 요구하는 모든 쓰기)를 큐에 세운다 — 즉 배포 중 웹훅 트리거 생성·수정·경로 변경 API 호출이 마이그레이션 완료까지 잠시 블록될 수 있다. 파일 자체 주석(7~18행)이 이 lock 을 "백필과 트리거 사이로 새 경로가 빠져나갈 틈이 없게" 의도적으로 설계했다고 밝히고 있고, 백필은 단순 `INSERT ... SELECT`(V132 인덱스로 빠르게 스캔 가능)라 구간은 보통 밀리초~수백 ms 수준으로 짧을 것으로 보인다. `SELECT`(ACCESS SHARE)는 이 lock 과 충돌하지 않으므로 웹훅 수신(`/api/hooks/:endpointPath`)이나 목록 조회는 영향받지 않는다.
  - 제안: 결함은 아니며 트레이드오프가 이미 명시적으로 문서화돼 있다 — 다만 운영 배포 시 `trigger` 테이블 행수가 커진 시점에 이 파일을 다시 돌릴 계획이 있다면(예: 재배포·리플레이) 저트래픽 구간에서 적용하는 것을 권장한다는 점만 배포 체크리스트에 남겨두면 좋다.

- **[INFO]** 합성 제약 이름(`webhook_endpoint_reservation_owner`)이 실재 DB 오브젝트가 아님 — 이미 알려진 사실이나 DB 관점에서 재확인
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:48-50` (`RAISE EXCEPTION ... USING CONSTRAINT = 'webhook_endpoint_reservation_owner'`), 소비 측 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(그 부근)
  - 상세: `webhook_endpoint_reservation` 테이블의 유일한 제약은 PK(`endpoint_path`)뿐이라, 이 이름은 실제 UNIQUE/CHECK 제약이 아니라 트리거 함수가 raise 시 붙이는 라벨이다. `codebase/backend/src/common/db/pg-error.ts` 의 `pgErrorConstraint()` 가 `err.constraint`/`err.driverError.constraint` 를 그대로 읽으므로, Postgres `RAISE ... USING CONSTRAINT` 가 채우는 `constraint_name` 필드를 정확히 흡수해 동작 자체는 맞다(e2e `webhook-endpoint-reservation.e2e-spec.ts` 가 `{ code: '23505', constraint: OWNER_LABEL }` 로 실측 검증). 다만 `\d webhook_endpoint_reservation` 등으로 실제 제약 목록을 조회하는 운영자는 이 이름을 찾지 못해 혼동할 수 있다(consistency-check INFO#5 와 동일 지적).
  - 제안: 이미 리뷰된 사안이며 코드 동작에는 문제가 없다. 트리거 함수 주석에 "실재 제약이 아니라 raise 라벨" 이라는 한 줄이 있으면 향후 DBA/운영자의 혼동을 줄인다(주석은 서비스 코드 JSDoc 에는 이미 있음 — 함수 자체에도 있으면 더 낫다).

## 확인된 양호한 설계 (참고)

- **트랜잭션 원자성**: `CREATE TABLE` → `CREATE INDEX`(신규 빈 테이블이라 lock 문제 없음) → `CREATE FUNCTION` → `CREATE TRIGGER` → 백필이 한 트랜잭션으로 묶여 있어, 백필이 V132 로 이미 보장된 전역 유일성에 기대는 것과 함께 중간 상태(트리거만 있고 백필이 안 된 상태)가 관측될 창이 없다.
- **동시성 제어**: 트리거 함수가 `INSERT ... ON CONFLICT (endpoint_path) DO NOTHING` 뒤 `SELECT ... FOR` 없이 같은 트랜잭션 내 순차 조회로 소유자를 판별 — PK 하나가 동시 요청의 승자를 결정하고, 패자는 자연히 대기 후 재확인된다. e2e(`webhook-endpoint-reservation.e2e-spec.ts`)가 지운/바꾼/이관 시나리오를 SAVEPOINT 로 실측.
- **인덱스**: `idx_webhook_endpoint_reservation_workspace_id` 는 `WHERE workspace_id IS NOT NULL` partial 로, FK `ON DELETE SET NULL` 이 이 테이블을 훑지 않게 하는 목적에 정확히 부합하고 불필요한 인덱스 크기 증가(대부분 orphan 예약이 NULL 이 될 수 있음)를 피한다. `deletion-cascade-indexes.e2e-spec.ts` 가 인덱스 정의(`indisvalid` 포함)를 그대로 대조 검증.
- **스키마 선언 일치**: `WebhookEndpointReservation` 엔티티의 컬럼 타입(`varchar(255)`, `uuid` nullable, `timestamptz`)이 마이그레이션 DDL 과 정확히 일치 — 최근 커밋(`6f9c0f1c1`)에서 아홉 곳의 선언-DB 불일치를 고친 직후라 이 신규 엔티티가 같은 종류의 결함을 반복하지 않았는지 대조했고 문제 없음.
- **SQL 인젝션**: 신규 코드 경로에 사용자 입력을 문자열로 결합하는 raw SQL이 없다 — 마이그레이션은 정적 DDL/DML 뿐이고, 애플리케이션 계층은 이 테이블에 대해 별도 읽기/쓰기 코드를 두지 않는다(강제는 전적으로 DB 트리거).
- **N+1**: 해당 없음 — 강제 로직이 앱 반복문이 아니라 DB 트리거(행 단위 BEFORE 트리거)로 구현됨.
- **대량 데이터**: 백필 `INSERT ... SELECT FROM trigger WHERE endpoint_path IS NOT NULL` 은 V132 의 partial UNIQUE 인덱스를 스캔 대상으로 활용할 수 있어 트리거 테이블 규모(수만 건)에서도 부담이 적다. B9 e2e 의 orphan 정합성 체크(`LEFT JOIN`)도 같은 이유로 부담 없는 규모.

## 요약

새 테이블 `webhook_endpoint_reservation` 과 이를 강제하는 DB 트리거(V133)는 트랜잭션 원자성·동시성 제어·인덱스 설계·엔티티-DDL 정합성 면에서 모두 견고하며, 전용 e2e(스키마 복제 + ROLLBACK 패턴)로 백필·거부·소유권 이전·워크스페이스 삭제 시나리오를 실측 검증했다. 유일하게 짚을 지점은 (1) `CREATE TRIGGER` 가 기존 `trigger` 테이블에 커밋까지 유지되는 `SHARE ROW EXCLUSIVE` 를 걸어 배포 중 짧은 쓰기 차단 구간을 만든다는 점(의도적 설계, 이미 문서화됨)과 (2) 합성 제약 이름이 실재 DB 오브젝트가 아니라는 점(이미 알려진 INFO, 동작에는 문제 없음)이다. 둘 다 CRITICAL/WARNING 급이 아니며 코드 자체를 막을 이유가 없다.

## 위험도

LOW
