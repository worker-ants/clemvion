# 데이터베이스(Database) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 방법

`codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`(전체) · `webhook-endpoint-reservation.entity.ts`(전체) ·
`triggers.service.ts` predicate/`rethrowEndpointPathConflict` 영역 · `triggers.service.spec.ts` · `deletion-cascade-indexes.e2e-spec.ts` ·
`webhook-endpoint-reservation.e2e-spec.ts`(전체, 317줄) · `webhook-trigger.e2e-spec.ts` B7~B9 · `spec/1-data-model.md` §2.8.1을
diff 와 `Read`/`Grep` 으로 직접 대조했다. 저장소 파일은 수정하지 않았다(읽기만 수행).

## 발견사항

- **[INFO]** `CREATE TRIGGER ... ON trigger` 가 배포 중 `trigger` 테이블에 커밋까지 유지되는 쓰기 차단 구간을 만든다
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:65-69`(`CREATE TRIGGER trg_trigger_reserve_endpoint_path`), 백필은 같은 트랜잭션의 `:71-74`
  - 상세: `.conf` 파일이 없어(V132 와 달리) 이 마이그레이션은 파일 전체가 하나의 트랜잭션으로 실행된다. `CREATE TRIGGER` 는 대상 테이블(`trigger`)에 `SHARE ROW EXCLUSIVE` 를 커밋까지 보유해, 그 사이 웹훅 트리거 생성·수정·경로 변경 API 호출(`INSERT`/`UPDATE ON trigger`)이 큐에 세워진다. 파일 자체 주석(7~18행)이 이를 "백필과 트리거 사이로 새 경로가 빠져나갈 틈이 없게" 하려는 의도적 설계로 밝히고 있고, 백필은 `WHERE endpoint_path IS NOT NULL` 대상만 복사하는 단순 `INSERT ... SELECT`(V132 로 이미 전역 유일이라 충돌 없음)라 구간은 보통 짧다. `SELECT`(ACCESS SHARE)·수신 웹훅 라우팅은 이 lock 과 충돌하지 않는다.
  - 제안: 결함이 아니며 이미 CHANGELOG("배포 뒤 보일 수 있는 것")·마이그레이션 헤더 양쪽에 문서화돼 있다. 운영 배포 시 `trigger` 행수가 커진 시점이라면 저트래픽 구간 적용을 권장한다는 점만 배포 체크리스트에 남겨 둘 것.

- **[INFO]** 합성 제약 이름(`webhook_endpoint_reservation_owner`)이 실재 DB 오브젝트가 아니다
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:52-55`(`RAISE EXCEPTION ... USING CONSTRAINT = 'webhook_endpoint_reservation_owner'`), 소비 측 `codebase/backend/src/modules/triggers/triggers.service.ts` `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(라인 233~236 부근)
  - 상세: `webhook_endpoint_reservation` 테이블의 실제 제약은 PK(`endpoint_path`) 하나뿐이라, 이 이름은 트리거 함수가 `RAISE ... USING CONSTRAINT` 로 붙이는 라벨이다. `pg-error.ts` 의 `pgErrorConstraint()` 는 driver 가 채우는 `constraint` 필드를 그대로 읽으므로 동작은 정확하고(`webhook-endpoint-reservation.e2e-spec.ts` 가 `{ code: '23505', constraint: OWNER_LABEL }` 로 두 시나리오 모두 실측), 서비스 JSDoc 도 "실재 제약이 아니라 라벨" 이라고 정확히 서술한다. 다만 `\d webhook_endpoint_reservation` 로 실제 제약 목록을 조회하는 운영자는 이 이름을 찾지 못해 혼동할 수 있다.
  - 제안: 이미 알려진 사안(직전 라운드 INFO)이며 코드 동작 문제는 아니다. 트리거 함수 본문 주석에도 "실재 제약이 아니라 raise 라벨" 한 줄을 더하면(현재는 서비스 JSDoc 에만 있음) 향후 DBA 혼동을 더 줄인다.

- **[INFO]** `webhook_endpoint_reservation` 은 설계상 행을 절대 지우지 않는(append-only) 테이블 — 장기적으로 무한 증가
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:21-26`(`CREATE TABLE`), `spec/1-data-model.md:272`("예약은 지우지 않는다")
  - 상세: 트리거·워크스페이스가 지워져도 예약 행 자체는 남고(`workspace_id` 만 `NULL`), 앱에서 이 테이블을 지우는 경로가 전혀 없다. 이는 §2.8.1 Rationale 이 명시한 **영구** 보존이 목적인 의도된 설계라 결함은 아니다. 다만 순수 DB 관점에서 "대량 데이터" 축으로는, 웹훅 트리거 생성·경로 변경 빈도가 이례적으로 높아지는 워크로드에서는 이 테이블이 무기한 커진다. 조회는 전부 PK(`endpoint_path`) 단건 조회 또는 `workspace_id` partial 인덱스 조회뿐이라(둘 다 B-tree 로 스케일함) 행수 증가 자체가 쿼리 성능을 즉시 저하시키지는 않지만, 파티셔닝/아카이브 계획 없이 "영원히 보관" 이라는 점은 인지해 둘 가치가 있다.
  - 제안: 별도 조치 불요 — 사용자가 2026-09-19 명시적으로 "영구" 를 결정했고(§2.8.1), 현재 웹훅 트리거 생성 빈도로는 테이블 크기가 문제 될 규모에 이르기까지 오랜 시간이 걸린다. 참고 기록으로만 남긴다.

## 확인된 양호한 설계 (참고, 오탐 방지)

- **인덱스**: PK `(endpoint_path)` 가 예약 조회·소유권 판정·동시 신규 경로 경합 모두를 한 구조로 처리한다. `idx_webhook_endpoint_reservation_workspace_id` 는 `WHERE workspace_id IS NOT NULL` partial 로, FK `ON DELETE SET NULL` 훑기 방지 목적에 정확히 부합하고 주인 없는(대부분일 수 있는) 예약을 인덱스에서 제외해 크기를 줄인다. `deletion-cascade-indexes.e2e-spec.ts` 가 `indisvalid` 까지 포함해 정의를 실측 대조한다.
- **트랜잭션**: 마이그레이션 전체(`CREATE TABLE` → `CREATE INDEX` → `CREATE FUNCTION` → `CREATE TRIGGER` → 백필)가 단일 암묵적 트랜잭션이라 중간 상태(트리거만 있고 백필 안 된 상태)가 관측될 창이 없다. 예약 강제 로직(`INSERT ... ON CONFLICT DO NOTHING` + `SELECT`)도 호출 트랜잭션(트리거를 발동시킨 `INSERT`/`UPDATE ON trigger`) 안에서 원자적으로 실행돼, 예약 성공과 트리거 행 쓰기가 분리되지 않는다.
- **동시성**: 같은 새 경로를 두 트랜잭션이 동시에 잡을 때 PK 삽입이 승자를 가르고, 패자는 커밋 대기 후 재조회로 소유자 라벨 거부(23505/`webhook_endpoint_reservation_owner`) 또는(선행이 롤백하면) 자신이 주인이 된다 — `webhook-endpoint-reservation.e2e-spec.ts` 두 번째 `it` 가 `pg_stat_activity`(`wait_event_type = 'Lock'`)로 실제 잠금 대기 지점을 확인한 뒤 커밋/롤백 양쪽 분기를 모두 실측 검증한다(인터리빙 지점을 관측 없이 가정하지 않음). 두 연결(`first`/`second`)은 `finally` 에서 반드시 `end()` 되고, 픽스처(워크스페이스·사용자)도 정리돼 커넥션·데이터 누수가 없다.
- **커넥션 관리**: e2e 파일들의 `pg.Client` 는 `beforeAll`/`afterAll` 또는 `try/finally` 로 정확히 짝을 맞춰 연결·해제한다(누수 없음, `webhook-endpoint-reservation.e2e-spec.ts` 전체 확인).
- **SQL 인젝션**: 마이그레이션은 정적 DDL/DML 뿐이고 사용자 입력을 문자열로 결합하지 않는다. 애플리케이션 계층은 이 테이블에 대해 별도 read/write 코드를 두지 않는다(강제는 전적으로 DB 트리거). e2e 의 raw SQL 도 전부 파라미터 바인딩(`$1, $2...`)을 사용한다.
- **N+1**: 해당 없음 — 강제 로직이 앱 반복문이 아니라 행 단위 BEFORE 트리거로 구현돼 트리거 CRUD 경로마다 정확히 한 번의 INSERT+SELECT(같은 경로 재사용 시엔 그마저도 스킵되지 않지만 O(1))만 추가된다.
- **대량 데이터(백필)**: `INSERT ... SELECT FROM trigger WHERE endpoint_path IS NOT NULL` 은 V132 의 partial UNIQUE 인덱스 대상 부분집합만 다뤄, 트리거 테이블 규모(관찰된 워크로드 기준 수만 건)에서도 부담이 적다. 이미 전역 유일이 보장된 값이라 PK 충돌도 없다.
- **스키마 설계**: 소유권 이력을 `trigger` 행에 얹지 않고 별도 테이블로 분리한 것은 "트리거를 지워도/재사용해도 예약은 독립적으로 산다" 는 요구를 정확히 반영한 정규화 — soft-delete 컬럼을 `trigger` 에 추가하는 대안보다 책임이 분명하다. `WebhookEndpointReservation` 엔티티의 컬럼 타입(`varchar(255)`, `uuid` nullable, `timestamptz`)이 DDL 과 정확히 일치.

## 요약

새 테이블 `webhook_endpoint_reservation` 과 이를 강제하는 DB 트리거(V133)는 트랜잭션 원자성·동시성 제어(실측된 잠금 대기 지점 기반 e2e 포함)·인덱스 설계·스키마 정규화·커넥션 관리 면에서 모두 견고하다. CRITICAL·WARNING 급 결함은 없다. 짚을 지점은 셋 다 INFO 수준이며 전부 이미 알려졌거나 트레이드오프로 문서화돼 있다 — (1) `CREATE TRIGGER` 가 배포 중 `trigger` 테이블에 짧은 쓰기 차단 구간을 만든다(의도적, 문서화됨), (2) 합성 제약 이름이 실재 DB 오브젝트가 아니다(동작엔 문제 없음), (3) 예약 테이블이 설계상 영구 append-only 라 장기적으로 무한 증가한다(사용자가 명시적으로 "영구"를 결정한 트레이드오프, 현재 워크로드에서 성능 영향 없음). 이번 라운드의 신규 e2e(동시 경합 커밋/롤백 분기)는 예약 로직의 DB 동시성 보장을 정확히 실측한다.

## 위험도

LOW
